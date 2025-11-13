/**
 * Auto-mode scheduler service
 * Handles server-side time window calculations for auto-mode functionality
 */

import type { AutoModeConfig, AutoModeTimeWindow } from '@automata/types';

export class AutoModeScheduler {
  /**
   * Check if a time is within a given time range
   */
  private isTimeInRange(
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

  /**
   * Check if a time window is active for a given date
   */
  private isActiveTimeWindow(window: AutoModeTimeWindow, date: Date): boolean {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hour = date.getHours();
    const minute = date.getMinutes();

    // Check if current day is in the window's days of week
    if (!window.daysOfWeek.includes(dayOfWeek)) {
      return false;
    }

    // Check if current time is within the window's time range
    return this.isTimeInRange(
      hour,
      minute,
      window.startTime.hour,
      window.startTime.minute,
      window.endTime.hour,
      window.endTime.minute,
    );
  }

  /**
   * Resolve the current mode for a given date based on the configuration
   */
  resolveModeForDate(config: AutoModeConfig, date: Date): 'Compact' | 'Nav' {
    if (!config.enabled) {
      return config.defaultMode;
    }

    // Find the first active time window for the current date/time
    const activeWindow = config.timeWindows.find(window =>
      this.isActiveTimeWindow(window, date),
    );

    return activeWindow ? activeWindow.mode : config.defaultMode;
  }

  /**
   * Get the next boundary (start or end of a time window) from a given date
   */
  getNextBoundary(config: AutoModeConfig, date: Date): Date | undefined {
    if (!config.enabled) {
      // Return a date far in the future if auto mode is disabled
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      return nextDate;
    }

    const currentHour = date.getHours();
    const currentMinute = date.getMinutes();
    const dayOfWeek = date.getDay();

    // Create array of all boundaries for today and tomorrow
    const boundaries: Array<{ date: Date; mode: 'Compact' | 'Nav' }> = [];

    // Add boundaries for today
    config.timeWindows.forEach(window => {
      if (window.daysOfWeek.includes(dayOfWeek)) {
        const startDate = new Date(date);
        startDate.setHours(window.startTime.hour, window.startTime.minute, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(window.endTime.hour, window.endTime.minute, 0, 0);

        if (startDate.getTime() > date.getTime()) {
          boundaries.push({ date: startDate, mode: window.mode });
        }
        if (endDate.getTime() > date.getTime()) {
          boundaries.push({ date: endDate, mode: config.defaultMode });
        }
      }
    });

    // If no boundaries left today, check tomorrow
    if (boundaries.length === 0) {
      const tomorrow = new Date(date);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDayOfWeek = tomorrow.getDay();

      config.timeWindows.forEach(window => {
        if (window.daysOfWeek.includes(tomorrowDayOfWeek)) {
          const startDate = new Date(tomorrow);
          startDate.setHours(window.startTime.hour, window.startTime.minute, 0, 0);
          boundaries.push({ date: startDate, mode: window.mode });
        }
      });
    }

    // Sort boundaries by time and return the earliest one
    boundaries.sort((a, b) => a.date.getTime() - b.date.getTime());
    return boundaries.length > 0 ? boundaries[0].date : undefined;
  }

  /**
   * Get the nav mode refresh seconds from config
   */
  getNavModeRefreshSeconds(config: AutoModeConfig): number {
    return config.navModeRefreshSeconds;
  }

  /**
   * Validate an auto-mode configuration
   */
  validateConfig(config: AutoModeConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (typeof config.enabled !== 'boolean') {
      errors.push('enabled must be a boolean');
    }

    if (!Array.isArray(config.timeWindows)) {
      errors.push('timeWindows must be an array');
    } else {
      config.timeWindows.forEach((window, index) => {
        if (!window.name || typeof window.name !== 'string') {
          errors.push(`timeWindows[${index}].name must be a non-empty string`);
        }
        if (!['Compact', 'Nav'].includes(window.mode)) {
          errors.push(`timeWindows[${index}].mode must be 'Compact' or 'Nav'`);
        }
        if (!window.startTime || typeof window.startTime.hour !== 'number' ||
            typeof window.startTime.minute !== 'number') {
          errors.push(`timeWindows[${index}].startTime must have valid hour and minute`);
        }
        if (!window.endTime || typeof window.endTime.hour !== 'number' ||
            typeof window.endTime.minute !== 'number') {
          errors.push(`timeWindows[${index}].endTime must have valid hour and minute`);
        }
        if (!Array.isArray(window.daysOfWeek)) {
          errors.push(`timeWindows[${index}].daysOfWeek must be an array`);
        }
      });
    }

    if (!['Compact', 'Nav'].includes(config.defaultMode)) {
      errors.push('defaultMode must be \'Compact\' or \'Nav\'');
    }

    if (typeof config.navModeRefreshSeconds !== 'number' ||
        config.navModeRefreshSeconds < 60 ||
        config.navModeRefreshSeconds > 3600) {
      errors.push('navModeRefreshSeconds must be between 60 and 3600');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
