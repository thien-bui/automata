import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import ReminderWidgetEmpty from '../ReminderWidgetEmpty.vue';

const VBtnStub = defineComponent({
  name: 'VBtn',
  emits: ['click'],
  setup(_, { slots, emit }) {
    return () =>
      h(
        'button',
        {
          class: 'v-btn-stub',
          onClick: () => emit('click'),
        },
        slots.default ? slots.default() : undefined,
      );
  },
});

const globalStubs = {
  'v-icon': defineComponent({
    name: 'VIcon',
    setup(_, { slots }) {
      return () => h('i', { class: 'v-icon-stub' }, slots.default ? slots.default() : undefined);
    },
  }),
  'v-btn': VBtnStub,
};

describe('ReminderWidgetEmpty', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders today messaging and allows adding reminders', async () => {
    vi.setSystemTime(new Date(2024, 3, 10, 8));
    const wrapper = mount(ReminderWidgetEmpty, {
      props: {
        selectedDate: '2024-04-10',
      },
      global: {
        stubs: globalStubs,
      },
    });

    expect(wrapper.text()).toContain('No reminders for today');
    const addButton = wrapper.findAllComponents(VBtnStub)[0];
    expect(addButton.text()).toContain('Add Reminder');

    await addButton.trigger('click');
    expect(wrapper.emitted('add-reminder')).toBeTruthy();
  });

  it('shows go-to-today action for past dates', async () => {
    vi.setSystemTime(new Date(2024, 3, 10, 8));

    const wrapper = mount(ReminderWidgetEmpty, {
      props: {
        selectedDate: '2024-04-08',
      },
      global: {
        stubs: globalStubs,
      },
    });

    expect(wrapper.text()).toContain('No reminders for this date');
    const buttons = wrapper.findAllComponents(VBtnStub);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].text()).toContain('Go to Today');

    await buttons[0].trigger('click');
    expect(wrapper.emitted('go-to-today')).toBeTruthy();
  });

  it('renders future messaging without actions', () => {
    vi.setSystemTime(new Date(2024, 3, 10, 8));

    const wrapper = mount(ReminderWidgetEmpty, {
      props: {
        selectedDate: '2024-04-12',
      },
      global: {
        stubs: globalStubs,
      },
    });

    expect(wrapper.text()).toContain('No reminders scheduled');
    expect(wrapper.findComponent(VBtnStub).exists()).toBe(false);
  });
});
