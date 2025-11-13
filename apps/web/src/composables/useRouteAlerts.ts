import { computed, ref, watch, type Ref } from 'vue';
import { useToasts } from './useToasts';
import { useUiPreferences } from './useUiPreferences';
import type { RouteAlert, RouteAlertResponse, RouteTimeResponse, AlertAcknowledgeRequest } from '@automata/types';

interface UseRouteAlertsOptions {
  routeData: Ref<RouteTimeResponse | null>;
  thresholdMinutes: Ref<number>;
}

interface UseRouteAlertsResult {
  activeAlerts: Ref<RouteAlert[]>;
  totalCount: Ref<number>;
  unacknowledgedCount: Ref<number>;
  lastUpdatedIso: Ref<string | null>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  acknowledgeAlerts: (alertIds?: number[]) => Promise<void>;
  acknowledgeAllAlerts: () => Promise<void>;
  refreshAlerts: () => Promise<void>;
  emitAlertCount: (count: number) => void;
}

async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export function useRouteAlerts(options: UseRouteAlertsOptions): UseRouteAlertsResult {
  const { push: pushToast } = useToasts();
  const { isWidgetCompact } = useUiPreferences();

  const activeAlerts = ref<RouteAlert[]>([]);
  const totalCount = ref(0);
  const unacknowledgedCount = ref(0);
  const lastUpdatedIso = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  let lastEmittedAlertCount = 0;
  let emitHandler: (count: number) => void = () => {};

  const isCompact = computed(() => isWidgetCompact('route-widget'));

  const emitAlertCountImpl = (count: number): void => {
    if (count === lastEmittedAlertCount) {
      return;
    }

    lastEmittedAlertCount = count;
    emitHandler(count);
  };

  const refreshAlerts = async (): Promise<void> => {
    if (!options.routeData.value) {
      activeAlerts.value = [];
      totalCount.value = 0;
      unacknowledgedCount.value = 0;
      lastUpdatedIso.value = null;
      emitAlertCountImpl(0);
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const routeDataJson = JSON.stringify(options.routeData.value);
      const params = new URLSearchParams({
        routeData: routeDataJson,
        thresholdMinutes: String(options.thresholdMinutes.value),
        compactMode: String(isCompact.value),
      });

      const response = await apiCall<RouteAlertResponse>(`/alerts/route?${params}`);
      
      // Show toast for new alerts
      const hasNewAlerts = response.alerts.length > 0 && 
        (activeAlerts.value.length === 0 || 
         response.alerts[response.alerts.length - 1].id !== activeAlerts.value[activeAlerts.value.length - 1]?.id);

      if (hasNewAlerts) {
        const latestAlert = response.alerts[response.alerts.length - 1];
        if (latestAlert) {
          pushToast({
            text: latestAlert.message || `Travel time exceeds threshold of ${options.thresholdMinutes.value} min.`,
            variant: 'warning',
            timeout: 7000,
          });
        }
      }

      activeAlerts.value = response.alerts;
      totalCount.value = response.totalCount;
      unacknowledgedCount.value = response.unacknowledgedCount;
      lastUpdatedIso.value = response.lastUpdatedIso;
      
      emitAlertCountImpl(response.unacknowledgedCount);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch route alerts';
      error.value = errorMessage;
      console.error('Failed to fetch route alerts:', err);
      
      // Clear alerts on error
      activeAlerts.value = [];
      totalCount.value = 0;
      unacknowledgedCount.value = 0;
      emitAlertCountImpl(0);
    } finally {
      loading.value = false;
    }
  };

  const acknowledgeAlerts = async (alertIds?: number[]): Promise<void> => {
    try {
      const requestBody: AlertAcknowledgeRequest = {
        alertIds: alertIds || activeAlerts.value.map(alert => alert.id),
      };

      const response = await apiCall<{
        success: boolean;
        message: string;
        acknowledgedCount: number;
        lastUpdatedIso: string;
      }>('/alerts/acknowledge', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      // Update local state immediately
      const acknowledgedIds = new Set(requestBody.alertIds || []);
      activeAlerts.value = activeAlerts.value.filter(alert => !acknowledgedIds.has(alert.id));
      totalCount.value = activeAlerts.value.length;
      unacknowledgedCount.value = activeAlerts.value.length;
      emitAlertCountImpl(0);

      if (response.acknowledgedCount > 0) {
        pushToast({
          text: response.message,
          variant: 'success',
          timeout: 3000,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to acknowledge alerts';
      error.value = errorMessage;
      console.error('Failed to acknowledge alerts:', err);
      throw err;
    }
  };

  const acknowledgeAllAlerts = async (): Promise<void> => {
    try {
      const requestBody: AlertAcknowledgeRequest = {
        acknowledgeAll: true,
      };

      const response = await apiCall<{
        success: boolean;
        message: string;
        acknowledgedCount: number;
        lastUpdatedIso: string;
      }>('/alerts/acknowledge', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      // Update local state immediately
      activeAlerts.value = [];
      totalCount.value = 0;
      unacknowledgedCount.value = 0;
      emitAlertCountImpl(0);

      if (response.acknowledgedCount > 0) {
        pushToast({
          text: response.message,
          variant: 'success',
          timeout: 3000,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to acknowledge all alerts';
      error.value = errorMessage;
      console.error('Failed to acknowledge all alerts:', err);
      throw err;
    }
  };

  const result = {
    activeAlerts,
    totalCount,
    unacknowledgedCount,
    lastUpdatedIso,
    loading,
    error,
    acknowledgeAlerts,
    acknowledgeAllAlerts,
    refreshAlerts,
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

  // Watch for changes and refresh alerts
  watch(
    [options.routeData, options.thresholdMinutes, isCompact],
    () => {
      refreshAlerts();
    },
    { immediate: true, flush: 'sync' },
  );

  return result;
}
