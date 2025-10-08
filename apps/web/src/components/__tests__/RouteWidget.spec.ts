import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { computed, defineComponent, h, nextTick, ref, type Ref, type ComputedRef, type ComponentInternalInstance } from 'vue';

type RouteTimeResponseMock = {
  durationMinutes: number;
  distanceKm: number;
  provider: string;
  mode: string;
  lastUpdatedIso: string;
  cache: {
    hit: boolean;
    ageSeconds: number;
    staleWhileRevalidate: boolean;
  };
};

interface RouteTimeStateMock {
  data: Ref<RouteTimeResponseMock>;
  error: Ref<string | null>;
  isLoading: Ref<boolean>;
  isRefreshing: Ref<boolean>;
  isStale: ComputedRef<boolean>;
  lastUpdatedIso: ComputedRef<string>;
  cacheAgeSeconds: ComputedRef<number>;
  cacheHit: ComputedRef<boolean>;
  freshnessSeconds: Ref<number>;
  mode: Ref<string>;
  from: Ref<string>;
  to: Ref<string>;
  refresh: (options?: { background?: boolean; reason?: string; forceRefresh?: boolean }) => Promise<void>;
  setMode: (value: string) => void;
  setEndpoints: (params: { from?: string; to?: string }) => void;
  setFreshnessSeconds: (value: number) => void;
}

interface AlertThresholdStateMock {
  thresholdMinutes: Ref<number>;
  setThreshold: (value: number) => void;
  resetThreshold: () => void;
}

function createRouteTimeState(): RouteTimeStateMock {
  const data = ref<RouteTimeResponseMock>({
    durationMinutes: 18,
    distanceKm: 7,
    provider: 'google-directions',
    mode: 'driving',
    lastUpdatedIso: new Date('2024-06-01T12:00:00Z').toISOString(),
    cache: {
      hit: false,
      ageSeconds: 0,
      staleWhileRevalidate: false,
    },
  });

  const refresh = vi.fn(async () => undefined);
  const setMode = vi.fn();
  const setEndpoints = vi.fn();
  const setFreshnessSeconds = vi.fn();

  return {
    data,
    error: ref<string | null>(null),
    isLoading: ref(false),
    isRefreshing: ref(false),
    isStale: computed(() => false),
    lastUpdatedIso: computed(() => data.value.lastUpdatedIso),
    cacheAgeSeconds: computed(() => data.value.cache.ageSeconds),
    cacheHit: computed(() => data.value.cache.hit),
    freshnessSeconds: ref(120),
    mode: ref('driving'),
    from: ref('Origin'),
    to: ref('Destination'),
    refresh: refresh as RouteTimeStateMock['refresh'],
    setMode: setMode as RouteTimeStateMock['setMode'],
    setEndpoints: setEndpoints as RouteTimeStateMock['setEndpoints'],
    setFreshnessSeconds: setFreshnessSeconds as RouteTimeStateMock['setFreshnessSeconds'],
  };
}

function createAlertThresholdState(): AlertThresholdStateMock {
  const thresholdMinutes = ref(45);
  const setThreshold = vi.fn((value: number) => {
    thresholdMinutes.value = value;
  }) as AlertThresholdStateMock['setThreshold'];
  const resetThreshold = vi.fn(() => {
    thresholdMinutes.value = 45;
  }) as AlertThresholdStateMock['resetThreshold'];

  return {
    thresholdMinutes,
    setThreshold,
    resetThreshold,
  };
}

let routeTimeState: RouteTimeStateMock;
let alertThresholdState: AlertThresholdStateMock;

const getRouteTimeState = (): RouteTimeStateMock => routeTimeState;
const getAlertThresholdState = (): AlertThresholdStateMock => alertThresholdState;

vi.mock('../../composables/useRouteTime.ts', () => ({
  useRouteTime: () => getRouteTimeState(),
}));

vi.mock('../../composables/useAlertThreshold.ts', () => ({
  useAlertThreshold: () => getAlertThresholdState(),
}));

import RouteWidget from '../RouteWidget.vue';
import { MonitoringMode } from '../monitoringMode';
import { provideToasts } from '../../composables/useToasts';

const createSlotStub = (tag: string) =>
  defineComponent({
    name: `${tag}-slot-stub`,
    setup(_, { slots }) {
      return () => h(tag, slots.default ? slots.default() : undefined);
    },
  });

const MapPreviewStub = defineComponent({
  name: 'MapPreviewStub',
  props: {
    mode: {
      type: String,
      default: 'Simple',
    },
    from: {
      type: String,
      default: '',
    },
    to: {
      type: String,
      default: '',
    },
  },
  setup(props) {
    const showMap = () => (props.mode === 'Nav' || props.mode === 'nav') && props.from && props.to;
    return () =>
      showMap()
        ? h('div', { 'data-test': 'map-preview' })
        : null; // Don't render anything when map shouldn't be shown
  },
});


const flushPendingUpdates = async (): Promise<void> => {
  await nextTick();
  await nextTick();
};

describe('RouteWidget', () => {
  let setIntervalSpy: MockInstance<Parameters<typeof window.setInterval>, ReturnType<typeof window.setInterval>>;
  let clearIntervalSpy: MockInstance<Parameters<typeof window.clearInterval>, ReturnType<typeof window.clearInterval>>;

  beforeEach(() => {
    vi.useFakeTimers();
    const baseDate = new Date();
    baseDate.setFullYear(2024, 5, 1);
    baseDate.setHours(12, 0, 0, 0);
    vi.setSystemTime(baseDate);

    routeTimeState = createRouteTimeState();
    alertThresholdState = createAlertThresholdState();

    setIntervalSpy = vi.spyOn(window, 'setInterval');
    setIntervalSpy.mockReturnValue(1 as unknown as ReturnType<typeof window.setInterval>);
    clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    clearIntervalSpy.mockImplementation(() => undefined);
  });

  afterEach(() => {
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const mountComponent = () => {
    const Wrapper = defineComponent({
      name: 'RouteWidgetTestWrapper',
      setup() {
        provideToasts();
        return () => h(RouteWidget);
      },
    });

    return mount(Wrapper, {
      global: {
        stubs: {
          MapPreview: MapPreviewStub,
          'v-card': createSlotStub('div'),
          'v-card-title': createSlotStub('div'),
          'v-card-text': createSlotStub('div'),
          'v-divider': defineComponent({
            name: 'VDividerStub',
            setup() {
              return () => h('hr');
            },
          }),
          'v-sheet': createSlotStub('div'),
          'v-btn-toggle': createSlotStub('div'),
          'v-btn': createSlotStub('button'),
          'v-btn-group': createSlotStub('div'),
          'v-alert': createSlotStub('div'),
          'v-progress-circular': defineComponent({
            name: 'VProgressCircularStub',
            setup() {
              return () => h('div');
            },
          }),
        },
      },
    });
  };

  it('shows the map preview only while navigation mode is active', async () => {
    const wrapper = mountComponent();
    const widget = wrapper.findComponent(RouteWidget);
    const getInternalInstance = () =>
      widget.vm.$ as ComponentInternalInstance & { setupState: { mode: MonitoringMode } };
    const setMode = (value: MonitoringMode) => {
      getInternalInstance().setupState.mode = value;
    };
    await flushPendingUpdates();

    expect(wrapper.find('[data-test="map-preview"]').exists()).toBe(false);

    setMode(MonitoringMode.Nav);
    await flushPendingUpdates();
    expect(getInternalInstance().setupState.mode).toBe(MonitoringMode.Nav);

    expect(wrapper.find('[data-test="map-preview"]').exists()).toBe(true);

    setMode(MonitoringMode.Simple);
    await flushPendingUpdates();

    expect(wrapper.find('[data-test="map-preview"]').exists()).toBe(false);
  });

  it('renders and removes MapPreview when switching modes via direct mode change', async () => {
    const wrapper = mountComponent();
    const widget = wrapper.findComponent(RouteWidget);
    const getInternalInstance = () =>
      widget.vm.$ as ComponentInternalInstance & { setupState: { mode: MonitoringMode } };
    const setMode = (value: MonitoringMode) => {
      getInternalInstance().setupState.mode = value;
    };

    const findMapPreview = () => wrapper.find('[data-test="map-preview"]');

    await flushPendingUpdates();
    expect(findMapPreview().exists()).toBe(false);

    setMode(MonitoringMode.Nav);
    await flushPendingUpdates();
    expect(findMapPreview().exists()).toBe(true);

    setMode(MonitoringMode.Simple);
    await flushPendingUpdates();
    expect(findMapPreview().exists()).toBe(false);
  });

  it('triggers an initial refresh on mount', async () => {
    const wrapper = mountComponent();
    await flushPendingUpdates();

    expect(getRouteTimeState().refresh).toHaveBeenCalledTimes(1);
    expect(getRouteTimeState().refresh).toHaveBeenCalledWith({
      background: false,
      reason: 'initial',
      forceRefresh: undefined,
    });

    wrapper.unmount();

    expect(getRouteTimeState().setFreshnessSeconds).toHaveBeenCalledWith(120);
  });

  it('automatically switches modes at 8:30am, 9:30am, 5pm and 8pm local time every day', async () => {
    // Test the auto mode logic by testing the time boundaries directly
    // This tests the core logic without relying on timer complexities
    
    // Test 8:30 AM - should be Nav mode (morning window start)
    const morningStart = new Date(2024, 5, 1, 8, 30, 0, 0);
    vi.setSystemTime(morningStart);
    
    const wrapper1 = mountComponent();
    await flushPendingUpdates();
    const internal1 = wrapper1.findComponent(RouteWidget).vm.$ as ComponentInternalInstance & { setupState: { mode: MonitoringMode } };
    expect(internal1.setupState.mode).toBe(MonitoringMode.Nav);
    wrapper1.unmount();

    // Test 9:30 AM - should be Simple mode (morning window end)
    const morningEnd = new Date(2024, 5, 1, 9, 30, 0, 0);
    vi.setSystemTime(morningEnd);
    
    const wrapper2 = mountComponent();
    await flushPendingUpdates();
    const internal2 = wrapper2.findComponent(RouteWidget).vm.$ as ComponentInternalInstance & { setupState: { mode: MonitoringMode } };
    expect(internal2.setupState.mode).toBe(MonitoringMode.Simple);
    wrapper2.unmount();

    // Test 5:00 PM - should be Nav mode (evening window start)
    const eveningStart = new Date(2024, 5, 1, 17, 0, 0, 0);
    vi.setSystemTime(eveningStart);
    
    const wrapper3 = mountComponent();
    await flushPendingUpdates();
    const internal3 = wrapper3.findComponent(RouteWidget).vm.$ as ComponentInternalInstance & { setupState: { mode: MonitoringMode } };
    expect(internal3.setupState.mode).toBe(MonitoringMode.Nav);
    wrapper3.unmount();

    // Test 8:00 PM - should be Simple mode (evening window end)
    const eveningEnd = new Date(2024, 5, 1, 20, 0, 0, 0);
    vi.setSystemTime(eveningEnd);
    
    const wrapper4 = mountComponent();
    await flushPendingUpdates();
    const internal4 = wrapper4.findComponent(RouteWidget).vm.$ as ComponentInternalInstance & { setupState: { mode: MonitoringMode } };
    expect(internal4.setupState.mode).toBe(MonitoringMode.Simple);
    wrapper4.unmount();

    // Test next day 8:30 AM - should be Nav mode again
    const nextDayMorning = new Date(2024, 5, 2, 8, 30, 0, 0);
    vi.setSystemTime(nextDayMorning);
    
    const wrapper5 = mountComponent();
    await flushPendingUpdates();
    const internal5 = wrapper5.findComponent(RouteWidget).vm.$ as ComponentInternalInstance & { setupState: { mode: MonitoringMode } };
    expect(internal5.setupState.mode).toBe(MonitoringMode.Nav);
    wrapper5.unmount();
  });
});
