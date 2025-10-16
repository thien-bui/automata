import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import type { DailyReminder } from '@automata/types';
import { defineComponent, h } from 'vue';
import ReminderListItem from '../ReminderListItem.vue';

const { mockFormatReminderTime, mockIsReminderOverdue } = vi.hoisted(() => ({
  mockFormatReminderTime: vi.fn(),
  mockIsReminderOverdue: vi.fn(),
}));

vi.mock('../../../composables/useDailyReminders', () => ({
  formatReminderTime: mockFormatReminderTime,
  isReminderOverdue: mockIsReminderOverdue,
}));

const baseReminder: DailyReminder = {
  id: 'reminder-1',
  title: 'Take medication',
  description: 'Morning pills',
  scheduledAt: '2024-04-10T08:00:00Z',
  isRecurring: true,
  isCompleted: false,
  createdAt: '2024-04-09T21:00:00Z',
};

const factory = (override: Partial<DailyReminder> = {}) =>
  mount(ReminderListItem, {
    props: {
      reminder: { ...baseReminder, ...override },
      isLast: false,
    },
    global: {
      stubs: {
        'v-list-item': defineComponent({
          name: 'VListItem',
          inheritAttrs: false,
          setup(_, { slots, attrs }) {
            return () =>
              h(
                'div',
                {
                  class: ['v-list-item-stub', attrs.class],
                  'data-disabled': attrs.disabled ?? null,
                },
                [
                  ...(slots.prepend?.() ?? []),
                  ...(slots.default?.() ?? []),
                  ...(slots.append?.() ?? []),
                ],
              );
          },
        }),
        'v-list-item-title': defineComponent({
          name: 'VListItemTitle',
          setup(_, { slots }) {
            return () => h('div', { class: 'v-list-item-title-stub' }, slots.default ? slots.default() : undefined);
          },
        }),
        'v-list-item-subtitle': defineComponent({
          name: 'VListItemSubtitle',
          setup(_, { slots }) {
            return () => h('div', { class: 'v-list-item-subtitle-stub' }, slots.default ? slots.default() : undefined);
          },
        }),
        'v-icon': defineComponent({
          name: 'VIcon',
          setup(_, { slots }) {
            return () => h('span', { class: 'v-icon-stub' }, slots.default ? slots.default() : undefined);
          },
        }),
        'v-chip': defineComponent({
          name: 'VChip',
          setup(_, { slots }) {
            return () => h('span', { class: 'v-chip-stub' }, slots.default ? slots.default() : undefined);
          },
        }),
        'v-btn': defineComponent({
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
        }),
        'v-divider': defineComponent({
          name: 'VDivider',
          setup() {
            return () => h('hr', { class: 'v-divider-stub' });
          },
        }),
      },
    },
  });

describe('ReminderListItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFormatReminderTime.mockReturnValue('08:00');
    mockIsReminderOverdue.mockReturnValue(false);
  });

  it('renders reminder details and formatted time', () => {
    const wrapper = factory();
    const root = wrapper.find('.v-list-item-stub');

    expect(root.text()).toContain('Take medication');
    expect(root.text()).toContain('Morning pills');
    expect(root.text()).toContain('08:00');
    expect(mockFormatReminderTime).toHaveBeenCalledWith(baseReminder.scheduledAt);
    expect(mockIsReminderOverdue).toHaveBeenCalledWith(expect.objectContaining({ id: baseReminder.id }));
  });

  it('applies completed styles and hides action button when reminder is completed', () => {
    const wrapper = factory({ isCompleted: true });
    const root = wrapper.find('.v-list-item-stub');

    expect(root.classes()).toContain('reminder-list-item--completed');
    expect(root.text()).not.toContain('Overdue');
    expect(wrapper.findComponent({ name: 'VBtn' }).exists()).toBe(false);
  });

  it('shows overdue badge and styles when reminder is overdue', () => {
    mockIsReminderOverdue.mockReturnValue(true);
    const wrapper = factory();
    const root = wrapper.find('.v-list-item-stub');

    expect(root.classes()).toContain('reminder-list-item--overdue');
    expect(root.text()).toContain('Overdue');
  });

  it('emits complete event when action button is pressed', async () => {
    const wrapper = factory();
    const button = wrapper.findComponent({ name: 'VBtn' });

    expect(button.exists()).toBe(true);

    button.vm.$emit('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('complete')).toEqual([[baseReminder.id]]);
  });
});
