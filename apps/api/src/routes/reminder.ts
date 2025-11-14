import { createHash } from 'node:crypto';

import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { DateTime } from 'luxon';

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

const autoRefreshSchema = z.object({
  enabled: z.boolean(),
  intervalSeconds: z.number().min(10).max(3600).optional(),
});

interface CachedReminderRecord {
  payload: Omit<ReminderResponse, 'cache'>;
  cachedAtIso: string;
}

interface ReminderResponse {
  reminders: DailyReminder[];
  expiresAfterMinutes: number;
  overdueCount: number;
  serverTime: string;
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

    const now = DateTime.utc();
    let cachedAgeSeconds = 0;
    let cachedTimestampValid = false;

    if (cachedRecord) {
      const cachedAt = DateTime.fromISO(cachedRecord.cachedAtIso, { zone: 'utc' });
      if (cachedAt.isValid) {
        cachedTimestampValid = true;
        const diffInSeconds = now.diff(cachedAt, 'seconds').seconds ?? 0;
        cachedAgeSeconds = Math.max(0, Math.floor(diffInSeconds));
      } else {
        app.log.warn(
          { cachedAtIso: cachedRecord.cachedAtIso },
          'Encountered invalid cachedAtIso timestamp in reminder cache',
        );
      }

      if (cachedTimestampValid && !forceRefresh && cachedAgeSeconds <= freshnessSeconds) {
        return toResponse(cachedRecord, cachedAgeSeconds, true, false);
      }
    }

    try {
      // Validate date format and convert to Date object
      const dateTime = DateTime.fromISO(date, { zone: 'utc' });
      if (!dateTime.isValid) {
        const error = buildValidationError('The provided date is not valid');
        return reply.status(error.statusCode).send(error.payload);
      }

      const queryDate = dateTime.toJSDate();

      // Ensure reminders are seeded for the requested date
      const reminderRepository = new ReminderRepository(app.redis);
      await reminderRepository.seedRecurringReminders(queryDate);

      // Get reminders for the date
      const reminderResponse = await reminderRepository.getRemindersForDate(queryDate);

      // Update expiresAfterMinutes from config
      reminderResponse.expiresAfterMinutes = getReminderExpireWindowMinutes();

      const lastUpdatedIso = now.toISO();
      if (!lastUpdatedIso) {
        throw new Error('Failed to generate ISO timestamp for reminder payload');
      }

      // Calculate overdue count on server side
      const serverTime = now.toISO();
      if (!serverTime) {
        throw new Error('Failed to generate ISO timestamp for server time');
      }

      const overdueCount = reminderResponse.reminders.filter(reminder => {
        if (reminder.isCompleted) return false;
        
        const scheduledTime = DateTime.fromISO(reminder.scheduledAt, { zone: 'utc' });
        if (!scheduledTime.isValid) return false;
        
        const expireTime = scheduledTime.plus({ minutes: reminderResponse.expiresAfterMinutes });
        return now > expireTime;
      }).length;

      const payload: Omit<ReminderResponse, 'cache'> = {
        reminders: reminderResponse.reminders,
        expiresAfterMinutes: reminderResponse.expiresAfterMinutes,
        overdueCount,
        serverTime,
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

      if (cachedRecord && cachedTimestampValid && cachedAgeSeconds <= maxAcceptableAgeSeconds) {
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
        const dateTime = DateTime.fromISO(date, { zone: 'utc' });
        if (!dateTime.isValid) {
          const error = buildValidationError('The provided date is not valid');
          return reply.status(error.statusCode).send(error.payload);
        }

        targetDate = dateTime.toJSDate();
      } else {
        targetDate = DateTime.utc().toJSDate();
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

  // POST /reminder/auto-refresh - Configure auto-refresh settings
  app.post('/reminder/auto-refresh', async (request, reply) => {
    const validation = autoRefreshSchema.safeParse(request.body);
    if (!validation.success) {
      const { statusCode, payload } = buildValidationError('Invalid request body', {
        issues: validation.error.flatten(),
      });
      return reply.status(statusCode).send(payload);
    }

    const { enabled, intervalSeconds } = validation.data;

    try {
      // Store auto-refresh configuration in Redis
      const configKey = 'reminder:auto-refresh-config';
      const config = {
        enabled,
        intervalSeconds: intervalSeconds ?? 60, // Default to 60 seconds
        updatedAt: DateTime.utc().toISO(),
      };

      await app.redis.set(configKey, JSON.stringify(config), 'EX', 86400); // 24 hour expiry

      app.log.info(`Updated reminder auto-refresh config: enabled=${enabled}, interval=${intervalSeconds ?? 60}s`);
      
      return {
        success: true,
        message: 'Auto-refresh configuration updated',
        config,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      app.log.error({ err: error }, 'Error updating auto-refresh configuration');
      
      const errorResponse = buildInternalError(error as Error);
      return reply.status(errorResponse.statusCode).send(errorResponse.payload);
    }
  });

  // GET /reminder/auto-refresh - Get current auto-refresh configuration
  app.get('/reminder/auto-refresh', async (request, reply) => {
    try {
      const configKey = 'reminder:auto-refresh-config';
      const configRaw = await app.redis.get(configKey);
      
      let config;
      if (configRaw) {
        try {
          config = JSON.parse(configRaw);
        } catch (error) {
          app.log.warn({ err: error }, 'Failed to parse auto-refresh config, using defaults');
          config = null;
        }
      }

      // Return default config if none found or parsing failed
      const defaultConfig = {
        enabled: true,
        intervalSeconds: 60,
        updatedAt: DateTime.utc().toISO(),
      };

      const responseConfig = config || defaultConfig;
      
      app.log.info('Retrieved reminder auto-refresh configuration');
      return responseConfig;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      app.log.error({ err: error }, 'Error getting auto-refresh configuration');
      
      const errorResponse = buildInternalError(error as Error);
      return reply.status(errorResponse.statusCode).send(errorResponse.payload);
    }
  });
}

export default registerReminder;
