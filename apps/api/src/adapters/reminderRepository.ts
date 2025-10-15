/**
 * Reminder repository adapter
 * Handles data storage and retrieval for reminders using Redis
 */

import { Redis } from 'ioredis';
import { 
  DailyReminder, 
  ReminderTemplate, 
  DailyReminderPayload,
  ReminderResponse 
} from '@automata/types';
import { 
  formatDateKey, 
  createUtcTimestamp, 
  filterExpiredReminders, 
  sortRemindersByTime 
} from '../config/reminder';

export class ReminderRepository {
  private redis: Redis;
  private readonly remindersKeyPrefix = 'reminders:daily:';
  private readonly templatesKey = 'reminders:templates';
  private readonly completedKeyPrefix = 'reminders:completed:';

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Get reminders for a specific date
   * @param date - Date to get reminders for (defaults to today)
   * @returns Promise resolving to ReminderResponse
   */
  async getRemindersForDate(date: Date = new Date()): Promise<ReminderResponse> {
    const dateKey = formatDateKey(date);
    const remindersKey = `${this.remindersKeyPrefix}${dateKey}`;
    const completedKey = `${this.completedKeyPrefix}${dateKey}`;

    try {
      // Get both active and completed reminders
      const [activeRemindersJson, completedRemindersJson] = await Promise.all([
        this.redis.get(remindersKey),
        this.redis.get(completedKey)
      ]);

      let activeReminders: DailyReminder[] = [];
      let completedReminders: DailyReminder[] = [];

      if (activeRemindersJson) {
        activeReminders = JSON.parse(activeRemindersJson);
      }

      if (completedRemindersJson) {
        completedReminders = JSON.parse(completedRemindersJson);
      }

      // Combine and filter out expired reminders
      const allReminders = [...activeReminders, ...completedReminders];
      const nonExpiredReminders = filterExpiredReminders(allReminders) as DailyReminder[];
      
      // Sort by scheduled time (earliest first)
      const sortedReminders = sortRemindersByTime(nonExpiredReminders);

      return {
        reminders: sortedReminders,
        expiresAfterMinutes: 15 // This should match the config, but we'll hardcode for now
      };
    } catch (error) {
      console.error('Error fetching reminders for date:', dateKey, error);
      throw new Error('Failed to fetch reminders');
    }
  }

  /**
   * Save reminders for a specific date
   * @param date - Date to save reminders for
   * @param reminders - Array of reminders to save
   */
  async saveRemindersForDate(date: Date, reminders: DailyReminder[]): Promise<void> {
    const dateKey = formatDateKey(date);
    const remindersKey = `${this.remindersKeyPrefix}${dateKey}`;

    try {
      await this.redis.set(remindersKey, JSON.stringify(reminders));
    } catch (error) {
      console.error('Error saving reminders for date:', dateKey, error);
      throw new Error('Failed to save reminders');
    }
  }

  /**
   * Get reminder templates
   * @returns Promise resolving to array of ReminderTemplate
   */
  async getReminderTemplates(): Promise<ReminderTemplate[]> {
    try {
      const templatesJson = await this.redis.get(this.templatesKey);
      
      if (!templatesJson) {
        return [];
      }

      return JSON.parse(templatesJson);
    } catch (error) {
      console.error('Error fetching reminder templates:', error);
      throw new Error('Failed to fetch reminder templates');
    }
  }

  /**
   * Save reminder templates
   * @param templates - Array of reminder templates to save
   */
  async saveReminderTemplates(templates: ReminderTemplate[]): Promise<void> {
    try {
      await this.redis.set(this.templatesKey, JSON.stringify(templates));
    } catch (error) {
      console.error('Error saving reminder templates:', error);
      throw new Error('Failed to save reminder templates');
    }
  }

  /**
   * Seed recurring reminders for a specific date from templates
   * @param date - Date to seed reminders for
   */
  async seedRecurringReminders(date: Date = new Date()): Promise<void> {
    const dateKey = formatDateKey(date);
    const remindersKey = `${this.remindersKeyPrefix}${dateKey}`;

    try {
      // Check if reminders already exist for this date
      const existingReminders = await this.redis.get(remindersKey);
      if (existingReminders) {
        return; // Don't overwrite existing reminders
      }

      // Get active recurring templates
      const templates = await this.getReminderTemplates();
      const activeTemplates = templates.filter(template => 
        template.isActive && template.recurrence === 'daily'
      );

      if (activeTemplates.length === 0) {
        return;
      }

      // Generate daily reminders from templates
      const dailyReminders: DailyReminder[] = activeTemplates.map(template => ({
        id: `${template.id}-${dateKey}`,
        title: template.title,
        description: template.description,
        scheduledAt: createUtcTimestamp(dateKey, template.time),
        isRecurring: true,
        isCompleted: false,
        createdAt: new Date().toISOString()
      }));

      // Save the generated reminders
      await this.saveRemindersForDate(date, dailyReminders);
      
      console.log(`Seeded ${dailyReminders.length} recurring reminders for ${dateKey}`);
    } catch (error) {
      console.error('Error seeding recurring reminders for date:', dateKey, error);
      throw new Error('Failed to seed recurring reminders');
    }
  }

  /**
   * Mark a reminder as completed
   * @param reminderId - ID of the reminder to mark as completed
   * @param date - Date of the reminder (defaults to today)
   */
  async markReminderCompleted(reminderId: string, date: Date = new Date()): Promise<void> {
    const dateKey = formatDateKey(date);
    const remindersKey = `${this.remindersKeyPrefix}${dateKey}`;
    const completedKey = `${this.completedKeyPrefix}${dateKey}`;

    try {
      // Get current reminders
      const remindersJson = await this.redis.get(remindersKey);
      if (!remindersJson) {
        throw new Error('No reminders found for this date');
      }

      const reminders: DailyReminder[] = JSON.parse(remindersJson);
      const reminderIndex = reminders.findIndex(r => r.id === reminderId);
      
      if (reminderIndex === -1) {
        throw new Error('Reminder not found');
      }

      // Mark as completed
      reminders[reminderIndex].isCompleted = true;

      // Move to completed list
      const completedRemindersJson = await this.redis.get(completedKey);
      let completedReminders: DailyReminder[] = [];
      
      if (completedRemindersJson) {
        completedReminders = JSON.parse(completedRemindersJson);
      }
      
      completedReminders.push(reminders[reminderIndex]);

      // Remove from active and add to completed
      const updatedReminders = reminders.filter(r => r.id !== reminderId);
      
      await Promise.all([
        this.redis.set(remindersKey, JSON.stringify(updatedReminders)),
        this.redis.set(completedKey, JSON.stringify(completedReminders))
      ]);

      console.log(`Marked reminder ${reminderId} as completed for ${dateKey}`);
    } catch (error) {
      console.error('Error marking reminder as completed:', reminderId, error);
      throw new Error('Failed to mark reminder as completed');
    }
  }

  /**
   * Initialize with default reminder templates if none exist
   */
  async initializeDefaultTemplates(): Promise<void> {
    try {
      const existingTemplates = await this.getReminderTemplates();
      
      if (existingTemplates.length > 0) {
        return; // Templates already exist
      }

      const defaultTemplates: ReminderTemplate[] = [
        {
          id: 'move-car',
          title: 'Move Car',
          description: 'Move car to new spot to avoid Kent Station parking enforcement',
          time: '19:00',
          recurrence: 'daily',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      await this.saveReminderTemplates(defaultTemplates);
      console.log('Initialized default reminder templates');
    } catch (error) {
      console.error('Error initializing default reminder templates:', error);
      throw new Error('Failed to initialize default reminder templates');
    }
  }
}
