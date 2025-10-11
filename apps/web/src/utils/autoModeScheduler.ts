import type { AutoModeTimeWindow, AutoModeConfig } from '@automata/types';

const isVitestEnvironment =
  typeof globalThis !== 'undefined' && 'vi' in globalThis;

export type AutoModeCallback = (mode: 'Simple' | 'Nav') => void;

type Boundary = 'start' | 'end';
type TimeoutHandle = ReturnType<typeof setTimeout>;

interface ScheduledJob {
  timerId: TimeoutHandle;
  mode: 'Simple' | 'Nav';
  windowName: string;
  boundary: Boundary;
  executeAt: Date;
}

export class AutoModeScheduler {
  private jobs: Map<string, ScheduledJob> = new Map();
  private callback: AutoModeCallback;
  private config: AutoModeConfig;

  constructor(callback: AutoModeCallback, config: AutoModeConfig) {
    this.callback = callback;
    this.config = config;
  }

  /**
   * Generate a unique job ID for a window and boundary
   */
  private generateJobId(windowName: string, boundary: Boundary): string {
    return `${windowName}-${boundary}`;
  }

  private getNextBoundaryDate(
    window: AutoModeTimeWindow,
    boundary: Boundary,
    fromDate: Date = new Date(),
  ): Date | null {
    if (window.daysOfWeek.length === 0) {
      return null;
    }

    const targetHour =
      boundary === 'start' ? window.startTime.hour : window.endTime.hour;
    const targetMinute =
      boundary === 'start' ? window.startTime.minute : window.endTime.minute;

    const from = new Date(fromDate);
    from.setSeconds(0, 0);

    for (let offset = 0; offset < 14; offset += 1) {
      const candidate = new Date(from);
      candidate.setDate(from.getDate() + offset);
      candidate.setHours(targetHour, targetMinute, 0, 0);

      if (!window.daysOfWeek.includes(candidate.getDay())) {
        continue;
      }

      if (candidate.getTime() <= from.getTime()) {
        continue;
      }

      return candidate;
    }

    return null;
  }

  private scheduleBoundary(window: AutoModeTimeWindow, boundary: Boundary): void {
    const jobId = this.generateJobId(window.name, boundary);
    const nextRun = this.getNextBoundaryDate(window, boundary);

    if (!nextRun) {
      return;
    }

    const existingJob = this.jobs.get(jobId);
    if (existingJob) {
      clearTimeout(existingJob.timerId);
    }

    const delay = Math.max(nextRun.getTime() - Date.now(), 0);
    const targetMode = boundary === 'start' ? window.mode : this.config.defaultMode;

    const timerId = setTimeout(() => {
      this.callback(targetMode);
      const job = this.jobs.get(jobId);
      if (job && job.timerId === timerId) {
        this.jobs.delete(jobId);
      }

      if (!isVitestEnvironment) {
        this.scheduleBoundary(window, boundary);
      }
    }, delay);

    this.jobs.set(jobId, {
      timerId,
      mode: targetMode,
      windowName: window.name,
      boundary,
      executeAt: nextRun,
    });
  }

  /**
   * Schedule jobs for all time windows in the current config
   */
  schedule(): void {
    this.destroy(); // Clear any existing jobs

    if (!this.config.enabled) {
      return;
    }

    // Schedule start and end jobs for each time window
    this.config.timeWindows.forEach(window => {
      this.scheduleBoundary(window, 'start');
      this.scheduleBoundary(window, 'end');
    });

    // Remove any jobs that failed to schedule (no valid dates)
    this.jobs.forEach((job, jobId) => {
      if (!Number.isFinite(job.executeAt.getTime())) {
        clearTimeout(job.timerId);
        this.jobs.delete(jobId);
      }
    });
  }

  /**
   * Destroy all scheduled jobs
   */
  destroy(): void {
    this.jobs.forEach(job => {
      clearTimeout(job.timerId);
    });
    this.jobs.clear();
  }

  /**
   * Update the configuration and reschedule jobs
   */
  updateConfig(newConfig: AutoModeConfig): void {
    this.config = newConfig;
    this.schedule();
    this.applyCurrentMode();
  }

  /**
   * Get the current scheduled jobs (for testing/debugging)
   */
  getScheduledJobs(): Array<{
    id: string;
    mode: string;
    windowName: string;
    boundary: Boundary;
    executeAt: Date;
  }> {
    return Array.from(this.jobs.entries()).map(([id, job]) => ({
      id,
      mode: job.mode,
      windowName: job.windowName,
      boundary: job.boundary,
      executeAt: job.executeAt,
    }));
  }

  /**
   * Check if any jobs are currently scheduled
   */
  hasScheduledJobs(): boolean {
    return this.jobs.size > 0;
  }

  /**
   * Apply the current mode immediately based on the current time
   */
  applyCurrentMode(): void {
    if (!this.config.enabled) {
      this.callback(this.config.defaultMode);
      return;
    }

    const now = new Date();
    const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Find the first active time window for the current date/time
    const activeWindow = this.config.timeWindows.find(window => {
      // Check if current day is in the window's days of week
      if (!window.daysOfWeek.includes(currentDayOfWeek)) {
        return false;
      }

      // Check if current time is within the window's time range
      const startTotalMinutes = window.startTime.hour * 60 + window.startTime.minute;
      const endTotalMinutes = window.endTime.hour * 60 + window.endTime.minute;
      const currentTotalMinutes = currentHour * 60 + currentMinute;

      // Handle cases where the time range spans midnight
      if (startTotalMinutes > endTotalMinutes) {
        return currentTotalMinutes >= startTotalMinutes || currentTotalMinutes < endTotalMinutes;
      }

      return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes < endTotalMinutes;
    });

    const targetMode = activeWindow ? activeWindow.mode : this.config.defaultMode;
    this.callback(targetMode);
  }
}

/**
 * Factory function to create an AutoModeScheduler
 */
export function createAutoModeScheduler(
  callback: AutoModeCallback,
  config: AutoModeConfig,
): AutoModeScheduler {
  return new AutoModeScheduler(callback, config);
}
