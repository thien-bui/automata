/**
 * Utility functions for scheduling tasks to run at midnight
 */

/**
 * Calculate the number of milliseconds until the next midnight
 * @returns Milliseconds until next midnight (local time)
 */
export function getMsUntilMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  
  // Set to tomorrow at 00:00:00.000
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  return tomorrow.getTime() - now.getTime();
}

/**
 * Calculate the number of milliseconds until a specific time of day
 * @param hours - Hour (0-23)
 * @param minutes - Minute (0-59)
 * @param seconds - Second (0-59)
 * @returns Milliseconds until the specified time
 */
export function getMsUntilTime(hours: number = 0, minutes: number = 0, seconds: number = 0): number {
  const now = new Date();
  const target = new Date(now);
  
  // Set target time for today
  target.setHours(hours, minutes, seconds, 0);
  
  // If target time has already passed today, schedule for tomorrow
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  
  return target.getTime() - now.getTime();
}

/**
 * Schedule a callback to run at midnight every day
 * @param callback - Function to call at midnight
 * @returns Cleanup function to cancel the scheduling
 */
export function scheduleMidnightTask(callback: () => void): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  function scheduleNext(): void {
    const msUntilMidnight = getMsUntilMidnight();
    
    timeoutId = setTimeout(() => {
      callback();
      scheduleNext(); // Schedule for the next day
    }, msUntilMidnight);
  }
  
  // Start the scheduling
  scheduleNext();
  
  // Return cleanup function
  return () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
}

/**
 * Schedule a callback to run at a specific time every day
 * @param callback - Function to call
 * @param hours - Hour (0-23)
 * @param minutes - Minute (0-59)
 * @param seconds - Second (0-59)
 * @returns Cleanup function to cancel the scheduling
 */
export function scheduleDailyTask(
  callback: () => void,
  hours: number = 0,
  minutes: number = 0,
  seconds: number = 0
): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  function scheduleNext(): void {
    const msUntilTarget = getMsUntilTime(hours, minutes, seconds);
    
    timeoutId = setTimeout(() => {
      callback();
      scheduleNext(); // Schedule for the next day
    }, msUntilTarget);
  }
  
  // Start the scheduling
  scheduleNext();
  
  // Return cleanup function
  return () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
}
