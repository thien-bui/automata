/**
 * Reminder widget type definitions
 * All timestamps are stored as UTC ISO-8601 strings
 */

/**
 * Time window configuration for reminder filtering
 */
export type ReminderTimeWindow = {
  /** Number of minutes after scheduled time when reminder expires */
  expiresAfterMinutes: number;
};

/**
 * Individual reminder instance for a specific day
 */
export type DailyReminder = {
  /** Unique identifier for the reminder */
  id: string;
  /** Title of the reminder */
  title: string;
  /** Optional description */
  description?: string;
  /** Scheduled time in UTC ISO-8601 format */
  scheduledAt: string;
  /** Whether this is a recurring reminder */
  isRecurring: boolean;
  /** Whether the reminder has been completed */
  isCompleted: boolean;
  /** When the reminder was created (UTC ISO-8601) */
  createdAt: string;
};

/**
 * Payload for creating/updating reminders
 */
export type DailyReminderPayload = {
  title: string;
  description?: string;
  scheduledAt: string;
  isRecurring?: boolean;
};

/**
 * Policy for removing expired reminders
 */
export type ReminderRemovalPolicy = {
  /** Minutes past scheduled time when reminder should be removed */
  expireAfterMinutes: number;
};

/**
 * API response for reminders endpoint
 */
export type ReminderResponse = {
  reminders: DailyReminder[];
  expiresAfterMinutes: number;
};

/**
 * Reminder template for recurring reminders
 */
export type ReminderTemplate = {
  id: string;
  title: string;
  description?: string;
  /** Time of day in HH:MM format (UTC) */
  time: string;
  /** Recurrence pattern - currently only 'daily' supported */
  recurrence: 'daily';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
