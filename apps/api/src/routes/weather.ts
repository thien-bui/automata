import { createHash } from 'node:crypto';

import type { WeatherResponse, WeatherQuery } from '@automata/types';
import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import { z } from 'zod';
import { DateTime } from 'luxon';

import { fetchGoogleWeather } from '../adapters/googleWeather';
import { cacheConfig } from '../config/cache';
import { buildProviderError, buildValidationError } from '../utils/errors';

const weatherCacheConfig = cacheConfig.weather;

const querySchema = z.object({
  location: z.string().min(1, 'location is required'),
  freshnessSeconds: z
    .coerce
    .number({ invalid_type_error: 'freshnessSeconds must be a number' })
    .int()
    .min(60)
    .max(3600)
    .optional(),
  forceRefresh: z.coerce.boolean().optional(),
});

interface CachedWeatherRecord {
  payload: Omit<WeatherResponse, 'cache'>;
  cachedAtIso: string;
}

type WeatherQueryParams = z.infer<typeof querySchema>;

function buildCacheKey({ location }: { location: string }): string {
  const hasher = createHash('sha256');
  hasher.update(`weather:${location}`);
  return `weather:${hasher.digest('hex')}`;
}

function toResponse(
  record: CachedWeatherRecord,
  ageSeconds: number,
  hit: boolean,
  staleWhileRevalidate: boolean,
): WeatherResponse {
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
): CachedWeatherRecord | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CachedWeatherRecord;
    if (parsed?.payload && parsed.cachedAtIso) {
      return parsed;
    }
  } catch (error) {
    logFn('Failed to parse cached weather entry', { error });
  }

  return null;
}

export async function registerWeather(
  app: FastifyInstance,
  _opts: FastifyPluginOptions,
): Promise<void> {
  app.get<{ Querystring: WeatherQueryParams }>('/weather', async (
    request: FastifyRequest<{ Querystring: WeatherQueryParams }>,
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
      location,
      freshnessSeconds: freshnessOverride,
      forceRefresh = false,
    } = validation.data;
    const freshnessSeconds = freshnessOverride ?? weatherCacheConfig.baseTtlSeconds;
    const maxAcceptableAgeSeconds = freshnessSeconds + weatherCacheConfig.staleGraceSeconds;
    const cacheKey = buildCacheKey({ location });

    let cachedRaw: string | null = null;
    try {
      cachedRaw = await app.redis.get(cacheKey);
    } catch (error) {
      app.log.error({ err: error }, 'Failed to read weather cache entry from Redis');
    }

    const cachedRecord = coerceCachedRecord(cachedRaw, (msg, meta) => {
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
          'Encountered invalid cachedAtIso timestamp in weather cache',
        );
      }

      if (cachedTimestampValid && !forceRefresh && cachedAgeSeconds <= freshnessSeconds) {
        return toResponse(cachedRecord, cachedAgeSeconds, true, false);
      }
    }

    try {
      const providerResult = await fetchGoogleWeather({ location });
      const lastUpdatedIso = now.toISO();
      if (!lastUpdatedIso) {
        throw new Error('Failed to generate ISO timestamp for weather payload');
      }

      const payload: Omit<WeatherResponse, 'cache'> = {
        hourlyData: providerResult.hourlyData,
        provider: 'google-weather',
        lastUpdatedIso,
      };

      const response: WeatherResponse = {
        ...payload,
        cache: {
          hit: false,
          ageSeconds: 0,
          staleWhileRevalidate: false,
        },
      };

      const cacheValue: CachedWeatherRecord = {
        payload,
        cachedAtIso: lastUpdatedIso,
      };

      try {
        await app.redis.set(
          cacheKey,
          JSON.stringify(cacheValue),
          'EX',
          weatherCacheConfig.redisExpireSeconds,
        );
      } catch (error) {
        app.log.error({ err: error }, 'Failed to persist weather cache entry to Redis');
      }

      return response;
    } catch (error) {
      app.log.error({ err: error }, 'Failed to retrieve weather data from provider');

      if (cachedRecord && cachedTimestampValid && cachedAgeSeconds <= maxAcceptableAgeSeconds) {
        return toResponse(cachedRecord, cachedAgeSeconds, true, true);
      }

      const { statusCode, payload } = buildProviderError(
        'Failed to fetch weather information from provider.',
        error instanceof Error ? { message: error.message } : error,
      );
      return reply.status(statusCode).send(payload);
    }
  });
}

export default registerWeather;
