import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/adapters/googleDirections', () => ({
  fetchGoogleDirections: vi.fn(),
}));

import type { FastifyInstance } from 'fastify';
import type { RouteMode, RouteTimeResponse } from '@automata/types';
import type Redis from 'ioredis';

import { fetchGoogleDirections } from '../src/adapters/googleDirections';
import { registerRouteTime } from '../src/routes/routeTime';
import type { ApiErrorPayload } from '../src/utils/errors';

type MockRedis = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

async function buildTestApp(redis: MockRedis): Promise<FastifyInstance> {
  const app = Fastify();
  app.decorate('redis', redis as unknown as Redis);
  await app.register(registerRouteTime, { prefix: '/api' });
  await app.ready();
  return app;
}

function buildCachedRecord(
  payload: Omit<RouteTimeResponse, 'cache'>,
  cachedAtIso: string,
): {
  payload: Omit<RouteTimeResponse, 'cache'>;
  cachedAtIso: string;
} {
  return {
    payload,
    cachedAtIso,
  };
}

function buildBasePayload(
  overrides: Partial<Omit<RouteTimeResponse, 'cache'>> = {},
): Omit<RouteTimeResponse, 'cache'> {
  return {
    durationMinutes: 15,
    distanceKm: 12.5,
    provider: 'google-directions',
    mode: 'driving' as RouteMode,
    lastUpdatedIso: new Date().toISOString(),
    ...overrides,
  };
}

describe('route-time cache behaviour', () => {
  const mockedFetch = vi.mocked(fetchGoogleDirections);
  let app: FastifyInstance | null = null;

  beforeEach(() => {
    mockedFetch.mockReset();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    vi.useRealTimers();
  });

  it('returns fresh cached entry without calling provider', async () => {
    vi.useFakeTimers();
    const now = new Date('2024-05-01T12:00:00.000Z');
    vi.setSystemTime(now);

    const cachedPayload = buildBasePayload({ lastUpdatedIso: now.toISOString() });
    const cachedRecord = buildCachedRecord(cachedPayload, now.toISOString());

    const redis: MockRedis = {
      get: vi.fn().mockResolvedValue(JSON.stringify(cachedRecord)),
      set: vi.fn(),
    };

    app = await buildTestApp(redis);

    const response = await app.inject({
      method: 'GET',
      url: '/api/route-time?from=A&to=B&mode=driving',
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<RouteTimeResponse>();

    expect(body.cache.hit).toBe(true);
    expect(body.cache.ageSeconds).toBe(0);
    expect(body.cache.staleWhileRevalidate).toBe(false);
    expect(body.durationMinutes).toBe(cachedPayload.durationMinutes);
    expect(body.distanceKm).toBe(cachedPayload.distanceKm);

    expect(redis.set).not.toHaveBeenCalled();
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('bypasses fresh cache when forceRefresh is true', async () => {
    vi.useFakeTimers();
    const now = new Date('2024-05-01T13:00:00.000Z');
    vi.setSystemTime(now);

    const cachedPayload = buildBasePayload({ lastUpdatedIso: now.toISOString() });
    const cachedRecord = buildCachedRecord(cachedPayload, now.toISOString());

    const redis: MockRedis = {
      get: vi.fn().mockResolvedValue(JSON.stringify(cachedRecord)),
      set: vi.fn().mockResolvedValue('OK'),
    };

    mockedFetch.mockResolvedValueOnce({
      durationMinutes: 9,
      distanceKm: 7.5,
      providerStatus: null,
    });

    app = await buildTestApp(redis);

    const response = await app.inject({
      method: 'GET',
      url: '/api/route-time?from=A&to=B&mode=driving&forceRefresh=true',
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<RouteTimeResponse>();

    expect(body.cache.hit).toBe(false);
    expect(body.cache.ageSeconds).toBe(0);
    expect(body.durationMinutes).toBe(9);
    expect(body.distanceKm).toBe(7.5);

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledTimes(1);

    const [cacheKey, serialized, expiryMode, ttlSeconds] = redis.set.mock.calls[0];

    expect(cacheKey).toMatch(/^route:driving:/);
    expect(redis.get.mock.calls[0][0]).toBe(cacheKey);
    expect(expiryMode).toBe('EX');
    expect(typeof ttlSeconds).toBe('number');

    const persisted = JSON.parse(serialized as string) as {
      payload: Omit<RouteTimeResponse, 'cache'>;
      cachedAtIso: string;
    };

    expect(persisted.cachedAtIso).toBe(body.lastUpdatedIso);
    expect(persisted.payload.durationMinutes).toBe(9);
  });

  it('returns stale cache when provider fails within grace period', async () => {
    vi.useFakeTimers();
    const now = new Date('2024-05-01T12:00:00.000Z');
    vi.setSystemTime(now);

    const cachedAt = new Date(now.getTime() - 90_000).toISOString();
    const cachedPayload = buildBasePayload({ lastUpdatedIso: cachedAt });
    const cachedRecord = buildCachedRecord(cachedPayload, cachedAt);

    const redis: MockRedis = {
      get: vi.fn().mockResolvedValue(JSON.stringify(cachedRecord)),
      set: vi.fn(),
    };

    mockedFetch.mockRejectedValueOnce(new Error('provider failure'));

    app = await buildTestApp(redis);

    const response = await app.inject({
      method: 'GET',
      url: '/api/route-time?from=A&to=B&mode=driving&freshnessSeconds=60',
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<RouteTimeResponse>();

    expect(body.cache.hit).toBe(true);
    expect(body.cache.staleWhileRevalidate).toBe(true);
    expect(body.cache.ageSeconds).toBe(90);
    expect(body.lastUpdatedIso).toBe(cachedAt);

    expect(redis.set).not.toHaveBeenCalled();
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('returns provider error when fetch fails and no usable cache exists', async () => {
    const redis: MockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
    };

    mockedFetch.mockRejectedValueOnce(new Error('provider failure'));

    app = await buildTestApp(redis);

    const response = await app.inject({
      method: 'GET',
      url: '/api/route-time?from=A&to=B&mode=walking',
    });

    expect(response.statusCode).toBe(502);

    const body = response.json<ApiErrorPayload>();

    expect(body.code).toBe('PROVIDER_ERROR');
    expect(body.message).toContain('Failed to fetch route information from provider');

    expect(redis.set).not.toHaveBeenCalled();
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('treats malformed cache entries as misses', async () => {
    vi.useFakeTimers();
    const now = new Date('2024-05-01T10:00:00.000Z');
    vi.setSystemTime(now);

    const redis: MockRedis = {
      get: vi.fn().mockResolvedValue('this is not json'),
      set: vi.fn().mockResolvedValue('OK'),
    };

    mockedFetch.mockResolvedValueOnce({
      durationMinutes: 12,
      distanceKm: 10.2,
      providerStatus: { warnings: [] },
    });

    app = await buildTestApp(redis);

    const response = await app.inject({
      method: 'GET',
      url: '/api/route-time?from=C&to=D&mode=transit',
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<RouteTimeResponse>();

    expect(body.cache.hit).toBe(false);
    expect(body.mode).toBe('transit');

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledTimes(1);

    const [cacheKey, serialized] = redis.set.mock.calls[0];

    expect(cacheKey).toMatch(/^route:transit:/);

    const persisted = JSON.parse(serialized as string) as {
      payload: Omit<RouteTimeResponse, 'cache'>;
      cachedAtIso: string;
    };

    expect(persisted.cachedAtIso).toBe(body.lastUpdatedIso);
    expect(persisted.payload.mode).toBe('transit');
    expect(persisted.payload.durationMinutes).toBe(12);
  });
});
