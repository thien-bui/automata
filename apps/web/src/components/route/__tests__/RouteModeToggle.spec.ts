import { mount } from '@vue/test-utils';
import { describe, it, expect, vi } from 'vitest';
import RouteModeToggle from '../RouteModeToggle.vue';
import { MonitoringMode } from '../../monitoringMode';

const createSlotStub = (tag: string) => ({
  name: `${tag}-slot-stub`,
  template: `<div><slot /></div>`,
});

describe('RouteModeToggle', () => {
  const mountComponent = (props: Partial<{
    modelValue: MonitoringMode;
    mandatory?: boolean;
    density?: 'default' | 'comfortable' | 'compact';
    color?: string;
    buttonClass?: string;
    ariaLabel?: string;
  }> = {}) => {
    const defaultProps = {
      modelValue: MonitoringMode.Simple,
      mandatory: true,
      density: 'default' as const,
      color: 'primary',
      buttonClass: '',
      ariaLabel: 'Select monitoring mode',
    };

    return mount(RouteModeToggle, {
      props: { ...defaultProps, ...props },
      global: {
        stubs: {
          'v-btn-toggle': createSlotStub('div'),
          'v-btn': createSlotStub('button'),
        },
      },
    });
  };

  it('renders with default props', () => {
    const wrapper = mountComponent();
    
    const toggle = wrapper.findComponent({ name: 'VBtnToggleStub' });
    expect(toggle.exists()).toBe(true);
    expect(toggle.attributes('model-value')).toBe(MonitoringMode.Simple);
    expect(toggle.attributes('mandatory')).toBe('true');
    expect(toggle.attributes('density')).toBe('default');
    expect(toggle.attributes('color')).toBe('primary');
    expect(toggle.attributes('aria-label')).toBe('Select monitoring mode');
  });

  it('renders with custom props', () => {
    const customProps = {
      modelValue: MonitoringMode.Nav,
      mandatory: false,
      density: 'compact' as const,
      color: 'secondary',
      buttonClass: 'custom-class',
      ariaLabel: 'Custom aria label',
    };
    const wrapper = mountComponent(customProps);
    
    const toggle = wrapper.findComponent({ name: 'VBtnToggleStub' });
    expect(toggle.attributes('model-value')).toBe(MonitoringMode.Nav);
    expect(toggle.attributes('mandatory')).toBe('false');
    expect(toggle.attributes('density')).toBe('compact');
    expect(toggle.attributes('color')).toBe('secondary');
    expect(toggle.attributes('class')).toContain('custom-class');
    expect(toggle.attributes('aria-label')).toBe('Custom aria label');
  });

  it('renders two buttons for Simple and Nav modes', () => {
    const wrapper = mountComponent();
    
    const buttons = wrapper.findAllComponents({ name: 'VBtnStub' });
    expect(buttons).toHaveLength(2);
    expect(buttons[0].attributes('value')).toBe(MonitoringMode.Simple);
    expect(buttons[1].attributes('value')).toBe(MonitoringMode.Nav);
  });

  it('emits update:modelValue when mode changes', async () => {
    const wrapper = mountComponent({ modelValue: MonitoringMode.Simple });
    
    const toggle = wrapper.findComponent({ name: 'VBtnToggleStub' });
    await toggle.vm.$emit('update:modelValue', MonitoringMode.Nav);
    
    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toBeTruthy();
    expect(emitted).toHaveLength(1);
    expect(emitted?.[0]).toEqual([MonitoringMode.Nav]);
  });

  it('does not emit when value is the same', async () => {
    const wrapper = mountComponent({ modelValue: MonitoringMode.Simple });
    
    const toggle = wrapper.findComponent({ name: 'VBtnToggleStub' });
    await toggle.vm.$emit('update:modelValue', MonitoringMode.Simple);
    
    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toBeTruthy();
    expect(emitted).toHaveLength(1);
  });

  it('handles Nav mode as initial value', () => {
    const wrapper = mountComponent({ modelValue: MonitoringMode.Nav });
    
    const toggle = wrapper.findComponent({ name: 'VBtnToggleStub' });
    expect(toggle.attributes('model-value')).toBe(MonitoringMode.Nav);
  });

  it('applies custom button class correctly', () => {
    const wrapper = mountComponent({ buttonClass: 'my-toggle-class' });
    
    const toggle = wrapper.findComponent({ name: 'VBtnToggleStub' });
    expect(toggle.attributes('class')).toContain('my-toggle-class');
  });

  it('handles empty button class', () => {
    const wrapper = mountComponent({ buttonClass: '' });
    
    const toggle = wrapper.findComponent({ name: 'VBtnToggleStub' });
    expect(toggle.attributes('class')).toBe('');
  });

  it('handles different density values', () => {
    const densities: Array<'default' | 'comfortable' | 'compact'> = ['default', 'comfortable', 'compact'];
    
    densities.forEach((density) => {
      const wrapper = mountComponent({ density });
      const toggle = wrapper.findComponent({ name: 'VBtnToggleStub' });
      expect(toggle.attributes('density')).toBe(density);
    });
  });

  it('handles custom color', () => {
    const wrapper = mountComponent({ color: 'accent' });
    
    const toggle = wrapper.findComponent({ name: 'VBtnToggleStub' });
    expect(toggle.attributes('color')).toBe('accent');
  });

  it('handles mandatory false', () => {
    const wrapper = mountComponent({ mandatory: false });
    
    const toggle = wrapper.findComponent({ name: 'VBtnToggleStub' });
    expect(toggle.attributes('mandatory')).toBe('false');
  });

  it('has correct button values', () => {
    const wrapper = mountComponent();
    
    const buttons = wrapper.findAllComponents({ name: 'VBtnStub' });
    expect(buttons[0].attributes('value')).toBe('Simple');
    expect(buttons[1].attributes('value')).toBe('Nav');
  });
});
