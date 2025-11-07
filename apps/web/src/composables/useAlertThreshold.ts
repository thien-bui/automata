import { ref, watch, type Ref } from 'vue';
import type { AlertThresholdResponse, AlertThresholdUpdateRequest } from '@automata/types';

const MIN_THRESHOLD_MINUTES = 5;
const DEFAULT_THRESHOLD_MINUTES = 45;

export const defaultAlertThresholdMinutes = DEFAULT_THRESHOLD_MINUTES;

type AlertThresholdState = {
  thresholdMinutes: Ref<number>;
  defaultThresholdMinutes: Ref<number>;
  minThresholdMinutes: Ref<number>;
  maxThresholdMinutes: Ref<number>;
  lastUpdatedIso: Ref<string | null>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  setThreshold: (value: number) => Promise<void>;
  resetThreshold: () => Promise<void>;
  refreshThreshold: () => Promise<void>;
};

function clampThreshold(value: number): number {
  if (Number.isNaN(value)) {
    return DEFAULT_THRESHOLD_MINUTES;
  }

  return Math.max(MIN_THRESHOLD_MINUTES, Math.round(value));
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

export function useAlertThreshold(): AlertThresholdState {
  const thresholdMinutes = ref(DEFAULT_THRESHOLD_MINUTES);
  const defaultThresholdMinutes = ref(DEFAULT_THRESHOLD_MINUTES);
  const minThresholdMinutes = ref(MIN_THRESHOLD_MINUTES);
  const maxThresholdMinutes = ref(1440); // 24 hours
  const lastUpdatedIso = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const refreshThreshold = async (): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
      const response = await apiCall<AlertThresholdResponse>('/alerts/threshold');
      
      thresholdMinutes.value = response.thresholdMinutes;
      defaultThresholdMinutes.value = response.defaultThresholdMinutes;
      minThresholdMinutes.value = response.minThresholdMinutes;
      maxThresholdMinutes.value = response.maxThresholdMinutes;
      lastUpdatedIso.value = response.lastUpdatedIso;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch alert threshold';
      error.value = errorMessage;
      console.error('Failed to fetch alert threshold:', err);
      
      // Fallback to default values on error
      thresholdMinutes.value = DEFAULT_THRESHOLD_MINUTES;
      defaultThresholdMinutes.value = DEFAULT_THRESHOLD_MINUTES;
      minThresholdMinutes.value = MIN_THRESHOLD_MINUTES;
      maxThresholdMinutes.value = 1440;
    } finally {
      loading.value = false;
    }
  };

  const setThreshold = async (value: number): Promise<void> => {
    const clampedValue = clampThreshold(value);
    
    // Optimistically update the local value
    thresholdMinutes.value = clampedValue;
    error.value = null;

    try {
      const requestBody: AlertThresholdUpdateRequest = {
        thresholdMinutes: clampedValue,
      };

      const response = await apiCall<{
        success: boolean;
        message: string;
        thresholdMinutes: number;
        lastUpdatedIso: string;
      }>('/alerts/threshold', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      // Update with server response
      thresholdMinutes.value = response.thresholdMinutes;
      lastUpdatedIso.value = response.lastUpdatedIso;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update alert threshold';
      error.value = errorMessage;
      console.error('Failed to update alert threshold:', err);
      
      // Revert to previous value on error
      await refreshThreshold();
      throw err;
    }
  };

  const resetThreshold = async (): Promise<void> => {
    await setThreshold(DEFAULT_THRESHOLD_MINUTES);
  };

  // Initialize by fetching from API
  refreshThreshold();

  const state: AlertThresholdState = {
    thresholdMinutes,
    defaultThresholdMinutes,
    minThresholdMinutes,
    maxThresholdMinutes,
    lastUpdatedIso,
    loading,
    error,
    setThreshold,
    resetThreshold,
    refreshThreshold,
  };

  return state;
}
