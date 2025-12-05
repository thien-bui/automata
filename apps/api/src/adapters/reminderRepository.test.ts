import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { ReminderRepository } from './reminderRepository';
import { Redis } from 'ioredis';
import type { DailyReminder, ReminderTemplate, ReminderResponse } from '@automata/types';
import { 
  formatDateKey, 
  createUtcTimestamp, 
  filterExpiredReminders, 
  sortRemindersByTime,
  getReminderExpireWindowMinutes 
} from '../config/reminder';

// Mock config functions
vi.mock('../config/reminder', () => ({
  formatDateKey: vi.fn((date: Date) => '2024-01-01'),
  createUtcTimestamp: vi.fn(() => '2024-01-01T19:00:00.000Z'),
  filterExpiredReminders: vi.fn((reminders, minutes) => reminders),
  sortRemindersByTime: vi.fn((reminders) => reminders),
  getReminderExpireWindowMinutes: vi.fn(() => 30),
}));

describe('ReminderRepository', () => {
  let mockRedis: { get: Mock; set: Mock };
  let repository: ReminderRepository;
  let dateSpy: any;

  const mockDate = new Date('2024-01-01T00:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
    };
    repository = new ReminderRepository(mockRedis as unknown as Redis);
    // Mock Date.prototype.toISOString to return a fixed timestamp
    dateSpy = vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-01T00:00:00.000Z');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    dateSpy.mockRestore();
  });

  describe('getRemindersForDate', () => {
    it('should fetch active and completed reminders and combine them', async () => {
      const activeReminders: DailyReminder[] = [
        {
          id: 'active-1',
          title: 'Active Reminder',
          description: 'Test',
          scheduledAt: '2024-01-01T10:00:00.000Z',
          isRecurring: true,
          isCompleted: false,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const completedReminders: DailyReminder[] = [
        {
          id: 'completed-1',
          title: 'Completed Reminder',
          description: 'Test',
          scheduledAt: '2024-01-01T09:00:00.000Z',
          isRecurring: true,
          isCompleted: true,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(activeReminders))
        .mockResolvedValueOnce(JSON.stringify(completedReminders));

      (filterExpiredReminders as Mock).mockImplementation((reminders) => reminders);
      (sortRemindersByTime as Mock).mockImplementation((reminders) => reminders);

      const result = await repository.getRemindersForDate(mockDate);

      expect(mockRedis.get).toHaveBeenCalledWith('reminders:daily:2024-01-01');
      expect(mockRedis.get).toHaveBeenCalledWith('reminders:completed:2024-01-01');
      expect(filterExpiredReminders).toHaveBeenCalledWith(
        [...activeReminders, ...completedReminders],
        30
      );
      expect(result).toEqual({
        reminders: [...activeReminders, ...completedReminders],
        expiresAfterMinutes: 30,
      });
    });

    it('should handle empty Redis responses', async () => {
      mockRedis.get.mockResolvedValue(null);

      (filterExpiredReminders as Mock).mockReturnValue([]);
      (sortRemindersByTime as Mock).mockReturnValue([]);

      const result = await repository.getRemindersForDate(mockDate);

      expect(result).toEqual({
        reminders: [],
        expiresAfterMinutes: 30,
      });
    });

    it('should handle JSON parsing errors', async () => {
      mockRedis.get.mockResolvedValue('invalid json');

      await expect(repository.getRemindersForDate(mockDate)).rejects.toThrow('Failed to fetch reminders');
    });

    it('should handle Redis errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      await expect(repository.getRemindersForDate(mockDate)).rejects.toThrow('Failed to fetch reminders');
    });
  });

  describe('saveRemindersForDate', () => {
    it('should save reminders to Redis', async () => {
      const reminders: DailyReminder[] = [
        {
          id: 'test-1',
          title: 'Test Reminder',
          description: 'Test',
          scheduledAt: '2024-01-01T10:00:00.000Z',
          isRecurring: false,
          isCompleted: false,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      mockRedis.set.mockResolvedValue('OK');
      (formatDateKey as Mock).mockReturnValue('2024-01-01');

      await repository.saveRemindersForDate(mockDate, reminders);

      expect(formatDateKey).toHaveBeenCalledWith(mockDate);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'reminders:daily:2024-01-01',
        JSON.stringify(reminders)
      );
    });

    it('should handle Redis errors', async () => {
      const reminders: DailyReminder[] = [];
      mockRedis.set.mockRejectedValue(new Error('Redis write failed'));

      await expect(repository.saveRemindersForDate(mockDate, reminders)).rejects.toThrow('Failed to save reminders');
    });
  });

  describe('getReminderTemplates', () => {
    it('should fetch templates from Redis', async () => {
      const templates: ReminderTemplate[] = [
        {
          id: 'template-1',
          title: 'Test Template',
          description: 'Test',
          localTime: '19:00',
          timezone: 'America/Los_Angeles',
          recurrence: 'daily',
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      mockRedis.get.mockResolvedValue(JSON.stringify(templates));

      const result = await repository.getReminderTemplates();

      expect(mockRedis.get).toHaveBeenCalledWith('reminders:templates');
      expect(result).toEqual(templates);
    });

    it('should return empty array when no templates exist', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await repository.getReminderTemplates();

      expect(result).toEqual([]);
    });

    it('should handle JSON parsing errors', async () => {
      mockRedis.get.mockResolvedValue('invalid json');

      await expect(repository.getReminderTemplates()).rejects.toThrow('Failed to fetch reminder templates');
    });

    it('should handle Redis errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      await expect(repository.getReminderTemplates()).rejects.toThrow('Failed to fetch reminder templates');
    });
  });

  describe('saveReminderTemplates', () => {
    it('should save templates to Redis', async () => {
      const templates: ReminderTemplate[] = [
        {
          id: 'template-1',
          title: 'Test Template',
          description: 'Test',
          localTime: '19:00',
          timezone: 'America/Los_Angeles',
          recurrence: 'daily',
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      mockRedis.set.mockResolvedValue('OK');

      await repository.saveReminderTemplates(templates);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'reminders:templates',
        JSON.stringify(templates)
      );
    });

    it('should handle Redis errors', async () => {
      const templates: ReminderTemplate[] = [];
      mockRedis.set.mockRejectedValue(new Error('Redis write failed'));

      await expect(repository.saveReminderTemplates(templates)).rejects.toThrow('Failed to save reminder templates');
    });
  });

  describe('seedRecurringReminders', () => {
    it('should not seed if reminders already exist', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify([{ id: 'existing' }]));
      mockRedis.set.mockResolvedValue('OK');

      await repository.seedRecurringReminders(mockDate);

      expect(mockRedis.get).toHaveBeenCalledWith('reminders:daily:2024-01-01');
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should not seed if no active daily templates', async () => {
      mockRedis.get.mockResolvedValue(null); // No existing reminders
      mockRedis.get.mockResolvedValueOnce(null).mockResolvedValueOnce(JSON.stringify([])); // No templates

      await repository.seedRecurringReminders(mockDate);

      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should seed reminders from active daily templates', async () => {
      const templates: ReminderTemplate[] = [
        {
          id: 'move-car',
          title: 'Move Car',
          description: 'Move car to new spot',
          localTime: '19:00',
          timezone: 'America/Los_Angeles',
          recurrence: 'daily',
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'inactive',
          title: 'Inactive',
          description: 'Inactive template',
          localTime: '20:00',
          timezone: 'America/Los_Angeles',
          recurrence: 'daily',
          isActive: false,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      mockRedis.get
        .mockResolvedValueOnce(null) // No existing reminders
        .mockResolvedValueOnce(JSON.stringify(templates)); // Templates exist
      mockRedis.set.mockResolvedValue('OK');
      (formatDateKey as Mock).mockReturnValue('2024-01-01');
      (createUtcTimestamp as Mock).mockReturnValue('2024-01-01T19:00:00.000Z');

      await repository.seedRecurringReminders(mockDate);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'reminders:daily:2024-01-01',
        JSON.stringify([
          {
            id: 'move-car-2024-01-01',
            title: 'Move Car',
            description: 'Move car to new spot',
            scheduledAt: '2024-01-01T19:00:00.000Z',
            isRecurring: true,
            isCompleted: false,
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ])
      );
    });

    it('should handle templates with time property instead of localTime/timezone', async () => {
      const templates: ReminderTemplate[] = [
        {
          id: 'legacy',
          title: 'Legacy Template',
          description: 'Legacy',
          time: '2024-01-01T19:00:00.000Z', // legacy property
          recurrence: 'daily',
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      mockRedis.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify(templates));
      (createUtcTimestamp as Mock).mockReturnValue('2024-01-01T19:00:00.000Z');

      await repository.seedRecurringReminders(mockDate);

      expect(createUtcTimestamp).toHaveBeenCalledWith('2024-01-01', '2024-01-01T19:00:00.000Z');
    });

    it('should handle template missing time configuration', async () => {
      const templates: ReminderTemplate[] = [
        {
          id: 'no-time',
          title: 'No Time',
          description: 'No time configured',
          recurrence: 'daily',
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      mockRedis.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify(templates));
      (createUtcTimestamp as Mock).mockImplementation(() => {
        throw new Error('Missing time configuration');
      });

      await expect(repository.seedRecurringReminders(mockDate)).rejects.toThrow('Failed to seed recurring reminders');
    });

    it('should handle Redis errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      await expect(repository.seedRecurringReminders(mockDate)).rejects.toThrow('Failed to seed recurring reminders');
    });
  });

  describe('markReminderCompleted', () => {
    it('should move reminder from active to completed list', async () => {
      const activeReminders: DailyReminder[] = [
        {
          id: 'reminder-1',
          title: 'Test Reminder',
          description: 'Test',
          scheduledAt: '2024-01-01T10:00:00.000Z',
          isRecurring: false,
          isCompleted: false,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const completedReminders: DailyReminder[] = [];

      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(activeReminders))
        .mockResolvedValueOnce(JSON.stringify(completedReminders));
      mockRedis.set.mockResolvedValue('OK');

      await repository.markReminderCompleted('reminder-1', mockDate);

      expect(mockRedis.set).toHaveBeenCalledTimes(2);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'reminders:daily:2024-01-01',
        JSON.stringify([])
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        'reminders:completed:2024-01-01',
        JSON.stringify([
          {
            id: 'reminder-1',
            title: 'Test Reminder',
            description: 'Test',
            scheduledAt: '2024-01-01T10:00:00.000Z',
            isRecurring: false,
            isCompleted: true,
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ])
      );
    });

    it('should do nothing if reminder is already completed', async () => {
      const activeReminders: DailyReminder[] = [];
      const completedReminders: DailyReminder[] = [
        {
          id: 'reminder-1',
          title: 'Test Reminder',
          description: 'Test',
          scheduledAt: '2024-01-01T10:00:00.000Z',
          isRecurring: false,
          isCompleted: true,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(activeReminders))
        .mockResolvedValueOnce(JSON.stringify(completedReminders));

      await repository.markReminderCompleted('reminder-1', mockDate);

      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should throw error if reminder not found', async () => {
      const activeReminders: DailyReminder[] = [
        {
          id: 'other-reminder',
          title: 'Other Reminder',
          description: 'Test',
          scheduledAt: '2024-01-01T10:00:00.000Z',
          isRecurring: false,
          isCompleted: false,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const completedReminders: DailyReminder[] = [];

      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(activeReminders))
        .mockResolvedValueOnce(JSON.stringify(completedReminders));

      await expect(repository.markReminderCompleted('reminder-1', mockDate)).rejects.toThrow('Failed to mark reminder as completed');
    });

    it('should throw error if no reminders found for date', async () => {
      mockRedis.get.mockResolvedValue(null); // Both active and completed empty

      await expect(repository.markReminderCompleted('reminder-1', mockDate)).rejects.toThrow('Failed to mark reminder as completed');
    });

    it('should handle JSON parsing errors', async () => {
      mockRedis.get.mockResolvedValue('invalid json');

      await expect(repository.markReminderCompleted('reminder-1', mockDate)).rejects.toThrow('Failed to mark reminder as completed');
    });

    it('should handle Redis errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      await expect(repository.markReminderCompleted('reminder-1', mockDate)).rejects.toThrow('Failed to mark reminder as completed');
    });
  });

  describe('initializeDefaultTemplates', () => {
    it('should not save templates if they already exist', async () => {
      const existingTemplates: ReminderTemplate[] = [
        {
          id: 'existing',
          title: 'Existing Template',
          description: 'Test',
          localTime: '19:00',
          timezone: 'America/Los_Angeles',
          recurrence: 'daily',
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      mockRedis.get.mockResolvedValue(JSON.stringify(existingTemplates));

      await repository.initializeDefaultTemplates();

      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should save default templates when none exist', async () => {
      mockRedis.get.mockResolvedValue(null); // No existing templates
      mockRedis.set.mockResolvedValue('OK');

      await repository.initializeDefaultTemplates();

      expect(mockRedis.set).toHaveBeenCalledWith(
        'reminders:templates',
        JSON.stringify([
          {
            id: 'move-car',
            title: 'Move Car',
            description: 'Move car to new spot to avoid Kent Station parking enforcement',
            localTime: '19:00',
            timezone: 'America/Los_Angeles',
            recurrence: 'daily',
            isActive: true,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ])
      );
    });

    it('should handle JSON parsing errors', async () => {
      mockRedis.get.mockResolvedValue('invalid json');

      await expect(repository.initializeDefaultTemplates()).rejects.toThrow('Failed to initialize default reminder templates');
    });

    it('should handle Redis errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      await expect(repository.initializeDefaultTemplates()).rejects.toThrow('Failed to initialize default reminder templates');
    });
  });
});
