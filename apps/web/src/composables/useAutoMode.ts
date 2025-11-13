import { computed, ref } from 'vue';
import type { AutoModeConfig, AutoModeStatusResponse } from '@automata/types';

const API_BASE = '/api';

export function useAutoMode() {
  const status = ref<AutoModeStatusResponse | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Computed properties based on API response
  const config = computed(() => status.value?.config || null);
  const isEnabled = computed(() => config.value?.enabled || false);
  const currentMode = computed(() => status.value?.currentMode || 'Compact');
  const nextBoundary = computed(() => {
    if (!status.value?.nextBoundaryIso) return null;
    return new Date(status.value.nextBoundaryIso);
  });

  // Fetch current auto-mode status from API
  async function fetchStatus(forceRefresh = false): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const params = new URLSearchParams();
      if (forceRefresh) {
        params.set('forceRefresh', 'true');
      }

      const response = await fetch(`${API_BASE}/auto-mode/status?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data: AutoModeStatusResponse = await response.json();
      status.value = data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  // Update auto-mode configuration via API
  async function updateConfig(newConfig: AutoModeConfig): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch(`${API_BASE}/auto-mode/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config: newConfig }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();

      // Refresh status after config update
      await fetchStatus(true);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  // Legacy methods for backward compatibility (now use API data)
  function resolveModeForDate(date: Date): 'Compact' | 'Nav' {
    if (!config.value) return 'Compact';
    // This is now handled server-side, but we can provide a client-side fallback
    // In practice, this should use the current status from the API
    return currentMode.value;
  }

  function getNextBoundary(date: Date): Date {
    // Return the next boundary from API, or a fallback
    return nextBoundary.value || new Date(date.getTime() + 24 * 60 * 60 * 1000);
  }

  function getNavModeRefreshSeconds(): number {
    return config.value?.navModeRefreshSeconds || 300;
  }

  // Reset config to default (server will handle defaults)
  async function resetConfig(): Promise<void> {
    const defaultConfig: AutoModeConfig = {
      enabled: true,
      timeWindows: [
        {
          name: 'morning-commute',
          mode: 'Nav',
          startTime: { hour: 8, minute: 30 },
          endTime: { hour: 9, minute: 30 },
          daysOfWeek: [1, 2, 3, 4, 5],
          description: 'Morning commute window',
        },
        {
          name: 'evening-commute',
          mode: 'Nav',
          startTime: { hour: 17, minute: 0 },
          endTime: { hour: 20, minute: 0 },
          daysOfWeek: [1, 2, 3, 4, 5],
          description: 'Evening commute window',
        },
      ],
      defaultMode: 'Compact',
      navModeRefreshSeconds: 300,
    };

    await updateConfig(defaultConfig);
  }

  return {
    // Reactive state
    status: computed(() => status.value),
    config,
    isEnabled,
    currentMode,
    nextBoundary,
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),

    // Methods
    fetchStatus,
    updateConfig,
    resolveModeForDate,
    getNextBoundary,
    getNavModeRefreshSeconds,
    resetConfig,
  };
}
