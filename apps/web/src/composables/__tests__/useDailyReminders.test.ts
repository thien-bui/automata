import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import type { DailyReminder, ReminderResponse } from '@automata/types';
import {
  useDailyReminders,
  type UseDailyRemindersOptions,
  type UseDailyRemindersReturn,
} from '../useDailyReminders';
import type { DateKey } from '../../utils/dateOnly';
import * as dateOnlyModule from '../../utils/dateOnly';

const scheduleMidnightTaskMock = vi.hoisted(() =>
  vi.fn<[callback: () => void], () => void>()
);

vi.mock('../../utils/midnightScheduler', () => ({
  scheduleMidnightTask: scheduleMidnightTaskMock,
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const waitForMidnightScheduler = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (scheduleMidnightTaskMock.mock.calls.length > 0) {
      return;
    }
    await flushPromises();
  }

  throw new Error('Midnight scheduler did not run');
};

const waitForCondition = async (predicate: () => boolean, attempts = 10) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate()) {
      return;
    }
    await flushPromises();
  }

  throw new Error('Condition was not met within retry window');
};

const createReminder = (overrides: Partial<DailyReminder> = {}): DailyReminder => ({
  id: overrides.id ?? 'reminder-1',
  title: overrides.title ?? 'Morning reminder',
  description: overrides.description,
  scheduledAt: overrides.scheduledAt ?? '2024-01-01T08:00:00.000Z',
  isRecurring: overrides.isRecurring ?? false,
  isCompleted: overrides.isCompleted ?? false,
  createdAt: overrides.createdAt ?? '2023-12-31T12:00:00.000Z',
});

const createFetchResponse = (reminders: DailyReminder[]): Response => {
  const payload: ReminderResponse = {
    reminders,
    expiresAfterMinutes: 15,
  };

  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: vi.fn<[], Promise<ReminderResponse>>().mockResolvedValue(payload),
  } as unknown as Response;
};

describe('useDailyReminders', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let midnightCallback: (() => void) | null;
  let midnightCleanupMock: ReturnType<typeof vi.fn>;

  const mountComposable = (
    options: UseDailyRemindersOptions = {}
  ): { wrapper: ReturnType<typeof mount>; composable: UseDailyRemindersReturn } => {
    let result: UseDailyRemindersReturn | undefined;

    const wrapper = mount(
      defineComponent({
        name: 'UseDailyRemindersHost',
        setup() {
          result = useDailyReminders(options);
          return () => h('div');
        },
      })
    );

    return { wrapper, composable: result! };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    midnightCallback = null;
    midnightCleanupMock = vi.fn();
    scheduleMidnightTaskMock.mockImplementation(callback => {
      midnightCallback = callback;
      return midnightCleanupMock;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    scheduleMidnightTaskMock.mockReset();
    vi.restoreAllMocks();
  });

  it('updates selected date to today and refreshes reminders when midnight task runs', async () => {
    const initialDate: DateKey = '2024-01-01';
    const todayDate: DateKey = '2024-01-02';

    vi.spyOn(dateOnlyModule, 'getTodayDateKey').mockReturnValue(todayDate);

    const initialReminders = [
      createReminder({
        id: 'initial-reminder',
        scheduledAt: '2024-01-01T08:00:00.000Z',
      }),
    ];
    const refreshedReminders = [
      createReminder({
        id: 'updated-reminder',
        scheduledAt: '2024-01-02T09:00:00.000Z',
      }),
    ];

    fetchMock.mockResolvedValueOnce(createFetchResponse(initialReminders));
    fetchMock.mockResolvedValueOnce(createFetchResponse(refreshedReminders));

    const { wrapper, composable } = mountComposable({
      date: initialDate,
      autoRefresh: false,
    });

    await nextTick();
    await waitForMidnightScheduler();

    expect(scheduleMidnightTaskMock).toHaveBeenCalledTimes(1);
    expect(midnightCallback).toBeTypeOf('function');
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/reminder?date=${encodeURIComponent(initialDate)}`
    );
    expect(composable.selectedDate.value).toBe(initialDate);
    expect(composable.reminders.value).toEqual(initialReminders);

    midnightCallback?.();
    await flushPromises();
    await nextTick();
    await waitForCondition(
      () =>
        composable.selectedDate.value === todayDate &&
        composable.reminders.value.length === refreshedReminders.length &&
        composable.reminders.value[0]?.id === refreshedReminders[0]?.id
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/reminder?date=${encodeURIComponent(todayDate)}`
    );
    expect(composable.selectedDate.value).toBe(todayDate);
    expect(composable.reminders.value).toEqual(refreshedReminders);

    wrapper.unmount();
    expect(midnightCleanupMock).toHaveBeenCalledTimes(1);
  });
});
