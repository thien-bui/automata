/**
 * Reminder scheduler service
 * Handles expanding recurring templates into daily instances
 */

import { ReminderRepository } from '../adapters/reminderRepository';
import { formatDateKey } from '../config/reminder';

export class ReminderScheduler {
  private reminderRepository: ReminderRepository;

  constructor(reminderRepository: ReminderRepository) {
    this.reminderRepository = reminderRepository;
  }

  /**
   * Initialize the scheduler by seeding today's reminders
   * This should be called when the application starts
   */
  async initialize(): Promise<void> {
    try {
      // Initialize default templates if needed
      await this.reminderRepository.initializeDefaultTemplates();
      
      // Seed today's reminders
      await this.seedTodayReminders();
      
      // Seed tomorrow's reminders (to prepare for the next day)
      await this.seedTomorrowReminders();
      
      console.log('Reminder scheduler initialized successfully');
    } catch (error) {
      console.error('Failed to initialize reminder scheduler:', error);
      throw error;
    }
  }

  /**
   * Seed reminders for today
   */
  async seedTodayReminders(): Promise<void> {
    const today = new Date();
    await this.reminderRepository.seedRecurringReminders(today);
  }

  /**
   * Seed reminders for tomorrow
   */
  async seedTomorrowReminders(): Promise<void> {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    await this.reminderRepository.seedRecurringReminders(tomorrow);
  }

  /**
   * Seed reminders for a specific date range
   * Useful for bulk operations or testing
   * @param startDate - Start date (inclusive)
   * @param endDate - End date (inclusive)
   */
  async seedDateRange(startDate: Date, endDate: Date): Promise<void> {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      throw new Error('Start date must be before or equal to end date');
    }

    const currentDate = new Date(start);
    
    while (currentDate <= end) {
      await this.reminderRepository.seedRecurringReminders(new Date(currentDate));
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    console.log(`Seeded reminders for date range: ${formatDateKey(start)} to ${formatDateKey(end)}`);
  }

  /**
   * Clean up old reminder data
   * Removes reminder data for dates older than the specified number of days
   * @param daysToKeep - Number of days to keep data for (default: 7)
   */
  async cleanupOldData(daysToKeep: number = 7): Promise<void> {
    // This would be implemented to clean up old reminder data
    // For now, we'll just log that this feature is available
    console.log(`Cleanup called for ${daysToKeep} days - implementation pending`);
  }

  /**
   * Get scheduler status and statistics
   */
  async getStatus(): Promise<{
    initialized: boolean;
    todaySeeded: boolean;
    tomorrowSeeded: boolean;
    templateCount: number;
  }> {
    try {
      const templates = await this.reminderRepository.getReminderTemplates();
      const today = formatDateKey();
      const tomorrow = formatDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000));

      // Check if reminders exist for today and tomorrow
      // This is a simplified check - in a real implementation you might want more sophisticated checks
      const todayReminders = await this.reminderRepository.getRemindersForDate(new Date());
      const tomorrowReminders = await this.reminderRepository.getRemindersForDate(
        new Date(Date.now() + 24 * 60 * 60 * 1000)
      );

      return {
        initialized: true,
        todaySeeded: todayReminders.reminders.length > 0,
        tomorrowSeeded: tomorrowReminders.reminders.length > 0,
        templateCount: templates.length
      };
    } catch (error) {
      console.error('Error getting scheduler status:', error);
      return {
        initialized: false,
        todaySeeded: false,
        tomorrowSeeded: false,
        templateCount: 0
      };
    }
  }
}

/**
 * Create a daily cron job function that can be used to seed reminders
 * This would typically be called by a cron job scheduler
 */
export function createDailySeedJob(scheduler: ReminderScheduler): () => Promise<void> {
  return async (): Promise<void> => {
    try {
      console.log('Running daily reminder seed job');
      await scheduler.seedTodayReminders();
      await scheduler.seedTomorrowReminders();
      console.log('Daily reminder seed job completed');
    } catch (error) {
      console.error('Daily reminder seed job failed:', error);
    }
  };
}
