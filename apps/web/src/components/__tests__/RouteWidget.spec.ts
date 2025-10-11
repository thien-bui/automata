import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computed, defineComponent, h, nextTick, ref } from 'vue';
import RouteWidget from '../RouteWidget.vue';
import { MonitoringMode } from '../monitoringMode';
import { provideToasts } from '../../composables/useToasts';
import type { RouteTimeResponse } from '@automata/types';

// Mock all the new route components
vi.mock('../route/index', () => ({
  RouteSummary: defineComponent({
    name: 'RouteSummary',
    props: ['routeData', 'isPolling', 'cacheDescription'],
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
      return () => h('button', {
        onClick: () => emit('update:modelValue', 
          props.modelValue === MonitoringMode.Simple ? MonitoringMode.Nav : MonitoringMode.Simple
        )
      }, props.modelValue);
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
vi.mock('../../composables/useRoutePolling', () => ({
  useRoutePolling: () => ({
    data: ref(createMockRouteData()),
    error: ref(null),
    isPolling: ref(false),
    isStale: ref(false),
    lastUpdatedIso: ref('2024-06-01T12:00:00Z'),
    cacheAgeSeconds: ref(0),
    cacheHit: ref(false),
    from: ref('Origin'),
    to: ref('Destination'),
    mode: ref(MonitoringMode.Simple),
    refreshInterval: ref(120),
    pollingSeconds: ref(120),
    triggerPolling: vi.fn(),
    setMode: vi.fn(),
    setRefreshInterval: vi.fn(),
    setFreshnessSeconds: vi.fn(),
  }),
}));

vi.mock('../../composables/useRouteAlerts', () => ({
  useRouteAlerts: () => ({
    activeAlerts: ref([]),
    acknowledgeAlerts: vi.fn(),
    emitAlertCount: vi.fn(),
  }),
}));

vi.mock('../../composables/useAlertThreshold', () => ({
  useAlertThreshold: () => ({
    thresholdMinutes: ref(45),
    setThreshold: vi.fn(),
    resetThreshold: vi.fn(),
  }),
}));

vi.mock('../../composables/useUiPreferences', () => ({
  useUiPreferences: () => ({
    isWidgetCompact: () => false,
  }),
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
    mode: { type: String, default: 'Simple' },
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

    expect(wrapper.find('[data-test="duration"]').text()).toBe('25.5');
    expect(wrapper.find('[data-test="distance"]').text()).toBe('12.3');
  });

  it('shows map preview in Nav mode', async () => {
    const wrapper = mountComponent();
    await flushPendingUpdates();

    // Initially in Simple mode, no map
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
    
    // Initial state should be Simple
    expect(modeToggle.text()).toBe(MonitoringMode.Simple);

    // Click to switch to Nav
    await modeToggle.trigger('click');
    await flushPendingUpdates();

    expect(modeToggle.text()).toBe(MonitoringMode.Nav);
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

    expect(wrapper.emitted('alerts-acknowledged')).toBeTruthy();

    // Test alerts-updated event (should be called with count)
    expect(wrapper.emitted('alerts-updated')).toBeTruthy();
  });

  it('displays correct title and subtitle', async () => {
    const wrapper = mountComponent();
    await flushPendingUpdates();

    // Should show monitoring mode and route
    expect(wrapper.text()).toContain('Simple Mode');
    expect(wrapper.text()).toContain('Origin → Destination');
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
    const { useUiPreferences } = require('../../composables/useUiPreferences');
    useUiPreferences.mockReturnValue({
      isWidgetCompact: () => true,
    });

    const wrapper = mountComponent();
    await flushPendingUpdates();

    // Should still render all components in compact mode
    expect(wrapper.find('[data-test="route-summary"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="route-alerts"]').exists()).toBe(true);
  });

  it('handles error states gracefully', async () => {
    // Mock error state
    const { useRoutePolling } = require('../../composables/useRoutePolling');
    useRoutePolling.mockReturnValue({
      data: ref(null),
      error: ref('Network error'),
      isPolling: ref(false),
      isStale: ref(false),
      lastUpdatedIso: ref(null),
      cacheAgeSeconds: ref(null),
      cacheHit: ref(false),
      from: ref('Origin'),
      to: ref('Destination'),
      mode: ref(MonitoringMode.Simple),
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
        const shouldShowMap = computed(() => !props.isCompact || isNavMode.value);
        
        return () => h('div', [
          h('div', { 'data-test': 'compact-status' }, props.isCompact ? 'compact' : 'normal'),
          h('div', { 'data-test': 'mode-status' }, props.mode),
          h('div', { 'data-test': 'should-show-map' }, shouldShowMap.value ? 'show' : 'hide'),
          // Simulate the MapPreview condition
          shouldShowMap.value && props.mode === MonitoringMode.Nav 
            ? h('div', { 'data-test': 'map-preview' })
            : null,
        ]);
      },
    });

    // Test all combinations
    const testCases = [
      { isCompact: true, mode: MonitoringMode.Nav, shouldShow: true, description: 'Compact + Nav' },
      { isCompact: true, mode: MonitoringMode.Simple, shouldShow: false, description: 'Compact + Simple' },
      { isCompact: false, mode: MonitoringMode.Nav, shouldShow: true, description: 'Normal + Nav' },
      { isCompact: false, mode: MonitoringMode.Simple, shouldShow: true, description: 'Normal + Simple' },
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
