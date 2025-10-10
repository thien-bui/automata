import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import WeatherSettings from '../WeatherSettings.vue';

const createSlotStub = (tag: string) =>
  defineComponent({
    name: `${tag}-slot-stub`,
    setup(_, { slots }) {
      return () => h(tag, slots.default ? slots.default() : undefined);
    },
  });

describe('WeatherSettings', () => {
  let onSaveMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSaveMock = vi.fn();
  });

  const mountComponent = (props = {}) => {
    const defaultProps = {
      location: 'Seattle, WA',
      refreshInterval: 300,
      compactMode: false,
      globalCompactEnabled: false,
      minRefreshSeconds: 60,
      maxRefreshSeconds: 3600,
      onSave: onSaveMock,
    };

    return mount(WeatherSettings, {
      props: { ...defaultProps, ...props },
      global: {
        stubs: {
          'v-text-field': createSlotStub('input'),
          'v-divider': createSlotStub('hr'),
          'v-switch': createSlotStub('input'),
        },
      },
    });
  };

  it('renders location input with correct initial value', () => {
    const wrapper = mountComponent();
    
    const locationInput = wrapper.find('input[label="Location"]');
    expect(locationInput.exists()).toBe(true);
    expect(locationInput.attributes('placeholder')).toBe('Enter city or address');
  });

  it('renders refresh interval input with correct initial value', () => {
    const wrapper = mountComponent();
    
    const refreshInput = wrapper.find('input[label="Refresh Interval (seconds)"]');
    expect(refreshInput.exists()).toBe(true);
    expect(refreshInput.attributes('type')).toBe('number');
    expect(refreshInput.attributes('min')).toBe('60');
    expect(refreshInput.attributes('max')).toBe('3600');
  });

  it('renders compact mode switch', () => {
    const wrapper = mountComponent();
    
    const compactSwitch = wrapper.find('input[label="Compact mode (weather widget)"]');
    expect(compactSwitch.exists()).toBe(true);
    expect(compactSwitch.attributes('color')).toBe('primary');
  });

  it('displays correct help text when global compact is disabled', () => {
    const wrapper = mountComponent({ globalCompactEnabled: false });
    
    expect(wrapper.text()).toContain('Applies only to the Weather widget layout.');
    expect(wrapper.text()).not.toContain('Controlled by global compact mode from the toolbar.');
  });

  it('displays correct help text when global compact is enabled', () => {
    const wrapper = mountComponent({ globalCompactEnabled: true });
    
    expect(wrapper.text()).toContain('Controlled by global compact mode from the toolbar.');
    expect(wrapper.text()).not.toContain('Applies only to the Weather widget layout.');
  });

  it('disables compact switch when global compact is enabled', () => {
    const wrapper = mountComponent({ globalCompactEnabled: true });
    
    const compactSwitch = wrapper.find('input[label="Compact mode (weather widget)"]');
    expect(compactSwitch.attributes('disabled')).toBeDefined();
  });

  it('calls onSave when location input triggers keyup.enter', async () => {
    const wrapper = mountComponent();
    
    const locationInput = wrapper.find('input[label="Location"]');
    await locationInput.setValue('New York, NY');
    await locationInput.trigger('keyup.enter');

    expect(onSaveMock).toHaveBeenCalledWith({
      location: 'New York, NY',
      refreshInterval: 300,
      compactMode: false,
    });
  });

  it('calls onSave when refresh interval input triggers keyup.enter', async () => {
    const wrapper = mountComponent();
    
    const refreshInput = wrapper.find('input[label="Refresh Interval (seconds)"]');
    await refreshInput.setValue(600);
    await refreshInput.trigger('keyup.enter');

    expect(onSaveMock).toHaveBeenCalledWith({
      location: 'Seattle, WA',
      refreshInterval: 600,
      compactMode: false,
    });
  });

  it('calls onSave when compact switch is toggled', async () => {
    const wrapper = mountComponent();
    
    const compactSwitch = wrapper.find('input[label="Compact mode (weather widget)"]');
    await compactSwitch.setValue(true);

    expect(onSaveMock).toHaveBeenCalledWith({
      location: 'Seattle, WA',
      refreshInterval: 300,
      compactMode: true,
    });
  });

  it('updates internal state when props change', async () => {
    const wrapper = mountComponent();
    
    await wrapper.setProps({
      location: 'Portland, OR',
      refreshInterval: 180,
      compactMode: true,
    });

    // Trigger a save to verify the internal state was updated
    const locationInput = wrapper.find('input[label="Location"]');
    await locationInput.trigger('keyup.enter');

    expect(onSaveMock).toHaveBeenCalledWith({
      location: 'Portland, OR',
      refreshInterval: 180,
      compactMode: true,
    });
  });

  it('handles boolean conversion for compact switch', async () => {
    const wrapper = mountComponent();
    
    const compactSwitch = wrapper.find('input[label="Compact mode (weather widget)"]');
    await compactSwitch.setValue(null); // Simulate v-model update with null

    expect(onSaveMock).toHaveBeenCalledWith({
      location: 'Seattle, WA',
      refreshInterval: 300,
      compactMode: false, // Should be converted to boolean false
    });
  });

  it('uses correct min and max refresh interval values', () => {
    const wrapper = mountComponent({
      minRefreshSeconds: 30,
      maxRefreshSeconds: 7200,
    });
    
    const refreshInput = wrapper.find('input[label="Refresh Interval (seconds)"]');
    expect(refreshInput.attributes('min')).toBe('30');
    expect(refreshInput.attributes('max')).toBe('7200');
  });

  it('renders all form elements in correct order', () => {
    const wrapper = mountComponent();
    
    const inputs = wrapper.findAll('input');
    expect(inputs).toHaveLength(3); // Location, refresh interval, compact switch
    
    expect(inputs[0].attributes('label')).toBe('Location');
    expect(inputs[1].attributes('label')).toBe('Refresh Interval (seconds)');
    expect(inputs[2].attributes('label')).toBe('Compact mode (weather widget)');
  });
});
