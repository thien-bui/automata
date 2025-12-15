import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, computed, type ComputedRef } from 'vue';
import { useRoutePolling } from '../useRoutePolling';
import { MonitoringMode } from '../../components/monitoringMode';
import type { AutoModeConfig, RouteTimeResponse } from '@automata/types';
import type { useRouteTime } from '../useRouteTime';
import type { useAutoMode } from '../useAutoMode';
import type { Mock } from 'vitest';

type UseRouteTimeResult = ReturnType<typeof useRouteTime>;
type UseAutoModeReturn = ReturnType<typeof useAutoMode>;
type AugmentedRouteTimeMock = UseRouteTimeResult & {
  refresh: Mock<(...args: any[]) => Promise<void>>;
  setMode: Mock<(...args: any[]) => void>;
  setFreshnessSeconds: Mock<(...args: any[]) => void>;
  setEndpoints: Mock<(...args: any[]) => void>;
};

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

const createRouteTimeMock = (): AugmentedRouteTimeMock => {
  const data = ref<RouteTimeResponse | null>(null);
  const error = ref<string | null>(null);
  const isLoading = ref(false);
  const isRefreshing = ref(false);
  const freshnessSeconds = ref(120);
  const mode = ref<'driving' | 'walking' | 'transit'>('driving');
  const from = ref('Origin');
  const to = ref('Destination');
  const lastUpdated = ref<string | null>(null);
  const cacheAge = ref<number | null>(null);
  const cacheHit = ref(false);
  const stale = ref(false);
  const refreshMock = vi.fn(async () => {});
  const setModeMock = vi.fn();
  const setEndpointsMock = vi.fn();
  const setFreshnessSecondsMock = vi.fn();

  return {
    data,
    error,
    isLoading,
    isRefreshing,
    isStale: computed(() => stale.value),
    lastUpdatedIso: computed(() => lastUpdated.value),
    cacheAgeSeconds: computed(() => cacheAge.value),
    cacheHit: computed(() => cacheHit.value),
    freshnessSeconds,
    mode,
    from,
    to,
    refresh: refreshMock,
    setMode: setModeMock,
    setEndpoints: setEndpointsMock,
    setFreshnessSeconds: setFreshnessSecondsMock,
  };
};

const createDefaultAutoModeConfig = (): AutoModeConfig => ({
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
  ],
  defaultMode: 'Compact',
  navModeRefreshSeconds: 60,
});

const createToastMock = () => ({
  push: vi.fn(),
  messages: ref([]),
  dismiss: vi.fn(),
  clear: vi.fn(),
});

const isTimeWithinWindow = (date: Date, window: AutoModeConfig['timeWindows'][number]): boolean => {
  const day = date.getDay();
  if (!window.daysOfWeek.includes(day)) {
    return false;
  }

  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const startMinutes = window.startTime.hour * 60 + window.startTime.minute;
  const endMinutes = window.endTime.hour * 60 + window.endTime.minute;

  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
};

const createAutoModeMock = (): UseAutoModeReturn => {
  const resolveModeForDate = vi.fn((date: Date) => {
    const config = autoModeConfigRef.value;
    if (!config.enabled) {
      return config.defaultMode;
    }

    const activeWindow = config.timeWindows.find(window => isTimeWithinWindow(date, window));
    return activeWindow ? activeWindow.mode : config.defaultMode;
  });

  const getNextBoundary = vi.fn((date: Date) => new Date(date.getTime() + 30 * 60 * 1000));

  return {
    config: computed(() => autoModeConfigRef.value),
    isEnabled: computed(() => autoModeConfigRef.value.enabled),
    resolveModeForDate,
    getNextBoundary,
    getNavModeRefreshSeconds: vi.fn(() => autoModeConfigRef.value.navModeRefreshSeconds),
    updateConfig: vi.fn(),
    resetConfig: vi.fn(),
  } as unknown as UseAutoModeReturn;
};

let routeTimeMock: ReturnType<typeof createRouteTimeMock>;
const autoModeConfigRef = ref<AutoModeConfig>(createDefaultAutoModeConfig());
let autoModeMock: UseAutoModeReturn;
let toastMock: ReturnType<typeof createToastMock>;

describe('useRoutePolling', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    const routeTimeModule = await import('../useRouteTime');
    const autoModeModule = await import('../useAutoMode');
    const toastsModule = await import('../useToasts');

    routeTimeMock = createRouteTimeMock();
    toastMock = createToastMock();
    autoModeConfigRef.value = createDefaultAutoModeConfig();

    autoModeMock = createAutoModeMock();

    vi.mocked(routeTimeModule.useRouteTime).mockReturnValue(routeTimeMock);
    vi.mocked(autoModeModule.useAutoMode).mockReturnValue(autoModeMock);
    vi.mocked(toastsModule.useToasts).mockReturnValue(toastMock);
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
    // Set a time outside the auto mode window to avoid auto mode switching
    vi.setSystemTime(new Date(2024, 5, 3, 10, 0, 0, 0)); // Monday 10:00 AM (outside 8:30-9:30 window)
    
    const result = useRoutePolling({
      from: 'Test Origin',
      to: 'Test Destination',
      initialMode: MonitoringMode.Compact,
      initialRefreshInterval: 120,
    });

    expect(result.mode.value).toBe(MonitoringMode.Compact);
    expect(result.refreshInterval.value).toBe(120);
    expect(result.isPolling.value).toBe(false);
    expect(result.pollingSeconds.value).toBe(120);
  });

  it('uses Nav mode refresh seconds when in Nav mode', () => {
    autoModeConfigRef.value = {
      ...autoModeConfigRef.value,
      navModeRefreshSeconds: 30,
    };

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
      initialMode: MonitoringMode.Compact,
      initialRefreshInterval: 120,
    });

    expect(routeTimeMock.refresh).toHaveBeenCalledWith({
      background: false,
      reason: 'initial',
      forceRefresh: undefined,
    });
  });

  it('applies auto mode on mount', () => {
    const testDate = new Date(2024, 5, 3, 8, 45, 0, 0); // Monday 8:45 AM
    vi.setSystemTime(testDate);

    const result = useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Compact,
      initialRefreshInterval: 120,
    });

    expect(result.mode.value).toBe(MonitoringMode.Nav);
  });

  it('sets up polling interval', () => {
    useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Compact,
      initialRefreshInterval: 60,
    });

    expect(routeTimeMock.setFreshnessSeconds).toHaveBeenCalledWith(60);

    vi.advanceTimersByTime(60000); // 60 seconds
    
    expect(routeTimeMock.refresh).toHaveBeenCalledWith({
      background: true,
      reason: 'interval',
      forceRefresh: undefined,
    });
  });

  it('triggers polling on mode change', async () => {
    const result = useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Compact,
      initialRefreshInterval: 120,
    });

    // Clear the initial call
    routeTimeMock.refresh.mockClear();

    result.setMode(MonitoringMode.Nav);
    
    // Wait for the watcher to trigger
    await vi.runAllTimersAsync();

    expect(routeTimeMock.setMode).toHaveBeenCalledWith('driving');
    expect(routeTimeMock.refresh).toHaveBeenCalledWith({
      background: true,
      reason: 'mode-change',
      forceRefresh: undefined,
    });
  });

  it('handles manual refresh', async () => {
    const result = useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Compact,
      initialRefreshInterval: 120,
    });

    routeTimeMock.refresh.mockClear();
    routeTimeMock.error.value = null;

    await result.triggerPolling('manual');

    expect(routeTimeMock.refresh).toHaveBeenCalledWith({
      background: false,
      reason: 'manual',
      forceRefresh: undefined,
    });
    expect(toastMock.push).toHaveBeenCalledWith({
      text: 'Route data refreshed.',
      variant: 'success',
    });
  });

  it('handles hard refresh', async () => {
    const result = useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Compact,
      initialRefreshInterval: 120,
    });

    routeTimeMock.refresh.mockClear();
    routeTimeMock.error.value = null;

    await result.triggerPolling('hard-manual', { forceRefresh: true });

    expect(routeTimeMock.refresh).toHaveBeenCalledWith({
      background: false,
      reason: 'hard-manual',
      forceRefresh: true,
    });
    expect(toastMock.push).toHaveBeenCalledWith({
      text: 'Route data refreshed from provider.',
      variant: 'success',
    });
  });

  it('shows error toast when error occurs', () => {
    routeTimeMock.error.value = 'Network error';

    useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Compact,
      initialRefreshInterval: 120,
    });

    // Error toast should be shown via watcher
    expect(toastMock.push).toHaveBeenCalledWith({
      text: 'Network error',
      variant: 'error',
      timeout: 6000,
    });
  });

  it('shows stale data toast when data is stale', async () => {
    // Create a new mock with stale data for this test
    const staleMockRouteTime = {
      ...routeTimeMock,
      data: ref(createRouteData(30)),
      isStale: computed(() => true),
    } as UseRouteTimeResult;

    const routeTimeModule = await import('../useRouteTime');
    vi.mocked(routeTimeModule.useRouteTime).mockReturnValue(staleMockRouteTime);

    useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Compact,
      initialRefreshInterval: 120,
    });

    expect(toastMock.push).toHaveBeenCalledWith({
      text: 'Showing cached route data while waiting for a fresh provider response.',
      variant: 'warning',
      timeout: 7000,
    });
  });

  it('schedules auto mode switches', async () => {
    vi.setSystemTime(new Date(2024, 5, 3, 8, 0, 0, 0)); // Monday 8:00 AM
    useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Compact,
      initialRefreshInterval: 120,
    });

    routeTimeMock.refresh.mockClear();

    // Fast forward 30 minutes to the start boundary
    vi.advanceTimersByTime(30 * 60 * 1000);
    await vi.runAllTimersAsync();

    expect(routeTimeMock.refresh).toHaveBeenCalledWith({
      background: true,
      reason: 'mode-change',
      forceRefresh: undefined,
    });
  });

  it('updates refresh interval', () => {
    const result = useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Compact,
      initialRefreshInterval: 120,
    });

    result.setRefreshInterval(180);

    expect(result.refreshInterval.value).toBe(180);
  });

  it('computes isPolling correctly', () => {
    routeTimeMock.isLoading.value = true;
    
    const result = useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Compact,
      initialRefreshInterval: 120,
    });

    expect(result.isPolling.value).toBe(true);

    routeTimeMock.isLoading.value = false;
    routeTimeMock.isRefreshing.value = true;

    expect(result.isPolling.value).toBe(true);

    routeTimeMock.isRefreshing.value = false;

    expect(result.isPolling.value).toBe(false);
  });

  it('computes isNavMode correctly', () => {
    autoModeConfigRef.value = {
      ...autoModeConfigRef.value,
      navModeRefreshSeconds: 60,
    };

    const result = useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Nav,
      initialRefreshInterval: 120,
    });

    expect(result.pollingSeconds.value).toBe(60); // Nav mode uses getNavModeRefreshSeconds
  });

  it('reapplies current mode when auto mode config changes', async () => {
    vi.setSystemTime(new Date(2024, 5, 3, 8, 45, 0, 0)); // Monday 8:45 AM

    const result = useRoutePolling({
      from: 'Origin',
      to: 'Destination',
      initialMode: MonitoringMode.Compact,
      initialRefreshInterval: 120,
    });

    expect(result.mode.value).toBe(MonitoringMode.Nav);

    autoModeConfigRef.value = {
      ...autoModeConfigRef.value,
      enabled: false,
      timeWindows: [],
    };

    await vi.runAllTimersAsync();

    expect(result.mode.value).toBe(MonitoringMode.Compact);
  });
});
