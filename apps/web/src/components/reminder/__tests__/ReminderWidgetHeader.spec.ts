import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import ReminderWidgetHeader from '../ReminderWidgetHeader.vue';

const VMenuStub = defineComponent({
  name: 'VMenu',
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue'],
  setup(_, { slots }) {
    return () =>
      h('div', { class: 'v-menu-stub' }, [
        slots.activator?.({ props: { onClick: () => {} } }),
        slots.default?.(),
      ]);
  },
});

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

const VDatePickerStub = defineComponent({
  name: 'VDatePicker',
  props: {
    modelValue: {
      type: [String, Date, null],
      default: null,
    },
  },
  emits: ['update:modelValue'],
  setup(_, { slots }) {
    return () => h('div', { class: 'v-date-picker-stub' }, slots.default ? slots.default() : undefined);
  },
});

const globalStubs = {
  'v-card-title': defineComponent({
    name: 'VCardTitle',
    setup(_, { slots }) {
      return () => h('div', { class: 'v-card-title-stub' }, slots.default ? slots.default() : undefined);
    },
  }),
  'v-icon': defineComponent({
    name: 'VIcon',
    setup(_, { slots }) {
      return () => h('i', { class: 'v-icon-stub' }, slots.default ? slots.default() : undefined);
    },
  }),
  'v-chip': defineComponent({
    name: 'VChip',
    setup(_, { slots }) {
      return () => h('span', { class: 'v-chip-stub' }, slots.default ? slots.default() : undefined);
    },
  }),
  'v-menu': VMenuStub,
  'v-btn': VBtnStub,
  'v-date-picker': VDatePickerStub,
};

describe('ReminderWidgetHeader', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('displays friendly label and overdue count', () => {
    vi.setSystemTime(new Date(2024, 3, 10, 8, 0));

    const wrapper = mount(ReminderWidgetHeader, {
      props: {
        selectedDate: '2024-04-10',
        isLoading: false,
        overdueCount: 3,
      },
      global: {
        stubs: globalStubs,
      },
    });

    expect(wrapper.text()).toContain('Today');
    expect(wrapper.text()).toContain('3 overdue');
  });

  it('emits refresh when refresh button is clicked', async () => {
    const wrapper = mount(ReminderWidgetHeader, {
      props: {
        selectedDate: '2024-04-10',
        isLoading: false,
        overdueCount: 0,
      },
      global: {
        stubs: globalStubs,
      },
    });

    const buttons = wrapper.findAllComponents(VBtnStub);
    expect(buttons).toHaveLength(2);

    await buttons[1].trigger('click');
    expect(wrapper.emitted('refresh')).toBeTruthy();
  });

  it('emits date-change with selected date when picker updates', () => {
    const wrapper = mount(ReminderWidgetHeader, {
      props: {
        selectedDate: '2024-04-10',
        isLoading: false,
        overdueCount: 0,
      },
      global: {
        stubs: globalStubs,
      },
    });

    const picker = wrapper.findComponent(VDatePickerStub);
    picker.vm.$emit('update:modelValue', '2024-04-12');

    expect(wrapper.emitted('date-change')).toEqual([['2024-04-12']]);
  });
});
