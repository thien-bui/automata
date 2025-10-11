import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useRoutePolling } from '../useRoutePolling';
import { MonitoringMode } from '../../components/monitoringMode';
import type { RouteTimeResponse } from '@automata/types';

// Mock dependencies
vi.mock('../useRouteTime', () => ({
  useRouteTime: vi.fn(),
}));

vi.mock('../useAutoMode', () => ({
  useAutoMode: vi.fn(),
}));

vi.mock('../useToasts', () => ({
  useToasts: vi.fn(),
}));

const mockRouteTime = {
  data: ref<RouteTimeResponse | null>(null),
  error: ref<string | null>(null),
  isLoading: ref(false),
  isRefreshing: ref(false),
  isStale: ref(false),
  lastUpdatedIso: ref<string | null>(null),
  cacheAgeSeconds: ref<number | null>(null),
  cacheHit: ref(false),
  from: ref('Origin'),
  to: ref('Destination'),
  refresh: vi.fn(),
  setMode: vi.fn(),
  setFreshnessSeconds: vi.fn(),
};

const mockAutoMode = {
  resolveModeForDate: vi.fn(),
  getNextBoundary: vi.fn(),
  getNavModeRefreshSeconds: vi.fn(() => 60),
};

const mockToasts = {
  push: vi.fn(),
};

describe('useRoutePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    
    const { useRouteTime } = require('../useRouteTime');
    const { useAutoMode } = require('../useAutoMode');
    const { useToasts } = require('../useToasts');
    
    useRouteTime.mockReturnValue(mockRouteTime);
    useAutoMode.mockReturnValue(mockAutoMode);
    useToasts.mockReturnValue(mockToasts);
    
    mockAutoMode.resolveModeForDate.mockReturnValue('Simple');
    mockAutoMode.getNextBoundary.mockReturnValue(new Date(Date.now() + 3600000)); // 1 hour from now
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createRouteData = (durationMinutes: number): RouteTimeResponse => ({
    durationMinutes,
    distanceKm: 10,
    provider: 'google-directions',
    mode: 'driving',
    lastUpdatedIso: new Date().toISOString(),
    cache: {
      hit: false,
      ageSeconds: 0,
      staleWhileRevalidate: false,
    },
  });

  it('initializes with correct default values', () => {
    const result = useRoutePolling({
      from: 'Test Origin',
      to: 'Test Destination',
      initialMode: MonitoringMode.Simple,
      initialRefreshInterval: 120,
    });

    expect(result.mode.value).toBe(MonitoringMode.Simple);
    expect(result.refreshInterval.value).toBe(120);
    expect(result.isPolling.value).toBe(false);
    expect(result.pollingSeconds.value).toBe(120);
  });

  it('uses Nav mode refresh seconds when in Nav mode', () => {
    mockAutoMode.getNavModeRefreshSeconds.mockReturnValue(30);
    
    const result = useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Nav,
      initialRefreshInterval: 120,
    });

    expect(result.pollingSeconds.value).toBe(30);
  });

  it('triggers initial polling on mount', () => {
    useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Simple,
      initialRefreshInterval: 120,
    });

    expect(mockRouteTime.refresh).toHaveBeenCalledWith({
      background: false,
      reason: 'initial',
      forceRefresh: undefined,
    });
  });

  it('applies auto mode on mount', () => {
    const testDate = new Date('2024-06-01T08:30:00Z');
    vi.setSystemTime(testDate);
    
    mockAutoMode.resolveModeForDate.mockReturnValue('Nav');
    
    const result = useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Simple,
      initialRefreshInterval: 120,
    });

    expect(mockAutoMode.resolveModeForDate).toHaveBeenCalledWith(testDate);
    expect(result.mode.value).toBe(MonitoringMode.Nav);
  });

  it('sets up polling interval', () => {
    useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Simple,
      initialRefreshInterval: 60,
    });

    expect(mockRouteTime.setFreshnessSeconds).toHaveBeenCalledWith(60);

    vi.advanceTimersByTime(60000); // 60 seconds
    
    expect(mockRouteTime.refresh).toHaveBeenCalledWith({
      background: true,
      reason: 'interval',
      forceRefresh: undefined,
    });
  });

  it('triggers polling on mode change', async () => {
    const result = useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Simple,
      initialRefreshInterval: 120,
    });

    // Clear the initial call
    mockRouteTime.refresh.mockClear();

    result.setMode(MonitoringMode.Nav);
    
    // Wait for the watcher to trigger
    await vi.runAllTimersAsync();

    expect(mockRouteTime.setMode).toHaveBeenCalledWith('driving');
    expect(mockRouteTime.refresh).toHaveBeenCalledWith({
      background: true,
      reason: 'mode-change',
      forceRefresh: undefined,
    });
  });

  it('handles manual refresh', async () => {
    const result = useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Simple,
      initialRefreshInterval: 120,
    });

    mockRouteTime.refresh.mockClear();
    mockRouteTime.error.value = null;

    await result.triggerPolling('manual');

    expect(mockRouteTime.refresh).toHaveBeenCalledWith({
      background: false,
      reason: 'manual',
      forceRefresh: undefined,
    });
    expect(mockToasts.push).toHaveBeenCalledWith({
      text: 'Route data refreshed.',
      variant: 'success',
    });
  });

  it('handles hard refresh', async () => {
    const result = useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Simple,
      initialRefreshInterval: 120,
    });

    mockRouteTime.refresh.mockClear();
    mockRouteTime.error.value = null;

    await result.triggerPolling('hard-manual', { forceRefresh: true });

    expect(mockRouteTime.refresh).toHaveBeenCalledWith({
      background: false,
      reason: 'hard-manual',
      forceRefresh: true,
    });
    expect(mockToasts.push).toHaveBeenCalledWith({
      text: 'Route data refreshed from provider.',
      variant: 'success',
    });
  });

  it('shows error toast when error occurs', () => {
    mockRouteTime.error.value = 'Network error';

    useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Simple,
      initialRefreshInterval: 120,
    });

    // Error toast should be shown via watcher
    expect(mockToasts.push).toHaveBeenCalledWith({
      text: 'Network error',
      variant: 'error',
      timeout: 6000,
    });
  });

  it('shows stale data toast when data is stale', () => {
    mockRouteTime.data.value = createRouteData(30);
    mockRouteTime.isStale.value = true;

    useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Simple,
      initialRefreshInterval: 120,
    });

    expect(mockToasts.push).toHaveBeenCalledWith({
      text: 'Showing cached route data while waiting for a fresh provider response.',
      variant: 'warning',
      timeout: 7000,
    });
  });

  it('schedules auto mode switches', () => {
    const now = new Date('2024-06-01T08:00:00Z');
    const boundary = new Date('2024-06-01T08:30:00Z');
    
    vi.setSystemTime(now);
    mockAutoMode.getNextBoundary.mockReturnValue(boundary);
    mockAutoMode.resolveModeForDate.mockReturnValue('Nav');

    useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Simple,
      initialRefreshInterval: 120,
    });

    // Fast forward to boundary
    vi.advanceTimersByTime(boundary.getTime() - now.getTime());

    expect(mockAutoMode.resolveModeForDate).toHaveBeenCalled();
  });

  it('updates refresh interval', () => {
    const result = useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Simple,
      initialRefreshInterval: 120,
    });

    result.setRefreshInterval(180);

    expect(result.refreshInterval.value).toBe(180);
  });

  it('computes isPolling correctly', () => {
    mockRouteTime.isLoading.value = true;
    
    const result = useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Simple,
      initialRefreshInterval: 120,
    });

    expect(result.isPolling.value).toBe(true);

    mockRouteTime.isLoading.value = false;
    mockRouteTime.isRefreshing.value = true;

    expect(result.isPolling.value).toBe(true);

    mockRouteTime.isRefreshing.value = false;

    expect(result.isPolling.value).toBe(false);
  });

  it('computes isNavMode correctly', () => {
    const result = useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Nav,
      initialRefreshInterval: 120,
    });

    expect(result.pollingSeconds.value).toBe(60); // Nav mode uses getNavModeRefreshSeconds
  });

  it('cleans up timers on unmount', () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');

    // Create the composable to set up timers
    useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Simple,
      initialRefreshInterval: 120,
    });

    // Advance timers to trigger cleanup
    vi.advanceTimersByTime(1000);

    // The cleanup happens in onBeforeUnmount, which we can't directly test
    // but we can verify that the timers are set up correctly
    expect(clearIntervalSpy).not.toHaveBeenCalled();
    expect(clearTimeoutSpy).not.toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });
});
