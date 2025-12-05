import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutoModeScheduler } from './autoModeScheduler';
import type { AutoModeConfig, AutoModeTimeWindow } from '@automata/types';

describe('AutoModeScheduler', () => {
  let scheduler: AutoModeScheduler;

  beforeEach(() => {
    scheduler = new AutoModeScheduler();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isTimeInRange', () => {
    it('should return true when time is within range', () => {
      // 10:30 is between 9:00 and 11:00
      expect(scheduler['isTimeInRange'](10, 30, 9, 0, 11, 0)).toBe(true);
    });

    it('should return false when time is before start', () => {
      // 8:30 is before 9:00
      expect(scheduler['isTimeInRange'](8, 30, 9, 0, 11, 0)).toBe(false);
    });

    it('should return false when time is after end', () => {
      // 11:30 is after 11:00
      expect(scheduler['isTimeInRange'](11, 30, 9, 0, 11, 0)).toBe(false);
    });

    it('should handle midnight crossing (end < start)', () => {
      // Range: 22:00 to 2:00 (next day)
      // 23:30 should be in range
      expect(scheduler['isTimeInRange'](23, 30, 22, 0, 2, 0)).toBe(true);
      // 1:30 should be in range
      expect(scheduler['isTimeInRange'](1, 30, 22, 0, 2, 0)).toBe(true);
      // 3:30 should NOT be in range
      expect(scheduler['isTimeInRange'](3, 30, 22, 0, 2, 0)).toBe(false);
      // 21:30 should NOT be in range
      expect(scheduler['isTimeInRange'](21, 30, 22, 0, 2, 0)).toBe(false);
    });

    it('should handle exact start time as inclusive', () => {
      // 9:00 is start time, should be inclusive
      expect(scheduler['isTimeInRange'](9, 0, 9, 0, 11, 0)).toBe(true);
    });

    it('should handle exact end time as exclusive', () => {
      // 11:00 is end time, should be exclusive
      expect(scheduler['isTimeInRange'](11, 0, 9, 0, 11, 0)).toBe(false);
    });
  });

  describe('isActiveTimeWindow', () => {
    const mockWindow: AutoModeTimeWindow = {
      name: 'test-window',
      mode: 'Nav',
      startTime: { hour: 9, minute: 0 },
      endTime: { hour: 17, minute: 0 },
      daysOfWeek: [1, 2, 3, 4, 5], // Monday-Friday
    };

    it('should return true for matching day and time', () => {
      // Tuesday at 10:30 AM
      const date = new Date('2024-01-02T10:30:00');
      expect(scheduler['isActiveTimeWindow'](mockWindow, date)).toBe(true);
    });

    it('should return false for wrong day of week', () => {
      // Sunday at 10:30 AM (day 0)
      const date = new Date('2024-01-07T10:30:00');
      expect(scheduler['isActiveTimeWindow'](mockWindow, date)).toBe(false);
    });

    it('should return false for time before window', () => {
      // Tuesday at 8:30 AM
      const date = new Date('2024-01-02T08:30:00');
      expect(scheduler['isActiveTimeWindow'](mockWindow, date)).toBe(false);
    });

    it('should return false for time after window', () => {
      // Tuesday at 17:30 PM (5:30 PM)
      const date = new Date('2024-01-02T17:30:00');
      expect(scheduler['isActiveTimeWindow'](mockWindow, date)).toBe(false);
    });

    it('should handle exact start time', () => {
      // Tuesday at 9:00 AM exactly
      const date = new Date('2024-01-02T09:00:00');
      expect(scheduler['isActiveTimeWindow'](mockWindow, date)).toBe(true);
    });

    it('should handle exact end time (exclusive)', () => {
      // Tuesday at 17:00 PM (5:00 PM) exactly - should be exclusive
      const date = new Date('2024-01-02T17:00:00');
      expect(scheduler['isActiveTimeWindow'](mockWindow, date)).toBe(false);
    });
  });

  describe('resolveModeForDate', () => {
    const baseConfig: AutoModeConfig = {
      enabled: true,
      timeWindows: [
        {
          name: 'morning-commute',
          mode: 'Nav',
          startTime: { hour: 8, minute: 30 },
          endTime: { hour: 9, minute: 30 },
          daysOfWeek: [1, 2, 3, 4, 5], // Monday-Friday
        },
        {
          name: 'evening-commute',
          mode: 'Nav',
          startTime: { hour: 17, minute: 0 },
          endTime: { hour: 20, minute: 0 },
          daysOfWeek: [1, 2, 3, 4, 5], // Monday-Friday
        },
      ],
      defaultMode: 'Compact',
      navModeRefreshSeconds: 300,
    };

    it('should return default mode when auto-mode is disabled', () => {
      const config: AutoModeConfig = {
        ...baseConfig,
        enabled: false,
      };
      const date = new Date('2024-01-02T10:30:00'); // Tuesday 10:30 AM
      expect(scheduler.resolveModeForDate(config, date)).toBe('Compact');
    });

    it('should return window mode when within active window', () => {
      const date = new Date('2024-01-02T08:45:00'); // Tuesday 8:45 AM (within morning commute)
      expect(scheduler.resolveModeForDate(baseConfig, date)).toBe('Nav');
    });

    it('should return default mode when not within any window', () => {
      const date = new Date('2024-01-02T14:30:00'); // Tuesday 2:30 PM (between windows)
      expect(scheduler.resolveModeForDate(baseConfig, date)).toBe('Compact');
    });

    it('should return default mode on weekends', () => {
      const date = new Date('2024-01-06T10:30:00'); // Saturday 10:30 AM
      expect(scheduler.resolveModeForDate(baseConfig, date)).toBe('Compact');
    });

    it('should handle multiple windows and pick first matching', () => {
      // Add another window that overlaps
      const config: AutoModeConfig = {
        ...baseConfig,
        timeWindows: [
          {
            name: 'first-window',
            mode: 'Nav',
            startTime: { hour: 8, minute: 0 },
            endTime: { hour: 9, minute: 0 },
            daysOfWeek: [1],
          },
          {
            name: 'second-window',
            mode: 'Compact',
            startTime: { hour: 8, minute: 30 },
            endTime: { hour: 9, minute: 30 },
            daysOfWeek: [1],
          },
        ],
      };
      // Monday at 8:45 AM - matches both windows, should pick first
      const date = new Date('2024-01-01T08:45:00');
      expect(scheduler.resolveModeForDate(config, date)).toBe('Nav');
    });
  });

  describe('getNextBoundary', () => {
    const baseConfig: AutoModeConfig = {
      enabled: true,
      timeWindows: [
        {
          name: 'morning-commute',
          mode: 'Nav',
          startTime: { hour: 8, minute: 30 },
          endTime: { hour: 9, minute: 30 },
          daysOfWeek: [1, 2, 3, 4, 5], // Monday-Friday
        },
        {
          name: 'evening-commute',
          mode: 'Nav',
          startTime: { hour: 17, minute: 0 },
          endTime: { hour: 20, minute: 0 },
          daysOfWeek: [1, 2, 3, 4, 5], // Monday-Friday
        },
      ],
      defaultMode: 'Compact',
      navModeRefreshSeconds: 300,
    };

    it('should return tomorrow when auto-mode is disabled', () => {
      const config: AutoModeConfig = {
        ...baseConfig,
        enabled: false,
      };
      const date = new Date('2024-01-02T10:30:00');
      const result = scheduler.getNextBoundary(config, date);
      expect(result).toBeDefined();
      expect(result!.getDate()).toBe(date.getDate() + 1);
    });

    it('should return start of next window when before first window', () => {
      // Monday 6:00 AM (before morning commute)
      const date = new Date('2024-01-01T06:00:00');
      const result = scheduler.getNextBoundary(baseConfig, date);
      expect(result).toBeDefined();
      expect(result!.getHours()).toBe(8);
      expect(result!.getMinutes()).toBe(30);
      expect(result!.getDate()).toBe(1); // Same day
    });

    it('should return end of current window when within a window', () => {
      // Monday 8:45 AM (within morning commute window)
      const date = new Date('2024-01-01T08:45:00');
      const result = scheduler.getNextBoundary(baseConfig, date);
      expect(result).toBeDefined();
      expect(result!.getHours()).toBe(9);
      expect(result!.getMinutes()).toBe(30);
      expect(result!.getDate()).toBe(1);
    });

    it('should return start of next window when between windows', () => {
      // Monday 14:00 (2:00 PM, between morning and evening commute)
      const date = new Date('2024-01-01T14:00:00');
      const result = scheduler.getNextBoundary(baseConfig, date);
      expect(result).toBeDefined();
      expect(result!.getHours()).toBe(17);
      expect(result!.getMinutes()).toBe(0);
      expect(result!.getDate()).toBe(1);
    });

    it('should return start of next day window when after last window', () => {
      // Monday 21:00 (9:00 PM, after evening commute)
      const date = new Date('2024-01-01T21:00:00');
      const result = scheduler.getNextBoundary(baseConfig, date);
      expect(result).toBeDefined();
      expect(result!.getHours()).toBe(8);
      expect(result!.getMinutes()).toBe(30);
      expect(result!.getDate()).toBe(2); // Next day (Tuesday)
    });

    it('should return start of next weekday window on weekends', () => {
      // Sunday 10:00 AM (weekend, no windows)
      const date = new Date('2024-01-07T10:00:00');
      const result = scheduler.getNextBoundary(baseConfig, date);
      expect(result).toBeDefined();
      expect(result!.getHours()).toBe(8);
      expect(result!.getMinutes()).toBe(30);
      expect(result!.getDay()).toBe(1); // Monday
    });
  });

  describe('getNavModeRefreshSeconds', () => {
    it('should return navModeRefreshSeconds from config', () => {
      const config: AutoModeConfig = {
        enabled: true,
        timeWindows: [],
        defaultMode: 'Compact',
        navModeRefreshSeconds: 150,
      };
      expect(scheduler.getNavModeRefreshSeconds(config)).toBe(150);
    });
  });

  describe('validateConfig', () => {
    const validConfig: AutoModeConfig = {
      enabled: true,
      timeWindows: [
        {
          name: 'test-window',
          mode: 'Nav',
          startTime: { hour: 8, minute: 30 },
          endTime: { hour: 17, minute: 0 },
          daysOfWeek: [1, 2, 3, 4, 5],
        },
      ],
      defaultMode: 'Compact',
      navModeRefreshSeconds: 300,
    };

    it('should validate correct config', () => {
      const result = scheduler.validateConfig(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid enabled type', () => {
      const config = { ...validConfig, enabled: 'true' as any };
      const result = scheduler.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('enabled must be a boolean');
    });

    it('should reject invalid defaultMode', () => {
      const config = { ...validConfig, defaultMode: 'Invalid' as any };
      const result = scheduler.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('defaultMode must be \'Compact\' or \'Nav\'');
    });

    it('should reject invalid navModeRefreshSeconds', () => {
      const config = { ...validConfig, navModeRefreshSeconds: 50 }; // Below minimum
      const result = scheduler.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('navModeRefreshSeconds must be between 60 and 3600');
    });

    it('should reject window with invalid time range', () => {
      const config: AutoModeConfig = {
        ...validConfig,
        timeWindows: [
          {
            name: 'invalid-window',
            mode: 'Nav' as const,
            startTime: { hour: 10, minute: 0 },
            endTime: { hour: 25, minute: 0 }, // Invalid hour (25 > 23)
            daysOfWeek: [1],
          },
        ],
      };
      const result = scheduler.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('timeWindows[0].endTime.hour must be between 0 and 23');
    });

    it('should reject window with invalid day of week', () => {
      const config: AutoModeConfig = {
        ...validConfig,
        timeWindows: [
          {
            name: 'invalid-window',
            mode: 'Nav' as const,
            startTime: { hour: 8, minute: 0 },
            endTime: { hour: 17, minute: 0 },
            daysOfWeek: [7], // Invalid day (0-6)
          },
        ],
      };
      const result = scheduler.validateConfig(config);
      expect(result.valid).toBe(false);
    });

    it('should accumulate multiple errors', () => {
      const config = {
        enabled: 'true' as any,
        timeWindows: [
          {
            name: 123 as any, // Invalid name type
            mode: 'Invalid' as any,
            startTime: { hour: '8' as any, minute: 0 },
            endTime: { hour: 17, minute: 0 },
            daysOfWeek: 'not-an-array' as any,
          },
        ],
        defaultMode: 'Invalid' as any,
        navModeRefreshSeconds: 50,
      };
      const result = scheduler.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});
