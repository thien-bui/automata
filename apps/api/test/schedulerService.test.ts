import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SchedulerService } from '../src/services/schedulerService';
import type { FastifyInstance } from 'fastify';

// Mock Fastify instance
const createMockFastify = () => {
  const mock = {
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    redis: {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
    },
  };
  return mock as unknown as FastifyInstance & { redis: any };
};

describe('SchedulerService', () => {
  let schedulerService: SchedulerService;
  let mockFastify: FastifyInstance & { redis: any };

  beforeEach(() => {
    vi.useFakeTimers();
    mockFastify = createMockFastify();
    schedulerService = new SchedulerService(mockFastify);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('schedule', () => {
    it('should schedule a one-time task with interval expression', async () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      const event = await schedulerService.schedule(
        'test-task',
        'interval:60',
        { test: 'payload' },
        false
      );

      expect(event.eventId).toMatch(/^evt_\d+_[a-z0-9]+$/);
      expect(event.taskType).toBe('test-task');
      expect(event.scheduleExpression).toBe('interval:60');
      expect(event.payload).toEqual({ test: 'payload' });
      expect(event.isRecurring).toBe(false);
      expect(event.nextRunAtIso).toBe(new Date(now.getTime() + 60000).toISOString());
      expect(event.createdAtIso).toBe(now.toISOString());
      expect(event.lastRunAtIso).toBeUndefined();
    });

    it('should schedule a recurring task with interval expression', async () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      const event = await schedulerService.schedule(
        'recurring-task',
        'interval:300',
        undefined,
        true
      );

      expect(event.isRecurring).toBe(true);
      expect(event.nextRunAtIso).toBe(new Date(now.getTime() + 300000).toISOString());
    });

    it('should schedule a task with cron expression (every minute)', async () => {
      const now = new Date('2024-01-01T12:00:30Z');
      vi.setSystemTime(now);

      const event = await schedulerService.schedule(
        'cron-task',
        'cron:* * * * *',
        undefined,
        true
      );

      expect(event.nextRunAtIso).toBe(new Date('2024-01-01T12:01:00Z').toISOString());
    });

    it('should schedule a task with cron expression (hourly)', async () => {
      const now = new Date('2024-01-01T12:30:00Z');
      vi.setSystemTime(now);

      const event = await schedulerService.schedule(
        'hourly-task',
        'cron:0 * * * *',
        undefined,
        true
      );

      expect(event.nextRunAtIso).toBe(new Date('2024-01-01T13:00:00Z').toISOString());
    });

    it('should schedule a task with cron expression (daily at specific time)', async () => {
      const now = new Date('2024-01-01T08:00:00Z');
      vi.setSystemTime(now);

      const event = await schedulerService.schedule(
        'daily-task',
        'cron:0 9 * * *',
        undefined,
        true
      );

      expect(event.nextRunAtIso).toBe(new Date('2024-01-01T09:00:00Z').toISOString());
    });

    it('should schedule a task with cron expression (specific day of week)', async () => {
      // Monday, January 1, 2024
      const now = new Date('2024-01-01T08:00:00Z');
      vi.setSystemTime(now);

      const event = await schedulerService.schedule(
        'weekly-task',
        'cron:0 9 * * 1',
        undefined,
        true
      );

      // Next Monday is January 8, 2024
      expect(event.nextRunAtIso).toBe(new Date('2024-01-08T09:00:00Z').toISOString());
    });

    it('should throw error for invalid schedule expression', async () => {
      await expect(
        schedulerService.schedule('invalid-task', 'invalid:expression')
      ).rejects.toThrow('Invalid schedule expression');
    });

    it('should throw error for invalid interval', async () => {
      await expect(
        schedulerService.schedule('invalid-task', 'interval:invalid')
      ).rejects.toThrow('Invalid schedule expression');
    });

    it('should throw error for invalid cron expression', async () => {
      await expect(
        schedulerService.schedule('invalid-task', 'cron:invalid')
      ).rejects.toThrow('Invalid schedule expression');
    });
  });

  describe('cancel', () => {
    it('should cancel a scheduled task', async () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      const event = await schedulerService.schedule(
        'test-task',
        'interval:60',
        undefined,
        false
      );

      const cancelled = await schedulerService.cancel(event.eventId);
      expect(cancelled).toBe(true);

      // Verify task was removed
      const status = await schedulerService.getStatus();
      expect(status.activeSchedules).toBe(0);
    });

    it('should return false for non-existent task', async () => {
      const cancelled = await schedulerService.cancel('non-existent-id');
      expect(cancelled).toBe(false);
    });
  });

  describe('getAllTasks', () => {
    it('should return all scheduled tasks', async () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      await schedulerService.schedule('task-1', 'interval:60', undefined, false);
      await schedulerService.schedule('task-2', 'interval:120', undefined, true);
      await schedulerService.schedule('task-3', 'cron:0 * * * *', undefined, true);

      const tasks = schedulerService.getAllTasks();
      expect(tasks).toHaveLength(3);
      expect(tasks.map(t => t.taskType)).toContain('task-1');
      expect(tasks.map(t => t.taskType)).toContain('task-2');
      expect(tasks.map(t => t.taskType)).toContain('task-3');
    });

    it('should return empty array when no tasks scheduled', () => {
      const tasks = schedulerService.getAllTasks();
      expect(tasks).toHaveLength(0);
    });
  });

  describe('getStatus', () => {
    it('should return scheduler status with no tasks', async () => {
      const status = await schedulerService.getStatus();
      expect(status.isHealthy).toBe(true);
      expect(status.activeSchedules).toBe(0);
      expect(status.nextScheduledEvents).toHaveLength(0);
    });

    it('should return scheduler status with tasks', async () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      await schedulerService.schedule('task-1', 'interval:60', undefined, false);
      await schedulerService.schedule('task-2', 'interval:120', undefined, true);
      await schedulerService.schedule('task-3', 'cron:0 * * * *', undefined, true);

      const status = await schedulerService.getStatus();
      expect(status.isHealthy).toBe(true);
      expect(status.activeSchedules).toBe(3);
      expect(status.nextScheduledEvents).toHaveLength(3);
    });

    it('should limit next scheduled events to 10', async () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      // Schedule 15 tasks
      for (let i = 0; i < 15; i++) {
        await schedulerService.schedule(`task-${i}`, `interval:${60 + i}`, undefined, false);
      }

      const status = await schedulerService.getStatus();
      expect(status.activeSchedules).toBe(15);
      expect(status.nextScheduledEvents).toHaveLength(10);
    });

    it('should sort next scheduled events by time', async () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      // Schedule tasks with different intervals
      await schedulerService.schedule('task-1', 'interval:300', undefined, false); // 5 minutes
      await schedulerService.schedule('task-2', 'interval:60', undefined, false);  // 1 minute
      await schedulerService.schedule('task-3', 'interval:180', undefined, false); // 3 minutes

      const status = await schedulerService.getStatus();
      const events = status.nextScheduledEvents;
      
      expect(events[0].taskType).toBe('task-2'); // 1 minute (earliest)
      expect(events[1].taskType).toBe('task-3'); // 3 minutes
      expect(events[2].taskType).toBe('task-1'); // 5 minutes (latest)
    });
  });

  describe('initialize', () => {
    it('should load tasks from Redis on initialization', async () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      // Mock Redis to return a saved task
      const savedTask = {
        eventId: 'evt_12345_abc',
        taskType: 'saved-task',
        scheduleExpression: 'interval:60',
        payload: { test: 'data' },
        isRecurring: true,
        nextRunAt: new Date(now.getTime() + 60000),
        createdAt: now,
      };

      vi.mocked(mockFastify.redis.keys).mockResolvedValue(['scheduler:task:evt_12345_abc']);
      vi.mocked(mockFastify.redis.get).mockResolvedValue(JSON.stringify(savedTask));

      await schedulerService.initialize();

      const tasks = schedulerService.getAllTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].eventId).toBe('evt_12345_abc');
      expect(tasks[0].taskType).toBe('saved-task');
    });

    it('should handle Redis errors during initialization', async () => {
      vi.mocked(mockFastify.redis.keys).mockRejectedValue(new Error('Redis connection failed'));

      // Should not throw, but log error
      await expect(schedulerService.initialize()).resolves.not.toThrow();
      expect(mockFastify.log.error).toHaveBeenCalled();
    });

    it('should handle invalid task data in Redis', async () => {
      vi.mocked(mockFastify.redis.keys).mockResolvedValue(['scheduler:task:invalid']);
      vi.mocked(mockFastify.redis.get).mockResolvedValue('invalid json');

      await schedulerService.initialize();

      const tasks = schedulerService.getAllTasks();
      expect(tasks).toHaveLength(0);
      expect(mockFastify.log.warn).toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should clear all timeouts on shutdown', async () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      await schedulerService.schedule('task-1', 'interval:60', undefined, false);
      await schedulerService.schedule('task-2', 'interval:120', undefined, true);

      expect(schedulerService.getAllTasks()).toHaveLength(2);

      await schedulerService.shutdown();

      expect(schedulerService.getAllTasks()).toHaveLength(0);
    });
  });

  describe('task execution', () => {
    it('should execute one-time task and not reschedule', async () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      const event = await schedulerService.schedule(
        'test-task',
        'interval:1',
        undefined,
        false
      );

      // Fast-forward time to trigger execution
      vi.advanceTimersByTime(1000);

      // Wait for async execution
      await vi.runAllTimersAsync();

      // Task should be removed after execution
      const tasks = schedulerService.getAllTasks();
      expect(tasks).toHaveLength(0);

      expect(mockFastify.log.info).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: event.eventId }),
        'Executing scheduled task'
      );
    });

    it('should execute recurring task and reschedule', async () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      const event = await schedulerService.schedule(
        'recurring-task',
        'interval:1',
        undefined,
        true
      );

      // Fast-forward time to trigger execution
      vi.advanceTimersByTime(1000);

      // Wait for async execution
      await vi.runAllTimersAsync();

      // Task should still exist and have new next run time
      const tasks = schedulerService.getAllTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].eventId).toBe(event.eventId);
      expect(tasks[0].lastRunAtIso).toBeDefined();
      expect(tasks[0].nextRunAtIso).toBe(new Date(now.getTime() + 2000).toISOString());
    });

    it('should handle task execution errors gracefully', async () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      // Schedule a task with invalid payload to trigger error
      const event = await schedulerService.schedule(
        'invalid-task-type',
        'interval:1',
        undefined,
        true
      );

      // Fast-forward time to trigger execution
      vi.advanceTimersByTime(1000);

      // Wait for async execution
      await vi.runAllTimersAsync();

      // Should log error but not crash
      expect(mockFastify.log.error).toHaveBeenCalled();

      // Recurring task should still be scheduled
      const tasks = schedulerService.getAllTasks();
      expect(tasks).toHaveLength(1);
    });
  });
});
