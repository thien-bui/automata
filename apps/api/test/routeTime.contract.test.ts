import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/adapters/googleDirections', () => ({
  fetchGoogleDirections: vi.fn(),
}));

import type { FastifyInstance } from 'fastify';
import type { RouteTimeResponse } from '@automata/types';
import type Redis from 'ioredis';

import { fetchGoogleDirections } from '../src/adapters/googleDirections';
import { registerRouteTime } from '../src/routes/routeTime';

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

describe('/api/route-time contract', () => {
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

  it('fetches provider on cache miss and stores response payload', async () => {
    vi.useFakeTimers();
    const now = new Date('2024-05-01T12:00:00.000Z');
    vi.setSystemTime(now);

    const redis: MockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
    };

    const providerResult = {
      durationMinutes: 22,
      distanceKm: 18.4,
      providerStatus: { routeLabels: [], warnings: [] },
    };

    mockedFetch.mockResolvedValueOnce(providerResult);

    app = await buildTestApp(redis);

    const response = await app.inject({
      method: 'GET',
      url: '/api/route-time?from=Start&to=Finish&mode=walking',
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<RouteTimeResponse>();

    expect(body).toMatchObject({
      durationMinutes: providerResult.durationMinutes,
      distanceKm: providerResult.distanceKm,
      mode: 'walking',
      provider: 'google-directions',
      cache: {
        hit: false,
        ageSeconds: 0,
        staleWhileRevalidate: false,
      },
    });

    expect(body.lastUpdatedIso).toBe(now.toISOString());

    expect(mockedFetch).toHaveBeenCalledWith({
      from: 'Start',
      to: 'Finish',
      mode: 'walking',
    });

    expect(redis.get).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledTimes(1);

    const expireSeconds = Number(process.env.ROUTE_CACHE_TTL_SECONDS ?? '300') +
      Number(process.env.ROUTE_CACHE_STALE_GRACE_SECONDS ?? '120');

    const [cacheKey, storedValue, expiryMode, ttlSeconds] = redis.set.mock.calls[0];

    expect(cacheKey).toMatch(/^route:walking:/);
    expect(expiryMode).toBe('EX');
    expect(ttlSeconds).toBe(expireSeconds);

    const persisted = JSON.parse(storedValue as string) as {
      payload: Omit<RouteTimeResponse, 'cache'>;
      cachedAtIso: string;
    };

    expect(persisted.cachedAtIso).toBe(now.toISOString());
    expect(persisted.payload.durationMinutes).toBe(providerResult.durationMinutes);
    expect(persisted.payload.distanceKm).toBe(providerResult.distanceKm);
    expect(persisted.payload.provider).toBe('google-directions');
    expect(persisted.payload.mode).toBe('walking');

    expect(redis.get.mock.calls[0][0]).toBe(cacheKey);
  });
});
