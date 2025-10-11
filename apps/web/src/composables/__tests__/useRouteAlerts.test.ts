import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useRouteAlerts } from '../useRouteAlerts';
import type { RouteTimeResponse } from '@automata/types';

// Mock dependencies
vi.mock('../useToasts', () => ({
  useToasts: vi.fn(),
}));

vi.mock('../useUiPreferences', () => ({
  useUiPreferences: vi.fn(),
}));

const mockToasts = {
  push: vi.fn(),
};

const mockUiPreferences = {
  isWidgetCompact: vi.fn(() => false),
};

describe('useRouteAlerts', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const toastsModule = await import('../useToasts');
    const uiPreferencesModule = await import('../useUiPreferences');

    vi.mocked(toastsModule.useToasts).mockReturnValue(mockToasts);
    vi.mocked(uiPreferencesModule.useUiPreferences).mockReturnValue(mockUiPreferences);
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

  it('initializes with empty alerts', () => {
    const routeData = ref<RouteTimeResponse | null>(null);
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    expect(result.activeAlerts.value).toEqual([]);
  });

  it('creates alert when route duration exceeds threshold', () => {
    const routeData = ref(createRouteData(60)); // 60 minutes > 45 threshold
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    expect(result.activeAlerts.value).toHaveLength(1);
    expect(result.activeAlerts.value[0].message).toContain('60.0 min exceeds threshold of 45 min');
    expect(result.activeAlerts.value[0].id).toBeTypeOf('number');
  });

  it('does not create alert when route duration is below threshold', () => {
    const routeData = ref(createRouteData(30)); // 30 minutes < 45 threshold
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    expect(result.activeAlerts.value).toEqual([]);
  });

  it('does not create alert when route data is null', () => {
    const routeData = ref<RouteTimeResponse | null>(null);
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    expect(result.activeAlerts.value).toEqual([]);
  });

  it('shows toast when alert is created', () => {
    const routeData = ref(createRouteData(60));
    const thresholdMinutes = ref(45);

    useRouteAlerts({ routeData, thresholdMinutes });

    expect(mockToasts.push).toHaveBeenCalledWith({
      text: 'Travel time 60.0 min exceeds threshold of 45 min.',
      variant: 'warning',
      timeout: 7000,
    });
  });

  it('acknowledges alerts correctly', () => {
    const routeData = ref(createRouteData(60));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    expect(result.activeAlerts.value).toHaveLength(1);

    result.acknowledgeAlerts();

    expect(result.activeAlerts.value).toEqual([]);
  });

  it('prevents duplicate alerts for same route data and threshold', () => {
    const routeData = ref(createRouteData(60));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    // First alert should be created
    expect(result.activeAlerts.value).toHaveLength(1);
    expect(mockToasts.push).toHaveBeenCalledTimes(1);

    // Update route data with same timestamp (simulating re-fetch)
    const sameRouteData = { ...routeData.value };
    routeData.value = sameRouteData;

    // Should not create new alert
    expect(result.activeAlerts.value).toHaveLength(1);
    expect(mockToasts.push).toHaveBeenCalledTimes(1);
  });

  it('creates new alert when route data changes', () => {
    const routeData = ref(createRouteData(60));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    // First alert
    expect(result.activeAlerts.value).toHaveLength(1);
    expect(mockToasts.push).toHaveBeenCalledTimes(1);

    // Update route data with new timestamp
    const newRouteData = createRouteData(65);
    routeData.value = newRouteData;

    // Should create new alert
    expect(result.activeAlerts.value).toHaveLength(1);
    expect(mockToasts.push).toHaveBeenCalledTimes(2);
  });

  it('creates new alert when threshold changes', () => {
    const routeData = ref(createRouteData(60));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    // First alert with threshold 45
    expect(result.activeAlerts.value).toHaveLength(1);
    expect(mockToasts.push).toHaveBeenCalledTimes(1);

    // Change threshold to 30 (still exceeded)
    thresholdMinutes.value = 30;

    // Should create new alert
    expect(result.activeAlerts.value).toHaveLength(1);
    expect(mockToasts.push).toHaveBeenCalledTimes(2);
  });

  it('removes alert when duration drops below threshold', () => {
    const routeData = ref(createRouteData(60));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    expect(result.activeAlerts.value).toHaveLength(1);

    // Update route data with lower duration
    routeData.value = createRouteData(30);

    expect(result.activeAlerts.value).toEqual([]);
  });

  it('handles compact mode correctly', () => {
    mockUiPreferences.isWidgetCompact.mockReturnValue(true);

    const routeData = ref(createRouteData(60));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    expect(result.activeAlerts.value).toHaveLength(1);
    // In compact mode, message should still be created for toast
    expect(result.activeAlerts.value[0].message).toContain('60.0 min exceeds threshold of 45 min');
  });

  it('emits alert count correctly', () => {
    const routeData = ref(createRouteData(60));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    const mockEmit = vi.fn();
    result.emitAlertCount = mockEmit;

    // Should emit count when alert is created
    expect(mockEmit).toHaveBeenCalledWith(1);

    // Should emit count when alert is acknowledged
    mockEmit.mockClear();
    result.acknowledgeAlerts();
    expect(mockEmit).toHaveBeenCalledWith(0);
  });

  it('does not emit count when count is the same', () => {
    const routeData = ref(createRouteData(60));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    const mockEmit = vi.fn();
    result.emitAlertCount = mockEmit;

    // First emission
    expect(mockEmit).toHaveBeenCalledWith(1);

    // Update with same data should not emit again
    mockEmit.mockClear();
    const sameRouteData = { ...routeData.value };
    routeData.value = sameRouteData;

    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('handles acknowledged alerts correctly', () => {
    const routeData = ref(createRouteData(60));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    // Create and acknowledge alert
    expect(result.activeAlerts.value).toHaveLength(1);
    result.acknowledgeAlerts();
    expect(result.activeAlerts.value).toEqual([]);

    // Update with same data should not recreate alert
    const sameRouteData = { ...routeData.value };
    routeData.value = sameRouteData;

    expect(result.activeAlerts.value).toEqual([]);
  });

  it('recreates alert after acknowledgment when data changes', () => {
    const routeData = ref(createRouteData(60));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    // Create and acknowledge alert
    expect(result.activeAlerts.value).toHaveLength(1);
    result.acknowledgeAlerts();
    expect(result.activeAlerts.value).toEqual([]);

    // Update with new timestamp should recreate alert
    const newRouteData = createRouteData(65);
    routeData.value = newRouteData;

    expect(result.activeAlerts.value).toHaveLength(1);
  });

  it('formats duration correctly in alert message', () => {
    const routeData = ref(createRouteData(55.75));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    expect(result.activeAlerts.value[0].message).toContain('55.8 min exceeds threshold of 45 min');
  });

  it('handles edge case of duration exactly at threshold', () => {
    const routeData = ref(createRouteData(45)); // Exactly at threshold
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    expect(result.activeAlerts.value).toEqual([]);
  });
});
