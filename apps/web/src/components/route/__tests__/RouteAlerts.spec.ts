import { mount } from '@vue/test-utils';
import { describe, it, expect, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import RouteAlerts from '../RouteAlerts.vue';

interface RouteAlert {
  id: number;
  message: string;
}

const createAlert = (id: number, message: string): RouteAlert => ({ id, message });

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

      if (options.emits?.includes('click:close')) {
        data['onClick:close'] = (event: Event) => emit('click:close', event);
      }

      return () => h(tag, data, slots.default?.());
    },
  });

describe('RouteAlerts', () => {
  const mountComponent = (props: Partial<{
    alerts: RouteAlert[];
    compact: boolean;
  }> = {}) => {
    const defaultProps = {
      alerts: [],
      compact: false,
    };

    return mount(RouteAlerts, {
      props: { ...defaultProps, ...props },
      global: {
        stubs: {
          'v-alert': createSlotStub('VAlertStub', 'div', { emits: ['click:close'] }),
          'v-icon': createSlotStub('VIconStub', 'i', { props: ['color', 'icon', 'size'] }),
          'v-btn': createSlotStub('VBtnStub', 'button', { props: ['variant', 'size', 'color'], emits: ['click'] }),
        },
      },
    });
  };

  it('renders nothing when no alerts are present', () => {
    const wrapper = mountComponent({ alerts: [] });
    
    expect(wrapper.find('div').exists()).toBe(false);
  });

  it('renders full alert in normal mode', () => {
    const alerts = [createAlert(1, 'Traffic delay on I-5')];
    const wrapper = mountComponent({ alerts, compact: false });
    
    expect(wrapper.findComponent({ name: 'VAlertStub' }).exists()).toBe(true);
    expect(wrapper.text()).toContain('Route Alerts');
    expect(wrapper.text()).toContain('Traffic delay on I-5');
  });

  it('renders compact alert indicator in compact mode', () => {
    const alerts = [createAlert(1, 'Traffic delay')];
    const wrapper = mountComponent({ alerts, compact: true });
    
    expect(wrapper.findComponent({ name: 'VAlertStub' }).exists()).toBe(false);
    expect(wrapper.text()).toContain('1 alert');
    expect(wrapper.text()).toContain('Dismiss');
  });

  it('renders multiple alerts correctly in normal mode', () => {
    const alerts = [
      createAlert(1, 'Traffic delay on I-5'),
      createAlert(2, 'Accident on Highway 99')
    ];
    const wrapper = mountComponent({ alerts, compact: false });
    
    expect(wrapper.text()).toContain('Traffic delay on I-5');
    expect(wrapper.text()).toContain('Accident on Highway 99');
  });

  it('shows plural "alerts" for multiple alerts in compact mode', () => {
    const alerts = [
      createAlert(1, 'Traffic delay'),
      createAlert(2, 'Accident')
    ];
    const wrapper = mountComponent({ alerts, compact: true });
    
    expect(wrapper.text()).toContain('2 alerts');
  });

  it('shows singular "alert" for single alert in compact mode', () => {
    const alerts = [createAlert(1, 'Traffic delay')];
    const wrapper = mountComponent({ alerts, compact: true });
    
    expect(wrapper.text()).toContain('1 alert');
  });

  it('emits acknowledge-alerts when dismiss button is clicked in compact mode', async () => {
    const alerts = [createAlert(1, 'Traffic delay')];
    const wrapper = mountComponent({ alerts, compact: true });
    
    const dismissButton = wrapper.findComponent({ name: 'VBtnStub' });
    await dismissButton.trigger('click');
    
    expect(wrapper.emitted('acknowledge-alerts')).toBeTruthy();
    expect(wrapper.emitted('acknowledge-alerts')).toHaveLength(1);
  });

  it('emits acknowledge-alerts when alert close button is clicked in normal mode', async () => {
    const alerts = [createAlert(1, 'Traffic delay')];
    const wrapper = mountComponent({ alerts, compact: false });
    
    const alertComponent = wrapper.findComponent({ name: 'VAlertStub' });
    await alertComponent.vm.$emit('click:close');
    
    expect(wrapper.emitted('acknowledge-alerts')).toBeTruthy();
    expect(wrapper.emitted('acknowledge-alerts')).toHaveLength(1);
  });

  it('renders alerts with correct IDs', () => {
    const alerts = [
      createAlert(123, 'First alert'),
      createAlert(456, 'Second alert')
    ];
    const wrapper = mountComponent({ alerts, compact: false });
    
    const listItems = wrapper.findAll('li');
    expect(listItems).toHaveLength(2);
  });

  it('applies correct CSS classes in compact mode', () => {
    const alerts = [createAlert(1, 'Traffic delay')];
    const wrapper = mountComponent({ alerts, compact: true });
    
    const container = wrapper.find('.mt-4');
    expect(container.exists()).toBe(true);
    expect(container.classes()).toContain('d-flex');
    expect(container.classes()).toContain('align-center');
    expect(container.classes()).toContain('gap-2');
  });
});
