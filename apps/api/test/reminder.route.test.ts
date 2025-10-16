import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type Redis from 'ioredis';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DailyReminder, ReminderResponse } from '@automata/types';

type ReminderRouteResponse = ReminderResponse & {
  cache: {
    hit: boolean;
    staleWhileRevalidate: boolean;
    ageSeconds: number;
  };
};

const {
  ReminderRepositoryStub,
  reminderRepositoryConstructorSpy,
  seedRecurringRemindersMock,
  getRemindersForDateMock,
  markReminderCompletedMock,
} = vi.hoisted(() => {
  const constructorSpy = vi.fn<[unknown], void>();
  const seedMock = vi.fn<[Date], Promise<void>>();
  const getMock = vi.fn<[Date], Promise<ReminderResponse>>();
  const markMock = vi.fn<[string, Date], Promise<void>>();

  class ReminderRepositoryStub {
    constructor(redis: unknown) {
      constructorSpy(redis);
    }

    seedRecurringReminders = seedMock;

    getRemindersForDate = getMock;

    markReminderCompleted = markMock;
  }

  return {
    ReminderRepositoryStub,
    reminderRepositoryConstructorSpy: constructorSpy,
    seedRecurringRemindersMock: seedMock,
    getRemindersForDateMock: getMock,
    markReminderCompletedMock: markMock,
  };
});

vi.mock('../src/adapters/reminderRepository', () => ({
  ReminderRepository: ReminderRepositoryStub,
}));

import { registerReminder } from '../src/routes/reminder';

type MockRedis = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

async function buildTestApp(redis: MockRedis): Promise<FastifyInstance> {
  const app = Fastify();
  app.decorate('redis', redis as unknown as Redis);
  await app.register(registerReminder, { prefix: '/api' });
  await app.ready();
  return app;
}

describe('reminder route', () => {
  let app: FastifyInstance | null = null;

  beforeEach(() => {
    seedRecurringRemindersMock.mockReset();
    getRemindersForDateMock.mockReset();
    markReminderCompletedMock.mockReset();
    reminderRepositoryConstructorSpy.mockClear();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it('returns cached reminders when entry is fresh', async () => {
    const cachedAt = DateTime.utc().minus({ seconds: 15 });
    const cachedAtIso = cachedAt.toISO();
    if (!cachedAtIso) {
      throw new Error('failed to build cachedAtIso');
    }

    const reminders: DailyReminder[] = [
      {
        id: 'rem-1',
        title: 'Drink water',
        description: 'Stay hydrated',
        scheduledAt: DateTime.utc().plus({ minutes: 10 }).toISO() ?? new Date().toISOString(),
        isRecurring: true,
        isCompleted: false,
        createdAt: DateTime.utc().toISO() ?? new Date().toISOString(),
      },
    ];

    const redis: MockRedis = {
      get: vi.fn().mockResolvedValue(JSON.stringify({
        payload: {
          reminders,
          expiresAfterMinutes: 15,
        },
        cachedAtIso,
      })),
      set: vi.fn(),
    };

    app = await buildTestApp(redis);

    const response = await app.inject({
      method: 'GET',
      url: '/api/reminder?date=2024-05-01',
    });

    const maybeError = (() => {
      try {
        return JSON.parse(response.payload) as Record<string, unknown>;
      } catch {
        return null;
      }
    })();

    if (response.statusCode !== 200) {
      throw new Error(`unexpected status ${response.statusCode}: ${JSON.stringify(maybeError)}`);
    }

    expect(response.statusCode).toBe(200);

    const body = response.json<ReminderRouteResponse>();
    expect(body.reminders).toHaveLength(1);
    expect(body.cache.hit).toBe(true);
    expect(body.cache.staleWhileRevalidate).toBe(false);
    expect(body.cache.ageSeconds).toBeGreaterThanOrEqual(0);

    expect(reminderRepositoryConstructorSpy).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('fetches reminders and caches result on cache miss', async () => {
    const redis: MockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
    };

    const reminders: DailyReminder[] = [
      {
        id: 'rem-2',
        title: 'Stand up',
        scheduledAt: '2024-06-01T09:00:00.000Z',
        isRecurring: false,
        isCompleted: false,
        createdAt: '2024-04-01T09:00:00.000Z',
      },
    ];

    seedRecurringRemindersMock.mockResolvedValue(undefined);
    getRemindersForDateMock.mockResolvedValue({
      reminders,
      expiresAfterMinutes: 42,
    });

    app = await buildTestApp(redis);

    const response = await app.inject({
      method: 'GET',
      url: '/api/reminder?date=2024-06-01',
    });

    const maybeError = (() => {
      try {
        return JSON.parse(response.payload) as Record<string, unknown>;
      } catch {
        return null;
      }
    })();

    if (response.statusCode !== 200) {
      throw new Error(`unexpected status ${response.statusCode}: ${JSON.stringify(maybeError)}`);
    }

    expect(response.statusCode).toBe(200);

    expect(reminderRepositoryConstructorSpy).toHaveBeenCalledTimes(1);
    const [redisArgument] = reminderRepositoryConstructorSpy.mock.calls[0];
    expect(redisArgument).toBe(redis);

    expect(seedRecurringRemindersMock).toHaveBeenCalledTimes(1);
    const seededDate = seedRecurringRemindersMock.mock.calls[0][0];
    expect(DateTime.fromJSDate(seededDate, { zone: 'utc' }).toISODate()).toBe('2024-06-01');

    expect(getRemindersForDateMock).toHaveBeenCalledTimes(1);
    const fetchedDate = getRemindersForDateMock.mock.calls[0][0];
    expect(DateTime.fromJSDate(fetchedDate, { zone: 'utc' }).toISODate()).toBe('2024-06-01');

    const body = response.json<ReminderRouteResponse>();
    expect(body.reminders).toEqual(reminders);
    expect(body.expiresAfterMinutes).toBe(15);
    expect(body.cache.hit).toBe(false);
    expect(body.cache.staleWhileRevalidate).toBe(false);
    expect(body.cache.ageSeconds).toBe(0);

    expect(redis.set).toHaveBeenCalledTimes(1);
    const [cacheKey, cacheValueJson, mode, ttl] = redis.set.mock.calls[0];
    expect(cacheKey).toContain('reminder:');
    expect(mode).toBe('EX');
    expect(typeof ttl).toBe('number');

    const cacheValue = JSON.parse(cacheValueJson as string) as {
      payload: ReminderResponse;
      cachedAtIso: string;
    };
    expect(cacheValue.payload.reminders).toEqual(reminders);
    expect(DateTime.fromISO(cacheValue.cachedAtIso).isValid).toBe(true);
  });

  it('falls back to cached data when repository fails but cache is within grace period', async () => {
    const cachedAt = DateTime.utc().minus({ seconds: 330 });
    const cachedAtIso = cachedAt.toISO();
    if (!cachedAtIso) {
      throw new Error('failed to build cachedAtIso');
    }

    const cachedReminders: DailyReminder[] = [
      {
        id: 'rem-stale',
        title: 'Backup reminder',
        scheduledAt: '2024-03-01T10:00:00.000Z',
        isRecurring: true,
        isCompleted: false,
        createdAt: '2024-02-01T09:00:00.000Z',
      },
    ];

    const redis: MockRedis = {
      get: vi.fn().mockResolvedValue(JSON.stringify({
        payload: {
          reminders: cachedReminders,
          expiresAfterMinutes: 15,
        },
        cachedAtIso,
      })),
      set: vi.fn(),
    };

    seedRecurringRemindersMock.mockResolvedValue(undefined);
    getRemindersForDateMock.mockRejectedValueOnce(new Error('repository failure'));

    app = await buildTestApp(redis);

    const response = await app.inject({
      method: 'GET',
      url: '/api/reminder?date=2024-03-02',
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<ReminderRouteResponse>();
    expect(body.reminders).toEqual(cachedReminders);
    expect(body.cache.hit).toBe(true);
    expect(body.cache.staleWhileRevalidate).toBe(true);
    expect(body.cache.ageSeconds).toBeGreaterThanOrEqual(300);

    expect(redis.set).not.toHaveBeenCalled();
    expect(seedRecurringRemindersMock).toHaveBeenCalledTimes(1);
    expect(getRemindersForDateMock).toHaveBeenCalledTimes(1);
  });

  it('marks reminder as completed for today when no date provided', async () => {
    const redis: MockRedis = {
      get: vi.fn(),
      set: vi.fn(),
    };

    markReminderCompletedMock.mockResolvedValue(undefined);

    app = await buildTestApp(redis);

    const before = DateTime.utc();

    const response = await app.inject({
      method: 'POST',
      url: '/api/reminder/complete',
      payload: {
        reminderId: 'rem-3',
      },
    });

    const after = DateTime.utc();

    expect(response.statusCode).toBe(200);
    expect(markReminderCompletedMock).toHaveBeenCalledTimes(1);

    const [reminderId, completedDate] = markReminderCompletedMock.mock.calls[0];
    expect(reminderId).toBe('rem-3');

    const completed = DateTime.fromJSDate(completedDate, { zone: 'utc' });
    expect(completed.toMillis()).toBeGreaterThanOrEqual(before.toMillis());
    expect(completed.toMillis()).toBeLessThanOrEqual(after.plus({ seconds: 1 }).toMillis());
  });

  it('marks reminder as completed for provided date', async () => {
    const redis: MockRedis = {
      get: vi.fn(),
      set: vi.fn(),
    };

    markReminderCompletedMock.mockResolvedValue(undefined);

    app = await buildTestApp(redis);

    const response = await app.inject({
      method: 'POST',
      url: '/api/reminder/complete',
      payload: {
        reminderId: 'rem-4',
        date: '2024-08-15',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(markReminderCompletedMock).toHaveBeenCalledTimes(1);

    const [, completedDate] = markReminderCompletedMock.mock.calls[0];
    expect(DateTime.fromJSDate(completedDate, { zone: 'utc' }).toISODate()).toBe('2024-08-15');
  });
});
