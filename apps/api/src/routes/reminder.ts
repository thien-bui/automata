import { createHash } from 'node:crypto';

import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ReminderRepository } from '../adapters/reminderRepository';
import { ReminderScheduler } from '../services/reminderScheduler';
import { cacheConfig } from '../config/cache';
import { getReminderExpireWindowMinutes } from '../config/reminder';
import { buildProviderError, buildValidationError, buildInternalError } from '../utils/errors';
import type { DailyReminder } from '@automata/types';

const reminderCacheConfig = cacheConfig.reminder;

const reminderQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Expected YYYY-MM-DD'),
  forceRefresh: z.coerce.boolean().optional(),
});

const completeReminderSchema = z.object({
  reminderId: z.string().min(1, 'Reminder ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Expected YYYY-MM-DD').optional(),
});

interface CachedReminderRecord {
  payload: Omit<ReminderResponse, 'cache'>;
  cachedAtIso: string;
}

interface ReminderResponse {
  reminders: DailyReminder[];
  expiresAfterMinutes: number;
  cache: {
    hit: boolean;
    ageSeconds: number;
    staleWhileRevalidate: boolean;
  };
}

type ReminderQueryParams = z.infer<typeof reminderQuerySchema>;

function buildCacheKey({ date }: { date: string }): string {
  const hasher = createHash('sha256');
  hasher.update(`reminder:${date}`);
  return `reminder:${hasher.digest('hex')}`;
}

function toResponse(
  record: CachedReminderRecord,
  ageSeconds: number,
  hit: boolean,
  staleWhileRevalidate: boolean,
): ReminderResponse {
  return {
    ...record.payload,
    cache: {
      hit,
      ageSeconds,
      staleWhileRevalidate,
    },
  };
}

function coerceCachedRecord(
  raw: string | null,
  logFn: (msg: string, meta?: unknown) => void,
): CachedReminderRecord | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CachedReminderRecord;
    if (parsed?.payload && parsed.cachedAtIso) {
      return parsed;
    }
  } catch (error) {
    logFn('Failed to parse cached reminder entry', { error });
  }

  return null;
}

export async function registerReminder(
  app: FastifyInstance,
  _opts: FastifyPluginOptions,
): Promise<void> {
  // GET /reminder - Get reminders for a specific date
  app.get<{ Querystring: ReminderQueryParams }>('/reminder', async (
    request: FastifyRequest<{ Querystring: ReminderQueryParams }>,
    reply: FastifyReply,
  ) => {
    const validation = reminderQuerySchema.safeParse(request.query);
    if (!validation.success) {
      const { statusCode, payload } = buildValidationError('Invalid query parameters', {
        issues: validation.error.flatten(),
      });
      return reply.status(statusCode).send(payload);
    }

    const { date, forceRefresh = false } = validation.data;
    const freshnessSeconds = reminderCacheConfig.baseTtlSeconds;
    const maxAcceptableAgeSeconds = freshnessSeconds + reminderCacheConfig.staleGraceSeconds;
    const cacheKey = buildCacheKey({ date });

    const cachedRecord = coerceCachedRecord(await app.redis.get(cacheKey), (msg, meta) => {
      app.log.warn(meta, msg);
    });

    const now = Date.now();
    let cachedAgeSeconds = 0;

    if (cachedRecord) {
      cachedAgeSeconds = Math.max(
        0,
        Math.floor((now - new Date(cachedRecord.cachedAtIso).getTime()) / 1000),
      );

      if (!forceRefresh && cachedAgeSeconds <= freshnessSeconds) {
        return toResponse(cachedRecord, cachedAgeSeconds, true, false);
      }
    }

    try {
      // Validate date format and convert to Date object
      const dateParts = date.split('-').map(Number);
      const queryDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
      
      if (isNaN(queryDate.getTime())) {
        const error = buildValidationError('The provided date is not valid');
        return reply.status(error.statusCode).send(error.payload);
      }

      // Ensure reminders are seeded for the requested date
      const reminderRepository = new ReminderRepository(app.redis);
      await reminderRepository.seedRecurringReminders(queryDate);

      // Get reminders for the date
      const reminderResponse = await reminderRepository.getRemindersForDate(queryDate);

      // Update expiresAfterMinutes from config
      reminderResponse.expiresAfterMinutes = getReminderExpireWindowMinutes();

      const lastUpdatedIso = new Date(now).toISOString();

      const payload: Omit<ReminderResponse, 'cache'> = {
        reminders: reminderResponse.reminders,
        expiresAfterMinutes: reminderResponse.expiresAfterMinutes,
      };

      const response: ReminderResponse = {
        ...payload,
        cache: {
          hit: false,
          ageSeconds: 0,
          staleWhileRevalidate: false,
        },
      };

      const cacheValue: CachedReminderRecord = {
        payload,
        cachedAtIso: lastUpdatedIso,
      };

      await app.redis.set(
        cacheKey,
        JSON.stringify(cacheValue),
        'EX',
        reminderCacheConfig.redisExpireSeconds,
      );

      app.log.info(`Retrieved ${reminderResponse.reminders.length} reminders for date: ${date}`);
      
      return response;
    } catch (error) {
      app.log.error({ err: error }, 'Failed to retrieve reminder data');

      if (cachedRecord && cachedAgeSeconds <= maxAcceptableAgeSeconds) {
        return toResponse(cachedRecord, cachedAgeSeconds, true, true);
      }

      const { statusCode, payload } = buildProviderError(
        'Failed to fetch reminder information.',
        error instanceof Error ? { message: error.message } : error,
      );
      return reply.status(statusCode).send(payload);
    }
  });

  // POST /reminder/complete - Mark a reminder as completed
  app.post('/reminder/complete', async (request, reply) => {
    const validation = completeReminderSchema.safeParse(request.body);
    if (!validation.success) {
      const { statusCode, payload } = buildValidationError('Invalid request body', {
        issues: validation.error.flatten(),
      });
      return reply.status(statusCode).send(payload);
    }

    const { reminderId, date } = validation.data;

    try {
      let targetDate: Date;
      if (date) {
        const dateParts = date.split('-').map(Number);
        targetDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
        
        if (isNaN(targetDate.getTime())) {
          const error = buildValidationError('The provided date is not valid');
          return reply.status(error.statusCode).send(error.payload);
        }
      } else {
        targetDate = new Date();
      }

      const reminderRepository = new ReminderRepository(app.redis);
      await reminderRepository.markReminderCompleted(reminderId, targetDate);

      app.log.info(`Marked reminder ${reminderId} as completed for date: ${date || 'today'}`);
      
      return {
        success: true,
        message: 'Reminder marked as completed',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      app.log.error({ err: error }, 'Error marking reminder as completed');
      
      if (error instanceof Error && error.message === 'Reminder not found') {
        const errorResponse = buildValidationError('The specified reminder does not exist');
        return reply.status(404).send(errorResponse.payload);
      }

      if (error instanceof Error && error.message === 'No reminders found for this date') {
        const errorResponse = buildValidationError('No reminders exist for the specified date');
        return reply.status(404).send(errorResponse.payload);
      }
      
      const errorResponse = buildInternalError(error as Error);
      return reply.status(errorResponse.statusCode).send(errorResponse.payload);
    }
  });

  // GET /reminder/status - Get scheduler status
  app.get('/reminder/status', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            initialized: { type: 'boolean' },
            todaySeeded: { type: 'boolean' },
            tomorrowSeeded: { type: 'boolean' },
            templateCount: { type: 'number' },
          },
          required: ['initialized', 'todaySeeded', 'tomorrowSeeded', 'templateCount'],
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
            message: { type: 'string' },
          },
          required: ['error', 'code', 'message'],
        },
      },
    },
  }, async (request, reply) => {
    try {
      const reminderScheduler = new ReminderScheduler(new ReminderRepository(app.redis));
      const status = await reminderScheduler.getStatus();
      app.log.info('Retrieved reminder scheduler status');
      return status;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      app.log.error({ err: error }, 'Error getting scheduler status');
      
      const errorResponse = buildInternalError(error as Error);
      return reply.status(errorResponse.statusCode).send(errorResponse.payload);
    }
  });
}

export default registerReminder;
