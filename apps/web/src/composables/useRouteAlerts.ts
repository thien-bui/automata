import { computed, ref, watch, type Ref, type ComputedRef } from 'vue';
import { useToasts } from './useToasts';
import { useUiPreferences } from './useUiPreferences';

interface RouteAlert {
  id: number;
  message: string;
}

interface UseRouteAlertsOptions {
  routeData: Ref<import('@automata/types').RouteTimeResponse | null>;
  thresholdMinutes: Ref<number>;
}

interface UseRouteAlertsResult {
  activeAlerts: Ref<RouteAlert[]>;
  acknowledgeAlerts: () => void;
  emitAlertCount: (count: number) => void;
}

export function useRouteAlerts(options: UseRouteAlertsOptions): UseRouteAlertsResult {
  const { push: pushToast } = useToasts();
  const { isWidgetCompact } = useUiPreferences();

  const activeAlerts = ref<RouteAlert[]>([]);
  let lastAlertKey: string | null = null;
  let acknowledgedAlertKey: string | null = null;
  let lastEmittedAlertCount = 0;

  const isCompact = computed(() => isWidgetCompact('route-widget'));

  let emitHandler: (count: number) => void = () => {};

  const emitAlertCountImpl = (count: number): void => {
    if (count === lastEmittedAlertCount) {
      return;
    }

    lastEmittedAlertCount = count;
    emitHandler(count);
  };

  const result = {
    activeAlerts,
    acknowledgeAlerts,
  } as UseRouteAlertsResult;

  Object.defineProperty(result, 'emitAlertCount', {
    get(): (count: number) => void {
      return emitAlertCountImpl;
    },
    set(handler: (count: number) => void) {
      emitHandler = handler;
      if (typeof handler === 'function') {
        handler(lastEmittedAlertCount);
      }
    },
  });

  function dispatchAlertCount(count: number): void {
    emitAlertCountImpl(count);
  }

  function acknowledgeAlerts(): void {
    acknowledgedAlertKey = lastAlertKey;
    activeAlerts.value = [];
    dispatchAlertCount(0);
  }

  watch(
    [options.routeData, options.thresholdMinutes, isCompact],
    ([payload, threshold, compact]) => {
      if (!payload) {
        activeAlerts.value = [];
        lastAlertKey = null;
        acknowledgedAlertKey = null;
        dispatchAlertCount(0);
        return;
      }

      const overThreshold = payload.durationMinutes > threshold;
      const alertKey = `${payload.lastUpdatedIso}:${threshold}:${payload.durationMinutes.toFixed(1)}`;

      if (!overThreshold) {
        activeAlerts.value = [];
        lastAlertKey = null;
        acknowledgedAlertKey = null;
        dispatchAlertCount(0);
        return;
      }

      if (acknowledgedAlertKey === alertKey) {
        activeAlerts.value = [];
        dispatchAlertCount(0);
        return;
      }

      // Only construct detailed message if not in compact mode or if we need it for toasts
      const needsDetailedMessage = !compact || lastAlertKey !== alertKey;
      const message = needsDetailedMessage 
        ? `Travel time ${payload.durationMinutes.toFixed(1)} min exceeds threshold of ${threshold} min.`
        : '';

      if (acknowledgedAlertKey && acknowledgedAlertKey !== alertKey) {
        acknowledgedAlertKey = null;
      }

      // In compact mode, we only need minimal alert data for the count
      activeAlerts.value = [
        {
          id: Date.now(),
          message,
        },
      ];
      dispatchAlertCount(activeAlerts.value.length);

      if (lastAlertKey !== alertKey) {
        pushToast({
          text: message || `Travel time exceeds threshold of ${threshold} min.`,
          variant: 'warning',
          timeout: 7000,
        });
      }

      lastAlertKey = alertKey;
    },
    { immediate: true, flush: 'sync' },
  );

  return result;
}
