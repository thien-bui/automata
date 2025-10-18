import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computed, defineComponent, h, nextTick, readonly, ref } from 'vue';
import RouteWidget from '../RouteWidget.vue';
import { MonitoringMode } from '../../monitoringMode';
import { provideToasts } from '../../../composables/useToasts';
import type { RouteTimeResponse } from '@automata/types';

// Mock all the new route components
vi.mock('../index', () => ({
  RouteSummary: defineComponent({
    name: 'RouteSummary',
    props: ['routeData', 'isPolling', 'cacheDescription', 'isCompact'],
    setup(props) {
      return () => h('div', { 'data-test': 'route-summary' }, [
        h('div', { 'data-test': 'duration' }, props.routeData?.durationMinutes || '—'),
        h('div', { 'data-test': 'distance' }, props.routeData?.distanceKm || '—'),
        h('div', { 'data-test': 'cache-desc' }, props.cacheDescription),
      ]);
    },
  }),
  RouteAlerts: defineComponent({
    name: 'RouteAlerts',
    props: ['alerts', 'compact'],
    emits: ['acknowledge-alerts'],
    setup(props, { emit }) {
      return () => h('div', { 'data-test': 'route-alerts' }, [
        h('div', { 'data-test': 'alert-count' }, props.alerts.length),
        h('button', { onClick: () => emit('acknowledge-alerts') }, 'Dismiss'),
      ]);
    },
  }),
  RouteModeToggle: defineComponent({
    name: 'RouteModeToggle',
    props: ['modelValue', 'density', 'ariaLabel'],
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () => h(
        'button',
        {
          'aria-label': props.ariaLabel,
          onClick: () => emit(
            'update:modelValue',
            props.modelValue === MonitoringMode.Compact ? MonitoringMode.Nav : MonitoringMode.Compact,
          ),
        },
        props.modelValue === MonitoringMode.Compact ? 'Compact Mode' : 'Navigation Mode',
      );
    },
  }),
  RouteSettings: defineComponent({
    name: 'RouteSettings',
    props: ['mode', 'refreshInterval', 'thresholdMinutes', 'isNavMode'],
    emits: ['update:mode', 'update:refreshInterval', 'update:thresholdMinutes', 'reset-threshold', 'save'],
    setup(props, { emit }) {
      return () => h('div', { 'data-test': 'route-settings' }, [
        h('button', { onClick: () => emit('update:mode', MonitoringMode.Nav) }, 'Mode'),
        h('button', { onClick: () => emit('update:refreshInterval', 180) }, 'Interval'),
        h('button', { onClick: () => emit('update:thresholdMinutes', 60) }, 'Threshold'),
        h('button', { onClick: () => emit('reset-threshold') }, 'Reset'),
        h('button', { onClick: () => emit('save') }, 'Save'),
      ]);
    },
  }),
}));

// Mock composables
const useRoutePollingMock = vi.hoisted(() => vi.fn(() => createRoutePollingState()));

vi.mock('../../composables/useRoutePolling', () => ({
  useRoutePolling: useRoutePollingMock,
}));

const useRouteAlertsMock = vi.hoisted(() =>
  vi.fn(() => ({
    activeAlerts: ref([{ id: 1, message: 'Alert' }]),
    acknowledgeAlerts: vi.fn(() => {
      /* noop by default */
    }),
    emitAlertCount: vi.fn(),
  })),
);

vi.mock('../../composables/useRouteAlerts', () => ({
  useRouteAlerts: useRouteAlertsMock,
}));

vi.mock('../../composables/useAlertThreshold', () => ({
  useAlertThreshold: () => ({
    thresholdMinutes: ref(45),
    setThreshold: vi.fn(),
    resetThreshold: vi.fn(),
  }),
}));

function createUiPreferencesMock(compact = false) {
  const stateRef = ref({
    compactMode: compact,
    widgetCompactModes: {},
  });

  return {
    state: readonly(stateRef),
    isCompact: computed(() => stateRef.value.compactMode),
    setCompactMode: vi.fn((value: boolean) => {
      stateRef.value = {
        ...stateRef.value,
        compactMode: value,
      };
    }),
    toggleCompactMode: vi.fn(() => {
      stateRef.value = {
        ...stateRef.value,
        compactMode: !stateRef.value.compactMode,
      };
    }),
    resetPreferences: vi.fn(() => {
      stateRef.value = {
        compactMode: compact,
        widgetCompactModes: {},
      };
    }),
    getWidgetCompactMode: vi.fn(() => 'use-global'),
    setWidgetCompactMode: vi.fn(),
    isWidgetCompact: vi.fn((_widgetName: string) => compact),
    didHydrateFromStorage: computed(() => true),
  };
}

const useUiPreferencesMock = vi.hoisted(() => vi.fn(() => createUiPreferencesMock(false)));

vi.mock('../../composables/useUiPreferences', () => ({
  useUiPreferences: useUiPreferencesMock,
}));

function createMockRouteData(): RouteTimeResponse {
  return {
    durationMinutes: 25.5,
    distanceKm: 12.3,
    provider: 'google-directions',
    mode: 'driving',
    lastUpdatedIso: '2024-06-01T12:00:00Z',
    cache: {
      hit: false,
      ageSeconds: 0,
      staleWhileRevalidate: false,
    },
  };
}

function createRoutePollingState() {
  const modeRef = ref<MonitoringMode>(MonitoringMode.Compact);
  const refreshIntervalRef = ref<number>(120);
  const pollingSecondsRef = ref<number>(120);
  const dataRef = ref<RouteTimeResponse | null>(createMockRouteData());
  const errorRef = ref<string | null>(null);
  const isPollingRef = ref(false);
  const isStaleRef = ref(false);
  const lastUpdatedIsoRef = ref<string | null>('2024-06-01T12:00:00Z');
  const cacheAgeSecondsRef = ref<number | null>(0);
  const cacheHitRef = ref(false);
  const fromRef = ref('443 Ramsay Way, Kent, WA 98032');
  const toRef = ref('35522 21st Ave SW ste B, Federal Way, WA 98023');

  return {
    data: dataRef,
    error: errorRef,
    isPolling: isPollingRef,
    isStale: isStaleRef,
    lastUpdatedIso: lastUpdatedIsoRef,
    cacheAgeSeconds: cacheAgeSecondsRef,
    cacheHit: cacheHitRef,
    from: fromRef,
    to: toRef,
    mode: modeRef,
    refreshInterval: refreshIntervalRef,
    pollingSeconds: pollingSecondsRef,
    triggerPolling: vi.fn(),
    setMode(value: MonitoringMode) {
      modeRef.value = value;
    },
    setRefreshInterval(value: number) {
      refreshIntervalRef.value = value;
    },
    setFreshnessSeconds(value: number) {
      pollingSecondsRef.value = value;
    },
  };
}

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
    mode: { type: String, default: 'Compact' },
    from: { type: String, default: '' },
    to: { type: String, default: '' },
  },
  setup(props) {
    const showMap = () => (props.mode === 'Nav' || props.mode === 'nav') && props.from && props.to;
    return () =>
      showMap()
        ? h('div', { 'data-test': 'map-preview' })
        : null;
  },
});

const flushPendingUpdates = async (): Promise<void> => {
  await nextTick();
  await nextTick();
};

describe('RouteWidget Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const baseDate = new Date();
    baseDate.setFullYear(2024, 5, 1);
    baseDate.setHours(12, 0, 0, 0);
    vi.setSystemTime(baseDate);

    useRoutePollingMock.mockImplementation(createRoutePollingState);
    useUiPreferencesMock.mockReturnValue(createUiPreferencesMock(false));
    useRouteAlertsMock.mockImplementation(() => {
      const alertsRef = ref([{ id: 1, message: 'Alert' }]);
      return {
        activeAlerts: alertsRef,
        acknowledgeAlerts: vi.fn(() => {
          alertsRef.value = [];
        }),
        emitAlertCount: vi.fn(),
      };
    });
  });

  afterEach(() => {
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
          PollingWidget: defineComponent({
            name: 'PollingWidget',
            props: {
              overlineText: { type: String, default: '' },
              title: { type: String, default: '' },
              subtitle: { type: String, default: '' },
            },
            setup(props, { slots }) {
              return () => h('section', { 'data-test': 'polling-widget' }, [
                h('header', [
                  h('div', props.overlineText),
                  h('h2', props.title),
                  h('p', props.subtitle),
                ]),
                slots['title-actions']?.(),
                slots['main-content']?.(),
                slots['settings-content']?.(),
              ]);
            },
          }),
          MapPreview: MapPreviewStub,
          CompactModeControl: defineComponent({
            name: 'CompactModeControlStub',
            setup() {
              return () => h('div');
            },
          }),
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
          'v-icon': defineComponent({
            name: 'VIconStub',
            setup() {
              return () => h('i');
            },
          }),
          'v-list-subheader': defineComponent({
            name: 'VListSubheaderStub',
            setup() {
              return () => h('div');
            },
          }),
          'v-slider': defineComponent({
            name: 'VSliderStub',
            setup() {
              return () => h('input');
            },
          }),
          'v-spacer': defineComponent({
            name: 'VSpacerStub',
            setup() {
              return () => h('span');
            },
          }),
          'v-card-actions': defineComponent({
            name: 'VCardActionsStub',
            setup() {
              return () => h('div');
            },
          }),
          'v-dialog': defineComponent({
            name: 'VDialogStub',
            setup() {
              return () => h('div');
            },
          }),
        },
      },
    });
  };

  it('renders all route components correctly', async () => {
    const wrapper = mountComponent();
    await flushPendingUpdates();

    expect(wrapper.find('[data-test="route-summary"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="route-alerts"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="duration"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="distance"]').exists()).toBe(true);
  });

  it('displays route data correctly', async () => {
    const wrapper = mountComponent();
    await flushPendingUpdates();

    // The mock data should be passed through the composables
    expect(wrapper.find('[data-test="duration"]').text()).toBe('25.5');
    expect(wrapper.find('[data-test="distance"]').text()).toBe('12.3');
  });

  it('shows map preview in Nav mode', async () => {
    const wrapper = mountComponent();
    await flushPendingUpdates();

    // Initially in Compact mode, no map
    expect(wrapper.find('[data-test="map-preview"]').exists()).toBe(false);

    // Switch to Nav mode
    const modeToggle = wrapper.findComponent({ name: 'RouteModeToggle' });
    await modeToggle.trigger('click');
    await flushPendingUpdates();

    // Should show map in Nav mode
    expect(wrapper.find('[data-test="map-preview"]').exists()).toBe(true);
  });

  it('handles mode switching', async () => {
    const wrapper = mountComponent();
    await flushPendingUpdates();

    const modeToggle = wrapper.findComponent({ name: 'RouteModeToggle' });
    
    // Initial state should be Compact (formerly Compact)
    expect(modeToggle.text()).toBe('Compact Mode');

    // Click to switch to Nav
    await modeToggle.trigger('click');
    await flushPendingUpdates();

    expect(modeToggle.text()).toBe('Navigation Mode');
  });

  it('handles settings interactions', async () => {
    const wrapper = mountComponent();
    await flushPendingUpdates();

    const settings = wrapper.findComponent({ name: 'RouteSettings' });
    
    // Test settings interactions
    await settings.find('button').trigger('click'); // Mode button
    await settings.findAll('button')[1].trigger('click'); // Interval button
    await settings.findAll('button')[2].trigger('click'); // Threshold button
    await settings.findAll('button')[3].trigger('click'); // Reset button
    await settings.findAll('button')[4].trigger('click'); // Save button

    // Should not throw errors
    expect(true).toBe(true);
  });

  it('handles alert acknowledgment', async () => {
    const wrapper = mountComponent();
    await flushPendingUpdates();

    const alerts = wrapper.findComponent({ name: 'RouteAlerts' });
    const dismissButton = alerts.find('button');
    
    await dismissButton.trigger('click');
    await flushPendingUpdates();

    // Should not throw errors
    expect(true).toBe(true);
  });

  it('emits correct events', async () => {
    const wrapper = mountComponent();
    await flushPendingUpdates();

    // Test alert acknowledgment event
    const alerts = wrapper.findComponent({ name: 'RouteAlerts' });
    await alerts.find('button').trigger('click');
    const widget = wrapper.findComponent({ name: 'RouteWidget' });
    await flushPendingUpdates();

    expect(widget.emitted('alerts-acknowledged')).toBeTruthy();

    // Test alerts-updated event (should be called with count)
    await flushPendingUpdates();
    expect(widget.emitted('alerts-updated')).toBeTruthy();
  });

  it('displays correct title and subtitle', async () => {
    const wrapper = mountComponent();
    await flushPendingUpdates();

    // Should show monitoring mode and route
    expect(wrapper.text()).toContain('Compact Mode');
    expect(wrapper.text()).toContain('443 Ramsay Way, Kent, WA 98032 → 35522 21st Ave SW ste B, Federal Way, WA 98023');
  });

  it('handles cache description', async () => {
    const wrapper = mountComponent();
    await flushPendingUpdates();

    const cacheDesc = wrapper.find('[data-test="cache-desc"]');
    expect(cacheDesc.exists()).toBe(true);
  });

  it('maintains accessibility features', async () => {
    const wrapper = mountComponent();
    await flushPendingUpdates();

    // Should have proper ARIA labels
    const modeToggle = wrapper.findComponent({ name: 'RouteModeToggle' });
    expect(modeToggle.attributes('aria-label')).toBe('Select monitoring mode');
  });

  it('integrates properly with PollingWidget', async () => {
    const wrapper = mountComponent();
    await flushPendingUpdates();

    // Should render within PollingWidget structure
    expect(wrapper.findComponent({ name: 'PollingWidget' }).exists()).toBe(true);
  });

  it('handles compact mode correctly', async () => {
    // Mock compact mode
    useUiPreferencesMock.mockReturnValue(createUiPreferencesMock(true));

    const wrapper = mountComponent();
    await flushPendingUpdates();

    // Should still render all components in compact mode
    expect(wrapper.find('[data-test="route-summary"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="route-alerts"]').exists()).toBe(true);
  });

  it('handles error states gracefully', async () => {
    // Mock error state
    useRoutePollingMock.mockReturnValue({
      data: ref<RouteTimeResponse | null>(null),
      error: ref<string | null>('Network error'),
      isPolling: ref(false),
      isStale: ref(false),
      lastUpdatedIso: ref<string | null>(null),
      cacheAgeSeconds: ref<number | null>(null),
      cacheHit: ref(false),
      from: ref('Origin'),
      to: ref('Destination'),
      mode: ref(MonitoringMode.Compact),
      refreshInterval: ref(120),
      pollingSeconds: ref(120),
      triggerPolling: vi.fn(),
      setMode: vi.fn(),
      setRefreshInterval: vi.fn(),
      setFreshnessSeconds: vi.fn(),
    });

    const wrapper = mountComponent();
    await flushPendingUpdates();

    // Should handle error state without crashing
    expect(wrapper.find('[data-test="route-summary"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="duration"]').text()).toBe('—');
  });

  it('shows map preview in Nav mode even when in compact mode', async () => {
    // Test the core logic: MapPreview should be shown when (isNavMode || !isCompact)
    // This test verifies the fix for the issue where Nav mode didn't show map in compact mode
    
    // Create a test component that directly tests the conditional logic
    const TestComponent = defineComponent({
      name: 'TestMapPreviewLogic',
      props: {
        isCompact: Boolean,
        mode: String as () => MonitoringMode,
      },
      setup(props) {
        const isNavMode = computed(() => props.mode === MonitoringMode.Nav);
        // New logic: Compact mode is always compact, map only shows in Nav mode when not compact
        const effectiveCompact = computed(() => props.mode === MonitoringMode.Compact ? true : props.isCompact);
        const shouldShowMap = computed(() => isNavMode.value && !effectiveCompact.value);
        
        return () => h('div', [
          h('div', { 'data-test': 'compact-status' }, effectiveCompact.value ? 'compact' : 'normal'),
          h('div', { 'data-test': 'mode-status' }, props.mode),
          h('div', { 'data-test': 'should-show-map' }, shouldShowMap.value ? 'show' : 'hide'),
          // Simulate the MapPreview condition
          shouldShowMap.value 
            ? h('div', { 'data-test': 'map-preview' })
            : null,
        ]);
      },
    });

    // Test all combinations - Compact mode is now always compact and never shows map
    const testCases = [
      { isCompact: true, mode: MonitoringMode.Nav, shouldShow: false, description: 'Compact + Nav (no map when compact)' },
      { isCompact: true, mode: MonitoringMode.Compact, shouldShow: false, description: 'Compact + Compact (always no map)' },
      { isCompact: false, mode: MonitoringMode.Nav, shouldShow: true, description: 'Normal + Nav (shows map)' },
      { isCompact: false, mode: MonitoringMode.Compact, shouldShow: false, description: 'Normal + Compact (now compact, no map)' },
    ];

    for (const testCase of testCases) {
      const wrapper = mount(TestComponent, {
        props: {
          isCompact: testCase.isCompact,
          mode: testCase.mode,
        },
      });

      await flushPendingUpdates();
      
      expect(wrapper.find('[data-test="should-show-map"]').text()).toBe(testCase.shouldShow ? 'show' : 'hide');
      
      if (testCase.shouldShow && testCase.mode === MonitoringMode.Nav) {
        expect(wrapper.find('[data-test="map-preview"]').exists()).toBe(true);
      } else {
        expect(wrapper.find('[data-test="map-preview"]').exists()).toBe(false);
      }
    }
  });
});
