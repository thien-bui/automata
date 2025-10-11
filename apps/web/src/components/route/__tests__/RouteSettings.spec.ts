import { mount } from '@vue/test-utils';
import { describe, it, expect, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import RouteSettings from '../RouteSettings.vue';
import { MonitoringMode } from '../../monitoringMode';

interface StubOptions {
  props?: string[];
  emits?: string[];
}

const createSlotStub = (name: string, tag: string, options: StubOptions = {}) =>
  defineComponent({
    name,
    props: options.props ?? [],
    emits: options.emits ?? [],
    setup(_props, { attrs, slots, emit }) {
      const data: Record<string, unknown> = { ...attrs };

      if (options.emits?.includes('click')) {
        data.onClick = (event: Event) => emit('click', event);
      }

      return () => h(tag, data, slots.default?.());
    },
  });

describe('RouteSettings', () => {
  const mountComponent = (props: Partial<{
    mode: MonitoringMode;
    refreshInterval: number;
    thresholdMinutes: number;
    isNavMode: boolean;
  }> = {}) => {
    const defaultProps = {
      mode: MonitoringMode.Simple,
      refreshInterval: 120,
      thresholdMinutes: 45,
      isNavMode: false,
    };

    return mount(RouteSettings, {
      props: { ...defaultProps, ...props },
      global: {
        stubs: {
          'v-list-subheader': createSlotStub('VListSubheaderStub', 'div'),
          'v-slider': createSlotStub('VSliderStub', 'input', {
            props: ['modelValue', 'min', 'max', 'step', 'thumbLabel', 'color', 'ariaLabel'],
            emits: ['update:modelValue'],
          }),
          'v-btn': createSlotStub('VBtnStub', 'button', {
            props: ['size', 'variant'],
            emits: ['click'],
          }),
          'v-divider': createSlotStub('VDividerStub', 'hr'),
          CompactModeControl: createSlotStub('CompactModeControl', 'div', {
            props: ['widgetName'],
          }),
        },
      },
    });
  };

  it('renders with default props', () => {
    const wrapper = mountComponent();
    
    expect(wrapper.text()).toContain('Mode');
    expect(wrapper.text()).toContain('Refresh cadence');
    expect(wrapper.text()).toContain('Alert threshold');
    expect(wrapper.text()).toContain('Polling every 120 seconds.');
    expect(wrapper.text()).toContain('Alerts fire above 45 minutes.');
  });

  it('renders with custom props', () => {
    const customProps = {
      mode: MonitoringMode.Nav,
      refreshInterval: 60,
      thresholdMinutes: 30,
      isNavMode: true,
    };
    const wrapper = mountComponent(customProps);
    
    expect(wrapper.text()).toContain('Polling every 60 seconds.');
    expect(wrapper.text()).toContain('Alerts fire above 30 minutes.');
  });

  it('renders RouteModeToggle with correct props', () => {
    const wrapper = mountComponent({ mode: MonitoringMode.Nav });
    
    const modeToggle = wrapper.findComponent({ name: 'RouteModeToggle' });
    expect(modeToggle.exists()).toBe(true);
    expect(modeToggle.props('modelValue')).toBe(MonitoringMode.Nav);
    expect(modeToggle.props('density')).toBe('default');
    expect(modeToggle.props('color')).toBe('primary');
    expect(modeToggle.props('ariaLabel')).toBe('Toggle monitoring mode');
  });

  it('renders refresh interval slider with correct value', () => {
    const wrapper = mountComponent({ refreshInterval: 180 });
    
    const slider = wrapper.findAllComponents({ name: 'VSliderStub' })[0];
    expect(slider.exists()).toBe(true);
    expect(slider.props('modelValue')).toBe(180);
    expect(slider.props('min')).toBe(15);
    expect(slider.props('max')).toBe(300);
    expect(slider.props('step')).toBe(15);
    expect(slider.props('color')).toBe('secondary');
  });

  it('renders threshold slider with correct value', () => {
    const wrapper = mountComponent({ thresholdMinutes: 60 });
    
    const slider = wrapper.findAllComponents({ name: 'VSliderStub' })[1];
    expect(slider.exists()).toBe(true);
    expect(slider.props('modelValue')).toBe(60);
    expect(slider.props('min')).toBe(5);
    expect(slider.props('max')).toBe(180);
    expect(slider.props('step')).toBe(5);
    expect(slider.props('color')).toBe('secondary');
  });

  it('emits update:mode when RouteModeToggle changes', async () => {
    const wrapper = mountComponent({ mode: MonitoringMode.Simple });
    
    const modeToggle = wrapper.findComponent({ name: 'RouteModeToggle' });
    await modeToggle.vm.$emit('update:modelValue', MonitoringMode.Nav);
    
    const emitted = wrapper.emitted('update:mode');
    expect(emitted).toBeTruthy();
    expect(emitted).toHaveLength(1);
    expect(emitted?.[0]).toEqual([MonitoringMode.Nav]);
  });

  it('emits update:refreshInterval when refresh slider changes', async () => {
    const wrapper = mountComponent({ refreshInterval: 120 });
    
    const slider = wrapper.findAllComponents({ name: 'VSliderStub' })[0];
    await slider.vm.$emit('update:modelValue', 180);
    
    const emitted = wrapper.emitted('update:refreshInterval');
    expect(emitted).toBeTruthy();
    expect(emitted).toHaveLength(1);
    expect(emitted?.[0]).toEqual([180]);
  });

  it('emits update:thresholdMinutes when threshold slider changes', async () => {
    const wrapper = mountComponent({ thresholdMinutes: 45 });
    
    const slider = wrapper.findAllComponents({ name: 'VSliderStub' })[1];
    await slider.vm.$emit('update:modelValue', 60);
    
    const emitted = wrapper.emitted('update:thresholdMinutes');
    expect(emitted).toBeTruthy();
    expect(emitted).toHaveLength(1);
    expect(emitted?.[0]).toEqual([60]);
  });

  it('emits reset-threshold when reset button is clicked', async () => {
    const wrapper = mountComponent();
    
    const buttons = wrapper.findAllComponents({ name: 'VBtnStub' });
    const resetButton = buttons[buttons.length - 1];
    await resetButton.vm.$emit('click');
    
    expect(wrapper.emitted('reset-threshold')).toBeTruthy();
    expect(wrapper.emitted('reset-threshold')).toHaveLength(1);
  });

  it('renders CompactModeControl component', () => {
    const wrapper = mountComponent();
    
    const compactControl = wrapper.findComponent({ name: 'CompactModeControl' });
    expect(compactControl.exists()).toBe(true);
    expect(compactControl.props('widgetName')).toBe('route-widget');
  });

  it('displays correct polling interval text', () => {
    const testCases = [
      { interval: 15, expected: 'Polling every 15 seconds.' },
      { interval: 60, expected: 'Polling every 60 seconds.' },
      { interval: 300, expected: 'Polling every 300 seconds.' },
    ];

    testCases.forEach(({ interval, expected }) => {
      const wrapper = mountComponent({ refreshInterval: interval });
      expect(wrapper.text()).toContain(expected);
    });
  });

  it('displays correct threshold text', () => {
    const testCases = [
      { threshold: 5, expected: 'Alerts fire above 5 minutes.' },
      { threshold: 30, expected: 'Alerts fire above 30 minutes.' },
      { threshold: 180, expected: 'Alerts fire above 180 minutes.' },
    ];

    testCases.forEach(({ threshold, expected }) => {
      const wrapper = mountComponent({ thresholdMinutes: threshold });
      expect(wrapper.text()).toContain(expected);
    });
  });

  it('has proper section headers', () => {
    const wrapper = mountComponent();
    
    const headers = wrapper.findAllComponents({ name: 'VListSubheaderStub' });
    expect(headers).toHaveLength(3);
    expect(wrapper.text()).toContain('Mode');
    expect(wrapper.text()).toContain('Refresh cadence');
    expect(wrapper.text()).toContain('Alert threshold');
  });

  it('has reset button with correct text', () => {
    const wrapper = mountComponent();
    
    const buttons = wrapper.findAllComponents({ name: 'VBtnStub' });
    const resetButton = buttons[buttons.length - 1];
    expect(resetButton.exists()).toBe(true);
    expect(resetButton.props('variant')).toBe('text');
    expect(resetButton.props('size')).toBe('small');
  });

  it('renders divider before CompactModeControl', () => {
    const wrapper = mountComponent();
    
    const divider = wrapper.findComponent({ name: 'VDividerStub' });
    expect(divider.exists()).toBe(true);
    expect(divider.attributes('class')).toContain('my-4');
  });

  it('handles isNavMode prop correctly', () => {
    const wrapper = mountComponent({ isNavMode: true });
    
    // The isNavMode prop is passed but not directly rendered in the template
    // It's available for future use or computed properties
    expect(wrapper.props('isNavMode')).toBe(true);
  });
});
