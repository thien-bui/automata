import type { AutoModeConfig } from '@automata/types';

/**
 * Job interface for scheduled tasks
 */
interface ScheduledJob {
  id: string;
  boundary: 'start' | 'end';
  date: Date;
  mode: 'Compact' | 'Nav';
  timeoutId: ReturnType<typeof setTimeout>;
}

/**
 * AutoModeScheduler class for client-side auto mode scheduling
 */
export class AutoModeScheduler {
  private config: AutoModeConfig;
  private callback: (mode: 'Compact' | 'Nav') => void;
  private scheduledJobs: ScheduledJob[] = [];

  constructor(callback: (mode: 'Compact' | 'Nav') => void, config: AutoModeConfig) {
    this.callback = callback;
    this.config = config;
  }

  /**
   * Schedule all time window boundaries
   */
  schedule(): void {
    this.clearScheduledJobs();

    if (!this.config.enabled) {
      return;
    }

    const now = new Date();

    // Schedule jobs for each time window
    this.config.timeWindows.forEach((window, windowIndex) => {
      // Check if today is in the days of week
      if (window.daysOfWeek.includes(now.getDay())) {
        // Schedule start time
        const startDate = new Date(now);
        startDate.setHours(window.startTime.hour, window.startTime.minute, 0, 0);

        if (startDate.getTime() > now.getTime()) {
          this.scheduleJob({
            id: `start-${windowIndex}`,
            boundary: 'start',
            date: startDate,
            mode: window.mode,
          });
        }

        // Schedule end time
        const endDate = new Date(now);
        endDate.setHours(window.endTime.hour, window.endTime.minute, 0, 0);

        if (endDate.getTime() > now.getTime()) {
          this.scheduleJob({
            id: `end-${windowIndex}`,
            boundary: 'end',
            date: endDate,
            mode: this.config.defaultMode,
          });
        }
      }
    });
  }

  /**
   * Apply the current mode immediately based on the current time
   */
  applyCurrentMode(): void {
    const now = new Date();
    const currentMode = this.resolveModeForDate(this.config, now);
    this.callback(currentMode);
  }

  /**
   * Update the configuration and reschedule jobs
   */
  updateConfig(config: AutoModeConfig): void {
    this.config = config;
    this.schedule();
    this.applyCurrentMode();
  }

  /**
   * Get all scheduled jobs
   */
  getScheduledJobs(): ScheduledJob[] {
    return [...this.scheduledJobs];
  }

  /**
   * Check if there are any scheduled jobs
   */
  hasScheduledJobs(): boolean {
    return this.scheduledJobs.length > 0;
  }

  /**
   * Destroy the scheduler and clear all jobs
   */
  destroy(): void {
    this.clearScheduledJobs();
  }

  /**
   * Resolve the mode for a given date
   */
  private resolveModeForDate(config: AutoModeConfig, date: Date): 'Compact' | 'Nav' {
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
   * Schedule a single job
   */
  private scheduleJob(job: Omit<ScheduledJob, 'timeoutId'>): void {
    const timeoutId = setTimeout(() => {
      this.callback(job.mode);
      // Remove the job from the list after it executes
      this.scheduledJobs = this.scheduledJobs.filter(j => j.id !== job.id);
    }, job.date.getTime() - Date.now());

    this.scheduledJobs.push({
      ...job,
      timeoutId,
    });
  }

  /**
   * Clear all scheduled jobs
   */
  private clearScheduledJobs(): void {
    this.scheduledJobs.forEach(job => {
      clearTimeout(job.timeoutId);
    });
    this.scheduledJobs = [];
  }
}

/**
 * Factory function to create an AutoModeScheduler instance
 */
export function createAutoModeScheduler(
  callback: (mode: 'Compact' | 'Nav') => void,
  config: AutoModeConfig,
): AutoModeScheduler {
  return new AutoModeScheduler(callback, config);
}

// Import the type from @automata/types
import type { AutoModeTimeWindow } from '@automata/types';
