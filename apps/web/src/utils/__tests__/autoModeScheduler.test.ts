import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAutoModeScheduler, AutoModeScheduler } from '../autoModeScheduler';
import type { AutoModeConfig } from '@automata/types';
describe('AutoModeScheduler', () => {
  let mockCallback: ReturnType<typeof vi.fn>;
  let testConfig: AutoModeConfig;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 3, 8, 0, 0, 0)); // Monday 8:00 AM
    mockCallback = vi.fn();
    testConfig = {
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates scheduler instances via factory', () => {
    const scheduler = createAutoModeScheduler(mockCallback, testConfig);
    expect(scheduler).toBeInstanceOf(AutoModeScheduler);
  });

  it('schedules start and end boundaries for each window', () => {
    const scheduler = createAutoModeScheduler(mockCallback, testConfig);
    scheduler.schedule();

    const jobs = scheduler.getScheduledJobs();
    expect(jobs).toHaveLength(4);
    expect(jobs.filter(job => job.boundary === 'start')).toHaveLength(2);
    expect(jobs.filter(job => job.boundary === 'end')).toHaveLength(2);
    expect(scheduler.hasScheduledJobs()).toBe(true);
  });

  it('does not schedule jobs when config is disabled', () => {
    const scheduler = createAutoModeScheduler(mockCallback, { ...testConfig, enabled: false });
    scheduler.schedule();

    expect(scheduler.hasScheduledJobs()).toBe(false);
    expect(scheduler.getScheduledJobs()).toHaveLength(0);
  });

  it('clears all jobs on destroy', () => {
    const scheduler = createAutoModeScheduler(mockCallback, testConfig);
    scheduler.schedule();
    expect(scheduler.hasScheduledJobs()).toBe(true);

    scheduler.destroy();
    expect(scheduler.hasScheduledJobs()).toBe(false);
    expect(scheduler.getScheduledJobs()).toHaveLength(0);
  });

  it('invokes callback when boundary timers fire', () => {
    const scheduler = createAutoModeScheduler(mockCallback, testConfig);
    scheduler.schedule();

    vi.advanceTimersByTime(30 * 60 * 1000); // 30 minutes to 8:30
    expect(mockCallback).toHaveBeenCalledWith('Nav');

    vi.advanceTimersByTime(60 * 60 * 1000); // advance to 9:30
    expect(mockCallback).toHaveBeenCalledWith('Compact');
  });

  it('applies current mode immediately', () => {
    const scheduler = createAutoModeScheduler(mockCallback, testConfig);
    vi.setSystemTime(new Date(2024, 5, 3, 8, 45, 0, 0)); // Monday 8:45
    scheduler.applyCurrentMode();
    expect(mockCallback).toHaveBeenCalledWith('Nav');

    mockCallback.mockClear();
    vi.setSystemTime(new Date(2024, 5, 3, 10, 0, 0, 0)); // Monday 10:00
    scheduler.applyCurrentMode();
    expect(mockCallback).toHaveBeenCalledWith('Compact');
  });

  it('applies default mode when disabled', () => {
    const scheduler = createAutoModeScheduler(mockCallback, { ...testConfig, enabled: false });
    scheduler.applyCurrentMode();
    expect(mockCallback).toHaveBeenCalledWith('Compact');
  });

  it('reschedules and reapplies on config update', () => {
    vi.setSystemTime(new Date(2024, 5, 3, 12, 0, 0, 0)); // Monday noon
    const scheduler = createAutoModeScheduler(mockCallback, testConfig);
    scheduler.schedule();
    mockCallback.mockClear();

    const updatedConfig: AutoModeConfig = {
      ...testConfig,
      defaultMode: 'Nav',
      enabled: true,
      timeWindows: [
        {
          name: 'afternoon-window',
          mode: 'Nav',
          startTime: { hour: 13, minute: 0 },
          endTime: { hour: 15, minute: 0 },
          daysOfWeek: [1],
        },
      ],
    };

    scheduler.updateConfig(updatedConfig);
    expect(mockCallback).toHaveBeenCalledWith('Nav'); // applyCurrentMode called
    expect(scheduler.getScheduledJobs().length).toBeGreaterThan(0);
  });

  it('handles midnight-spanning windows when applying current mode', () => {
    const midnightConfig: AutoModeConfig = {
      enabled: true,
      timeWindows: [
        {
          name: 'night-shift',
          mode: 'Nav',
          startTime: { hour: 22, minute: 0 },
          endTime: { hour: 6, minute: 0 },
          daysOfWeek: [1, 2, 3, 4, 5],
        },
      ],
      defaultMode: 'Compact',
      navModeRefreshSeconds: 300,
    };

    const scheduler = createAutoModeScheduler(mockCallback, midnightConfig);
    vi.setSystemTime(new Date(2024, 5, 4, 2, 0, 0, 0)); // Tuesday 2AM
    scheduler.applyCurrentMode();
    expect(mockCallback).toHaveBeenCalledWith('Nav');
  });
});
