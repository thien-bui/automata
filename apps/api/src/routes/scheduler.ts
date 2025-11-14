import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { DateTime } from 'luxon';

import { buildProviderError, buildValidationError, buildInternalError } from '../utils/errors';
import { SchedulerService } from '../services/schedulerService';
import type { SchedulerEventRequest } from '@automata/types';

const schedulerQuerySchema = z.object({
  forceRefresh: z.coerce.boolean().optional(),
});

const schedulerEventRequestSchema = z.object({
  taskType: z.string().min(1, 'Task type is required'),
  scheduleExpression: z.string().min(1, 'Schedule expression is required'),
  payload: z.record(z.unknown()).optional(),
  isRecurring: z.boolean().optional().default(true),
});

type SchedulerQueryParams = z.infer<typeof schedulerQuerySchema>;
type SchedulerEventRequestBody = z.infer<typeof schedulerEventRequestSchema>;

export async function registerScheduler(
  app: FastifyInstance,
  _opts: FastifyPluginOptions,
): Promise<void> {
  // Initialize the scheduler service
  const schedulerService = new SchedulerService(app);

  // Initialize service when plugin is registered
  app.addHook('onReady', async () => {
    try {
      await schedulerService.initialize();
      app.log.info('SchedulerService initialized successfully');
    } catch (error) {
      app.log.error({ err: error }, 'Failed to initialize SchedulerService');
      // Don't throw to allow server to start even if scheduler fails
    }
  });

  // Clean up on server close
  app.addHook('onClose', async () => {
    try {
      await schedulerService.shutdown();
      app.log.info('SchedulerService shut down successfully');
    } catch (error) {
      app.log.error({ err: error }, 'Error shutting down SchedulerService');
    }
  });

  // GET /scheduler/status - Get scheduler status
  app.get<{ Querystring: SchedulerQueryParams }>('/scheduler/status', {
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
            isHealthy: { type: 'boolean' },
            activeSchedules: { type: 'number' },
            nextScheduledEvents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                  scheduledAtIso: { type: 'string' },
                  taskType: { type: 'string' },
                },
                required: ['eventId', 'scheduledAtIso', 'taskType'],
              },
            },
            lastUpdatedIso: { type: 'string' },
          },
          required: ['isHealthy', 'activeSchedules', 'nextScheduledEvents', 'lastUpdatedIso'],
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
    request: FastifyRequest<{ Querystring: SchedulerQueryParams }>,
    reply: FastifyReply,
  ) => {
    const validation = schedulerQuerySchema.safeParse(request.query);
    if (!validation.success) {
      const { statusCode, payload } = buildValidationError('Invalid query parameters', {
        issues: validation.error.flatten(),
      });
      return reply.status(statusCode).send(payload);
    }

    const { forceRefresh = false } = validation.data;

    try {
      // If forceRefresh, we could potentially clear caches or reload state
      // For now, we just fetch the current status
      if (forceRefresh) {
        app.log.info('Force refresh requested for scheduler status');
      }

      const status = await schedulerService.getStatus();
      const now = DateTime.utc();
      const lastUpdatedIso = now.toISO();

      if (!lastUpdatedIso) {
        throw new Error('Failed to generate ISO timestamp for scheduler status response');
      }

      const response = {
        ...status,
        lastUpdatedIso,
      };

      app.log.info(`Retrieved scheduler status: ${status.activeSchedules} active schedules`);
      
      return response;
    } catch (error) {
      app.log.error({ err: error }, 'Failed to retrieve scheduler status');

      const { statusCode, payload } = buildProviderError(
        'Failed to fetch scheduler status information.',
        error instanceof Error ? { message: error.message } : error,
      );
      return reply.status(statusCode).send(payload);
    }
  });

  // POST /scheduler/events - Schedule a new event
  app.post<{ Body: SchedulerEventRequestBody }>('/scheduler/events', {
    schema: {
      body: {
        type: 'object',
        properties: {
          taskType: { type: 'string' },
          scheduleExpression: { type: 'string' },
          payload: {
            type: 'object',
            additionalProperties: true,
          },
          isRecurring: { type: 'boolean' },
        },
        required: ['taskType', 'scheduleExpression'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            eventId: { type: 'string' },
            taskType: { type: 'string' },
            scheduleExpression: { type: 'string' },
            payload: {
              type: 'object',
              additionalProperties: true,
            },
            isRecurring: { type: 'boolean' },
            nextRunAtIso: { type: 'string' },
            lastRunAtIso: { type: 'string' },
            createdAtIso: { type: 'string' },
          },
          required: ['eventId', 'taskType', 'scheduleExpression', 'isRecurring', 'createdAtIso'],
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
    request: FastifyRequest<{ Body: SchedulerEventRequestBody }>,
    reply: FastifyReply,
  ) => {
    const validation = schedulerEventRequestSchema.safeParse(request.body);
    if (!validation.success) {
      const { statusCode, payload } = buildValidationError('Invalid request body', {
        issues: validation.error.flatten(),
      });
      return reply.status(statusCode).send(payload);
    }

    const { taskType, scheduleExpression, payload, isRecurring } = validation.data;

    try {
      const event = await schedulerService.schedule(
        taskType,
        scheduleExpression,
        payload,
        isRecurring
      );

      app.log.info({ 
        eventId: event.eventId, 
        taskType, 
        scheduleExpression 
      }, 'Event scheduled successfully');

      return event;
    } catch (error) {
      app.log.error({ 
        err: error, 
        taskType, 
        scheduleExpression 
      }, 'Failed to schedule event');

      if (error instanceof Error && error.message === 'Invalid schedule expression') {
        const errorResponse = buildValidationError('Invalid schedule expression');
        return reply.status(errorResponse.statusCode).send(errorResponse.payload);
      }

      const { statusCode, payload } = buildProviderError(
        'Failed to schedule event.',
        error instanceof Error ? { message: error.message } : error,
      );
      return reply.status(statusCode).send(payload);
    }
  });

  // DELETE /scheduler/events/:eventId - Cancel a scheduled event
  app.delete('/scheduler/events/:eventId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          eventId: { type: 'string' },
        },
        required: ['eventId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
          required: ['success', 'message'],
        },
        404: {
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
    request: FastifyRequest<{ Params: { eventId: string } }>,
    reply: FastifyReply,
  ) => {
    const { eventId } = request.params;

    try {
      const cancelled = await schedulerService.cancel(eventId);

      if (!cancelled) {
        const errorResponse = buildValidationError('Event not found');
        return reply.status(404).send(errorResponse.payload);
      }

      app.log.info({ eventId }, 'Event cancelled successfully');

      return {
        success: true,
        message: 'Event cancelled successfully',
      };
    } catch (error) {
      app.log.error({ err: error, eventId }, 'Failed to cancel event');

      const { statusCode, payload } = buildProviderError(
        'Failed to cancel event.',
        error instanceof Error ? { message: error.message } : error,
      );
      return reply.status(statusCode).send(payload);
    }
  });

  // GET /scheduler/events - List all scheduled events
  app.get('/scheduler/events', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            events: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  eventId: { type: 'string' },
                  taskType: { type: 'string' },
                  scheduleExpression: { type: 'string' },
                  payload: {
                    type: 'object',
                    additionalProperties: true,
                  },
                  isRecurring: { type: 'boolean' },
                  nextRunAtIso: { type: 'string' },
                  lastRunAtIso: { type: 'string' },
                  createdAtIso: { type: 'string' },
                },
                required: ['eventId', 'taskType', 'scheduleExpression', 'isRecurring', 'createdAtIso'],
              },
            },
            totalCount: { type: 'number' },
          },
          required: ['events', 'totalCount'],
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
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const events = schedulerService.getAllTasks();

      app.log.info(`Retrieved ${events.length} scheduled events`);

      return {
        events,
        totalCount: events.length,
      };
    } catch (error) {
      app.log.error({ err: error }, 'Failed to retrieve scheduled events');

      const { statusCode, payload } = buildProviderError(
        'Failed to retrieve scheduled events.',
        error instanceof Error ? { message: error.message } : error,
      );
      return reply.status(statusCode).send(payload);
    }
  });
}

export default registerScheduler;
