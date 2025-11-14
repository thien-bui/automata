/**
 * Composable for managing daily reminders
 * Handles fetching, refreshing, and managing reminder state
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { ComputedRef } from 'vue';
import type { DailyReminder, ReminderResponse } from '@automata/types';
import {
  getTodayDateKey,
  isValidDateKey,
  type DateKey,
} from '../utils/dateOnly';

export interface UseDailyRemindersOptions {
  /** Date to fetch reminders for (defaults to today) */
  date?: string;
  /** Auto-refresh interval in milliseconds (defaults to 60000 = 1 minute) */
  refreshInterval?: number;
  /** Enable auto-refresh (defaults to true) */
  autoRefresh?: boolean;
  /** Enable midnight auto-update to today (defaults to true) */
  midnightUpdate?: boolean;
}

export type UseDailyRemindersReturn = {
  /** Array of reminders for the selected date */
  reminders: ComputedRef<DailyReminder[]>;
  /** Number of overdue reminders */
  overdueCount: ComputedRef<number>;
  /** Loading state */
  isLoading: ComputedRef<boolean>;
  /** Error state */
  error: ComputedRef<string | null>;
  /** Selected date in YYYY-MM-DD format */
  selectedDate: ComputedRef<DateKey>;
  /** Server time from API response (ISO string) */
  serverTime: ComputedRef<string | null>;
  /** Refresh reminders for current date */
  refresh: () => Promise<void>;
  /** Change the selected date */
  setDate: (date: string) => Promise<void>;
  /** Mark a reminder as completed */
  completeReminder: (reminderId: string) => Promise<void>;
  /** Start auto-refresh */
  startAutoRefresh: () => void;
  /** Stop auto-refresh */
  stopAutoRefresh: () => void;
};

/**
 * Composable for managing daily reminders
 * @param options - Configuration options
 * @returns Reminder management interface
 */
export function useDailyReminders(
  options: UseDailyRemindersOptions = {}
): UseDailyRemindersReturn {
  const {
    date: initialDate,
    refreshInterval = 60000, // 1 minute
    autoRefresh = true,
    midnightUpdate = true,
  } = options;

  // Reactive state
  const reminders = ref<DailyReminder[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const selectedDate = ref<DateKey>(
    initialDate && isValidDateKey(initialDate) ? initialDate : getTodayDateKey()
  );

  // Auto-refresh timer
  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  const midnightSchedulerEventId = ref<string | null>(null);
  let activeFetchId = 0;

  // Computed properties
  const overdueCount = computed(() => {
    // Use server-provided overdue count if available, otherwise fall back to client calculation
    return serverOverdueCount.value ?? clientOverdueCount.value;
  });

  // Server-provided overdue count from API response
  const serverOverdueCount = ref<number | null>(null);

  // Client-side overdue calculation as fallback
  const clientOverdueCount = computed(() => {
    const now = new Date();
    return reminders.value.filter(reminder => {
      const scheduledTime = new Date(reminder.scheduledAt);
      const expireTime = new Date(scheduledTime.getTime() + 15 * 60 * 1000); // 15 minutes
      return now > expireTime && !reminder.isCompleted;
    }).length;
  });

  // Server time from API response
  const serverTime = ref<string | null>(null);

  /**
   * Fetch reminders for the selected date
   */
  async function fetchReminders(): Promise<void> {
    const targetDate = selectedDate.value;
    const requestId = ++activeFetchId;

    isLoading.value = true;
    if (requestId === activeFetchId) {
      error.value = null;
    }

    try {
      const response = await fetch(`/api/reminder?date=${encodeURIComponent(targetDate)}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ReminderResponse = await response.json();
      if (requestId === activeFetchId) {
        reminders.value = data.reminders;
        serverOverdueCount.value = data.overdueCount;
        serverTime.value = data.serverTime;
        error.value = null;
      }
    } catch (err) {
      console.error('Error fetching reminders:', err);
      if (requestId === activeFetchId) {
        error.value = err instanceof Error ? err.message : 'Failed to fetch reminders';
        reminders.value = [];
      }
    } finally {
      if (requestId === activeFetchId) {
        isLoading.value = false;
      }
    }
  }

  /**
   * Refresh reminders for current date
   */
  async function refresh(): Promise<void> {
    await fetchReminders();
  }

  /**
   * Change the selected date and fetch reminders
   */
  async function setDate(date: string): Promise<void> {
    if (!isValidDateKey(date)) {
      const message = 'Date must be in YYYY-MM-DD format';
      error.value = message;
      throw new Error(message);
    }

    selectedDate.value = date;
    await fetchReminders();
  }

  /**
   * Mark a reminder as completed
   */
  async function completeReminder(reminderId: string): Promise<void> {
    try {
      const response = await fetch('/api/reminder/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reminderId,
          date: selectedDate.value,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Refresh the reminders list to show updated state
      await fetchReminders();
    } catch (err) {
      console.error('Error completing reminder:', err);
      error.value = err instanceof Error ? err.message : 'Failed to complete reminder';
      throw err; // Re-throw so caller can handle if needed
    }
  }

  /**
   * Start auto-refresh timer
   */
  function startAutoRefresh(): void {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }

    refreshTimer = setInterval(() => {
      fetchReminders().catch(err => {
        console.error('Error during reminder auto-refresh:', err);
      });
    }, refreshInterval);
  }

  /**
   * Stop auto-refresh timer
   */
  function stopAutoRefresh(): void {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  /**
   * Handle midnight update - switch to today's date and refresh
   */
  async function handleMidnightUpdate(): Promise<void> {
    const today = getTodayDateKey();
    
    // Only update if we're not already on today's date
    if (selectedDate.value !== today) {
      selectedDate.value = today;
      await fetchReminders();
    } else {
      // Even if we're on today's date, refresh to get any new reminders
      await fetchReminders();
    }
  }

  /**
   * Initialize server-side midnight scheduler
   */
  async function initializeMidnightScheduler(): Promise<void> {
    // Cancel existing scheduler event if any
    if (midnightSchedulerEventId.value) {
      try {
        await fetch(`/api/scheduler/events/${midnightSchedulerEventId.value}`, {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json',
          },
        });
        midnightSchedulerEventId.value = null;
      } catch (error) {
        console.warn('Failed to cancel existing midnight scheduler event:', error);
      }
    }

    try {
      // Schedule midnight update on the server
      const response = await fetch('/api/scheduler/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          taskType: 'daily-reminder-update',
          scheduleExpression: 'cron:0 0 * * *', // Run at midnight every day
          isRecurring: true,
          payload: {},
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      midnightSchedulerEventId.value = data.eventId;
    } catch (error) {
      console.error('Failed to initialize midnight scheduler:', error);
      // Fall back to client-side logic if server scheduling fails
      // This would be handled by the existing logic if we had a fallback
    }
  }

  /**
   * Destroy server-side midnight scheduler
   */
  async function destroyMidnightScheduler(): Promise<void> {
    if (midnightSchedulerEventId.value) {
      try {
        await fetch(`/api/scheduler/events/${midnightSchedulerEventId.value}`, {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json',
          },
        });
        midnightSchedulerEventId.value = null;
      } catch (error) {
        console.warn('Failed to cancel midnight scheduler event:', error);
      }
    }
  }

  // Initialize
  onMounted(async () => {
    await fetchReminders();
    
    if (autoRefresh) {
      startAutoRefresh();
    }

    // Set up midnight update if enabled
    if (midnightUpdate) {
      await initializeMidnightScheduler();
    }
  });

  onUnmounted(async () => {
    stopAutoRefresh();
    
    // Clean up midnight scheduler
    await destroyMidnightScheduler();
  });

  return {
    reminders: computed(() => reminders.value),
    overdueCount,
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    selectedDate: computed(() => selectedDate.value),
    serverTime: computed(() => serverTime.value),
    refresh,
    setDate,
    completeReminder,
    startAutoRefresh,
    stopAutoRefresh,
  };
}

/**
 * Utility function to format reminder time for display
 * @param scheduledAt - UTC ISO-8601 timestamp
 * @returns Formatted time string in local timezone
 */
export function formatReminderTime(scheduledAt: string): string {
  const date = new Date(scheduledAt);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Los_Angeles'
  });
}

/**
 * Utility function to check if a reminder is overdue
 * @param reminder - Reminder to check
 * @param expireWindowMinutes - Minutes past scheduled time when reminder expires (default: 15)
 * @returns True if reminder is overdue
 */
export function isReminderOverdue(
  reminder: DailyReminder,
  expireWindowMinutes: number = 15
): boolean {
  if (reminder.isCompleted) return false;

  const now = new Date();
  const scheduledTime = new Date(reminder.scheduledAt);
  const expireTime = new Date(scheduledTime.getTime() + expireWindowMinutes * 60 * 1000);

  return now > expireTime;
}

/**
 * Utility function to get reminder status
 * @param reminder - Reminder to check
 * @returns Status string for display
 */
export function getReminderStatus(reminder: DailyReminder): string {
  if (reminder.isCompleted) return 'completed';
  if (isReminderOverdue(reminder)) return 'overdue';
  return 'pending';
}
