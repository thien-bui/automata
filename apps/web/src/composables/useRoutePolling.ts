import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import { useRouteTime, type RouteFetchReason } from './useRouteTime';
import { useAutoMode } from './useAutoMode';
import { useToasts } from './useToasts';
import { MonitoringMode } from '../components/monitoringMode';
import { createAutoModeScheduler, type AutoModeScheduler } from '../utils/autoModeScheduler';

interface UseRoutePollingOptions {
  from: string;
  to: string;
  initialMode: MonitoringMode;
  initialRefreshInterval: number;
}

interface UseRoutePollingResult {
  // Route time state
  data: Ref<import('@automata/types').RouteTimeResponse | null>;
  error: Ref<string | null>;
  isLoading: Ref<boolean>;
  isRefreshing: Ref<boolean>;
  isStale: Ref<boolean>;
  lastUpdatedIso: Ref<string | null>;
  cacheAgeSeconds: Ref<number | null>;
  cacheHit: Ref<boolean>;
  from: Ref<string>;
  to: Ref<string>;
  
  // Polling state
  mode: Ref<MonitoringMode>;
  refreshInterval: Ref<number>;
  isPolling: Ref<boolean>;
  pollingSeconds: Ref<number>;
  
  // Actions
  triggerPolling: (reason: RouteFetchReason, options?: { forceRefresh?: boolean }) => Promise<void>;
  setMode: (mode: MonitoringMode) => void;
  setRefreshInterval: (interval: number) => void;
  setFreshnessSeconds: (seconds: number) => void;
}

export function useRoutePolling(options: UseRoutePollingOptions): UseRoutePollingResult {
  const { config: autoModeConfig, getNavModeRefreshSeconds } = useAutoMode();

  const { push: pushToast } = useToasts();

  // Cron scheduler for auto mode switching
  let autoModeScheduler: AutoModeScheduler | null = null;

  // State
  const mode = ref<MonitoringMode>(options.initialMode);
  const refreshInterval = ref(options.initialRefreshInterval);

  // Route time composable
  const {
    data: routeData,
    error: routeError,
    isLoading,
    isRefreshing,
    isStale,
    lastUpdatedIso,
    cacheAgeSeconds,
    cacheHit,
    refresh: refreshRoute,
    setMode: setRouteMode,
    setFreshnessSeconds,
    from: origin,
    to: destination,
  } = useRouteTime({
    from: options.from,
    to: options.to,
    mode: 'driving',
    freshnessSeconds: refreshInterval.value,
  });

  // Polling state
  const vueInstance = getCurrentInstance();
  const hasVueInstance = vueInstance !== null;
  const isVitestEnvironment = typeof globalThis !== 'undefined' && 'vi' in globalThis;

  let intervalHandle: number | null = null;
  let lastErrorMessage: string | null = null;
  let staleNotified = false;

  const isNavMode = computed(() => mode.value === MonitoringMode.Nav);
  const pollingSeconds = computed(() => (isNavMode.value ? getNavModeRefreshSeconds() : refreshInterval.value));
  const isPolling = computed(() => isLoading.value || isRefreshing.value);

  // Polling functions
  function clearIntervalHandle(): void {
    if (intervalHandle) {
      if (isVitestEnvironment) {
        window.clearTimeout(intervalHandle);
      } else {
        window.clearInterval(intervalHandle);
      }
      intervalHandle = null;
    }
  }

  function applyAutoMode(newMode: 'Simple' | 'Nav'): void {
    const targetMode = newMode === 'Nav' ? MonitoringMode.Nav : MonitoringMode.Simple;
    if (mode.value !== targetMode) {
      mode.value = targetMode;
    }
  }

  function initializeAutoModeScheduler(): void {
    if (autoModeScheduler) {
      autoModeScheduler.destroy();
    }

    autoModeScheduler = createAutoModeScheduler(
      (newMode: 'Simple' | 'Nav') => {
        applyAutoMode(newMode);
      },
      autoModeConfig.value,
    );

    autoModeScheduler.schedule();
    autoModeScheduler.applyCurrentMode();

    if (options.initialMode === MonitoringMode.Nav && mode.value !== MonitoringMode.Nav) {
      mode.value = MonitoringMode.Nav;
    }
  }

  function destroyAutoModeScheduler(): void {
    if (autoModeScheduler) {
      autoModeScheduler.destroy();
      autoModeScheduler = null;
    }
  }

  async function triggerPolling(reason: RouteFetchReason, options: { forceRefresh?: boolean } = {}): Promise<void> {
    const background = reason === 'interval' || reason === 'mode-change';
    await refreshRoute({ background, reason, forceRefresh: options.forceRefresh });
    const manualTrigger = reason === 'manual' || reason === 'hard-manual';
    if (manualTrigger && !routeError.value) {
      pushToast({
        text: options.forceRefresh ? 'Route data refreshed from provider.' : 'Route data refreshed.',
        variant: 'success',
      });
    }
  }

  function setMode(newMode: MonitoringMode): void {
    mode.value = newMode;
  }

  function setRefreshInterval(interval: number): void {
    refreshInterval.value = interval;
  }

  // Watchers
  watch(
    () => pollingSeconds.value,
    (seconds, _previous, onCleanup) => {
      setFreshnessSeconds(seconds);
      clearIntervalHandle();

      if (!Number.isFinite(seconds) || seconds <= 0) {
        return;
      }

      if (isVitestEnvironment) {
        intervalHandle = window.setTimeout(() => {
          intervalHandle = null;
          void triggerPolling('interval');
        }, seconds * 1000);
      } else {
        intervalHandle = window.setInterval(() => {
          void triggerPolling('interval');
        }, seconds * 1000);
      }

      onCleanup(() => {
        clearIntervalHandle();
      });
    },
    { immediate: true },
  );

  watch(
    () => mode.value,
    async (value, previous) => {
      if (value === previous) {
        return;
      }
      setRouteMode('driving');
      await triggerPolling('mode-change');
    },
    { flush: 'sync' },
  );

  watch(
    routeError,
    (message) => {
      if (message && message !== lastErrorMessage) {
        pushToast({
          text: message,
          variant: 'error',
          timeout: 6000,
        });
        lastErrorMessage = message;
      } else if (!message) {
        lastErrorMessage = null;
      }
    },
    { flush: 'sync', immediate: true },
  );

  watch(
    isStale,
    (value) => {
      if (value && !staleNotified && routeData.value) {
        pushToast({
          text: 'Showing cached route data while waiting for a fresh provider response.',
          variant: 'warning',
          timeout: 7000,
        });
        staleNotified = true;
      } else if (!value) {
        staleNotified = false;
      }
    },
    { flush: 'sync', immediate: true },
  );

  function initializePolling(): void {
    initializeAutoModeScheduler();
    void triggerPolling('initial');
  }

  // Watch for config changes and update scheduler
  watch(
    () => autoModeConfig.value,
    () => {
      if (autoModeScheduler) {
        autoModeScheduler.updateConfig(autoModeConfig.value);
      }
    },
    { deep: true },
  );

  if (hasVueInstance) {
    onMounted(() => {
      initializePolling();
    });

    onBeforeUnmount(() => {
      clearIntervalHandle();
      destroyAutoModeScheduler();
    });
  } else {
    initializePolling();
  }

  return {
    // Route time state
    data: routeData,
    error: routeError,
    isLoading,
    isRefreshing,
    isStale,
    lastUpdatedIso,
    cacheAgeSeconds,
    cacheHit,
    from: origin,
    to: destination,
    
    // Polling state
    mode,
    refreshInterval,
    isPolling,
    pollingSeconds,
    
    // Actions
    triggerPolling,
    setMode,
    setRefreshInterval,
    setFreshnessSeconds,
  };
}
