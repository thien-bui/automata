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

// Mock fetch for scheduler API endpoints
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
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
  let schedulerEventId: string;

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
    fetchMock.mockClear();

    schedulerEventId = 'test-scheduler-event-123';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes server-side midnight scheduler when midnightUpdate is enabled', async () => {
    const initialDate: DateKey = '2024-01-01';
    const initialReminders = [
      createReminder({
        id: 'initial-reminder',
        scheduledAt: '2024-01-01T08:00:00.000Z',
      }),
    ];

    // Set up mock responses - use a more flexible approach
    fetchMock.mockImplementation((url: string, options?: any) => {
      if (url.includes('/api/reminder')) {
        return Promise.resolve(createFetchResponse(initialReminders));
      }
      if (url.includes('/api/scheduler/events') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({ eventId: schedulerEventId }),
        });
      }
      if (url.includes('/api/scheduler/events') && options?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({}),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({}),
      });
    });

    const { wrapper, composable } = mountComposable({
      date: initialDate,
      autoRefresh: false,
      midnightUpdate: true,
    });

    // Wait for initial setup - need to wait for both reminder fetch AND scheduler initialization
    await flushPromises();
    await nextTick();
    await flushPromises(); // Extra wait for scheduler initialization
    await nextTick();
    
    // Wait a bit more for the scheduler initialization to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    await flushPromises();
    await nextTick();

    // Verify scheduler was initialized
    const schedulerPostCalls = fetchMock.mock.calls.filter(call => 
      call[0]?.includes('/api/scheduler/events') && call[1]?.method === 'POST'
    );
    expect(schedulerPostCalls.length).toBe(1);
    
    const postCall = schedulerPostCalls[0];
    expect(postCall[1].body).toContain('daily-reminder-update');
    expect(postCall[1].body).toContain('cron:0 0 * * *');
    
    // Verify reminders were loaded
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/reminder?date=${encodeURIComponent(initialDate)}`
    );
    expect(composable.selectedDate.value).toBe(initialDate);
    expect(composable.reminders.value).toEqual(initialReminders);

    // Unmount and verify cleanup
    wrapper.unmount();
    
    await flushPromises();
    await nextTick();
    await flushPromises(); // Extra wait for cleanup
    await nextTick();
    
    const deleteCalls = fetchMock.mock.calls.filter(call => 
      call[0]?.includes('/api/scheduler/events') && call[1]?.method === 'DELETE'
    );
    expect(deleteCalls.length).toBe(1);
    expect(deleteCalls[0][0]).toContain(schedulerEventId);
  });

  it('does not initialize scheduler when midnightUpdate is disabled', async () => {
    const initialDate: DateKey = '2024-01-01';
    const initialReminders = [
      createReminder({
        id: 'initial-reminder',
        scheduledAt: '2024-01-01T08:00:00.000Z',
      }),
    ];

    // Set up mock response for reminders only
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/reminder')) {
        return Promise.resolve(createFetchResponse(initialReminders));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({}),
      });
    });

    const { wrapper, composable } = mountComposable({
      date: initialDate,
      autoRefresh: false,
      midnightUpdate: false,
    });

    // Wait for initial setup
    await flushPromises();
    await nextTick();
    await flushPromises(); // Extra wait
    await nextTick();

    // Verify no scheduler calls were made
    const schedulerCalls = fetchMock.mock.calls.filter(call => 
      call[0]?.includes('/api/scheduler/events')
    );
    expect(schedulerCalls.length).toBe(0);
    
    // Verify reminders were loaded
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/reminder?date=${encodeURIComponent(initialDate)}`
    );
    expect(composable.selectedDate.value).toBe(initialDate);
    expect(composable.reminders.value).toEqual(initialReminders);

    wrapper.unmount();
  });

  it('handles scheduler initialization failure gracefully', async () => {
    const initialDate: DateKey = '2024-01-01';
    const initialReminders = [
      createReminder({
        id: 'initial-reminder',
        scheduledAt: '2024-01-01T08:00:00.000Z',
      }),
    ];

    // Mock console.error to verify error handling
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Set up mock responses - scheduler fails but reminders load
    fetchMock.mockImplementation((url: string, options?: any) => {
      if (url.includes('/api/reminder')) {
        return Promise.resolve(createFetchResponse(initialReminders));
      }
      if (url.includes('/api/scheduler/events') && options?.method === 'POST') {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({}),
      });
    });

    const { wrapper, composable } = mountComposable({
      date: initialDate,
      autoRefresh: false,
      midnightUpdate: true,
    });

    // Wait for initial setup
    await flushPromises();
    await nextTick();
    await flushPromises(); // Extra wait for scheduler initialization
    await nextTick();

    // Verify scheduler was attempted
    const schedulerCalls = fetchMock.mock.calls.filter(call => 
      call[0]?.includes('/api/scheduler/events') && call[1]?.method === 'POST'
    );
    expect(schedulerCalls.length).toBe(1);
    
    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to initialize midnight scheduler:',
      expect.any(Error)
    );
    
    // Verify reminders still loaded despite scheduler failure
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/reminder?date=${encodeURIComponent(initialDate)}`
    );
    expect(composable.selectedDate.value).toBe(initialDate);
    expect(composable.reminders.value).toEqual(initialReminders);

    wrapper.unmount();
    consoleErrorSpy.mockRestore();
  });
});
