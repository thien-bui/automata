import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type Redis from 'ioredis';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/adapters/discord', () => ({
  fetchDiscordGuildStatus: vi.fn(),
}));

import { registerDiscord, type DiscordResponse } from '../src/routes/discord';
import { fetchDiscordGuildStatus } from '../src/adapters/discord';
import type { DiscordGuildStatus } from '../src/adapters/discord';

type MockRedis = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

async function buildTestApp(redis: MockRedis): Promise<FastifyInstance> {
  const app = Fastify();
  app.decorate('redis', redis as unknown as Redis);
  await app.register(registerDiscord, { prefix: '/api' });
  await app.ready();
  return app;
}

describe('discord route caching', () => {
  const mockedFetch = vi.mocked(fetchDiscordGuildStatus);
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

  it('returns cached guild status when entry is fresh', async () => {
    const cachedAt = DateTime.utc().minus({ seconds: 10 });
    const cachedAtIso = cachedAt.toISO();
    if (!cachedAtIso) {
      throw new Error('failed to build cachedAtIso');
    }

    const cachedPayload: DiscordGuildStatus = {
      guildId: 'guild-123',
      guildName: 'My Guild',
      totalMembers: 10,
      onlineMembers: 5,
      members: [],
      lastUpdatedIso: cachedAtIso,
    };

    const redis: MockRedis = {
      get: vi.fn().mockResolvedValue(JSON.stringify({
        payload: cachedPayload,
        cachedAtIso,
      })),
      set: vi.fn(),
    };

    app = await buildTestApp(redis);

    const response = await app.inject({
      method: 'GET',
      url: '/api/discord-status',
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<DiscordResponse>();
    expect(body.guildId).toBe(cachedPayload.guildId);
    expect(body.cache.hit).toBe(true);
    expect(body.cache.staleWhileRevalidate).toBe(false);
    expect(body.cache.ageSeconds).toBeGreaterThanOrEqual(0);

    expect(mockedFetch).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('fetches guild status and caches result on cache miss', async () => {
    const redis: MockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
    };

    const providerResult: DiscordGuildStatus = {
      guildId: 'guild-456',
      guildName: 'Another Guild',
      totalMembers: 20,
      onlineMembers: 11,
      members: [],
      lastUpdatedIso: DateTime.utc().toISO() ?? new Date().toISOString(),
    };

    mockedFetch.mockResolvedValueOnce(providerResult);

    app = await buildTestApp(redis);

    const response = await app.inject({
      method: 'GET',
      url: '/api/discord-status',
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<DiscordResponse>();
    expect(body.guildId).toBe(providerResult.guildId);
    expect(body.cache.hit).toBe(false);
    expect(body.cache.staleWhileRevalidate).toBe(false);
    expect(body.cache.ageSeconds).toBe(0);
    expect(DateTime.fromISO(body.lastUpdatedIso).isValid).toBe(true);

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledTimes(1);

    const [, cacheValueJson, mode, ttl] = redis.set.mock.calls[0];
    expect(mode).toBe('EX');
    expect(typeof ttl).toBe('number');

    const cacheValue = JSON.parse(cacheValueJson as string) as {
      payload: Omit<DiscordGuildStatus, 'cache'>;
      cachedAtIso: string;
    };
    expect(cacheValue.payload.guildId).toBe(providerResult.guildId);
    expect(cacheValue.cachedAtIso).toBe(body.lastUpdatedIso);
  });

  it('returns stale cache when provider fails within grace window', async () => {
    const cachedAt = DateTime.utc().minus({ seconds: 330 });
    const cachedAtIso = cachedAt.toISO();
    if (!cachedAtIso) {
      throw new Error('failed to build cachedAtIso');
    }

    const cachedPayload: DiscordGuildStatus = {
      guildId: 'guild-stale',
      guildName: 'Stale Guild',
      totalMembers: 50,
      onlineMembers: 25,
      members: [],
      lastUpdatedIso: cachedAtIso,
    };

    const redis: MockRedis = {
      get: vi.fn().mockResolvedValue(JSON.stringify({
        payload: cachedPayload,
        cachedAtIso,
      })),
      set: vi.fn(),
    };

    mockedFetch.mockRejectedValueOnce(new Error('provider unavailable'));

    app = await buildTestApp(redis);

    const response = await app.inject({
      method: 'GET',
      url: '/api/discord-status',
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<DiscordResponse>();
    expect(body.guildId).toBe(cachedPayload.guildId);
    expect(body.cache.hit).toBe(true);
    expect(body.cache.staleWhileRevalidate).toBe(true);
    expect(body.cache.ageSeconds).toBeGreaterThanOrEqual(300);

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(redis.set).not.toHaveBeenCalled();
  });
});
