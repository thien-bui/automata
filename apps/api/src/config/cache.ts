import { z } from 'zod';

type CacheEntryConfig = {
  baseTtlSeconds: number;
  staleGraceSeconds: number;
  redisExpireSeconds: number;
};

type CacheConfig = {
  routes: CacheEntryConfig;
  weather: CacheEntryConfig;
  discord: CacheEntryConfig;
  reminder: CacheEntryConfig;
};

type CacheEnvKey =
  | 'ROUTE_CACHE_TTL_SECONDS'
  | 'ROUTE_CACHE_STALE_GRACE_SECONDS'
  | 'WEATHER_CACHE_TTL_SECONDS'
  | 'WEATHER_CACHE_STALE_GRACE_SECONDS'
  | 'DISCORD_CACHE_TTL_SECONDS'
  | 'DISCORD_CACHE_STALE_GRACE_SECONDS'
  | 'REMINDER_CACHE_TTL_SECONDS'
  | 'REMINDER_CACHE_STALE_GRACE_SECONDS';

const ttlSchema = z
  .coerce
  .number({ invalid_type_error: 'cache ttl must be a number' })
  .int()
  .min(0, 'cache ttl must be non-negative');

function resolveCacheValue(key: CacheEnvKey, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') {
    return fallback;
  }

  const parsed = ttlSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid cache configuration: ${key} -> ${parsed.error.issues.map((issue) => issue.message).join(', ')}`,
    );
  }

  return parsed.data;
}

function makeEntry({
  ttlEnv,
  staleEnv,
  ttlFallback,
  staleFallback,
}: {
  ttlEnv: CacheEnvKey;
  staleEnv: CacheEnvKey;
  ttlFallback: number;
  staleFallback: number;
}): CacheEntryConfig {
  const baseTtlSeconds = resolveCacheValue(ttlEnv, ttlFallback);
  const staleGraceSeconds = resolveCacheValue(staleEnv, staleFallback);

  return {
    baseTtlSeconds,
    staleGraceSeconds,
    redisExpireSeconds: baseTtlSeconds + staleGraceSeconds,
  };
}

export const cacheConfig: CacheConfig = {
  routes: makeEntry({
    ttlEnv: 'ROUTE_CACHE_TTL_SECONDS',
    staleEnv: 'ROUTE_CACHE_STALE_GRACE_SECONDS',
    ttlFallback: 500,
    staleFallback: 300,
  }),
  weather: makeEntry({
    ttlEnv: 'WEATHER_CACHE_TTL_SECONDS',
    staleEnv: 'WEATHER_CACHE_STALE_GRACE_SECONDS',
    ttlFallback: 1800,
    staleFallback: 300,
  }),
  discord: makeEntry({
    ttlEnv: 'DISCORD_CACHE_TTL_SECONDS',
    staleEnv: 'DISCORD_CACHE_STALE_GRACE_SECONDS',
    ttlFallback: 300,
    staleFallback: 60,
  }),
  reminder: makeEntry({
    ttlEnv: 'REMINDER_CACHE_TTL_SECONDS',
    staleEnv: 'REMINDER_CACHE_STALE_GRACE_SECONDS',
    ttlFallback: 300,
    staleFallback: 60,
  }),
};

export type { CacheConfig, CacheEntryConfig };
