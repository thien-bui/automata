import { describe, it, expect, beforeEach } from 'vitest';
import { AutoModeScheduler } from '../src/services/autoModeScheduler';
import type { AutoModeConfig } from '@automata/types';

describe('AutoModeScheduler', () => {
  let scheduler: AutoModeScheduler;
  let testConfig: AutoModeConfig;

  beforeEach(() => {
    scheduler = new AutoModeScheduler();
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

  describe('resolveModeForDate', () => {
    it('should resolve to Nav mode during morning commute window on weekdays', () => {
      // Test Monday 8:30 AM
      const mondayMorning = new Date(2024, 5, 3, 8, 30, 0, 0); // Monday
      expect(scheduler.resolveModeForDate(testConfig, mondayMorning)).toBe('Nav');
      
      // Test Monday 9:00 AM
      const mondayMidMorning = new Date(2024, 5, 3, 9, 0, 0, 0); // Monday
      expect(scheduler.resolveModeForDate(testConfig, mondayMidMorning)).toBe('Nav');
      
      // Test Friday 8:45 AM
      const fridayMorning = new Date(2024, 5, 7, 8, 45, 0, 0); // Friday
      expect(scheduler.resolveModeForDate(testConfig, fridayMorning)).toBe('Nav');
    });

    it('should resolve to Nav mode during evening commute window on weekdays', () => {
      // Test Monday 5:00 PM
      const mondayEvening = new Date(2024, 5, 3, 17, 0, 0, 0); // Monday
      expect(scheduler.resolveModeForDate(testConfig, mondayEvening)).toBe('Nav');
      
      // Test Wednesday 6:30 PM
      const wednesdayEvening = new Date(2024, 5, 5, 18, 30, 0, 0); // Wednesday
      expect(scheduler.resolveModeForDate(testConfig, wednesdayEvening)).toBe('Nav');
      
      // Test Friday 7:59 PM
      const fridayLateEvening = new Date(2024, 5, 7, 19, 59, 0, 0); // Friday
      expect(scheduler.resolveModeForDate(testConfig, fridayLateEvening)).toBe('Nav');
    });

    it('should resolve to Compact mode outside commute windows on weekdays', () => {
      // Test Monday 8:00 AM (before morning window)
      const mondayEarly = new Date(2024, 5, 3, 8, 0, 0, 0); // Monday
      expect(scheduler.resolveModeForDate(testConfig, mondayEarly)).toBe('Compact');
      
      // Test Monday 10:00 AM (after morning window)
      const mondayLateMorning = new Date(2024, 5, 3, 10, 0, 0, 0); // Monday
      expect(scheduler.resolveModeForDate(testConfig, mondayLateMorning)).toBe('Compact');
      
      // Test Monday 4:00 PM (before evening window)
      const mondayAfternoon = new Date(2024, 5, 3, 16, 0, 0, 0); // Monday
      expect(scheduler.resolveModeForDate(testConfig, mondayAfternoon)).toBe('Compact');
      
      // Test Monday 8:00 PM (after evening window)
      const mondayNight = new Date(2024, 5, 3, 20, 0, 0, 0); // Monday
      expect(scheduler.resolveModeForDate(testConfig, mondayNight)).toBe('Compact');
    });

    it('should resolve to Compact mode on weekends', () => {
      // Test Saturday 8:30 AM (would be Nav on weekday)
      const saturdayMorning = new Date(2024, 5, 8, 8, 30, 0, 0); // Saturday
      expect(scheduler.resolveModeForDate(testConfig, saturdayMorning)).toBe('Compact');
      
      // Test Saturday 6:00 PM (would be Nav on weekday)
      const saturdayEvening = new Date(2024, 5, 8, 18, 0, 0, 0); // Saturday
      expect(scheduler.resolveModeForDate(testConfig, saturdayEvening)).toBe('Compact');
      
      // Test Sunday 9:00 AM (would be Nav on weekday)
      const sundayMorning = new Date(2024, 5, 9, 9, 0, 0, 0); // Sunday
      expect(scheduler.resolveModeForDate(testConfig, sundayMorning)).toBe('Compact');
    });

    it('should return default mode when auto mode is disabled', () => {
      const disabledConfig = { ...testConfig, enabled: false };
      
      // Test Monday 8:30 AM (would be Nav if enabled)
      const mondayMorning = new Date(2024, 5, 3, 8, 30, 0, 0); // Monday
      expect(scheduler.resolveModeForDate(disabledConfig, mondayMorning)).toBe('Compact');
    });

    it('should handle boundary edge cases correctly', () => {
      // Test exactly at 8:30 AM - should be Nav
      const exactStart = new Date(2024, 5, 3, 8, 30, 0, 0); // Monday
      expect(scheduler.resolveModeForDate(testConfig, exactStart)).toBe('Nav');
      
      // Test exactly at 9:30 AM - should be Compact (end is exclusive)
      const exactEnd = new Date(2024, 5, 3, 9, 30, 0, 0); // Monday
      expect(scheduler.resolveModeForDate(testConfig, exactEnd)).toBe('Compact');
      
      // Test exactly at 5:00 PM - should be Nav
      const eveningStart = new Date(2024, 5, 3, 17, 0, 0, 0); // Monday
      expect(scheduler.resolveModeForDate(testConfig, eveningStart)).toBe('Nav');
      
      // Test exactly at 8:00 PM - should be Compact (end is exclusive)
      const eveningEnd = new Date(2024, 5, 3, 20, 0, 0, 0); // Monday
      expect(scheduler.resolveModeForDate(testConfig, eveningEnd)).toBe('Compact');
    });
  });

  describe('getNextBoundary', () => {
    it('should get the next boundary correctly', () => {
      // Test at 8:00 AM - next boundary should be 8:30 AM
      const earlyMorning = new Date(2024, 5, 3, 8, 0, 0, 0); // Monday
      const nextBoundary1 = scheduler.getNextBoundary(testConfig, earlyMorning);
      expect(nextBoundary1?.getHours()).toBe(8);
      expect(nextBoundary1?.getMinutes()).toBe(30);
      
      // Test at 9:00 AM - next boundary should be 9:30 AM
      const midMorning = new Date(2024, 5, 3, 9, 0, 0, 0); // Monday
      const nextBoundary2 = scheduler.getNextBoundary(testConfig, midMorning);
      expect(nextBoundary2?.getHours()).toBe(9);
      expect(nextBoundary2?.getMinutes()).toBe(30);
      
      // Test at 10:00 AM - next boundary should be 5:00 PM
      const lateMorning = new Date(2024, 5, 3, 10, 0, 0, 0); // Monday
      const nextBoundary3 = scheduler.getNextBoundary(testConfig, lateMorning);
      expect(nextBoundary3?.getHours()).toBe(17);
      expect(nextBoundary3?.getMinutes()).toBe(0);
    });

    it('should get the next boundary for next day when no boundaries left today', () => {
      // Test at 9:00 PM - next boundary should be tomorrow 8:30 AM
      const nightTime = new Date(2024, 5, 3, 21, 0, 0, 0); // Monday 9 PM
      const nextBoundary = scheduler.getNextBoundary(testConfig, nightTime);
      
      // Should be next day (Tuesday) at 8:30 AM
      expect(nextBoundary?.getDate()).toBe(4); // Next day
      expect(nextBoundary?.getHours()).toBe(8);
      expect(nextBoundary?.getMinutes()).toBe(30);
    });

    it('should return undefined when no boundaries exist', () => {
      const emptyConfig = { ...testConfig, timeWindows: [] };
      const now = new Date(2024, 5, 3, 8, 0, 0, 0);
      const nextBoundary = scheduler.getNextBoundary(emptyConfig, now);
      expect(nextBoundary).toBeUndefined();
    });

    it('should return far future date when auto mode is disabled', () => {
      const disabledConfig = { ...testConfig, enabled: false };
      const now = new Date(2024, 5, 3, 8, 0, 0, 0);
      const nextBoundary = scheduler.getNextBoundary(disabledConfig, now);
      
      // Should return a date far in the future (next day)
      expect(nextBoundary).toBeDefined();
      expect(nextBoundary!.getDate()).toBe(4); // Next day
    });
  });

  describe('getNavModeRefreshSeconds', () => {
    it('should return correct nav mode refresh seconds', () => {
      expect(scheduler.getNavModeRefreshSeconds(testConfig)).toBe(300);
    });
  });

  describe('validateConfig', () => {
    it('should validate a correct configuration', () => {
      const result = scheduler.validateConfig(testConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid enabled field', () => {
      const invalidConfig = { ...testConfig, enabled: 'true' as any };
      const result = scheduler.validateConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('enabled must be a boolean');
    });

    it('should detect invalid timeWindows field', () => {
      const invalidConfig = { ...testConfig, timeWindows: 'not an array' as any };
      const result = scheduler.validateConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('timeWindows must be an array');
    });

    it('should detect invalid time window properties', () => {
      const invalidConfig = {
        ...testConfig,
        timeWindows: [
          {
            name: '', // Empty name
            mode: 'InvalidMode', // Invalid mode
            startTime: { hour: 'invalid', minute: 0 }, // Invalid hour type
            endTime: { hour: 0, minute: 'invalid' }, // Invalid minute type
            daysOfWeek: 'not an array', // Invalid daysOfWeek
          } as any,
        ],
      };
      const result = scheduler.validateConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('timeWindows[0].name must be a non-empty string');
      expect(result.errors).toContain('timeWindows[0].mode must be \'Compact\' or \'Nav\'');
      expect(result.errors).toContain('timeWindows[0].startTime must have valid hour and minute');
      expect(result.errors).toContain('timeWindows[0].endTime must have valid hour and minute');
      expect(result.errors).toContain('timeWindows[0].daysOfWeek must be an array');
    });

    it('should detect invalid defaultMode', () => {
      const invalidConfig = { ...testConfig, defaultMode: 'InvalidMode' as any };
      const result = scheduler.validateConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('defaultMode must be \'Compact\' or \'Nav\'');
    });

    it('should detect invalid navModeRefreshSeconds', () => {
      const invalidConfig1 = { ...testConfig, navModeRefreshSeconds: 30 }; // Too low
      const result1 = scheduler.validateConfig(invalidConfig1);
      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('navModeRefreshSeconds must be between 60 and 3600');

      const invalidConfig2 = { ...testConfig, navModeRefreshSeconds: 4000 }; // Too high
      const result2 = scheduler.validateConfig(invalidConfig2);
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain('navModeRefreshSeconds must be between 60 and 3600');

      const invalidConfig3 = { ...testConfig, navModeRefreshSeconds: '300' as any }; // Wrong type
      const result3 = scheduler.validateConfig(invalidConfig3);
      expect(result3.valid).toBe(false);
      expect(result3.errors).toContain('navModeRefreshSeconds must be between 60 and 3600');
    });

    it('should detect multiple validation errors', () => {
      const invalidConfig = {
        enabled: 'true' as any,
        timeWindows: 'not an array' as any,
        defaultMode: 'InvalidMode' as any,
        navModeRefreshSeconds: 30,
      };
      const result = scheduler.validateConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});
