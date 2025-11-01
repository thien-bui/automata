import { z } from 'zod';
import { DateTime } from 'luxon';

type CacheEntryConfig = {
  baseTtlSeconds: number;
  staleGraceSeconds: number;
  redisExpireSeconds: number;
  peakHourTtlSeconds?: number;
  peakHourStaleGraceSeconds?: number;
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
  | 'ROUTE_CACHE_PEAK_HOUR_TTL_SECONDS'
  | 'ROUTE_CACHE_PEAK_HOUR_STALE_GRACE_SECONDS'
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
  peakHourTtlEnv,
  peakHourStaleEnv,
  peakHourTtlFallback,
  peakHourStaleFallback,
}: {
  ttlEnv: CacheEnvKey;
  staleEnv: CacheEnvKey;
  ttlFallback: number;
  staleFallback: number;
  peakHourTtlEnv?: CacheEnvKey;
  peakHourStaleEnv?: CacheEnvKey;
  peakHourTtlFallback?: number;
  peakHourStaleFallback?: number;
}): CacheEntryConfig {
  const baseTtlSeconds = resolveCacheValue(ttlEnv, ttlFallback);
  const staleGraceSeconds = resolveCacheValue(staleEnv, staleFallback);

  const config: CacheEntryConfig = {
    baseTtlSeconds,
    staleGraceSeconds,
    redisExpireSeconds: baseTtlSeconds + staleGraceSeconds,
  };

  // Add peak hour configuration if provided
  if (peakHourTtlEnv && peakHourStaleEnv && peakHourTtlFallback !== undefined && peakHourStaleFallback !== undefined) {
    config.peakHourTtlSeconds = resolveCacheValue(peakHourTtlEnv, peakHourTtlFallback);
    config.peakHourStaleGraceSeconds = resolveCacheValue(peakHourStaleEnv, peakHourStaleFallback);
  }

  return config;
}

export const cacheConfig: CacheConfig = {
  routes: makeEntry({
    ttlEnv: 'ROUTE_CACHE_TTL_SECONDS',
    staleEnv: 'ROUTE_CACHE_STALE_GRACE_SECONDS',
    ttlFallback: 600, // 10 minutes
    staleFallback: 900, // 15 minutes
    peakHourTtlEnv: 'ROUTE_CACHE_PEAK_HOUR_TTL_SECONDS',
    peakHourStaleEnv: 'ROUTE_CACHE_PEAK_HOUR_STALE_GRACE_SECONDS',
    peakHourTtlFallback: 300, // 5 minutes during peak hours
    peakHourStaleFallback: 420, // 7 minute stale grace during peak hours
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

// Time-based utility functions for peak hour detection
export function isPeakHour(now: DateTime): boolean {
  // Convert to PST (UTC-8) and check if hour is 18 (6PM)
  const pstHour = now.setZone('America/Los_Angeles').hour;
  return pstHour === 18; // 6PM PST
}

export function getEffectiveTtlSeconds(config: CacheEntryConfig, now: DateTime): { ttlSeconds: number; staleGraceSeconds: number } {
  if (config.peakHourTtlSeconds && config.peakHourStaleGraceSeconds && isPeakHour(now)) {
    return {
      ttlSeconds: config.peakHourTtlSeconds,
      staleGraceSeconds: config.peakHourStaleGraceSeconds,
    };
  }
  
  return {
    ttlSeconds: config.baseTtlSeconds,
    staleGraceSeconds: config.staleGraceSeconds,
  };
}
