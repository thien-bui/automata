import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/adapters/googleDirections', () => ({
  fetchGoogleDirections: vi.fn(),
}));

import type { FastifyInstance } from 'fastify';
import type { RouteMode, RouteTimeResponse } from '@automata/types';

import { fetchGoogleDirections } from '../src/adapters/googleDirections';
import { registerRouteTime } from '../src/routes/routeTime';

type MockRedis = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

async function buildTestApp(redis: MockRedis): Promise<FastifyInstance> {
  const app = Fastify();
  app.decorate('redis', redis as any);
  await app.register(registerRouteTime, { prefix: '/api' });
  await app.ready();
  return app;
}

function buildCachedRecord(
  payload: Omit<RouteTimeResponse, 'cache'>,
  cachedAtIso: string,
) {
  return {
    payload,
    cachedAtIso,
  };
}

describe('route-time cache behaviour', () => {
  const mockedFetch = vi.mocked(fetchGoogleDirections);
  const basePayload: Omit<RouteTimeResponse, 'cache'> = {
    durationMinutes: 15,
    distanceKm: 12.5,
    provider: 'google-directions',
    mode: 'driving' as RouteMode,
    lastUpdatedIso: new Date().toISOString(),
  };

  let app: FastifyInstance | null = null;

  beforeEach(() => {
    mockedFetch.mockReset();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it('returns fresh cached entry without calling provider', async () => {
    const cachedRecord = buildCachedRecord(basePayload, new Date().toISOString());

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
    expect(body.cache.staleWhileRevalidate).toBe(false);
    expect(body.durationMinutes).toBe(basePayload.durationMinutes);
    expect(body.distanceKm).toBe(basePayload.distanceKm);

    expect(redis.set).not.toHaveBeenCalled();
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('bypasses fresh cache when forceRefresh is true', async () => {
    const cachedRecord = buildCachedRecord(basePayload, new Date().toISOString());

    const redis: MockRedis = {
      get: vi.fn().mockResolvedValue(JSON.stringify(cachedRecord)),
      set: vi.fn(),
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
  });

  it('returns stale cache when provider fails within grace period', async () => {
    const cachedAt = new Date(Date.now() - 90_000).toISOString();
    const cachedRecord = buildCachedRecord({
      ...basePayload,
      lastUpdatedIso: cachedAt,
    }, cachedAt);

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
    expect(body.cache.ageSeconds).toBeGreaterThanOrEqual(90);
    expect(body.lastUpdatedIso).toBe(cachedAt);

    expect(redis.set).not.toHaveBeenCalled();
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });
});
