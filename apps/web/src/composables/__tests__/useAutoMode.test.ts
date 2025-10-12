import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAutoMode } from '../useAutoMode';

// Mock the configuration file
vi.mock('../../config/automode-config.json', () => ({
  default: {
    autoMode: {
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
    },
  },
}));

describe('useAutoMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve to Nav mode during morning commute window on weekdays', () => {
    const { resolveModeForDate } = useAutoMode();
    
    // Test Monday 8:30 AM
    const mondayMorning = new Date(2024, 5, 3, 8, 30, 0, 0); // Monday
    expect(resolveModeForDate(mondayMorning)).toBe('Nav');
    
    // Test Monday 9:00 AM
    const mondayMidMorning = new Date(2024, 5, 3, 9, 0, 0, 0); // Monday
    expect(resolveModeForDate(mondayMidMorning)).toBe('Nav');
    
    // Test Friday 8:45 AM
    const fridayMorning = new Date(2024, 5, 7, 8, 45, 0, 0); // Friday
    expect(resolveModeForDate(fridayMorning)).toBe('Nav');
  });

  it('should resolve to Nav mode during evening commute window on weekdays', () => {
    const { resolveModeForDate } = useAutoMode();
    
    // Test Monday 5:00 PM
    const mondayEvening = new Date(2024, 5, 3, 17, 0, 0, 0); // Monday
    expect(resolveModeForDate(mondayEvening)).toBe('Nav');
    
    // Test Wednesday 6:30 PM
    const wednesdayEvening = new Date(2024, 5, 5, 18, 30, 0, 0); // Wednesday
    expect(resolveModeForDate(wednesdayEvening)).toBe('Nav');
    
    // Test Friday 7:59 PM
    const fridayLateEvening = new Date(2024, 5, 7, 19, 59, 0, 0); // Friday
    expect(resolveModeForDate(fridayLateEvening)).toBe('Nav');
  });

  it('should resolve to Compact mode outside commute windows on weekdays', () => {
    const { resolveModeForDate } = useAutoMode();
    
    // Test Monday 8:00 AM (before morning window)
    const mondayEarly = new Date(2024, 5, 3, 8, 0, 0, 0); // Monday
    expect(resolveModeForDate(mondayEarly)).toBe('Compact');
    
    // Test Monday 10:00 AM (after morning window)
    const mondayLateMorning = new Date(2024, 5, 3, 10, 0, 0, 0); // Monday
    expect(resolveModeForDate(mondayLateMorning)).toBe('Compact');
    
    // Test Monday 4:00 PM (before evening window)
    const mondayAfternoon = new Date(2024, 5, 3, 16, 0, 0, 0); // Monday
    expect(resolveModeForDate(mondayAfternoon)).toBe('Compact');
    
    // Test Monday 8:00 PM (after evening window)
    const mondayNight = new Date(2024, 5, 3, 20, 0, 0, 0); // Monday
    expect(resolveModeForDate(mondayNight)).toBe('Compact');
  });

  it('should resolve to Compact mode on weekends', () => {
    const { resolveModeForDate } = useAutoMode();
    
    // Test Saturday 8:30 AM (would be Nav on weekday)
    const saturdayMorning = new Date(2024, 5, 8, 8, 30, 0, 0); // Saturday
    expect(resolveModeForDate(saturdayMorning)).toBe('Compact');
    
    // Test Saturday 6:00 PM (would be Nav on weekday)
    const saturdayEvening = new Date(2024, 5, 8, 18, 0, 0, 0); // Saturday
    expect(resolveModeForDate(saturdayEvening)).toBe('Compact');
    
    // Test Sunday 9:00 AM (would be Nav on weekday)
    const sundayMorning = new Date(2024, 5, 9, 9, 0, 0, 0); // Sunday
    expect(resolveModeForDate(sundayMorning)).toBe('Compact');
  });

  it('should get the next boundary correctly', () => {
    const { getNextBoundary } = useAutoMode();
    
    // Test at 8:00 AM - next boundary should be 8:30 AM
    const earlyMorning = new Date(2024, 5, 3, 8, 0, 0, 0); // Monday
    const nextBoundary1 = getNextBoundary(earlyMorning);
    expect(nextBoundary1.getHours()).toBe(8);
    expect(nextBoundary1.getMinutes()).toBe(30);
    
    // Test at 9:00 AM - next boundary should be 9:30 AM
    const midMorning = new Date(2024, 5, 3, 9, 0, 0, 0); // Monday
    const nextBoundary2 = getNextBoundary(midMorning);
    expect(nextBoundary2.getHours()).toBe(9);
    expect(nextBoundary2.getMinutes()).toBe(30);
    
    // Test at 10:00 AM - next boundary should be 5:00 PM
    const lateMorning = new Date(2024, 5, 3, 10, 0, 0, 0); // Monday
    const nextBoundary3 = getNextBoundary(lateMorning);
    expect(nextBoundary3.getHours()).toBe(17);
    expect(nextBoundary3.getMinutes()).toBe(0);
  });

  it('should get the next boundary for next day when no boundaries left today', () => {
    const { getNextBoundary } = useAutoMode();
    
    // Test at 9:00 PM - next boundary should be tomorrow 8:30 AM
    const nightTime = new Date(2024, 5, 3, 21, 0, 0, 0); // Monday 9 PM
    const nextBoundary = getNextBoundary(nightTime);
    
    // Should be next day (Tuesday) at 8:30 AM
    expect(nextBoundary.getDate()).toBe(4); // Next day
    expect(nextBoundary.getHours()).toBe(8);
    expect(nextBoundary.getMinutes()).toBe(30);
  });

  it('should return correct nav mode refresh seconds', () => {
    const { getNavModeRefreshSeconds } = useAutoMode();
    expect(getNavModeRefreshSeconds()).toBe(300);
  });

  it('should be enabled by default', () => {
    const { isEnabled } = useAutoMode();
    expect(isEnabled.value).toBe(true);
  });

  it('should handle boundary edge cases correctly', () => {
    const { resolveModeForDate } = useAutoMode();
    
    // Test exactly at 8:30 AM - should be Nav
    const exactStart = new Date(2024, 5, 3, 8, 30, 0, 0); // Monday
    expect(resolveModeForDate(exactStart)).toBe('Nav');
    
    // Test exactly at 9:30 AM - should be Compact (end is exclusive)
    const exactEnd = new Date(2024, 5, 3, 9, 30, 0, 0); // Monday
    expect(resolveModeForDate(exactEnd)).toBe('Compact');
    
    // Test exactly at 5:00 PM - should be Nav
    const eveningStart = new Date(2024, 5, 3, 17, 0, 0, 0); // Monday
    expect(resolveModeForDate(eveningStart)).toBe('Nav');
    
    // Test exactly at 8:00 PM - should be Compact (end is exclusive)
    const eveningEnd = new Date(2024, 5, 3, 20, 0, 0, 0); // Monday
    expect(resolveModeForDate(eveningEnd)).toBe('Compact');
  });
});
