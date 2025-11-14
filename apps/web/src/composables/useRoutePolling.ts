import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import { useRouteTime, type RouteFetchReason } from './useRouteTime';
import { useAutoMode } from './useAutoMode';
import { useToasts } from './useToasts';
import { MonitoringMode } from '../components/monitoringMode';

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

  // Server-side scheduler event IDs
  let autoModeSchedulerEventId: string | null = null;
  let pollingSchedulerEventId: string | null = null;

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

  function applyAutoMode(newMode: 'Compact' | 'Nav'): void {
    const targetMode = newMode === 'Nav' ? MonitoringMode.Nav : MonitoringMode.Compact;
    if (mode.value !== targetMode) {
      mode.value = targetMode;
    }
  }

  async function initializeAutoModeScheduler(): Promise<void> {
    // Cancel existing scheduler event if any
    if (autoModeSchedulerEventId) {
      try {
        await fetch(`/api/scheduler/events/${autoModeSchedulerEventId}`, {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json',
          },
        });
        autoModeSchedulerEventId = null;
      } catch (error) {
        console.warn('Failed to cancel existing auto-mode scheduler event:', error);
      }
    }

    if (autoModeConfig.value?.enabled) {
      try {
        // Schedule auto-mode switching on the server
        const response = await fetch('/api/scheduler/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            taskType: 'auto-mode-switch',
            scheduleExpression: 'cron:0 * * * *', // Check every hour
            isRecurring: true,
            payload: {
              config: autoModeConfig.value,
            },
          }),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        autoModeSchedulerEventId = data.eventId;
        
        // Apply current mode immediately
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.getDay();
        
        // Simple logic to determine current mode based on config
        let currentMode: 'Compact' | 'Nav' = autoModeConfig.value.defaultMode;
        
        for (const window of autoModeConfig.value.timeWindows) {
          const startHour = window.startTime.hour;
          const endHour = window.endTime.hour;
          
          if (currentHour >= startHour && currentHour < endHour && 
              window.daysOfWeek.includes(currentDay)) {
            currentMode = window.mode;
            break;
          }
        }
        
        applyAutoMode(currentMode);
        
        if (options.initialMode === MonitoringMode.Nav && mode.value !== MonitoringMode.Nav) {
          mode.value = MonitoringMode.Nav;
        }
      } catch (error) {
        console.error('Failed to initialize auto-mode scheduler:', error);
        // Server-side scheduling is now required, no fallback to client-side
        pushToast({
          text: 'Failed to initialize auto-mode scheduling. Please check server configuration.',
          variant: 'error',
          timeout: 5000,
        });
      }
    }
  }

  async function destroyAutoModeScheduler(): Promise<void> {
    if (autoModeSchedulerEventId) {
      try {
        await fetch(`/api/scheduler/events/${autoModeSchedulerEventId}`, {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json',
          },
        });
        autoModeSchedulerEventId = null;
      } catch (error) {
        console.warn('Failed to cancel auto-mode scheduler event:', error);
      }
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

  async function initializePolling(): Promise<void> {
    await initializeAutoModeScheduler();
    void triggerPolling('initial');
  }

  // Watch for config changes and update scheduler
  watch(
    () => autoModeConfig.value,
    async () => {
      if (autoModeConfig.value) {
        await initializeAutoModeScheduler();
      }
    },
    { deep: true },
  );

  if (hasVueInstance) {
    onMounted(async () => {
      await initializePolling();
    });

    onBeforeUnmount(async () => {
      clearIntervalHandle();
      await destroyAutoModeScheduler();
    });
  } else {
    void initializePolling();
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
