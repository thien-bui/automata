import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type Redis from 'ioredis';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  SchedulerStatusResponse,
  SchedulerEvent,
  SchedulerEventRequest,
} from '@automata/types';

type MockRedis = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  keys: ReturnType<typeof vi.fn>;
};

async function buildTestApp(redis: MockRedis): Promise<FastifyInstance> {
  const app = Fastify();
  app.decorate('redis', redis as unknown as Redis);
  await app.register(import('../src/routes/scheduler'), { prefix: '/api' });
  await app.ready();
  return app;
}

describe('scheduler route', () => {
  let app: FastifyInstance | null = null;
  let mockRedis: MockRedis;

  beforeEach(() => {
    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
    };
    vi.useFakeTimers();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('GET /scheduler/status', () => {
    it('returns scheduler status with no tasks', async () => {
      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/scheduler/status',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json<SchedulerStatusResponse>();
      expect(body.isHealthy).toBe(true);
      expect(body.activeSchedules).toBe(0);
      expect(body.nextScheduledEvents).toHaveLength(0);
      expect(body.lastUpdatedIso).toBeDefined();
      expect(DateTime.fromISO(body.lastUpdatedIso).isValid).toBe(true);
    });

    it('returns scheduler status with tasks', async () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      app = await buildTestApp(mockRedis);

      // Schedule a task
      await app.inject({
        method: 'POST',
        url: '/api/scheduler/events',
        payload: {
          taskType: 'test-task',
          scheduleExpression: 'interval:60',
          payload: { test: 'data' },
          isRecurring: false,
        } as SchedulerEventRequest,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/scheduler/status',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json<SchedulerStatusResponse>();
      expect(body.isHealthy).toBe(true);
      expect(body.activeSchedules).toBe(1);
      expect(body.nextScheduledEvents).toHaveLength(1);
      expect(body.lastUpdatedIso).toBeDefined();
    });

    it('handles forceRefresh parameter', async () => {
      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/scheduler/status?forceRefresh=true',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json<SchedulerStatusResponse>();
      expect(body.isHealthy).toBe(true);
    });

    it('handles timestamp generation errors gracefully', async () => {
      const originalToISO = DateTime.prototype.toISO;
      vi.spyOn(DateTime.prototype, 'toISO').mockReturnValue(null);

      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/scheduler/status',
      });

      expect(response.statusCode).toBe(500);

      const body = response.json();
      expect(body.code).toBe('INTERNAL_ERROR');
      expect(body.message).toBe('Unexpected server error.');

      DateTime.prototype.toISO = originalToISO;
    });
  });

  describe('POST /scheduler/events', () => {
    it('schedules a one-time event successfully', async () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      app = await buildTestApp(mockRedis);

      const payload: SchedulerEventRequest = {
        taskType: 'test-task',
        scheduleExpression: 'interval:60',
        payload: { test: 'data' },
        isRecurring: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/scheduler/events',
        payload,
      });

      expect(response.statusCode).toBe(200);

      const body = response.json<SchedulerEvent>();
      expect(body.eventId).toMatch(/^evt_\d+_[a-z0-9]+$/);
      expect(body.taskType).toBe('test-task');
      expect(body.scheduleExpression).toBe('interval:60');
      expect(body.payload).toEqual({ test: 'data' });
      expect(body.isRecurring).toBe(false);
      expect(body.nextRunAtIso).toBeDefined();
      expect(body.createdAtIso).toBeDefined();
    });

    it('schedules a recurring event successfully', async () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      app = await buildTestApp(mockRedis);

      const payload: SchedulerEventRequest = {
        taskType: 'recurring-task',
        scheduleExpression: 'cron:0 * * * *',
        isRecurring: true,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/scheduler/events',
        payload,
      });

      expect(response.statusCode).toBe(200);

      const body = response.json<SchedulerEvent>();
      expect(body.taskType).toBe('recurring-task');
      expect(body.scheduleExpression).toBe('cron:0 * * * *');
      expect(body.isRecurring).toBe(true);
      expect(body.nextRunAtIso).toBeDefined();
    });

    it('returns 400 error for invalid schedule expression', async () => {
      app = await buildTestApp(mockRedis);

      const payload: SchedulerEventRequest = {
        taskType: 'invalid-task',
        scheduleExpression: 'invalid:expression',
        isRecurring: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/scheduler/events',
        payload,
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.error).toBe('Bad Request');
      expect(body.message).toContain('Schedule expression');
    });

    it('returns 400 error for missing taskType', async () => {
      app = await buildTestApp(mockRedis);

      const payload = {
        scheduleExpression: 'interval:60',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/scheduler/events',
        payload,
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.error).toBe('Bad Request');
    });

    it('returns 400 error for missing scheduleExpression', async () => {
      app = await buildTestApp(mockRedis);

      const payload = {
        taskType: 'test-task',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/scheduler/events',
        payload,
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.error).toBe('Bad Request');
    });

    it('returns 400 error for empty taskType', async () => {
      app = await buildTestApp(mockRedis);

      const payload: SchedulerEventRequest = {
        taskType: '',
        scheduleExpression: 'interval:60',
        isRecurring: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/scheduler/events',
        payload,
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.error).toBe('Bad Request');
      expect(body.message).toContain('Task type is required');
    });

    it('returns 400 error for empty scheduleExpression', async () => {
      app = await buildTestApp(mockRedis);

      const payload: SchedulerEventRequest = {
        taskType: 'test-task',
        scheduleExpression: '',
        isRecurring: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/scheduler/events',
        payload,
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.error).toBe('Bad Request');
      expect(body.message).toContain('Schedule expression is required');
    });

    it('uses default isRecurring value of true when not provided', async () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      app = await buildTestApp(mockRedis);

      const payload = {
        taskType: 'default-recurring-task',
        scheduleExpression: 'interval:60',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/scheduler/events',
        payload,
      });

      expect(response.statusCode).toBe(200);

      const body = response.json<SchedulerEvent>();
      expect(body.isRecurring).toBe(true);
    });
  });

  describe('DELETE /scheduler/events/:eventId', () => {
    it('cancels an existing event successfully', async () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      app = await buildTestApp(mockRedis);

      // First schedule an event
      const scheduleResponse = await app.inject({
        method: 'POST',
        url: '/api/scheduler/events',
        payload: {
          taskType: 'test-task',
          scheduleExpression: 'interval:60',
          isRecurring: false,
        },
      });

      const event = scheduleResponse.json<SchedulerEvent>();
      const eventId = event.eventId;

      // Then cancel it
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/scheduler/events/${eventId}`,
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.message).toBe('Event cancelled successfully');
    });

    it('returns 404 error for non-existent event', async () => {
      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/scheduler/events/non-existent-id',
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.error).toBe('Bad Request');
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.message).toBe('Event not found');
    });

    it('returns 404 error for invalid eventId format', async () => {
      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/scheduler/events/invalid-format',
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.error).toBe('Bad Request');
      expect(body.message).toBe('Event not found');
    });
  });

  describe('GET /scheduler/events', () => {
    it('returns empty list when no events are scheduled', async () => {
      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/scheduler/events',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.events).toHaveLength(0);
      expect(body.totalCount).toBe(0);
    });

    it('returns list of all scheduled events', async () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      app = await buildTestApp(mockRedis);

      // Schedule multiple events
      await app.inject({
        method: 'POST',
        url: '/api/scheduler/events',
        payload: {
          taskType: 'task-1',
          scheduleExpression: 'interval:60',
          isRecurring: false,
        },
      });

      await app.inject({
        method: 'POST',
        url: '/api/scheduler/events',
        payload: {
          taskType: 'task-2',
          scheduleExpression: 'cron:0 * * * *',
          isRecurring: true,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/scheduler/events',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.events).toHaveLength(2);
      expect(body.totalCount).toBe(2);

      const taskTypes = body.events.map((event: SchedulerEvent) => event.taskType);
      expect(taskTypes).toContain('task-1');
      expect(taskTypes).toContain('task-2');
    });

    it('returns events with correct structure', async () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      app = await buildTestApp(mockRedis);

      // Schedule an event with payload
      const scheduleResponse = await app.inject({
        method: 'POST',
        url: '/api/scheduler/events',
        payload: {
          taskType: 'test-task',
          scheduleExpression: 'interval:60',
          payload: { test: 'data' },
          isRecurring: false,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/scheduler/events',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.events).toHaveLength(1);

      const event = body.events[0];
      expect(event.eventId).toBeDefined();
      expect(event.taskType).toBe('test-task');
      expect(event.scheduleExpression).toBe('interval:60');
      expect(event.payload).toEqual({ test: 'data' });
      expect(event.isRecurring).toBe(false);
      expect(event.nextRunAtIso).toBeDefined();
      expect(event.createdAtIso).toBeDefined();
    });
  });

  describe('Integration tests', () => {
    it('schedules, lists, and cancels events in sequence', async () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);

      app = await buildTestApp(mockRedis);

      // Start with empty list
      let listResponse = await app.inject({
        method: 'GET',
        url: '/api/scheduler/events',
      });

      expect(listResponse.json().events).toHaveLength(0);

      // Schedule a task
      const scheduleResponse = await app.inject({
        method: 'POST',
        url: '/api/scheduler/events',
        payload: {
          taskType: 'integration-task',
          scheduleExpression: 'interval:60',
          isRecurring: false,
        },
      });

      const eventId = scheduleResponse.json<SchedulerEvent>().eventId;

      // Verify task is in list
      listResponse = await app.inject({
        method: 'GET',
        url: '/api/scheduler/events',
      });

      expect(listResponse.json().events).toHaveLength(1);

      // Cancel the task
      await app.inject({
        method: 'DELETE',
        url: `/api/scheduler/events/${eventId}`,
      });

      // Verify task is removed
      listResponse = await app.inject({
        method: 'GET',
        url: '/api/scheduler/events',
      });

      expect(listResponse.json().events).toHaveLength(0);
    });
  });
});
