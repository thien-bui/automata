import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { computed, defineComponent, h, nextTick, ref } from 'vue';
import type { DailyReminder } from '@automata/types';
import ReminderWidget from '../ReminderWidget.vue';

const remindersRef = ref<DailyReminder[]>([]);
const overdueCountRef = ref(0);
const isLoadingRef = ref(false);
const errorRef = ref<string | null>(null);
const selectedDateRef = ref('2024-04-10');

const refreshMock = vi.fn<[], Promise<void>>(() => Promise.resolve());
const setDateMock = vi.fn<[string], Promise<void>>(() => Promise.resolve());
const completeReminderMock = vi.fn<[string], Promise<void>>(() => Promise.resolve());

vi.mock('../../../composables/useDailyReminders', () => ({
  useDailyReminders: vi.fn(() => ({
    reminders: computed(() => remindersRef.value),
    overdueCount: computed(() => overdueCountRef.value),
    isLoading: computed(() => isLoadingRef.value),
    error: computed(() => errorRef.value),
    selectedDate: computed(() => selectedDateRef.value),
    refresh: refreshMock,
    setDate: setDateMock,
    completeReminder: completeReminderMock,
    startAutoRefresh: vi.fn(),
    stopAutoRefresh: vi.fn(),
  })),
}));

const pushToastMock = vi.fn();

vi.mock('../../../composables/useToasts', () => ({
  useToasts: () => ({
    push: pushToastMock,
  }),
}));

vi.mock('../../../composables/useUiPreferences', () => ({
  useUiPreferences: () => ({
    isWidgetCompact: () => false,
  }),
}));

const ReminderWidgetHeaderStub = defineComponent({
  name: 'ReminderWidgetHeader',
  props: {
    selectedDate: { type: String, required: true },
    isLoading: { type: Boolean, required: true },
    overdueCount: { type: Number, required: true },
  },
  emits: ['date-change', 'refresh'],
  setup(props, { emit }) {
    return () =>
      h('header', { class: 'reminder-widget-header-stub' }, [
        h(
          'button',
          {
            class: 'change-date',
            onClick: () => emit('date-change', '2024-04-12'),
          },
          `date:${props.selectedDate}`,
        ),
        h(
          'button',
          {
            class: 'refresh',
            onClick: () => emit('refresh'),
          },
          'refresh',
        ),
      ]);
  },
});

const ReminderListItemStub = defineComponent({
  name: 'ReminderListItem',
  props: {
    reminder: {
      type: Object,
      required: true,
    },
    isLast: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['complete'],
  setup(props, { emit }) {
    return () =>
      h(
        'div',
        {
          class: 'reminder-list-item-stub',
          'data-id': (props.reminder as DailyReminder).id,
          onClick: () => emit('complete', (props.reminder as DailyReminder).id),
        },
        (props.reminder as DailyReminder).title,
      );
  },
});

const ReminderWidgetEmptyStub = defineComponent({
  name: 'ReminderWidgetEmpty',
  props: {
    selectedDate: {
      type: String,
      required: true,
    },
  },
  emits: ['add-reminder', 'go-to-today'],
  setup(props) {
    return () => h('div', { class: 'reminder-widget-empty-stub' }, props.selectedDate);
  },
});

const PollingWidgetStub = defineComponent({
  name: 'PollingWidget',
  props: {
    overlineText: { type: String, required: true },
    title: { type: String, required: true },
    subtitle: { type: String, required: true },
    errorTitle: { type: String, required: true },
    settingsTitle: { type: String, required: true },
    error: { type: String, default: null },
    isPolling: { type: Boolean, default: false },
    lastUpdatedIso: { type: String, default: null },
    isStale: { type: Boolean, default: false },
    pollingSeconds: { type: Number, required: true },
    cacheDescription: { type: String, default: '' },
    compact: { type: Boolean, default: false },
  },
  emits: ['manual-refresh', 'hard-refresh', 'save-settings'],
  setup(props, { slots, emit }) {
    return () =>
      h('div', { class: 'polling-widget-stub' }, [
        h('div', { class: 'polling-widget-title' }, props.title),
        h('div', { class: 'polling-widget-subtitle' }, props.subtitle),
        props.error ? h('div', { class: 'polling-widget-error' }, props.error) : null,
        props.isPolling ? h('div', { class: 'polling-widget-loading' }, 'Loading reminders...') : null,
        slots['title-actions']?.(),
        slots['main-content']?.(),
        slots['settings-content']?.(),
        slots['status-extra']?.(),
        h('button', {
          class: 'manual-refresh-btn',
          onClick: () => emit('manual-refresh'),
        }, 'Refresh now'),
        h('button', {
          class: 'hard-refresh-btn',
          onClick: () => emit('hard-refresh'),
        }, 'Hard refresh'),
        h('button', {
          class: 'save-settings-btn',
          onClick: () => emit('save-settings'),
        }, 'Save'),
      ]);
  },
});

const CompactModeControlStub = defineComponent({
  name: 'CompactModeControl',
  props: {
    widgetName: { type: String, required: true },
  },
  setup() {
    return () => h('div', { class: 'compact-mode-control-stub' }, 'Compact Mode Control');
  },
});

const vuetifyStubs = {
  'v-card': defineComponent({
    name: 'VCard',
    setup(_, { slots }) {
      return () => h('div', { class: 'v-card-stub' }, slots.default ? slots.default() : undefined);
    },
  }),
  'v-card-text': defineComponent({
    name: 'VCardText',
    setup(_, { slots }) {
      return () => h('div', { class: 'v-card-text-stub' }, slots.default ? slots.default() : undefined);
    },
  }),
  'v-progress-circular': defineComponent({
    name: 'VProgressCircular',
    setup() {
      return () => h('div', { class: 'v-progress-circular-stub' });
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
  'v-icon': defineComponent({
    name: 'VIcon',
    setup(_, { slots }) {
      return () => h('i', { class: 'v-icon-stub' }, slots.default ? slots.default() : undefined);
    },
  }),
  'v-list': defineComponent({
    name: 'VList',
    setup(_, { slots }) {
      return () => h('div', { class: 'v-list-stub' }, slots.default ? slots.default() : undefined);
    },
  }),
  'v-list-item': defineComponent({
    name: 'VListItem',
    setup(_, { slots }) {
      return () => h('div', { class: 'v-list-item-stub' }, slots.default ? slots.default() : undefined);
    },
  }),
  'v-chip': defineComponent({
    name: 'VChip',
    setup(_, { slots }) {
      return () => h('span', { class: 'v-chip-stub' }, slots.default ? slots.default() : undefined);
    },
  }),
  'v-divider': defineComponent({
    name: 'VDivider',
    setup() {
      return () => h('hr', { class: 'v-divider-stub' });
    },
  }),
  'v-row': defineComponent({
    name: 'VRow',
    setup(_, { slots }) {
      return () => h('div', { class: 'v-row-stub' }, slots.default ? slots.default() : undefined);
    },
  }),
  'v-col': defineComponent({
    name: 'VCol',
    setup(_, { slots }) {
      return () => h('div', { class: 'v-col-stub' }, slots.default ? slots.default() : undefined);
    },
  }),
  'v-text-field': defineComponent({
    name: 'VTextField',
    setup(_, { slots }) {
      return () => h('div', { class: 'v-text-field-stub' }, slots.default ? slots.default() : undefined);
    },
  }),
  'v-switch': defineComponent({
    name: 'VSwitch',
    setup(_, { slots }) {
      return () => h('div', { class: 'v-switch-stub' }, slots.default ? slots.default() : undefined);
    },
  }),
  TransitionGroup: defineComponent({
    name: 'TransitionGroup',
    setup(_, { slots }) {
      return () => h('div', { class: 'transition-group-stub' }, slots.default ? slots.default() : undefined);
    },
  }),
};

const mountWidget = () =>
  mount(ReminderWidget, {
    props: {
      date: '2024-04-10',
      autoRefresh: false,
    },
    global: {
      stubs: {
        ...vuetifyStubs,
        PollingWidget: PollingWidgetStub,
        CompactModeControl: CompactModeControlStub,
        ReminderWidgetHeader: ReminderWidgetHeaderStub,
        ReminderListItem: ReminderListItemStub,
        ReminderWidgetEmpty: ReminderWidgetEmptyStub,
      },
    },
  });

const sampleReminders: DailyReminder[] = [
  {
    id: 'reminder-1',
    title: 'Team standup',
    description: 'Daily sync',
    scheduledAt: '2024-04-10T09:00:00Z',
    isRecurring: true,
    isCompleted: false,
    createdAt: '2024-04-09T18:00:00Z',
  },
  {
    id: 'reminder-2',
    title: 'Submit report',
    description: 'Quarterly metrics',
    scheduledAt: '2024-04-10T14:00:00Z',
    isRecurring: false,
    isCompleted: true,
    createdAt: '2024-04-08T09:30:00Z',
  },
];

describe('ReminderWidget', () => {
  beforeEach(() => {
    remindersRef.value = [];
    overdueCountRef.value = 0;
    isLoadingRef.value = false;
    errorRef.value = null;
    selectedDateRef.value = '2024-04-10';

    refreshMock.mockClear();
    setDateMock.mockClear();
    completeReminderMock.mockClear();
    pushToastMock.mockClear();
  });

  it('shows loading indicator while fetching reminders', () => {
    isLoadingRef.value = true;
    const wrapper = mountWidget();

    expect(wrapper.text()).toContain('Loading reminders...');
  });

  it('renders error state and retries when requested', async () => {
    errorRef.value = 'Network error';
    const wrapper = mountWidget();

    expect(wrapper.text()).toContain('Network error');

    const refreshButton = wrapper.findAll('button').find(btn => btn.text().includes('Refresh now'));
    expect(refreshButton).toBeDefined();

    await refreshButton!.trigger('click');
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when no reminders are returned', () => {
    const wrapper = mountWidget();

    const emptyState = wrapper.findComponent(ReminderWidgetEmptyStub);
    expect(emptyState.exists()).toBe(true);
    expect(emptyState.props('selectedDate')).toBe('2024-04-10');
  });

  it('renders reminders list and summary when data is available', async () => {
    remindersRef.value = sampleReminders;
    overdueCountRef.value = 1;
    const wrapper = mountWidget();
    await nextTick();

    expect(wrapper.text()).toContain('Team standup');
    expect(wrapper.text()).toContain('Submit report');
    expect(wrapper.text()).toContain('1 of 2 completed');
    expect(wrapper.text()).toContain('1 overdue');
  });

  it('completes reminders, shows toast, and emits event', async () => {
    remindersRef.value = sampleReminders;
    const wrapper = mountWidget();
    await nextTick();

    const firstListItem = wrapper.findAllComponents(ReminderListItemStub)[0];
    firstListItem.vm.$emit('complete', 'reminder-1');
    await nextTick();
    await Promise.resolve();
    await nextTick();

    expect(completeReminderMock).toHaveBeenCalledWith('reminder-1');
    expect(pushToastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    expect(wrapper.emitted('reminder-completed')).toEqual([['reminder-1']]);
  });

  it('emits error and toast when completing reminder fails', async () => {
    const failure = new Error('Failed to complete reminder');
    completeReminderMock.mockRejectedValueOnce(failure);
    remindersRef.value = sampleReminders;

    const wrapper = mountWidget();
    await nextTick();

    const firstListItem = wrapper.findAllComponents(ReminderListItemStub)[0];
    firstListItem.vm.$emit('complete', 'reminder-1');
    await nextTick();
    await Promise.resolve();
    await nextTick();

    expect(completeReminderMock).toHaveBeenCalledWith('reminder-1');
    expect(pushToastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    expect(wrapper.emitted('error')).toEqual([[failure.message]]);
  });

  it('changes date and refreshes reminders when header emits date change', async () => {
    const wrapper = mountWidget();
    const header = wrapper.findComponent(ReminderWidgetHeaderStub);

    header.vm.$emit('date-change', '2024-04-12');
    await nextTick();

    expect(setDateMock).toHaveBeenCalledWith('2024-04-12');
  });

  it('triggers manual refresh when header emits refresh', async () => {
    const wrapper = mountWidget();
    const header = wrapper.findComponent(ReminderWidgetHeaderStub);

    header.vm.$emit('refresh');
    await nextTick();

    expect(refreshMock).toHaveBeenCalledOnce();
  });
});
