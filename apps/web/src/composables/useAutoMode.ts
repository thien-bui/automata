import { computed, ref } from 'vue';
import type { AutoModeConfig, AutoModeTimeWindow } from '@automata/types';

// Import the configuration file
import autoModeConfigJson from '../config/automode-config.json';

const DEFAULT_CONFIG: AutoModeConfig = {
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
  defaultMode: 'Simple',
  navModeRefreshSeconds: 300,
};

export function useAutoMode() {
  // Use the imported config or fall back to default
  const config = ref<AutoModeConfig>(
    (autoModeConfigJson as any).autoMode || DEFAULT_CONFIG,
  );

  const isEnabled = computed(() => config.value.enabled);

  function isTimeInRange(
    currentHour: number,
    currentMinute: number,
    startHour: number,
    startMinute: number,
    endHour: number,
    endMinute: number,
  ): boolean {
    // Convert times to minutes since midnight for easier comparison
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;

    // Handle cases where the time range spans midnight (not needed for current config but good practice)
    if (startTotalMinutes > endTotalMinutes) {
      return currentTotalMinutes >= startTotalMinutes || currentTotalMinutes < endTotalMinutes;
    }

    return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes < endTotalMinutes;
  }

  function isActiveTimeWindow(window: AutoModeTimeWindow, date: Date): boolean {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hour = date.getHours();
    const minute = date.getMinutes();

    // Check if current day is in the window's days of week
    if (!window.daysOfWeek.includes(dayOfWeek)) {
      return false;
    }

    // Check if current time is within the window's time range
    return isTimeInRange(
      hour,
      minute,
      window.startTime.hour,
      window.startTime.minute,
      window.endTime.hour,
      window.endTime.minute,
    );
  }

  function resolveModeForDate(date: Date): 'Simple' | 'Nav' {
    if (!isEnabled.value) {
      return config.value.defaultMode;
    }

    // Find the first active time window for the current date/time
    const activeWindow = config.value.timeWindows.find(window =>
      isActiveTimeWindow(window, date),
    );

    return activeWindow ? activeWindow.mode : config.value.defaultMode;
  }

  function getNextBoundary(date: Date): Date {
    if (!isEnabled.value) {
      // Return a date far in the future if auto mode is disabled
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      return nextDate;
    }

    const currentHour = date.getHours();
    const currentMinute = date.getMinutes();
    const dayOfWeek = date.getDay();

    // Create array of all boundaries for today and tomorrow
    const boundaries: Array<{ date: Date; mode: 'Simple' | 'Nav' }> = [];

    // Add boundaries for today
    config.value.timeWindows.forEach(window => {
      if (window.daysOfWeek.includes(dayOfWeek)) {
        const startDate = new Date(date);
        startDate.setHours(window.startTime.hour, window.startTime.minute, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(window.endTime.hour, window.endTime.minute, 0, 0);

        if (startDate.getTime() > date.getTime()) {
          boundaries.push({ date: startDate, mode: window.mode });
        }
        if (endDate.getTime() > date.getTime()) {
          boundaries.push({ date: endDate, mode: config.value.defaultMode });
        }
      }
    });

    // If no boundaries left today, check tomorrow
    if (boundaries.length === 0) {
      const tomorrow = new Date(date);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDayOfWeek = tomorrow.getDay();

      config.value.timeWindows.forEach(window => {
        if (window.daysOfWeek.includes(tomorrowDayOfWeek)) {
          const startDate = new Date(tomorrow);
          startDate.setHours(window.startTime.hour, window.startTime.minute, 0, 0);
          boundaries.push({ date: startDate, mode: window.mode });
        }
      });
    }

    // Sort boundaries by time and return the earliest one
    boundaries.sort((a, b) => a.date.getTime() - b.date.getTime());
    return boundaries.length > 0 ? boundaries[0].date : new Date(date.getTime() + 24 * 60 * 60 * 1000);
  }

  function getNavModeRefreshSeconds(): number {
    return config.value.navModeRefreshSeconds;
  }

  function updateConfig(newConfig: Partial<AutoModeConfig>) {
    config.value = { ...config.value, ...newConfig };
  }

  function resetConfig() {
    config.value = DEFAULT_CONFIG;
  }

  return {
    config: computed(() => config.value),
    isEnabled,
    resolveModeForDate,
    getNextBoundary,
    getNavModeRefreshSeconds,
    updateConfig,
    resetConfig,
  };
}
