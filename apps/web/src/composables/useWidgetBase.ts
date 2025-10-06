import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue';
import { useToasts } from './useToasts';

export type BaseFetchReason = 'initial' | 'interval' | 'manual' | 'hard-manual';

const defaultFreshnessSeconds = Number(import.meta.env.VITE_DEFAULT_FRESHNESS ?? '300');

interface UseWidgetBaseOptions {
  freshnessSeconds?: number;
  errorTitle?: string;
  successMessage?: string;
  hardRefreshSuccessMessage?: string;
  staleWarningMessage?: string;
}

interface RefreshOptions {
  background?: boolean;
  reason?: BaseFetchReason;
  forceRefresh?: boolean;
}

interface RefreshFunction {
  (options: RefreshOptions): Promise<void>;
}

interface UseWidgetBaseResult {
  isPolling: ComputedRef<boolean>;
  pollingSeconds: Ref<number>;
  statusText: ComputedRef<string>;
  progressValue: ComputedRef<number | undefined>;
  lastErrorMessage: Ref<string | null>;
  staleNotified: Ref<boolean>;
  
  // Methods
  triggerPolling: (reason: BaseFetchReason, options?: { forceRefresh?: boolean }) => Promise<void>;
  setupPolling: (
    refreshFn: RefreshFunction,
    pollingSecondsRef: Ref<number>
  ) => void;
  cleanupPolling: () => void;
  watchForErrors: (errorRef: Ref<string | null>) => void;
  watchForStaleData: (isStaleRef: ComputedRef<boolean>, hasDataRef: ComputedRef<boolean>) => void;
}

export function useWidgetBase(options: UseWidgetBaseOptions = {}): UseWidgetBaseResult {
  const {
    freshnessSeconds: defaultFreshness = defaultFreshnessSeconds,
    errorTitle = 'Error',
    successMessage = 'Data refreshed.',
    hardRefreshSuccessMessage = 'Data refreshed from provider.',
    staleWarningMessage = 'Showing cached data while waiting for a fresh provider response.',
  } = options;

  const { push: pushToast } = useToasts();

  const pollingSeconds = ref(defaultFreshness);
  const lastErrorMessage = ref<string | null>(null);
  const staleNotified = ref(false);
  
  let intervalHandle: number | null = null;
  let currentRefreshFn: RefreshFunction | null = null;

  const isPolling = ref(false);
  const isLoading = ref(false);
  const isRefreshing = ref(false);

  const computedIsPolling = computed(() => isLoading.value || isRefreshing.value);
  const progressValue = computed(() => (computedIsPolling.value ? undefined : 100));

  const statusText = computed(() => {
    if (computedIsPolling.value) {
      return 'Refreshing data…';
    }
    return 'Ready';
  });

  async function triggerPolling(
    reason: BaseFetchReason, 
    options: { forceRefresh?: boolean } = {}
  ): Promise<void> {
    if (!currentRefreshFn) {
      return;
    }

    const background = reason === 'interval';
    
    if (background) {
      isRefreshing.value = true;
    } else {
      isLoading.value = true;
    }
    isPolling.value = true;

    try {
      await currentRefreshFn({ background, reason, forceRefresh: options.forceRefresh });
      
      const manualTrigger = reason === 'manual' || reason === 'hard-manual';
      if (manualTrigger) {
        pushToast({
          text: options.forceRefresh ? hardRefreshSuccessMessage : successMessage,
          variant: 'success',
        });
      }
    } finally {
      isPolling.value = false;
      if (background) {
        isRefreshing.value = false;
      } else {
        isLoading.value = false;
      }
    }
  }

  function setupPolling(
    refreshFn: RefreshFunction,
    pollingSecondsRef: Ref<number>
  ): void {
    currentRefreshFn = refreshFn;

    // Set up polling interval
    watch(
      () => pollingSecondsRef.value,
      (seconds, _previous, onCleanup) => {
        cleanupPolling();

        if (!Number.isFinite(seconds) || seconds <= 0) {
          return;
        }

        intervalHandle = window.setInterval(() => {
          void triggerPolling('interval');
        }, seconds * 1000);

        onCleanup(() => {
          cleanupPolling();
        });
      },
      { immediate: true },
    );
  }

  function cleanupPolling(): void {
    if (intervalHandle) {
      window.clearInterval(intervalHandle);
      intervalHandle = null;
    }
  }

  function watchForErrors(errorRef: Ref<string | null>): void {
    watch(errorRef, (message) => {
      if (message && message !== lastErrorMessage.value) {
        pushToast({
          text: message,
          variant: 'error',
          timeout: 6000,
        });
        lastErrorMessage.value = message;
      } else if (!message) {
        lastErrorMessage.value = null;
      }
    });
  }

  function watchForStaleData(
    isStaleRef: ComputedRef<boolean>, 
    hasDataRef: ComputedRef<boolean>
  ): void {
    watch(isStaleRef, (value) => {
      if (value && !staleNotified.value && hasDataRef.value) {
        pushToast({
          text: staleWarningMessage,
          variant: 'warning',
          timeout: 7000,
        });
        staleNotified.value = true;
      } else if (!value) {
        staleNotified.value = false;
      }
    });
  }

  onBeforeUnmount(() => {
    cleanupPolling();
  });

  return {
    isPolling: computedIsPolling,
    pollingSeconds,
    statusText,
    progressValue,
    lastErrorMessage,
    staleNotified,
    triggerPolling,
    setupPolling,
    cleanupPolling,
    watchForErrors,
    watchForStaleData,
  };
}
