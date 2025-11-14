import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computed, readonly, ref } from 'vue';
import { useRouteAlerts } from '../useRouteAlerts';
import type { RouteTimeResponse, WidgetCompactMode, RouteAlert } from '@automata/types';

// Mock dependencies
vi.mock('../useToasts', () => ({
  useToasts: vi.fn(),
}));

vi.mock('../useUiPreferences', () => ({
  useUiPreferences: vi.fn(),
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create mock response
const createMockResponse = (data: any) => ({
  ok: true,
  json: async () => data,
});

const mockToasts = {
  push: vi.fn(),
  messages: ref([]),
  dismiss: vi.fn(),
  clear: vi.fn(),
};

const compactState = ref({
  compactMode: false,
  widgetCompactModes: {},
});

const mockUiPreferences = {
  state: readonly(compactState),
  isCompact: computed(() => compactState.value.compactMode),
  setCompactMode: vi.fn(),
  toggleCompactMode: vi.fn(),
  resetPreferences: vi.fn(),
  getWidgetCompactMode: vi.fn((): WidgetCompactMode => 'use-global'),
  setWidgetCompactMode: vi.fn(),
  isWidgetCompact: vi.fn((_widgetName: string) => false),
  didHydrateFromStorage: computed(() => true),
  isLoading: readonly(ref(false)),
  error: readonly(ref(null)),
};

describe('useRouteAlerts', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    compactState.value = {
      compactMode: false,
      widgetCompactModes: {},
    };
    mockUiPreferences.isWidgetCompact.mockReturnValue(false);

    // Set to track acknowledged alert IDs
    const acknowledgedAlertIds = new Set<number>();

    // Helper to generate stable alert ID
    const generateAlertId = (routeData: any, thresholdMinutes: number): number => {
      const key = `${routeData.durationMinutes}-${routeData.distanceKm}-${routeData.mode}-${thresholdMinutes}`;
      let hash = 0;
      for (let i = 0; i < key.length; i++) {
        hash = ((hash << 5) - hash) + key.charCodeAt(i);
        hash = hash & hash;
      }
      return Math.abs(hash);
    };

    // Set up default fetch mock
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/alerts/route')) {
        // Parse query parameters
        const urlObj = new URL(url, 'http://localhost');
        const routeDataJson = urlObj.searchParams.get('routeData');
        const thresholdMinutes = parseInt(urlObj.searchParams.get('thresholdMinutes') || '0');
        
        let alerts: RouteAlert[] = [];
        let totalCount = 0;
        let unacknowledgedCount = 0;
        
        if (routeDataJson) {
          try {
            const routeData = JSON.parse(routeDataJson);
            if (routeData.durationMinutes > thresholdMinutes) {
              const alertId = generateAlertId(routeData, thresholdMinutes);
              // Only create alert if not acknowledged
              if (!acknowledgedAlertIds.has(alertId)) {
                alerts = [{
                  id: alertId,
                  message: `Travel time ${routeData.durationMinutes.toFixed(1)} min exceeds threshold of ${thresholdMinutes} min.`,
                  thresholdMinutes,
                  routeData,
                  acknowledged: false,
                  createdAtIso: new Date().toISOString(),
                }];
                totalCount = 1;
                unacknowledgedCount = 1;
              }
            }
          } catch (e) {
            // Invalid JSON, return empty alerts
          }
        }
        
        return Promise.resolve(createMockResponse({
          alerts,
          totalCount,
          unacknowledgedCount,
          lastUpdatedIso: new Date().toISOString(),
        }));
      }
      
      if (url.includes('/api/alerts/acknowledge')) {
        const requestBody = options?.body ? JSON.parse(options.body.toString()) : {};
        
        if (requestBody.alertIds) {
          requestBody.alertIds.forEach((id: number) => acknowledgedAlertIds.add(id));
        } else if (requestBody.acknowledgeAll) {
          // For acknowledgeAll, clear the set (test doesn't use this in the failing case)
          acknowledgedAlertIds.clear();
        }
        
        return Promise.resolve(createMockResponse({
          success: true,
          message: 'Alerts acknowledged',
          acknowledgedCount: requestBody.alertIds?.length || 1,
          lastUpdatedIso: new Date().toISOString(),
        }));
      }
      
      return Promise.resolve(createMockResponse({}));
    });

    const toastsModule = await import('../useToasts');
    const uiPreferencesModule = await import('../useUiPreferences');

    vi.mocked(toastsModule.useToasts).mockReturnValue(mockToasts);
    vi.mocked(uiPreferencesModule.useUiPreferences).mockReturnValue(mockUiPreferences);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('creates alert when route duration exceeds threshold', async () => {
    const routeData = ref(createRouteData(60)); // 60 minutes > 45 threshold
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    // Wait for the initial refresh to complete
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });

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

  it('shows toast when alert is created', async () => {
    const routeData = ref(createRouteData(60));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    // Wait for the initial refresh to complete
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });

    expect(mockToasts.push).toHaveBeenCalledWith({
      text: 'Travel time 60.0 min exceeds threshold of 45 min.',
      variant: 'warning',
      timeout: 7000,
    });
  });

  it('acknowledges alerts correctly', async () => {
    const routeData = ref(createRouteData(60));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    // Wait for the initial refresh to complete
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });

    expect(result.activeAlerts.value).toHaveLength(1);

    await result.acknowledgeAlerts();

    expect(result.activeAlerts.value).toEqual([]);
  });

  it('prevents duplicate alerts for same route data and threshold', async () => {
    const routeData = ref(createRouteData(60));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    // Wait for the initial refresh to complete
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });

    // First alert should be created
    expect(result.activeAlerts.value).toHaveLength(1);
    expect(mockToasts.push).toHaveBeenCalledTimes(1);

    // Update route data with same timestamp (simulating re-fetch)
    const sameRouteData = { ...routeData.value };
    routeData.value = sameRouteData;

    // Wait for the update to process
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });

    // Should not create new alert
    expect(result.activeAlerts.value).toHaveLength(1);
    expect(mockToasts.push).toHaveBeenCalledTimes(1);
  });

  it('creates new alert when route data changes', async () => {
    const routeData = ref(createRouteData(60));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    // Wait for the initial refresh to complete
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });

    // First alert
    expect(result.activeAlerts.value).toHaveLength(1);
    expect(mockToasts.push).toHaveBeenCalledTimes(1);

    // Update route data with new timestamp
    const newRouteData = createRouteData(65);
    routeData.value = newRouteData;

    // Wait for the update to process
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });

    // Should create new alert
    expect(result.activeAlerts.value).toHaveLength(1);
    expect(mockToasts.push).toHaveBeenCalledTimes(2);
  });

  it('creates new alert when threshold changes', async () => {
    const routeData = ref(createRouteData(60));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    // Wait for the initial refresh to complete
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });

    // First alert with threshold 45
    expect(result.activeAlerts.value).toHaveLength(1);
    expect(mockToasts.push).toHaveBeenCalledTimes(1);

    // Change threshold to 30 (still exceeded)
    thresholdMinutes.value = 30;

    // Wait for the update to process
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });

    // Should create new alert
    expect(result.activeAlerts.value).toHaveLength(1);
    expect(mockToasts.push).toHaveBeenCalledTimes(2);
  });

  it('removes alert when duration drops below threshold', async () => {
    const routeData = ref(createRouteData(60));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    // Wait for the initial refresh to complete
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });

    expect(result.activeAlerts.value).toHaveLength(1);

    // Update route data with lower duration
    routeData.value = createRouteData(30);

    // Wait for the update to process
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });

    expect(result.activeAlerts.value).toEqual([]);
  });

  it('handles compact mode correctly', async () => {
    mockUiPreferences.isWidgetCompact.mockReturnValue(true);

    const routeData = ref(createRouteData(60));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    // Wait for the initial refresh to complete
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });

    expect(result.activeAlerts.value).toHaveLength(1);
    // In compact mode, message should still be created for toast
    expect(result.activeAlerts.value[0].message).toContain('60.0 min exceeds threshold of 45 min');
  });

  it('emits alert count correctly', async () => {
    const routeData = ref(createRouteData(60));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    // Wait for the initial refresh to complete
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });

    const mockEmit = vi.fn();
    result.emitAlertCount = mockEmit;

    // Should emit count when alert is created
    expect(mockEmit).toHaveBeenCalledWith(1);

    // Should emit count when alert is acknowledged
    mockEmit.mockClear();
    await result.acknowledgeAlerts();
    expect(mockEmit).toHaveBeenCalledWith(0);
  });

  it('does not emit count when count is the same', async () => {
    const routeData = ref(createRouteData(60));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    // Wait for the initial refresh to complete
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });

    const mockEmit = vi.fn();
    result.emitAlertCount = mockEmit;

    // First emission
    expect(mockEmit).toHaveBeenCalledWith(1);

    // Update with same data should not emit again
    mockEmit.mockClear();
    const sameRouteData = { ...routeData.value };
    routeData.value = sameRouteData;

    // Wait for the update to process
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });

    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('handles acknowledged alerts correctly', async () => {
    const routeData = ref(createRouteData(60));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    // Wait for the initial refresh to complete
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });

    // Create and acknowledge alert
    expect(result.activeAlerts.value).toHaveLength(1);
    await result.acknowledgeAlerts();
    expect(result.activeAlerts.value).toEqual([]);

    // Update with same data should not recreate alert
    const sameRouteData = { ...routeData.value };
    routeData.value = sameRouteData;

    // Wait for the update to process
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });

    expect(result.activeAlerts.value).toEqual([]);
  });

  it('recreates alert after acknowledgment when data changes', async () => {
    const routeData = ref(createRouteData(60));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    // Wait for the initial refresh to complete
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });

    // Create and acknowledge alert
    expect(result.activeAlerts.value).toHaveLength(1);
    await result.acknowledgeAlerts();
    expect(result.activeAlerts.value).toEqual([]);

    // Update with new timestamp should recreate alert
    const newRouteData = createRouteData(65);
    routeData.value = newRouteData;

    // Wait for the update to process
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });

    expect(result.activeAlerts.value).toHaveLength(1);
  });

  it('formats duration correctly in alert message', async () => {
    const routeData = ref(createRouteData(55.75));
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    // Wait for the initial refresh to complete
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false);
    });

    expect(result.activeAlerts.value[0].message).toContain('55.8 min exceeds threshold of 45 min');
  });

  it('handles edge case of duration exactly at threshold', () => {
    const routeData = ref(createRouteData(45)); // Exactly at threshold
    const thresholdMinutes = ref(45);

    const result = useRouteAlerts({ routeData, thresholdMinutes });

    expect(result.activeAlerts.value).toEqual([]);
  });
});
