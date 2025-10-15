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
  const scheduledTime = new Date(scheduledAt);
  const now = new Date();
  const expireTime = new Date(scheduledTime.getTime() + expireWindowMinutes * 60 * 1000);
  
  return now > expireTime;
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
    new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
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
 * Parse a time string in HH:MM format and return minutes since midnight
 * @param timeString - Time in HH:MM format (24-hour, UTC)
 * @returns Minutes since midnight
 */
export function parseTimeString(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time format: ${timeString}. Expected HH:MM in 24-hour format.`);
  }
  
  return hours * 60 + minutes;
}

/**
 * Create a UTC ISO-8601 timestamp for a specific date and time
 * @param dateKey - Date in YYYY-MM-DD format
 * @param timeString - Time in HH:MM format (24-hour, UTC)
 * @returns UTC ISO-8601 timestamp
 */
export function createUtcTimestamp(dateKey: string, timeString: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const minutesSinceMidnight = parseTimeString(timeString);
  
  const hours = Math.floor(minutesSinceMidnight / 60);
  const minutes = minutesSinceMidnight % 60;
  
  const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
  return date.toISOString();
}
