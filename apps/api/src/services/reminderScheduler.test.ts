import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ReminderScheduler, createDailySeedJob } from './reminderScheduler';
import { ReminderRepository } from '../adapters/reminderRepository';
import { formatDateKey } from '../config/reminder';

// Mock the reminder repository
vi.mock('../adapters/reminderRepository');

describe('ReminderScheduler', () => {
  let scheduler: ReminderScheduler;
  let mockRepository: ReturnType<typeof vi.mocked<ReminderRepository>>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create mock repository
    mockRepository = {
      initializeDefaultTemplates: vi.fn(),
      seedRecurringReminders: vi.fn(),
      getReminderTemplates: vi.fn(),
      getRemindersForDate: vi.fn(),
    } as unknown as ReturnType<typeof vi.mocked<ReminderRepository>>;

    // Create scheduler with mocked repository
    scheduler = new ReminderScheduler(mockRepository as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      mockRepository.initializeDefaultTemplates.mockResolvedValue(undefined);
      mockRepository.seedRecurringReminders.mockResolvedValue(undefined);

      await scheduler.initialize();

      expect(mockRepository.initializeDefaultTemplates).toHaveBeenCalledTimes(1);
      expect(mockRepository.seedRecurringReminders).toHaveBeenCalledTimes(2);
    });

    it('should handle initialization error', async () => {
      const error = new Error('Database connection failed');
      mockRepository.initializeDefaultTemplates.mockRejectedValue(error);

      await expect(scheduler.initialize()).rejects.toThrow('Database connection failed');
    });
  });

  describe('seedTodayReminders', () => {
    it('should seed reminders for today', async () => {
      await scheduler.seedTodayReminders();

      expect(mockRepository.seedRecurringReminders).toHaveBeenCalledTimes(1);
      expect(mockRepository.seedRecurringReminders).toHaveBeenCalledWith(
        expect.any(Date)
      );
    });
  });

  describe('seedTomorrowReminders', () => {
    it('should seed reminders for tomorrow', async () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      await scheduler.seedTomorrowReminders();

      expect(mockRepository.seedRecurringReminders).toHaveBeenCalledTimes(1);
      const call = mockRepository.seedRecurringReminders.mock.calls[0];
      expect(call).toBeDefined();
      const callDate = call![0]!;
      expect(callDate.getUTCDate()).toBe(tomorrow.getUTCDate());
    });
  });

  describe('seedDateRange', () => {
    it('should seed reminders for a date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-03');

      await scheduler.seedDateRange(startDate, endDate);

      expect(mockRepository.seedRecurringReminders).toHaveBeenCalledTimes(3);
      
      const calls = mockRepository.seedRecurringReminders.mock.calls;
      expect(calls[0]).toBeDefined();
      expect(calls[1]).toBeDefined();
      expect(calls[2]).toBeDefined();
      expect((calls[0]![0] as Date).toISOString().split('T')[0]).toBe('2024-01-01');
      expect((calls[1]![0] as Date).toISOString().split('T')[0]).toBe('2024-01-02');
      expect((calls[2]![0] as Date).toISOString().split('T')[0]).toBe('2024-01-03');
    });

    it('should throw error when start date is after end date', async () => {
      const startDate = new Date('2024-01-03');
      const endDate = new Date('2024-01-01');

      await expect(scheduler.seedDateRange(startDate, endDate))
        .rejects
        .toThrow('Start date must be before or equal to end date');

      expect(mockRepository.seedRecurringReminders).not.toHaveBeenCalled();
    });

    it('should seed single date when start and end are the same', async () => {
      const date = new Date('2024-01-01');

      await scheduler.seedDateRange(date, date);

      expect(mockRepository.seedRecurringReminders).toHaveBeenCalledTimes(1);
      expect(mockRepository.seedRecurringReminders).toHaveBeenCalledWith(date);
    });
  });

  describe('cleanupOldData', () => {
    it('should log cleanup information', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const daysToKeep = 14;

      await scheduler.cleanupOldData(daysToKeep);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Cleanup called for 14 days - implementation pending'
      );
    });

    it('should use default daysToKeep when not provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      await scheduler.cleanupOldData();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Cleanup called for 7 days - implementation pending'
      );
    });
  });

  describe('getStatus', () => {
    const mockTemplates = [
      {
        id: '1',
        title: 'Morning Meeting',
        description: 'Daily morning meeting',
        localTime: '09:00',
        timezone: 'America/Los_Angeles',
        recurrence: 'daily' as const,
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: '2',
        title: 'Evening Review',
        description: 'Daily evening review',
        localTime: '18:00',
        timezone: 'America/Los_Angeles',
        recurrence: 'daily' as const,
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ];

    const mockTodayReminders = {
      reminders: [
        { id: '1', title: 'Test Reminder 1', scheduledAt: '2024-01-01T09:00:00.000Z', isRecurring: true, isCompleted: false, createdAt: '2024-01-01T00:00:00.000Z' },
      ],
      expiresAfterMinutes: 60,
      overdueCount: 0,
      serverTime: '2024-01-01T12:00:00.000Z',
    };

    const mockTomorrowReminders = {
      reminders: [
        { id: '2', title: 'Test Reminder 2', scheduledAt: '2024-01-02T18:00:00.000Z', isRecurring: true, isCompleted: false, createdAt: '2024-01-01T00:00:00.000Z' },
      ],
      expiresAfterMinutes: 60,
      overdueCount: 0,
      serverTime: '2024-01-01T12:00:00.000Z',
    };

    it('should return status with seeded days when data exists', async () => {
      mockRepository.getReminderTemplates.mockResolvedValue(mockTemplates);
      mockRepository.getRemindersForDate
        .mockImplementation((date?: Date) => {
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);
          
          const inputDate = date ? new Date(date) : new Date();
          inputDate.setUTCHours(0, 0, 0, 0);
          
          if (inputDate.getTime() === today.getTime()) {
            return Promise.resolve(mockTodayReminders);
          } else {
            const tomorrow = new Date(today);
            tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
            if (inputDate.getTime() === tomorrow.getTime()) {
              return Promise.resolve(mockTomorrowReminders);
            }
          }
          return Promise.resolve({ reminders: [], expiresAfterMinutes: 60, overdueCount: 0, serverTime: new Date().toISOString() });
        });

      const status = await scheduler.getStatus();

      expect(status).toEqual({
        initialized: true,
        todaySeeded: true,
        tomorrowSeeded: true,
        templateCount: 2,
      });
    });

    it('should return status with unseeded days when no data exists', async () => {
      mockRepository.getReminderTemplates.mockResolvedValue([]);
      mockRepository.getRemindersForDate.mockResolvedValue({
        reminders: [],
        expiresAfterMinutes: 60,
        overdueCount: 0,
        serverTime: new Date().toISOString(),
      });

      const status = await scheduler.getStatus();

      expect(status).toEqual({
        initialized: true,
        todaySeeded: false,
        tomorrowSeeded: false,
        templateCount: 0,
      });
    });

    it('should handle errors and return false initialized status', async () => {
      const error = new Error('Database error');
      mockRepository.getReminderTemplates.mockRejectedValue(error);
      
      const consoleSpy = vi.spyOn(console, 'error');

      const status = await scheduler.getStatus();

      expect(consoleSpy).toHaveBeenCalledWith('Error getting scheduler status:', error);
      expect(status).toEqual({
        initialized: false,
        todaySeeded: false,
        tomorrowSeeded: false,
        templateCount: 0,
      });
    });
  });
});

describe('createDailySeedJob', () => {
  let mockScheduler: ReturnType<typeof vi.mocked<ReminderScheduler>>;
  let dailyJob: () => Promise<void>;

  beforeEach(() => {
    mockScheduler = {
      seedTodayReminders: vi.fn(),
      seedTomorrowReminders: vi.fn(),
    } as unknown as ReturnType<typeof vi.mocked<ReminderScheduler>>;

    dailyJob = createDailySeedJob(mockScheduler as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should run daily seed job successfully', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    
    await dailyJob();

    expect(mockScheduler.seedTodayReminders).toHaveBeenCalledTimes(1);
    expect(mockScheduler.seedTomorrowReminders).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('Running daily reminder seed job');
    expect(consoleSpy).toHaveBeenCalledWith('Daily reminder seed job completed');
  });

  it('should handle errors in daily seed job', async () => {
    const error = new Error('Seeding failed');
    mockScheduler.seedTodayReminders.mockRejectedValue(error);
    
    const consoleErrorSpy = vi.spyOn(console, 'error');
    const consoleLogSpy = vi.spyOn(console, 'log');

    await dailyJob();

    expect(consoleLogSpy).toHaveBeenCalledWith('Running daily reminder seed job');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Daily reminder seed job failed:', error);
    expect(mockScheduler.seedTomorrowReminders).not.toHaveBeenCalled();
  });
});
