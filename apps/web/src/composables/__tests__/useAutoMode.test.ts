import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAutoMode } from '../useAutoMode';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create mock response
const createMockResponse = (data: any) => ({
  ok: true,
  json: async () => data,
});

// Default mock response
const defaultMockResponse = {
  currentMode: 'Compact',
  nextBoundaryIso: null,
  config: {
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
  lastUpdatedIso: new Date().toISOString(),
};

describe('useAutoMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(createMockResponse(defaultMockResponse));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should resolve to Nav mode when API returns Nav', async () => {
    const { resolveModeForDate, fetchStatus } = useAutoMode();
    
    // Mock response with Nav mode
    mockFetch.mockResolvedValue(createMockResponse({
      ...defaultMockResponse,
      currentMode: 'Nav',
    }));
    
    await fetchStatus();
    
    // Should return Nav mode regardless of date
    const mondayMorning = new Date(2024, 5, 3, 8, 30, 0, 0);
    expect(resolveModeForDate(mondayMorning)).toBe('Nav');
    
    const mondayMidMorning = new Date(2024, 5, 3, 9, 0, 0, 0);
    expect(resolveModeForDate(mondayMidMorning)).toBe('Nav');
    
    const fridayMorning = new Date(2024, 5, 7, 8, 45, 0, 0);
    expect(resolveModeForDate(fridayMorning)).toBe('Nav');
  });

  it('should resolve to Nav mode when API returns Nav (evening)', async () => {
    const { resolveModeForDate, fetchStatus } = useAutoMode();
    
    // Mock response with Nav mode
    mockFetch.mockResolvedValue(createMockResponse({
      ...defaultMockResponse,
      currentMode: 'Nav',
    }));
    
    await fetchStatus();
    
    // Should return Nav mode regardless of date
    const mondayEvening = new Date(2024, 5, 3, 17, 0, 0, 0);
    expect(resolveModeForDate(mondayEvening)).toBe('Nav');
    
    const wednesdayEvening = new Date(2024, 5, 5, 18, 30, 0, 0);
    expect(resolveModeForDate(wednesdayEvening)).toBe('Nav');
    
    const fridayLateEvening = new Date(2024, 5, 7, 19, 59, 0, 0);
    expect(resolveModeForDate(fridayLateEvening)).toBe('Nav');
  });

  it('should resolve to Compact mode when API returns Compact', async () => {
    const { resolveModeForDate, fetchStatus } = useAutoMode();
    
    // Mock response with Compact mode
    mockFetch.mockResolvedValue(createMockResponse({
      ...defaultMockResponse,
      currentMode: 'Compact',
    }));
    
    await fetchStatus();
    
    // Should return Compact mode regardless of date
    const mondayEarly = new Date(2024, 5, 3, 8, 0, 0, 0);
    expect(resolveModeForDate(mondayEarly)).toBe('Compact');
    
    const mondayLateMorning = new Date(2024, 5, 3, 10, 0, 0, 0);
    expect(resolveModeForDate(mondayLateMorning)).toBe('Compact');
    
    const mondayAfternoon = new Date(2024, 5, 3, 16, 0, 0, 0);
    expect(resolveModeForDate(mondayAfternoon)).toBe('Compact');
    
    const mondayNight = new Date(2024, 5, 3, 20, 0, 0, 0);
    expect(resolveModeForDate(mondayNight)).toBe('Compact');
  });

  it('should resolve to Compact mode when API returns Compact (weekend)', async () => {
    const { resolveModeForDate, fetchStatus } = useAutoMode();
    
    // Mock response with Compact mode
    mockFetch.mockResolvedValue(createMockResponse({
      ...defaultMockResponse,
      currentMode: 'Compact',
    }));
    
    await fetchStatus();
    
    // Should return Compact mode regardless of day
    const saturdayMorning = new Date(2024, 5, 8, 8, 30, 0, 0);
    expect(resolveModeForDate(saturdayMorning)).toBe('Compact');
    
    const saturdayEvening = new Date(2024, 5, 8, 18, 0, 0, 0);
    expect(resolveModeForDate(saturdayEvening)).toBe('Compact');
    
    const sundayMorning = new Date(2024, 5, 9, 9, 0, 0, 0);
    expect(resolveModeForDate(sundayMorning)).toBe('Compact');
  });

  it('should get the next boundary from API', async () => {
    const { getNextBoundary, fetchStatus } = useAutoMode();
    
    const nextBoundaryDate = new Date(2024, 5, 3, 8, 30, 0, 0);
    
    // Mock response with next boundary
    mockFetch.mockResolvedValue(createMockResponse({
      ...defaultMockResponse,
      nextBoundaryIso: nextBoundaryDate.toISOString(),
    }));
    
    await fetchStatus();
    
    const earlyMorning = new Date(2024, 5, 3, 8, 0, 0, 0);
    const nextBoundary = getNextBoundary(earlyMorning);
    expect(nextBoundary.getHours()).toBe(8);
    expect(nextBoundary.getMinutes()).toBe(30);
  });

  it('should get the next boundary for next day from API', async () => {
    const { getNextBoundary, fetchStatus } = useAutoMode();
    
    const nextDayBoundary = new Date(2024, 5, 4, 8, 30, 0, 0); // Tuesday 8:30 AM
    
    // Mock response with next day boundary
    mockFetch.mockResolvedValue(createMockResponse({
      ...defaultMockResponse,
      nextBoundaryIso: nextDayBoundary.toISOString(),
    }));
    
    await fetchStatus();
    
    const nightTime = new Date(2024, 5, 3, 21, 0, 0, 0); // Monday 9 PM
    const nextBoundary = getNextBoundary(nightTime);
    
    expect(nextBoundary.getDate()).toBe(4); // Next day
    expect(nextBoundary.getHours()).toBe(8);
    expect(nextBoundary.getMinutes()).toBe(30);
  });

  it('should return correct nav mode refresh seconds', () => {
    const { getNavModeRefreshSeconds } = useAutoMode();
    expect(getNavModeRefreshSeconds()).toBe(300);
  });

  it('should be enabled by default', async () => {
    const { isEnabled, fetchStatus } = useAutoMode();
    
    await fetchStatus();
    
    expect(isEnabled.value).toBe(true);
  });

  it('should handle boundary edge cases correctly', async () => {
    const { resolveModeForDate, fetchStatus } = useAutoMode();
    
    // Test with Nav mode
    mockFetch.mockResolvedValue(createMockResponse({
      ...defaultMockResponse,
      currentMode: 'Nav',
    }));
    
    await fetchStatus();
    
    // Should return Nav mode regardless of exact time
    const exactStart = new Date(2024, 5, 3, 8, 30, 0, 0);
    expect(resolveModeForDate(exactStart)).toBe('Nav');
    
    const exactEnd = new Date(2024, 5, 3, 9, 30, 0, 0);
    expect(resolveModeForDate(exactEnd)).toBe('Nav');
    
    const eveningStart = new Date(2024, 5, 3, 17, 0, 0, 0);
    expect(resolveModeForDate(eveningStart)).toBe('Nav');
    
    const eveningEnd = new Date(2024, 5, 3, 20, 0, 0, 0);
    expect(resolveModeForDate(eveningEnd)).toBe('Nav');
    
    // Test with Compact mode
    mockFetch.mockResolvedValue(createMockResponse({
      ...defaultMockResponse,
      currentMode: 'Compact',
    }));
    
    await fetchStatus();
    
    const mondayEarly = new Date(2024, 5, 3, 8, 0, 0, 0);
    expect(resolveModeForDate(mondayEarly)).toBe('Compact');
  });
});
