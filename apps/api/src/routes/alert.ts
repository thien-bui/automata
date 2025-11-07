import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { DateTime } from 'luxon';

import { buildProviderError, buildValidationError, buildInternalError } from '../utils/errors';
import type { 
  AlertThresholdResponse, 
  AlertThresholdUpdateRequest,
  RouteAlertResponse,
  RouteAlert,
  RouteTimeResponse,
  AlertAcknowledgeRequest
} from '@automata/types';

const MIN_THRESHOLD_MINUTES = 5;
const DEFAULT_THRESHOLD_MINUTES = 45;
const MAX_THRESHOLD_MINUTES = 1440; // 24 hours

const alertThresholdQuerySchema = z.object({
  forceRefresh: z.coerce.boolean().optional(),
});

type AlertThresholdQueryParams = z.infer<typeof alertThresholdQuerySchema>;

const alertThresholdUpdateSchema = z.object({
  thresholdMinutes: z.number()
    .min(MIN_THRESHOLD_MINUTES, `Threshold must be at least ${MIN_THRESHOLD_MINUTES} minutes`)
    .max(MAX_THRESHOLD_MINUTES, `Threshold cannot exceed ${MAX_THRESHOLD_MINUTES} minutes`),
});

const routeAlertQuerySchema = z.object({
  routeData: z.string(),
  thresholdMinutes: z.number().optional(),
  compactMode: z.coerce.boolean().optional(),
});

type RouteAlertQueryParams = z.infer<typeof routeAlertQuerySchema>;

const alertAcknowledgeSchema = z.object({
  alertIds: z.array(z.number()).optional(),
  acknowledgeAll: z.coerce.boolean().optional(),
});

export async function registerAlert(
  app: FastifyInstance,
  _opts: FastifyPluginOptions,
): Promise<void> {
  // GET /alerts/threshold - Get current alert threshold configuration
  app.get<{ Querystring: AlertThresholdQueryParams }>('/alerts/threshold', {
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
            thresholdMinutes: { type: 'number' },
            defaultThresholdMinutes: { type: 'number' },
            minThresholdMinutes: { type: 'number' },
            maxThresholdMinutes: { type: 'number' },
            lastUpdatedIso: { type: 'string' },
          },
          required: [
            'thresholdMinutes',
            'defaultThresholdMinutes',
            'minThresholdMinutes',
            'maxThresholdMinutes',
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
    request: FastifyRequest<{ Querystring: AlertThresholdQueryParams }>,
    reply: FastifyReply,
  ) => {
    const validation = alertThresholdQuerySchema.safeParse(request.query);
    if (!validation.success) {
      const { statusCode, payload } = buildValidationError('Invalid query parameters', {
        issues: validation.error.flatten(),
      });
      return reply.status(statusCode).send(payload);
    }

    const { forceRefresh = false } = validation.data;

    try {
      // Get current threshold from Redis or use default
      const cacheKey = 'alert:threshold:current';
      let currentThreshold = DEFAULT_THRESHOLD_MINUTES;

      if (!forceRefresh) {
        try {
          const cachedValue = await app.redis.get(cacheKey);
          if (cachedValue) {
            const parsed = Number(cachedValue);
            if (!Number.isNaN(parsed) && parsed >= MIN_THRESHOLD_MINUTES && parsed <= MAX_THRESHOLD_MINUTES) {
              currentThreshold = parsed;
            }
          }
        } catch (error) {
          app.log.warn({ err: error }, 'Failed to read alert threshold from Redis, using default');
        }
      }

      const now = DateTime.utc();
      const lastUpdatedIso = now.toISO();

      if (!lastUpdatedIso) {
        throw new Error('Failed to generate ISO timestamp for alert threshold response');
      }

      const response: AlertThresholdResponse = {
        thresholdMinutes: currentThreshold,
        defaultThresholdMinutes: DEFAULT_THRESHOLD_MINUTES,
        minThresholdMinutes: MIN_THRESHOLD_MINUTES,
        maxThresholdMinutes: MAX_THRESHOLD_MINUTES,
        lastUpdatedIso,
      };

      // Cache the current threshold for future requests
      try {
        await app.redis.set(cacheKey, String(currentThreshold), 'EX', 3600); // 1 hour cache
      } catch (error) {
        app.log.warn({ err: error }, 'Failed to persist alert threshold to Redis');
      }

      app.log.info(`Retrieved alert threshold: ${currentThreshold} minutes`);
      
      return response;
    } catch (error) {
      app.log.error({ err: error }, 'Failed to retrieve alert threshold');

      const { statusCode, payload } = buildProviderError(
        'Failed to fetch alert threshold information.',
        error instanceof Error ? { message: error.message } : error,
      );
      return reply.status(statusCode).send(payload);
    }
  });

  // POST /alerts/threshold - Update alert threshold configuration
  app.post<{ Body: AlertThresholdUpdateRequest }>('/alerts/threshold', {
    schema: {
      body: {
        type: 'object',
        properties: {
          thresholdMinutes: { 
            type: 'number',
            minimum: MIN_THRESHOLD_MINUTES,
            maximum: MAX_THRESHOLD_MINUTES,
          },
        },
        required: ['thresholdMinutes'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            thresholdMinutes: { type: 'number' },
            lastUpdatedIso: { type: 'string' },
          },
          required: ['success', 'message', 'thresholdMinutes', 'lastUpdatedIso'],
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
    request: FastifyRequest<{ Body: AlertThresholdUpdateRequest }>,
    reply: FastifyReply,
  ) => {
    const validation = alertThresholdUpdateSchema.safeParse(request.body);
    if (!validation.success) {
      const { statusCode, payload } = buildValidationError('Invalid request body', {
        issues: validation.error.flatten(),
      });
      return reply.status(statusCode).send(payload);
    }

    const { thresholdMinutes } = validation.data;

    try {
      const cacheKey = 'alert:threshold:current';
      
      // Store the new threshold value
      try {
        await app.redis.set(cacheKey, String(thresholdMinutes), 'EX', 86400); // 24 hours cache
      } catch (error) {
        app.log.warn({ err: error }, 'Failed to persist alert threshold update to Redis');
      }

      const now = DateTime.utc();
      const lastUpdatedIso = now.toISO();

      if (!lastUpdatedIso) {
        throw new Error('Failed to generate ISO timestamp for alert threshold update');
      }

      app.log.info(`Updated alert threshold to ${thresholdMinutes} minutes`);
      
      return {
        success: true,
        message: 'Alert threshold updated successfully',
        thresholdMinutes,
        lastUpdatedIso,
      };
    } catch (error) {
      app.log.error({ err: error }, 'Failed to update alert threshold');

      const { statusCode, payload } = buildProviderError(
        'Failed to update alert threshold.',
        error instanceof Error ? { message: error.message } : error,
      );
      return reply.status(statusCode).send(payload);
    }
  });

  // GET /alerts/route - Get route alerts based on current threshold and route data
  app.get('/alerts/route', async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      // Manual validation to ensure we control error responses
      const query = request.query as any;
      const routeDataJson = query.routeData;
      const queryThresholdMinutes = query.thresholdMinutes ? Number(query.thresholdMinutes) : undefined;
      const compactMode = query.compactMode === 'true' || query.compactMode === true;

      // Validate required routeData parameter
      if (!routeDataJson) {
        const { statusCode, payload } = buildValidationError('Missing required routeData parameter');
        return reply.status(statusCode).send(payload);
      }

      // Parse route data with proper error handling
      let routeData: RouteTimeResponse;
      try {
        routeData = JSON.parse(routeDataJson) as RouteTimeResponse;
      } catch (error) {
        const { statusCode, payload } = buildValidationError('Invalid routeData JSON format');
        return reply.status(statusCode).send(payload);
      }

      // Validate route data structure
      if (!routeData.durationMinutes || !routeData.lastUpdatedIso) {
        const { statusCode, payload } = buildValidationError('Invalid routeData structure: missing required fields');
        return reply.status(statusCode).send(payload);
      }

      // Validate thresholdMinutes if provided
      if (queryThresholdMinutes !== undefined) {
        if (typeof queryThresholdMinutes !== 'number' || 
            queryThresholdMinutes < MIN_THRESHOLD_MINUTES || 
            queryThresholdMinutes > MAX_THRESHOLD_MINUTES) {
          const { statusCode, payload } = buildValidationError(
            `Threshold must be between ${MIN_THRESHOLD_MINUTES} and ${MAX_THRESHOLD_MINUTES} minutes`
          );
          return reply.status(statusCode).send(payload);
        }
      }

      // Get current threshold (from query param or Redis/default)
      let currentThreshold = queryThresholdMinutes;
      if (!currentThreshold) {
        try {
          const cachedValue = await app.redis.get('alert:threshold:current');
          if (cachedValue) {
            const parsed = Number(cachedValue);
            if (!Number.isNaN(parsed) && parsed >= MIN_THRESHOLD_MINUTES && parsed <= MAX_THRESHOLD_MINUTES) {
              currentThreshold = parsed;
            }
          }
        } catch (error) {
          app.log.warn({ err: error }, 'Failed to read alert threshold from Redis, using default');
        }
      }

      if (!currentThreshold) {
        currentThreshold = DEFAULT_THRESHOLD_MINUTES;
      }

      // Check if route time exceeds threshold
      const overThreshold = routeData.durationMinutes > currentThreshold;
      const now = DateTime.utc();
      const lastUpdatedIso = now.toISO();

      if (!lastUpdatedIso) {
        const { statusCode, payload } = buildInternalError('Failed to generate ISO timestamp for route alerts response');
        return reply.status(statusCode).send(payload);
      }

      const alerts: RouteAlert[] = [];

      if (overThreshold) {
        // Generate alert message based on compact mode
        const message = compactMode 
          ? `Travel time ${routeData.durationMinutes.toFixed(1)} min exceeds threshold of ${currentThreshold} min.`
          : `Travel time ${routeData.durationMinutes.toFixed(1)} min exceeds threshold of ${currentThreshold} min.`;

        const alert: RouteAlert = {
          id: Date.now(),
          message,
          routeData,
          thresholdMinutes: currentThreshold,
          acknowledged: false,
          createdAtIso: lastUpdatedIso,
        };

        alerts.push(alert);
      }

      // Get acknowledged alerts from Redis for context
      let acknowledgedAlertKey: string | null = null;
      try {
        const alertKey = `${routeData.lastUpdatedIso}:${currentThreshold}:${routeData.durationMinutes.toFixed(1)}`;
        const acknowledged = await app.redis.get(`alert:acknowledged:${alertKey}`);
        if (acknowledged === 'true') {
          acknowledgedAlertKey = alertKey;
        }
      } catch (error) {
        app.log.warn({ err: error }, 'Failed to read acknowledged alerts from Redis');
      }

      // Filter out acknowledged alerts
      const unacknowledgedAlerts = alerts.filter(alert => {
        if (acknowledgedAlertKey) {
          const alertKey = `${routeData.lastUpdatedIso}:${currentThreshold}:${routeData.durationMinutes.toFixed(1)}`;
          return alertKey !== acknowledgedAlertKey;
        }
        return true;
      });

      const response: RouteAlertResponse = {
        alerts: unacknowledgedAlerts,
        totalCount: alerts.length,
        unacknowledgedCount: unacknowledgedAlerts.length,
        lastUpdatedIso,
      };

      app.log.info(`Route alerts generated: ${unacknowledgedAlerts.length} unacknowledged out of ${alerts.length} total`);
      
      return response;
    } catch (error) {
      // Check if this is a validation-related error that should return 400
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isValidationError = 
        errorMessage.includes('Invalid routeData JSON format') ||
        errorMessage.includes('Invalid routeData structure') ||
        errorMessage.includes('Missing required routeData parameter') ||
        errorMessage.includes('Threshold must be between');
      
      if (isValidationError) {
        const { statusCode, payload } = buildValidationError(errorMessage);
        return reply.status(statusCode).send(payload);
      }

      // For other errors, return 500
      app.log.error({ err: error }, 'Failed to generate route alerts');
      const { statusCode, payload } = buildProviderError(
        'Failed to generate route alerts.',
        error instanceof Error ? { message: error.message } : error,
      );
      return reply.status(statusCode).send(payload);
    }
  });
}

export default registerAlert;
