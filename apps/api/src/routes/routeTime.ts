import { createHash } from 'node:crypto';

import type { RouteMode, RouteTimeResponse } from '@automata/types';
import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import { z } from 'zod';

import { fetchGoogleDirections } from '../adapters/googleDirections';
import { cacheConfig } from '../config/cache';
import { buildProviderError, buildValidationError } from '../utils/errors';

const routeCacheConfig = cacheConfig.routes;

const querySchema = z.object({
  from: z.string().min(1, 'from is required'),
  to: z.string().min(1, 'to is required'),
  mode: z.enum(['driving', 'walking', 'transit']).default('driving'),
  freshnessSeconds: z
    .coerce
    .number({ invalid_type_error: 'freshnessSeconds must be a number' })
    .int()
    .min(60)
    .max(900)
    .optional(),
  forceRefresh: z.coerce.boolean().optional(),
});

interface CachedRouteRecord {
  payload: Omit<RouteTimeResponse, 'cache'>;
  cachedAtIso: string;
}

type RouteTimeQueryParams = z.infer<typeof querySchema>;

function buildCacheKey({ from, to, mode }: { from: string; to: string; mode: RouteMode }): string {
  const hasher = createHash('sha256');
  hasher.update(`${mode}:${from}:${to}`);
  return `route:${mode}:${hasher.digest('hex')}`;
}

function toResponse(
  record: CachedRouteRecord,
  ageSeconds: number,
  hit: boolean,
  staleWhileRevalidate: boolean,
): RouteTimeResponse {
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
): CachedRouteRecord | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CachedRouteRecord;
    if (parsed?.payload && parsed.cachedAtIso) {
      return parsed;
    }
  } catch (error) {
    logFn('Failed to parse cached route entry', { error });
  }

  return null;
}

export async function registerRouteTime(
  app: FastifyInstance,
  _opts: FastifyPluginOptions,
): Promise<void> {
  app.get<{ Querystring: RouteTimeQueryParams }>('/route-time', async (
    request: FastifyRequest<{ Querystring: RouteTimeQueryParams }>,
    reply: FastifyReply,
  ) => {
    const validation = querySchema.safeParse(request.query);
    if (!validation.success) {
      const { statusCode, payload } = buildValidationError('Invalid query parameters', {
        issues: validation.error.flatten(),
      });
      return reply.status(statusCode).send(payload);
    }

    const {
      from,
      to,
      mode,
      freshnessSeconds: freshnessOverride,
      forceRefresh = false,
    } = validation.data;
    const freshnessSeconds = freshnessOverride ?? routeCacheConfig.baseTtlSeconds;
    const maxAcceptableAgeSeconds = freshnessSeconds + routeCacheConfig.staleGraceSeconds;
    const cacheKey = buildCacheKey({ from, to, mode });

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
      const providerResult = await fetchGoogleDirections({ from, to, mode });
      const lastUpdatedIso = new Date(now).toISOString();

      const payload: Omit<RouteTimeResponse, 'cache'> = {
        durationMinutes: providerResult.durationMinutes,
        distanceKm: providerResult.distanceKm,
        provider: 'google-directions',
        mode,
        lastUpdatedIso,
      };

      const response: RouteTimeResponse = {
        ...payload,
        cache: {
          hit: false,
          ageSeconds: 0,
          staleWhileRevalidate: false,
        },
      };

      const cacheValue: CachedRouteRecord = {
        payload,
        cachedAtIso: lastUpdatedIso,
      };

      await app.redis.set(
        cacheKey,
        JSON.stringify(cacheValue),
        'EX',
        routeCacheConfig.redisExpireSeconds,
      );

      return response;
    } catch (error) {
      app.log.error({ err: error }, 'Failed to retrieve route data from provider');

      if (cachedRecord && cachedAgeSeconds <= maxAcceptableAgeSeconds) {
        return toResponse(cachedRecord, cachedAgeSeconds, true, true);
      }

      const { statusCode, payload } = buildProviderError(
        'Failed to fetch route information from provider.',
        error instanceof Error ? { message: error.message } : error,
      );
      return reply.status(statusCode).send(payload);
    }
  });
}

export default registerRouteTime;
