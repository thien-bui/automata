import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computed, defineComponent, h, nextTick, ref, type Ref } from 'vue';

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
  isStale: ReturnType<typeof computed>;
  lastUpdatedIso: ReturnType<typeof computed>;
  cacheAgeSeconds: ReturnType<typeof computed>;
  cacheHit: ReturnType<typeof computed>;
  freshnessSeconds: Ref<number>;
  mode: Ref<string>;
  from: Ref<string>;
  to: Ref<string>;
  refresh: ReturnType<typeof vi.fn>;
  setMode: ReturnType<typeof vi.fn>;
  setEndpoints: ReturnType<typeof vi.fn>;
  setFreshnessSeconds: ReturnType<typeof vi.fn>;
}

interface AlertThresholdStateMock {
  thresholdMinutes: Ref<number>;
  setThreshold: ReturnType<typeof vi.fn>;
  resetThreshold: ReturnType<typeof vi.fn>;
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

  const refresh = vi.fn().mockResolvedValue(undefined);
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
    refresh,
    setMode,
    setEndpoints,
    setFreshnessSeconds,
  };
}

function createAlertThresholdState(): AlertThresholdStateMock {
  const thresholdMinutes = ref(45);
  const setThreshold = vi.fn((value: number) => {
    thresholdMinutes.value = value;
  });
  const resetThreshold = vi.fn(() => {
    thresholdMinutes.value = 45;
  });

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
    active: {
      type: Boolean,
      default: true,
    },
  },
  setup(props) {
    return () =>
      props.active
        ? h('div', { 'data-test': 'map-preview' })
        : h('div', { 'data-test': 'map-preview', 'data-hidden': 'true' });
  },
});

const SettingsDrawerStub = defineComponent({
  name: 'SettingsDrawerStub',
  setup(_, { slots }) {
    return () => h('div', { 'data-test': 'settings-drawer-stub' }, slots.default ? slots.default() : undefined);
  },
});

const flushPendingUpdates = async (): Promise<void> => {
  await nextTick();
  await nextTick();
};

describe('RouteWidget', () => {
  let setIntervalSpy: ReturnType<typeof vi.spyOn>;
  let clearIntervalSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    routeTimeState = createRouteTimeState();
    alertThresholdState = createAlertThresholdState();

    setIntervalSpy = vi.spyOn(window, 'setInterval').mockReturnValue(1 as unknown as number);
    clearIntervalSpy = vi.spyOn(window, 'clearInterval').mockImplementation(() => undefined);
  });

  afterEach(() => {
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
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
          SettingsDrawer: SettingsDrawerStub,
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
    const setMode = (value: MonitoringMode) => {
      widget.vm.$.setupState.mode = value;
    };
    await flushPendingUpdates();

    expect(wrapper.find('[data-test="map-preview"]').exists()).toBe(false);

    setMode(MonitoringMode.Nav);
    await flushPendingUpdates();
    expect(widget.vm.$.setupState.mode).toBe(MonitoringMode.Nav);

    expect(wrapper.find('[data-test="map-preview"]').exists()).toBe(true);

    setMode(MonitoringMode.Simple);
    await flushPendingUpdates();

    expect(wrapper.find('[data-test="map-preview"]').exists()).toBe(false);
  });

  it('renders and removes MapPreview when switching modes via settings drawer', async () => {
    const wrapper = mountComponent();
    const settingsDrawer = wrapper.findComponent(SettingsDrawerStub);

    const findMapPreview = () => wrapper.find('[data-test="map-preview"]');

    await flushPendingUpdates();
    expect(findMapPreview().exists()).toBe(false);

    settingsDrawer.vm.$emit('update:mode', MonitoringMode.Nav);
    await flushPendingUpdates();
    expect(findMapPreview().exists()).toBe(true);

    settingsDrawer.vm.$emit('update:mode', MonitoringMode.Simple);
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
});
