import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { DateTime } from 'luxon';

import { buildProviderError, buildValidationError, buildInternalError } from '../utils/errors';
import type {
  AutoModeStatusResponse,
  AutoModeConfigUpdate,
  AutoModeConfig,
  AutoModeTimeWindow
} from '@automata/types';
import { AutoModeScheduler } from '../services/autoModeScheduler';

const DEFAULT_CONFIG: AutoModeConfig = {
  enabled: true,
  timeWindows: [
    {
      name: 'morning-commute',
      mode: 'Nav',
      startTime: { hour: 8, minute: 30 },
      endTime: { hour: 9, minute: 30 },
      daysOfWeek: [1, 2, 3, 4, 5],
      description: 'Morning commute window',
    },
    {
      name: 'evening-commute',
      mode: 'Nav',
      startTime: { hour: 17, minute: 0 },
      endTime: { hour: 20, minute: 0 },
      daysOfWeek: [1, 2, 3, 4, 5],
      description: 'Evening commute window',
    },
  ],
  defaultMode: 'Compact',
  navModeRefreshSeconds: 300,
};

const autoModeStatusQuerySchema = z.object({
  forceRefresh: z.coerce.boolean().optional(),
});

type AutoModeStatusQueryParams = z.infer<typeof autoModeStatusQuerySchema>;

const autoModeConfigUpdateSchema = z.object({
  config: z.object({
    enabled: z.boolean(),
    timeWindows: z.array(z.object({
      name: z.string(),
      mode: z.enum(['Compact', 'Nav']),
      startTime: z.object({
        hour: z.number().min(0).max(23),
        minute: z.number().min(0).max(59),
      }),
      endTime: z.object({
        hour: z.number().min(0).max(23),
        minute: z.number().min(0).max(59),
      }),
      daysOfWeek: z.array(z.number().min(0).max(6)),
      description: z.string().optional(),
    })),
    defaultMode: z.enum(['Compact', 'Nav']),
    navModeRefreshSeconds: z.number().min(60).max(3600),
  }),
});

export async function registerAutoMode(
  app: FastifyInstance,
  _opts: FastifyPluginOptions,
): Promise<void> {
  // Initialize the auto-mode scheduler service
  const autoModeScheduler = new AutoModeScheduler();

  // GET /auto-mode/status - Get current auto-mode status and configuration
  app.get<{ Querystring: AutoModeStatusQueryParams }>('/auto-mode/status', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          forceRefresh: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      response: {
        200: {
          type: 'object',
          properties: {
            currentMode: { type: 'string', enum: ['Compact', 'Nav'] },
            nextBoundaryIso: { type: 'string' },
            config: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                timeWindows: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      mode: { type: 'string', enum: ['Compact', 'Nav'] },
                      startTime: {
                        type: 'object',
                        properties: {
                          hour: { type: 'number' },
                          minute: { type: 'number' },
                        },
                        required: ['hour', 'minute'],
                      },
                      endTime: {
                        type: 'object',
                        properties: {
                          hour: { type: 'number' },
                          minute: { type: 'number' },
                        },
                        required: ['hour', 'minute'],
                      },
                      daysOfWeek: {
                        type: 'array',
                        items: { type: 'number' },
                      },
                      description: { type: 'string' },
                    },
                    required: ['name', 'mode', 'startTime', 'endTime', 'daysOfWeek'],
                  },
                },
                defaultMode: { type: 'string', enum: ['Compact', 'Nav'] },
                navModeRefreshSeconds: { type: 'number' },
              },
              required: ['enabled', 'timeWindows', 'defaultMode', 'navModeRefreshSeconds'],
            },
            lastUpdatedIso: { type: 'string' },
          },
          required: [
            'currentMode',
            'config',
            'lastUpdatedIso',
          ],
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
  }, async (
    request: FastifyRequest<{ Querystring: AutoModeStatusQueryParams }>,
    reply: FastifyReply,
  ) => {
    const validation = autoModeStatusQuerySchema.safeParse(request.query);
    if (!validation.success) {
      const { statusCode, payload } = buildValidationError('Invalid query parameters', {
        issues: validation.error.flatten(),
      });
      return reply.status(statusCode).send(payload);
    }

    const { forceRefresh = false } = validation.data;

    try {
      // Get current config from Redis or use default
      const configKey = 'auto-mode:config:current';
      let currentConfig = DEFAULT_CONFIG;

      if (!forceRefresh) {
        try {
          const cachedConfig = await app.redis.get(configKey);
          if (cachedConfig) {
            const parsed = JSON.parse(cachedConfig) as AutoModeConfig;
            // Basic validation of parsed config
            if (parsed && typeof parsed.enabled === 'boolean' && Array.isArray(parsed.timeWindows)) {
              currentConfig = parsed;
            }
          }
        } catch (error) {
          app.log.warn({ err: error }, 'Failed to read auto-mode config from Redis, using default');
        }
      }

      // Calculate current mode and next boundary
      const now = new Date();
      const currentMode = autoModeScheduler.resolveModeForDate(currentConfig, now);
      const nextBoundary = autoModeScheduler.getNextBoundary(currentConfig, now);

      const nowIso = DateTime.utc();
      const lastUpdatedIso = nowIso.toISO();

      if (!lastUpdatedIso) {
        throw new Error('Failed to generate ISO timestamp for auto-mode status response');
      }

      const response: AutoModeStatusResponse = {
        currentMode,
        nextBoundaryIso: nextBoundary ? nextBoundary.toISOString() : undefined,
        config: currentConfig,
        lastUpdatedIso,
      };

      // Cache the current config for future requests
      try {
        await app.redis.set(configKey, JSON.stringify(currentConfig), 'EX', 3600); // 1 hour cache
      } catch (error) {
        app.log.warn({ err: error }, 'Failed to persist auto-mode config to Redis');
      }

      app.log.info(`Retrieved auto-mode status: ${currentMode} mode`);
      
      return response;
    } catch (error) {
      app.log.error({ err: error }, 'Failed to retrieve auto-mode status');

      const { statusCode, payload } = buildProviderError(
        'Failed to fetch auto-mode status information.',
        error instanceof Error ? { message: error.message } : error,
      );
      return reply.status(statusCode).send(payload);
    }
  });

  // POST /auto-mode/config - Update auto-mode configuration
  app.post<{ Body: AutoModeConfigUpdate }>('/auto-mode/config', {
    schema: {
      body: {
        type: 'object',
        properties: {
          config: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              timeWindows: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    mode: { type: 'string', enum: ['Compact', 'Nav'] },
                    startTime: {
                      type: 'object',
                      properties: {
                        hour: { type: 'number' },
                        minute: { type: 'number' },
                      },
                      required: ['hour', 'minute'],
                    },
                    endTime: {
                      type: 'object',
                      properties: {
                        hour: { type: 'number' },
                        minute: { type: 'number' },
                      },
                      required: ['hour', 'minute'],
                    },
                    daysOfWeek: {
                      type: 'array',
                      items: { type: 'number' },
                    },
                    description: { type: 'string' },
                  },
                  required: ['name', 'mode', 'startTime', 'endTime', 'daysOfWeek'],
                },
              },
              defaultMode: { type: 'string', enum: ['Compact', 'Nav'] },
              navModeRefreshSeconds: { type: 'number' },
            },
            required: ['enabled', 'timeWindows', 'defaultMode', 'navModeRefreshSeconds'],
          },
        },
        required: ['config'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            config: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                timeWindows: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      mode: { type: 'string', enum: ['Compact', 'Nav'] },
                      startTime: {
                        type: 'object',
                        properties: {
                          hour: { type: 'number' },
                          minute: { type: 'number' },
                        },
                        required: ['hour', 'minute'],
                      },
                      endTime: {
                        type: 'object',
                        properties: {
                          hour: { type: 'number' },
                          minute: { type: 'number' },
                        },
                        required: ['hour', 'minute'],
                      },
                      daysOfWeek: {
                        type: 'array',
                        items: { type: 'number' },
                      },
                      description: { type: 'string' },
                    },
                    required: ['name', 'mode', 'startTime', 'endTime', 'daysOfWeek'],
                  },
                },
                defaultMode: { type: 'string', enum: ['Compact', 'Nav'] },
                navModeRefreshSeconds: { type: 'number' },
              },
              required: ['enabled', 'timeWindows', 'defaultMode', 'navModeRefreshSeconds'],
            },
            lastUpdatedIso: { type: 'string' },
          },
          required: ['success', 'message', 'config', 'lastUpdatedIso'],
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
            message: { type: 'string' },
          },
          required: ['error', 'code', 'message'],
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
  }, async (
    request: FastifyRequest<{ Body: AutoModeConfigUpdate }>,
    reply: FastifyReply,
  ) => {
    const validation = autoModeConfigUpdateSchema.safeParse(request.body);
    if (!validation.success) {
      const { statusCode, payload } = buildValidationError('Invalid request body', {
        issues: validation.error.flatten(),
      });
      return reply.status(statusCode).send(payload);
    }

    const { config: newConfig } = validation.data;

    try {
      const configKey = 'auto-mode:config:current';
      
      // Store the new config
      try {
        await app.redis.set(configKey, JSON.stringify(newConfig), 'EX', 86400); // 24 hours cache
      } catch (error) {
        app.log.warn({ err: error }, 'Failed to persist auto-mode config update to Redis');
      }

      const now = DateTime.utc();
      const lastUpdatedIso = now.toISO();

      if (!lastUpdatedIso) {
        throw new Error('Failed to generate ISO timestamp for auto-mode config update');
      }

      app.log.info(`Updated auto-mode config: enabled=${newConfig.enabled}, timeWindows=${newConfig.timeWindows.length}`);
      
      return {
        success: true,
        message: 'Auto-mode configuration updated successfully',
        config: newConfig,
        lastUpdatedIso,
      };
    } catch (error) {
      app.log.error({ err: error }, 'Failed to update auto-mode configuration');

      const { statusCode, payload } = buildProviderError(
        'Failed to update auto-mode configuration.',
        error instanceof Error ? { message: error.message } : error,
      );
      return reply.status(statusCode).send(payload);
    }
  });
}

export default registerAutoMode;
