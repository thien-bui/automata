import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/adapters/googleWeather', () => ({
  fetchGoogleWeather: vi.fn(),
}));

import type { FastifyInstance } from 'fastify';
import type { WeatherResponse } from '@automata/types';
import type Redis from 'ioredis';

import { fetchGoogleWeather } from '../src/adapters/googleWeather';
import { cacheConfig } from '../src/config/cache';
import { registerWeather } from '../src/routes/weather';
import type { ApiErrorPayload } from '../src/utils/errors';

type MockRedis = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

async function buildTestApp(redis: MockRedis): Promise<FastifyInstance> {
  const app = Fastify();
  app.decorate('redis', redis as unknown as Redis);
  await app.register(registerWeather, { prefix: '/api' });
  await app.ready();
  return app;
}

function buildCachedRecord(
  payload: Omit<WeatherResponse, 'cache'>,
  cachedAtIso: string,
): {
  payload: Omit<WeatherResponse, 'cache'>;
  cachedAtIso: string;
} {
  return {
    payload,
    cachedAtIso,
  };
}

function buildWeatherPayload(
  overrides: Partial<Omit<WeatherResponse, 'cache'>> = {},
): Omit<WeatherResponse, 'cache'> {
  return {
    hourlyData: [
      {
        timestamp: '2024-05-01T12:00:00.000Z',
        temperatureCelsius: 21.5,
        temperatureFahrenheit: 70.7,
        condition: 'Sunny',
        humidityPercent: 55,
        precipitationProbability: 0.1,
      },
    ],
    provider: 'google-weather',
    lastUpdatedIso: '2024-05-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('weather route', () => {
  const mockedFetch = vi.mocked(fetchGoogleWeather);
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

  describe('validation', () => {
    it('returns validation error for missing location', async () => {
      const redis: MockRedis = {
        get: vi.fn(),
        set: vi.fn(),
      };

      app = await buildTestApp(redis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/weather',
      });

      expect(response.statusCode).toBe(400);

      const payload = response.json<ApiErrorPayload>();

      expect(payload.code).toBe('INVALID_REQUEST');
      expect(payload.message).toContain('Invalid query parameters');
      expect(redis.get).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('returns validation error for empty location', async () => {
      const redis: MockRedis = {
        get: vi.fn(),
        set: vi.fn(),
      };

      app = await buildTestApp(redis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/weather?location=',
      });

      expect(response.statusCode).toBe(400);

      const payload = response.json<ApiErrorPayload>();

      expect(payload.code).toBe('INVALID_REQUEST');
      expect(payload.message).toContain('Invalid query parameters');
      expect(redis.get).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe('cache behaviour', () => {
    it('fetches provider on cache miss and stores response payload', async () => {
      vi.useFakeTimers();
      const now = new Date('2024-05-01T12:00:00.000Z');
      vi.setSystemTime(now);

      const redis: MockRedis = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue('OK'),
      };

      const providerResult = {
        hourlyData: [
          {
            timestamp: '2024-05-01T12:00:00.000Z',
            temperatureCelsius: 21.5,
            temperatureFahrenheit: 70.7,
            condition: 'Sunny',
            humidityPercent: 48,
            precipitationProbability: 0.2,
          },
        ],
        provider: 'google-weather' as const,
        lastUpdatedIso: '2024-05-01T11:59:00.000Z',
      };

      mockedFetch.mockResolvedValueOnce(providerResult);

      app = await buildTestApp(redis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/weather?location=Seattle',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json<WeatherResponse>();

      expect(body).toMatchObject({
        hourlyData: providerResult.hourlyData,
        provider: 'google-weather',
        cache: {
          hit: false,
          ageSeconds: 0,
          staleWhileRevalidate: false,
        },
      });
      expect(body.lastUpdatedIso).toBe(now.toISOString());

      expect(mockedFetch).toHaveBeenCalledWith({ location: 'Seattle' });
      expect(redis.get).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledTimes(1);

      const [cacheKey, serialized, expiryMode, ttlSeconds] = redis.set.mock.calls[0];

      expect(cacheKey).toMatch(/^weather:/);
      expect(redis.get.mock.calls[0][0]).toBe(cacheKey);
      expect(expiryMode).toBe('EX');
      expect(ttlSeconds).toBe(cacheConfig.weather.redisExpireSeconds);

      const persisted = JSON.parse(serialized as string) as {
        payload: Omit<WeatherResponse, 'cache'>;
        cachedAtIso: string;
      };

      expect(persisted.cachedAtIso).toBe(body.lastUpdatedIso);
      expect(persisted.payload.hourlyData).toEqual(providerResult.hourlyData);
    });

    it('returns cached entry when within freshness window', async () => {
      vi.useFakeTimers();
      const now = new Date('2024-05-01T15:00:00.000Z');
      vi.setSystemTime(now);

      const cachedAtIso = new Date(now.getTime() - 30_000).toISOString();
      const cachedPayload = buildWeatherPayload({ lastUpdatedIso: cachedAtIso });
      const cachedRecord = buildCachedRecord(cachedPayload, cachedAtIso);

      const redis: MockRedis = {
        get: vi.fn().mockResolvedValue(JSON.stringify(cachedRecord)),
        set: vi.fn(),
      };

      app = await buildTestApp(redis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/weather?location=Seattle',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json<WeatherResponse>();

      expect(body.cache.hit).toBe(true);
      expect(body.cache.ageSeconds).toBe(30);
      expect(body.cache.staleWhileRevalidate).toBe(false);
      expect(mockedFetch).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('bypasses cache when forceRefresh is true', async () => {
      vi.useFakeTimers();
      const now = new Date('2024-05-02T08:00:00.000Z');
      vi.setSystemTime(now);

      const cachedPayload = buildWeatherPayload({ lastUpdatedIso: now.toISOString() });
      const cachedRecord = buildCachedRecord(cachedPayload, now.toISOString());

      const redis: MockRedis = {
        get: vi.fn().mockResolvedValue(JSON.stringify(cachedRecord)),
        set: vi.fn().mockResolvedValue('OK'),
      };

      const providerResult = {
        hourlyData: [
          {
            timestamp: '2024-05-02T08:00:00.000Z',
            temperatureCelsius: 18.2,
            temperatureFahrenheit: 64.8,
            condition: 'Cloudy',
            humidityPercent: 60,
            precipitationProbability: 0.3,
          },
        ],
        provider: 'google-weather' as const,
        lastUpdatedIso: '2024-05-02T07:55:00.000Z',
      };

      mockedFetch.mockResolvedValueOnce(providerResult);

      app = await buildTestApp(redis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/weather?location=Seattle&forceRefresh=true',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json<WeatherResponse>();

      expect(body.cache.hit).toBe(false);
      expect(body.cache.ageSeconds).toBe(0);
      expect(body.hourlyData).toEqual(providerResult.hourlyData);

      expect(mockedFetch).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledTimes(1);
    });

    it('returns stale cache when provider fails within grace period', async () => {
      vi.useFakeTimers();
      const now = new Date('2024-05-03T09:00:00.000Z');
      vi.setSystemTime(now);

      const cachedAtIso = new Date(now.getTime() - 240_000).toISOString();
      const cachedPayload = buildWeatherPayload({ lastUpdatedIso: cachedAtIso });
      const cachedRecord = buildCachedRecord(cachedPayload, cachedAtIso);

      const redis: MockRedis = {
        get: vi.fn().mockResolvedValue(JSON.stringify(cachedRecord)),
        set: vi.fn(),
      };

      mockedFetch.mockRejectedValueOnce(new Error('provider failure'));

      app = await buildTestApp(redis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/weather?location=Seattle&freshnessSeconds=180',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json<WeatherResponse>();

      expect(body.cache.hit).toBe(true);
      expect(body.cache.staleWhileRevalidate).toBe(true);
      expect(body.cache.ageSeconds).toBe(240);
      expect(body.lastUpdatedIso).toBe(cachedAtIso);

      expect(redis.set).not.toHaveBeenCalled();
      expect(mockedFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('returns provider error when provider fails without cache', async () => {
      const redis: MockRedis = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn(),
      };

      mockedFetch.mockRejectedValueOnce(new Error('provider failure'));

      app = await buildTestApp(redis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/weather?location=Seattle',
      });

      expect(response.statusCode).toBe(502);

      const payload = response.json<ApiErrorPayload>();

      expect(payload.code).toBe('PROVIDER_ERROR');
      expect(payload.message).toContain('Failed to fetch weather information from provider');
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('falls back to provider when Redis read fails', async () => {
      vi.useFakeTimers();
      const now = new Date('2024-05-04T10:00:00.000Z');
      vi.setSystemTime(now);

      const redis: MockRedis = {
        get: vi.fn().mockRejectedValue(new Error('redis unavailable')),
        set: vi.fn().mockResolvedValue('OK'),
      };

      const providerResult = {
        hourlyData: [
          {
            timestamp: '2024-05-04T10:00:00.000Z',
            temperatureCelsius: 23.4,
            temperatureFahrenheit: 74.1,
            condition: 'Clear',
            humidityPercent: 42,
            precipitationProbability: 0.05,
          },
        ],
        provider: 'google-weather' as const,
        lastUpdatedIso: '2024-05-04T09:59:00.000Z',
      };

      mockedFetch.mockResolvedValueOnce(providerResult);

      app = await buildTestApp(redis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/weather?location=Seattle',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json<WeatherResponse>();

      expect(body.cache.hit).toBe(false);
      expect(mockedFetch).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledTimes(1);
    });

    it('treats malformed cached entries as cache misses', async () => {
      vi.useFakeTimers();
      const now = new Date('2024-05-05T11:30:00.000Z');
      vi.setSystemTime(now);

      const redis: MockRedis = {
        get: vi.fn().mockResolvedValue('{"invalid":'),
        set: vi.fn().mockResolvedValue('OK'),
      };

      const providerResult = {
        hourlyData: [
          {
            timestamp: '2024-05-05T11:30:00.000Z',
            temperatureCelsius: 16.1,
            temperatureFahrenheit: 61.0,
            condition: 'Rain',
            humidityPercent: 70,
            precipitationProbability: 0.6,
          },
        ],
        provider: 'google-weather' as const,
        lastUpdatedIso: '2024-05-05T11:25:00.000Z',
      };

      mockedFetch.mockResolvedValueOnce(providerResult);

      app = await buildTestApp(redis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/weather?location=Seattle',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json<WeatherResponse>();

      expect(body.cache.hit).toBe(false);
      expect(mockedFetch).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchGoogleWeather adapter', () => {
    it('throws an error when API key is missing', async () => {
      const originalApiKey = process.env.GOOGLE_WEATHER_API_KEY;
      delete process.env.GOOGLE_WEATHER_API_KEY;

      const actualModule = await vi.importActual<typeof import('../src/adapters/googleWeather')>(
        '../src/adapters/googleWeather',
      );

      await expect(actualModule.fetchGoogleWeather({ location: 'New York' })).rejects.toThrow(
        'GOOGLE_WEATHER_API_KEY is not configured.',
      );

      if (originalApiKey) {
        process.env.GOOGLE_WEATHER_API_KEY = originalApiKey;
      } else {
        delete process.env.GOOGLE_WEATHER_API_KEY;
      }
    });
  });
});
