import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { SchedulerService } from './schedulerService';
import type { FastifyInstance } from 'fastify';
import type { SchedulerEvent } from '@automata/types';
import { DateTime } from 'luxon';

// Mock luxon
vi.mock('luxon', () => ({
  DateTime: {
    utc: vi.fn(),
    fromJSDate: vi.fn(),
  },
}));

describe('SchedulerService', () => {
  let scheduler: SchedulerService;
  let mockFastify: Partial<FastifyInstance> & {
    redis: {
      keys: Mock;
      get: Mock;
      set: Mock;
      del: Mock;
    };
    log: {
      info: Mock;
      warn: Mock;
      error: Mock;
    };
  };

  beforeEach(() => {
    // Create mock Fastify instance
    mockFastify = {
      redis: {
        keys: vi.fn(),
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
      },
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    } as any;

    // Create scheduler with mocked Fastify instance
    scheduler = new SchedulerService(mockFastify as FastifyInstance);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
  });

  describe('constructor', () => {
    it('should initialize with empty tasks map', () => {
      expect(scheduler).toBeInstanceOf(SchedulerService);
      // @ts-expect-error - Accessing private property for testing
      expect(scheduler.tasks.size).toBe(0);
    });
  });

  describe('initialize', () => {
    it('should load tasks from Redis and schedule them', async () => {
      const mockTaskData = {
        eventId: 'test-event-1',
        taskType: 'test-task',
        scheduleExpression: 'interval:60',
        payload: { test: 'data' },
        isRecurring: true,
        nextRunAt: new Date(Date.now() + 60000).toISOString(),
        createdAt: new Date().toISOString(),
      };

      mockFastify.redis.keys.mockResolvedValue(['scheduler:task:test-event-1']);
      mockFastify.redis.get.mockResolvedValue(JSON.stringify(mockTaskData));

      await scheduler.initialize();

      expect(mockFastify.log.info).toHaveBeenCalledWith('Initializing SchedulerService');
      expect(mockFastify.redis.keys).toHaveBeenCalledWith('scheduler:task:*');
      expect(mockFastify.redis.get).toHaveBeenCalledWith('scheduler:task:test-event-1');
      expect(mockFastify.log.info).toHaveBeenCalledWith('Loaded and scheduled task: test-event-1');
      expect(mockFastify.redis.set).toHaveBeenCalledWith(
        'scheduler:status',
        expect.any(String),
        'EX',
        300
      );
      expect(mockFastify.log.info).toHaveBeenCalledWith('SchedulerService initialized with 1 active tasks');
    });

    it('should handle Redis errors gracefully', async () => {
      mockFastify.redis.keys.mockRejectedValue(new Error('Redis connection failed'));

      await scheduler.initialize();

      expect(mockFastify.log.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Failed to load tasks from Redis during initialization'
      );
      expect(mockFastify.log.info).toHaveBeenCalledWith('SchedulerService initialized with 0 active tasks');
    });

    it('should handle invalid task data in Redis', async () => {
      mockFastify.redis.keys.mockResolvedValue(['scheduler:task:test-event-1']);
      mockFastify.redis.get.mockResolvedValue('invalid-json');

      await scheduler.initialize();

      expect(mockFastify.log.warn).toHaveBeenCalledWith(
        { err: expect.any(Error), key: 'scheduler:task:test-event-1' },
        'Failed to load task from Redis'
      );
    });
  });

  describe('schedule', () => {
    it('should schedule a new task with interval expression', async () => {
      const mockDate = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(mockDate);

      const scheduleExpression = 'interval:300'; // 5 minutes
      const payload = { test: 'data' };
      const isRecurring = true;

      const result = await scheduler.schedule('test-task', scheduleExpression, payload, isRecurring);

      expect(result.eventId).toMatch(/^evt_\d+_[a-z0-9]+$/);
      expect(result.taskType).toBe('test-task');
      expect(result.scheduleExpression).toBe(scheduleExpression);
      expect(result.payload).toEqual(payload);
      expect(result.isRecurring).toBe(true);
      expect(result.nextRunAtIso).toBe(new Date(mockDate.getTime() + 300000).toISOString());
      expect(result.createdAtIso).toBe(mockDate.toISOString());

      // Check that task was persisted to Redis
      expect(mockFastify.redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^scheduler:task:evt_\d+_[a-z0-9]+$/),
        expect.any(String),
        'EX',
        86400 * 7
      );

      // Check that status was updated
      expect(mockFastify.redis.set).toHaveBeenCalledWith(
        'scheduler:status',
        expect.any(String),
        'EX',
        300
      );

      expect(mockFastify.log.info).toHaveBeenCalledWith(
        { eventId: result.eventId, taskType: 'test-task' },
        'Task scheduled successfully'
      );
    });

    it('should schedule a new task with cron expression', async () => {
      const mockDate = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(mockDate);

      // Mock DateTime to return a specific time
      const mockDateTime = {
        toUTC: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        plus: vi.fn().mockReturnThis(),
        startOf: vi.fn().mockReturnThis(),
        toJSDate: vi.fn().mockReturnValue(new Date('2024-01-01T13:00:00Z')),
        toMillis: vi.fn().mockReturnValue(mockDate.getTime()),
        weekday: 1, // Monday
      };
      (DateTime.fromJSDate as Mock).mockReturnValue(mockDateTime);

      const scheduleExpression = 'cron:0 * * * *'; // Every hour at minute 0
      const result = await scheduler.schedule('test-task', scheduleExpression);

      expect(result.eventId).toBeDefined();
      expect(result.taskType).toBe('test-task');
      expect(result.scheduleExpression).toBe(scheduleExpression);
    });

    it('should throw error for invalid schedule expression', async () => {
      const scheduleExpression = 'invalid:expression';

      await expect(scheduler.schedule('test-task', scheduleExpression))
        .rejects
        .toThrow('Invalid schedule expression');
    });
  });

  describe('cancel', () => {
    it('should cancel an existing task', async () => {
      // First schedule a task
      const mockDate = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(mockDate);

      const result = await scheduler.schedule('test-task', 'interval:300');
      const eventId = result.eventId;

      // Now cancel it
      const cancelResult = await scheduler.cancel(eventId);

      expect(cancelResult).toBe(true);
      expect(mockFastify.redis.del).toHaveBeenCalledWith(
        `scheduler:task:${eventId}`
      );
      expect(mockFastify.redis.set).toHaveBeenCalledWith(
        'scheduler:status',
        expect.any(String),
        'EX',
        300
      );
      expect(mockFastify.log.info).toHaveBeenCalledWith(
        { eventId },
        'Task cancelled successfully'
      );
    });

    it('should return false for non-existent task', async () => {
      const result = await scheduler.cancel('non-existent-id');

      expect(result).toBe(false);
      expect(mockFastify.redis.del).not.toHaveBeenCalled();
    });
  });

  describe('getAllTasks', () => {
    it('should return all scheduled tasks', async () => {
      // Schedule multiple tasks
      const mockDate = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(mockDate);

      const task1 = await scheduler.schedule('task-1', 'interval:300');
      const task2 = await scheduler.schedule('task-2', 'interval:600');

      const allTasks = scheduler.getAllTasks();

      expect(allTasks).toHaveLength(2);
      expect(allTasks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ eventId: task1.eventId, taskType: 'task-1' }),
          expect.objectContaining({ eventId: task2.eventId, taskType: 'task-2' }),
        ])
      );
    });

    it('should return empty array when no tasks', () => {
      const allTasks = scheduler.getAllTasks();

      expect(allTasks).toEqual([]);
    });
  });

  describe('getStatus', () => {
    it('should return status with active tasks', async () => {
      const mockDate = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(mockDate);

      const task = await scheduler.schedule('test-task', 'interval:300');

      const status = await scheduler.getStatus();

      expect(status).toEqual({
        isHealthy: true,
        activeSchedules: 1,
        nextScheduledEvents: [
          {
            eventId: task.eventId,
            scheduledAtIso: task.nextRunAtIso,
            taskType: 'test-task',
          },
        ],
      });
    });

    it('should return only future scheduled events', async () => {
      const mockDate = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(mockDate);

      // Schedule a task in the future
      const futureTask = await scheduler.schedule('future-task', 'interval:300');

      // Manually add a task that would have already run (for testing private method)
      // This simulates a task that has already executed
      const pastDate = new Date(mockDate.getTime() - 60000); // 1 minute ago
      // @ts-expect-error - Accessing private property for testing
      scheduler.tasks.set('past-task', {
        eventId: 'past-task',
        taskType: 'past-task',
        scheduleExpression: 'interval:300',
        nextRunAt: pastDate,
        createdAt: new Date(),
        isRecurring: true,
      });

      const status = await scheduler.getStatus();

      expect(status.activeSchedules).toBe(2);
      expect(status.nextScheduledEvents).toHaveLength(1);
      expect(status.nextScheduledEvents[0].eventId).toBe(futureTask.eventId);
    });

    it('should limit next scheduled events to 10', async () => {
      const mockDate = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(mockDate);

      // Schedule 15 tasks
      for (let i = 0; i < 15; i++) {
        await scheduler.schedule(`task-${i}`, 'interval:300');
      }

      const status = await scheduler.getStatus();

      expect(status.activeSchedules).toBe(15);
      expect(status.nextScheduledEvents).toHaveLength(10);
    });
  });

  describe('shutdown', () => {
    it('should clear all timeouts and tasks', async () => {
      // Schedule a task
      const mockDate = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(mockDate);

      await scheduler.schedule('test-task', 'interval:300');

      // Spy on clearTimeout
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      await scheduler.shutdown();

      expect(mockFastify.log.info).toHaveBeenCalledWith('Shutting down SchedulerService');
      expect(clearTimeoutSpy).toHaveBeenCalled();
      // @ts-expect-error - Accessing private property for testing
      expect(scheduler.tasks.size).toBe(0);
      expect(mockFastify.log.info).toHaveBeenCalledWith('SchedulerService shut down successfully');
    });
  });

  describe('executeTaskByType', () => {
    it('should handle route-polling task type', async () => {
      // @ts-expect-error - Accessing private method for testing
      await scheduler.executeTaskByType({
        taskType: 'route-polling',
        eventId: 'test-event',
      } as any);

      expect(mockFastify.log.info).toHaveBeenCalledWith('Triggering route polling refresh');
    });

    it('should handle weather-update task type', async () => {
      // @ts-expect-error - Accessing private method for testing
      await scheduler.executeTaskByType({
        taskType: 'weather-update',
        eventId: 'test-event',
      } as any);

      expect(mockFastify.log.info).toHaveBeenCalledWith('Triggering weather data update');
    });

    it('should handle reminder-check task type', async () => {
      // @ts-expect-error - Accessing private method for testing
      await scheduler.executeTaskByType({
        taskType: 'reminder-check',
        eventId: 'test-event',
      } as any);

      expect(mockFastify.log.info).toHaveBeenCalledWith('Checking for overdue reminders');
    });

    it('should handle cache-cleanup task type', async () => {
      // @ts-expect-error - Accessing private method for testing
      await scheduler.executeTaskByType({
        taskType: 'cache-cleanup',
        eventId: 'test-event',
      } as any);

      expect(mockFastify.log.info).toHaveBeenCalledWith('Cleaning up stale cache entries');
    });

    it('should log warning for unknown task type', async () => {
      // @ts-expect-error - Accessing private method for testing
      await scheduler.executeTaskByType({
        taskType: 'unknown-task',
        eventId: 'test-event',
      } as any);

      expect(mockFastify.log.warn).toHaveBeenCalledWith(
        { taskType: 'unknown-task' },
        'Unknown task type'
      );
    });
  });

  describe('calculateNextRunTime', () => {
    it('should calculate interval-based next run time', () => {
      const mockDate = new Date('2024-01-01T12:00:00Z');
      const scheduleExpression = 'interval:300'; // 5 minutes

      // @ts-expect-error - Accessing private method for testing
      const result = scheduler.calculateNextRunTime(scheduleExpression, mockDate);

      expect(result).toEqual(new Date('2024-01-01T12:05:00Z'));
    });

    it('should return null for invalid interval', () => {
      const mockDate = new Date('2024-01-01T12:00:00Z');
      const scheduleExpression = 'interval:invalid';

      // @ts-expect-error - Accessing private method for testing
      const result = scheduler.calculateNextRunTime(scheduleExpression, mockDate);

      expect(result).toBeNull();
    });

    it('should return null for negative interval', () => {
      const mockDate = new Date('2024-01-01T12:00:00Z');
      const scheduleExpression = 'interval:-60';

      // @ts-expect-error - Accessing private method for testing
      const result = scheduler.calculateNextRunTime(scheduleExpression, mockDate);

      expect(result).toBeNull();
    });

    it('should calculate cron-based next run time for every minute', () => {
      const mockDate = new Date('2024-01-01T12:00:00Z');
      const scheduleExpression = 'cron:* * * * *';

      const mockDateTime = {
        toUTC: vi.fn().mockReturnThis(),
        plus: vi.fn().mockReturnThis(),
        startOf: vi.fn().mockReturnThis(),
        toJSDate: vi.fn().mockReturnValue(new Date('2024-01-01T12:01:00Z')),
      };
      (DateTime.fromJSDate as Mock).mockReturnValue(mockDateTime);

      // @ts-expect-error - Accessing private method for testing
      const result = scheduler.calculateNextRunTime(scheduleExpression, mockDate);

      expect(result).toEqual(new Date('2024-01-01T12:01:00Z'));
    });

    it('should calculate cron-based next run time for hourly', () => {
      const mockDate = new Date('2024-01-01T12:30:00Z');
      const scheduleExpression = 'cron:0 * * * *';

      const mockDateTime = {
        toUTC: vi.fn().mockReturnThis(),
        plus: vi.fn().mockReturnThis(),
        startOf: vi.fn().mockReturnThis(),
        toJSDate: vi.fn().mockReturnValue(new Date('2024-01-01T13:00:00Z')),
      };
      (DateTime.fromJSDate as Mock).mockReturnValue(mockDateTime);

      // @ts-expect-error - Accessing private method for testing
      const result = scheduler.calculateNextRunTime(scheduleExpression, mockDate);

      expect(result).toEqual(new Date('2024-01-01T13:00:00Z'));
    });

    it('should calculate cron-based next run time for daily', () => {
      const mockDate = new Date('2024-01-01T12:00:00Z');
      const scheduleExpression = 'cron:0 9 * * *';

      const mockDateTime = {
        toUTC: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        plus: vi.fn().mockReturnThis(),
        startOf: vi.fn().mockReturnThis(),
        toJSDate: vi.fn().mockReturnValue(new Date('2024-01-01T09:00:00Z')),
        toMillis: vi.fn().mockReturnValue(mockDate.getTime() - 10800000), // 3 hours earlier
      };
      (DateTime.fromJSDate as Mock).mockReturnValue(mockDateTime);

      // @ts-expect-error - Accessing private method for testing
      const result = scheduler.calculateNextRunTime(scheduleExpression, mockDate);

      expect(result).toEqual(new Date('2024-01-01T09:00:00Z'));
    });

    it('should return null for invalid cron expression', () => {
      const mockDate = new Date('2024-01-01T12:00:00Z');
      const scheduleExpression = 'cron:invalid';

      // @ts-expect-error - Accessing private method for testing
      const result = scheduler.calculateNextRunTime(scheduleExpression, mockDate);

      expect(result).toBeNull();
    });

    it('should return null for unsupported cron expression', () => {
      const mockDate = new Date('2024-01-01T12:00:00Z');
      const scheduleExpression = 'cron:*/5 * * * *'; // Every 5 minutes (not supported)

      // @ts-expect-error - Accessing private method for testing
      const result = scheduler.calculateNextRunTime(scheduleExpression, mockDate);

      expect(result).toBeNull();
    });
  });

  describe('parseCronExpression', () => {
    it('should parse every minute cron expression', () => {
      const mockDate = new Date('2024-01-01T12:00:00Z');
      const cronExpression = '* * * * *';

      const mockDateTime = {
        toUTC: vi.fn().mockReturnThis(),
        plus: vi.fn().mockReturnThis(),
        startOf: vi.fn().mockReturnThis(),
        toJSDate: vi.fn().mockReturnValue(new Date('2024-01-01T12:01:00Z')),
      };
      (DateTime.fromJSDate as Mock).mockReturnValue(mockDateTime);

      // @ts-expect-error - Accessing private method for testing
      const result = scheduler.parseCronExpression(cronExpression, mockDate);

      expect(result).toEqual(new Date('2024-01-01T12:01:00Z'));
    });

    it('should parse hourly cron expression', () => {
      const mockDate = new Date('2024-01-01T12:30:00Z');
      const cronExpression = '0 * * * *';

      const mockDateTime = {
        toUTC: vi.fn().mockReturnThis(),
        plus: vi.fn().mockReturnThis(),
        startOf: vi.fn().mockReturnThis(),
        toJSDate: vi.fn().mockReturnValue(new Date('2024-01-01T13:00:00Z')),
      };
      (DateTime.fromJSDate as Mock).mockReturnValue(mockDateTime);

      // @ts-expect-error - Accessing private method for testing
      const result = scheduler.parseCronExpression(cronExpression, mockDate);

      expect(result).toEqual(new Date('2024-01-01T13:00:00Z'));
    });

    it('should parse daily cron expression', () => {
      const mockDate = new Date('2024-01-01T12:00:00Z');
      const cronExpression = '0 9 * * *';

      const mockDateTime = {
        toUTC: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        plus: vi.fn().mockReturnThis(),
        startOf: vi.fn().mockReturnThis(),
        toJSDate: vi.fn().mockReturnValue(new Date('2024-01-01T09:00:00Z')),
        toMillis: vi.fn().mockReturnValue(mockDate.getTime() - 10800000), // 3 hours earlier
      };
      (DateTime.fromJSDate as Mock).mockReturnValue(mockDateTime);

      // @ts-expect-error - Accessing private method for testing
      const result = scheduler.parseCronExpression(cronExpression, mockDate);

      expect(result).toEqual(new Date('2024-01-01T09:00:00Z'));
    });

    it('should return null for malformed cron expression', () => {
      const mockDate = new Date('2024-01-01T12:00:00Z');
      const cronExpression = '* * * *'; // Missing day of week

      // @ts-expect-error - Accessing private method for testing
      const result = scheduler.parseCronExpression(cronExpression, mockDate);

      expect(result).toBeNull();
    });

    it('should handle cron execution error gracefully', () => {
      const mockDate = new Date('2024-01-01T12:00:00Z');
      const cronExpression = '0 9 * * *';

      (DateTime.fromJSDate as Mock).mockImplementation(() => {
        throw new Error('DateTime error');
      });

      // @ts-expect-error - Accessing private method for testing
      const result = scheduler.parseCronExpression(cronExpression, mockDate);

      expect(result).toBeNull();
      expect(mockFastify.log.error).toHaveBeenCalledWith(
        { err: expect.any(Error), cronExpression },
        'Failed to parse cron expression'
      );
    });
  });

  describe('executeTask', () => {
    it('should execute task and reschedule if recurring', async () => {
      const mockTask = {
        eventId: 'test-event',
        taskType: 'test-task',
        scheduleExpression: 'interval:300',
        isRecurring: true,
        nextRunAt: new Date(Date.now() + 1000),
        lastRunAt: undefined,
        createdAt: new Date(),
        payload: { test: 'data' },
      };

      // Mock calculateNextRunTime to return a future time
      const nextRunAt = new Date(Date.now() + 300000);
      vi.spyOn(scheduler as any, 'calculateNextRunTime').mockReturnValue(nextRunAt);
      vi.spyOn(scheduler as any, 'executeTaskByType').mockResolvedValue(undefined);
      vi.spyOn(scheduler as any, 'persistTask').mockResolvedValue(undefined);
      vi.spyOn(scheduler as any, 'updateStatus').mockResolvedValue(undefined);

      // @ts-expect-error - Accessing private method for testing
      await scheduler.executeTask(mockTask);

      expect(mockFastify.log.info).toHaveBeenCalledWith(
        { eventId: 'test-event', taskType: 'test-task', payload: { test: 'data' } },
        'Executing scheduled task'
      );
      expect(scheduler['executeTaskByType']).toHaveBeenCalledWith(mockTask);
      expect(mockTask.lastRunAt).toBeInstanceOf(Date);
      expect(scheduler['persistTask']).toHaveBeenCalledWith(mockTask);
      expect(scheduler['updateStatus']).toHaveBeenCalled();
    });

    it('should cancel non-recurring task after execution', async () => {
      const mockTask = {
        eventId: 'test-event',
        taskType: 'test-task',
        scheduleExpression: 'interval:300',
        isRecurring: false,
        nextRunAt: new Date(Date.now() + 1000),
        lastRunAt: undefined,
        createdAt: new Date(),
      };

      vi.spyOn(scheduler as any, 'executeTaskByType').mockResolvedValue(undefined);
      vi.spyOn(scheduler, 'cancel').mockResolvedValue(true);

      // @ts-expect-error - Accessing private method for testing
      await scheduler.executeTask(mockTask);

      expect(scheduler.cancel).toHaveBeenCalledWith('test-event');
    });

    it('should handle task execution error and reschedule recurring task', async () => {
      const mockTask = {
        eventId: 'test-event',
        taskType: 'test-task',
        scheduleExpression: 'interval:300',
        isRecurring: true,
        nextRunAt: new Date(Date.now() + 1000),
        lastRunAt: undefined,
        createdAt: new Date(),
      };

      const error = new Error('Task execution failed');
      vi.spyOn(scheduler as any, 'executeTaskByType').mockRejectedValue(error);
      vi.spyOn(scheduler as any, 'calculateNextRunTime').mockReturnValue(
        new Date(Date.now() + 300000)
      );
      vi.spyOn(scheduler as any, 'persistTask').mockResolvedValue(undefined);
      vi.spyOn(scheduler as any, 'updateStatus').mockResolvedValue(undefined);

      // @ts-expect-error - Accessing private method for testing
      await scheduler.executeTask(mockTask);

      expect(mockFastify.log.error).toHaveBeenCalledWith(
        { err: error, eventId: 'test-event', duration: expect.any(Number) },
        'Task execution failed'
      );
      expect(scheduler['persistTask']).toHaveBeenCalled();
    });

    it('should skip execution if already executing', async () => {
      const mockTask = {
        eventId: 'test-event',
        taskType: 'test-task',
        scheduleExpression: 'interval:300',
        isRecurring: true,
        nextRunAt: new Date(Date.now() + 1000),
        lastRunAt: undefined,
        createdAt: new Date(),
      };

      // Spy on executeTaskByType before setting isExecuting
      const executeTaskByTypeSpy = vi.spyOn(scheduler as any, 'executeTaskByType');

      // Set isExecuting to true
      scheduler['isExecuting'] = true;

      // @ts-expect-error - Accessing private method for testing
      await scheduler.executeTask(mockTask);

      expect(mockFastify.log.warn).toHaveBeenCalledWith(
        { eventId: 'test-event' },
        'Task execution already in progress, skipping'
      );
      expect(executeTaskByTypeSpy).not.toHaveBeenCalled();
    });

    it('should cancel task if next run time cannot be calculated', async () => {
      const mockTask = {
        eventId: 'test-event',
        taskType: 'test-task',
        scheduleExpression: 'interval:300',
        isRecurring: true,
        nextRunAt: new Date(Date.now() + 1000),
        lastRunAt: undefined,
        createdAt: new Date(),
      };

      vi.spyOn(scheduler as any, 'executeTaskByType').mockResolvedValue(undefined);
      vi.spyOn(scheduler as any, 'calculateNextRunTime').mockReturnValue(null);
      vi.spyOn(scheduler, 'cancel').mockResolvedValue(true);

      // @ts-expect-error - Accessing private method for testing
      await scheduler.executeTask(mockTask);

      expect(mockFastify.log.warn).toHaveBeenCalledWith(
        { eventId: 'test-event' },
        'Could not calculate valid next run time for recurring task'
      );
      expect(scheduler.cancel).toHaveBeenCalledWith('test-event');
    });
  });

  describe('toSchedulerEvent', () => {
    it('should convert ScheduledTask to SchedulerEvent', () => {
      const task = {
        eventId: 'test-event',
        taskType: 'test-task',
        scheduleExpression: 'interval:300',
        payload: { test: 'data' },
        isRecurring: true,
        nextRunAt: new Date('2024-01-01T12:00:00Z'),
        lastRunAt: new Date('2024-01-01T11:00:00Z'),
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      // @ts-expect-error - Accessing private method for testing
      const result = scheduler.toSchedulerEvent(task);

      expect(result).toEqual({
        eventId: 'test-event',
        taskType: 'test-task',
        scheduleExpression: 'interval:300',
        payload: { test: 'data' },
        isRecurring: true,
        nextRunAtIso: '2024-01-01T12:00:00.000Z',
        lastRunAtIso: '2024-01-01T11:00:00.000Z',
        createdAtIso: '2024-01-01T10:00:00.000Z',
      });
    });

    it('should handle undefined lastRunAt', () => {
      const task = {
        eventId: 'test-event',
        taskType: 'test-task',
        scheduleExpression: 'interval:300',
        payload: undefined,
        isRecurring: false,
        nextRunAt: new Date('2024-01-01T12:00:00Z'),
        lastRunAt: undefined,
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };

      // @ts-expect-error - Accessing private method for testing
      const result = scheduler.toSchedulerEvent(task);

      expect(result).toEqual({
        eventId: 'test-event',
        taskType: 'test-task',
        scheduleExpression: 'interval:300',
        payload: undefined,
        isRecurring: false,
        nextRunAtIso: '2024-01-01T12:00:00.000Z',
        lastRunAtIso: undefined,
        createdAtIso: '2024-01-01T10:00:00.000Z',
      });
    });
  });
});
