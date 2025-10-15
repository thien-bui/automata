/**
 * Composable for managing daily reminders
 * Handles fetching, refreshing, and managing reminder state
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { DailyReminder, ReminderResponse } from '@automata/types';

export interface UseDailyRemindersOptions {
  /** Date to fetch reminders for (defaults to today) */
  date?: string;
  /** Auto-refresh interval in milliseconds (defaults to 60000 = 1 minute) */
  refreshInterval?: number;
  /** Enable auto-refresh (defaults to true) */
  autoRefresh?: boolean;
}

export interface UseDailyRemindersReturn {
  /** Array of reminders for the selected date */
  reminders: DailyReminder[];
  /** Number of overdue reminders */
  overdueCount: number;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Selected date in YYYY-MM-DD format */
  selectedDate: string;
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
}

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
  } = options;

  // Reactive state
  const reminders = ref<DailyReminder[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const selectedDate = ref(initialDate || formatDateKey(new Date()));

  // Auto-refresh timer
  let refreshTimer: NodeJS.Timeout | null = null;

  // Computed properties
  const overdueCount = computed(() => {
    const now = new Date();
    return reminders.value.filter(reminder => {
      const scheduledTime = new Date(reminder.scheduledAt);
      const expireTime = new Date(scheduledTime.getTime() + 15 * 60 * 1000); // 15 minutes
      return now > expireTime && !reminder.isCompleted;
    }).length;
  });

  /**
   * Format date as YYYY-MM-DD string
   */
  function formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Fetch reminders for the selected date
   */
  async function fetchReminders(): Promise<void> {
    if (!selectedDate.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch(`/api/reminder?date=${encodeURIComponent(selectedDate.value)}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ReminderResponse = await response.json();
      reminders.value = data.reminders;
    } catch (err) {
      console.error('Error fetching reminders:', err);
      error.value = err instanceof Error ? err.message : 'Failed to fetch reminders';
      reminders.value = [];
    } finally {
      isLoading.value = false;
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
      fetchReminders();
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

  // Initialize
  onMounted(async () => {
    await fetchReminders();
    
    if (autoRefresh) {
      startAutoRefresh();
    }
  });

  onUnmounted(() => {
    stopAutoRefresh();
  });

  return {
    reminders: reminders.value,
    overdueCount: overdueCount.value,
    isLoading: isLoading.value,
    error: error.value,
    selectedDate: selectedDate.value,
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
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
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
