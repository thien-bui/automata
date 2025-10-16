import { DateTime } from 'luxon';

/**
 * Reminder widget configuration
 * Handles environment variables and provides helper utilities
 */

const DEFAULT_EXPIRE_WINDOW_MINUTES = 15;

/**
 * Get the reminder expiration window in minutes
 * @returns Number of minutes after scheduled time when reminder expires
 */
export function getReminderExpireWindowMinutes(): number {
  const envValue = process.env.REMINDER_EXPIRE_WINDOW_MINUTES;
  if (!envValue) {
    return DEFAULT_EXPIRE_WINDOW_MINUTES;
  }
  
  const parsed = parseInt(envValue, 10);
  if (isNaN(parsed) || parsed < 0) {
    console.warn(
      `Invalid REMINDER_EXPIRE_WINDOW_MINUTES: ${envValue}. Using default: ${DEFAULT_EXPIRE_WINDOW_MINUTES}`
    );
    return DEFAULT_EXPIRE_WINDOW_MINUTES;
  }
  
  return parsed;
}

/**
 * Check if a reminder is expired based on its scheduled time
 * @param scheduledAt - UTC ISO-8601 timestamp when reminder was scheduled
 * @param expireWindowMinutes - Minutes past scheduled time when reminder expires
 * @returns True if reminder should be filtered out
 */
export function isReminderExpired(
  scheduledAt: string,
  expireWindowMinutes: number = getReminderExpireWindowMinutes()
): boolean {
  const scheduledTime = DateTime.fromISO(scheduledAt, { zone: 'utc' });
  if (!scheduledTime.isValid) {
    throw new Error(`Invalid scheduledAt timestamp: ${scheduledAt}`);
  }

  const expireTime = scheduledTime.plus({ minutes: expireWindowMinutes });
  return DateTime.utc().toMillis() > expireTime.toMillis();
}

/**
 * Filter out expired reminders from a list
 * @param reminders - List of reminders to filter
 * @param expireWindowMinutes - Minutes past scheduled time when reminders expire
 * @returns Filtered list of non-expired reminders
 */
export function filterExpiredReminders(
  reminders: Array<{ scheduledAt: string }>,
  expireWindowMinutes: number = getReminderExpireWindowMinutes()
): Array<{ scheduledAt: string }> {
  return reminders.filter(reminder => !isReminderExpired(reminder.scheduledAt, expireWindowMinutes));
}

/**
 * Sort reminders by scheduled time (earliest first)
 * @param reminders - List of reminders to sort
 * @returns Sorted list of reminders
 */
export function sortRemindersByTime<T extends { scheduledAt: string }>(
  reminders: T[]
): T[] {
  return [...reminders].sort((a, b) => 
    DateTime.fromISO(a.scheduledAt).toMillis() - DateTime.fromISO(b.scheduledAt).toMillis()
  );
}

/**
 * Generate a date string in YYYY-MM-DD format for a given date
 * @param date - Date to format (defaults to current date)
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Create a UTC ISO-8601 timestamp for a specific date and time
 * @param dateKey - Date in YYYY-MM-DD format
 * @param timeString - Time in HH:MM format (24-hour). Interpreted as UTC when no timezone is provided.
 * @param timeZone - Optional IANA timezone identifier for interpreting the time string
 * @returns UTC ISO-8601 timestamp
 */
export function createUtcTimestamp(
  dateKey: string,
  timeString: string,
  timeZone?: string
): string {
  const seed = `${dateKey}T${timeString}`;
  const zone = timeZone ?? 'UTC';
  const dateTime = DateTime.fromISO(seed, { zone });

  if (!dateTime.isValid) {
    throw new Error(`Invalid date/time combination: ${seed} (${zone})`);
  }

  const utcValue = dateTime.toUTC();
  const isoString = utcValue.toISO({ suppressMilliseconds: false });

  if (!isoString) {
    throw new Error(`Failed to create ISO timestamp for: ${seed} (${zone})`);
  }

  return isoString;
}
