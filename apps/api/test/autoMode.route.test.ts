import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type Redis from 'ioredis';
import { registerAutoMode } from '../src/routes/autoMode';
import type { AutoModeConfig } from '@automata/types';
import type { ApiErrorPayload } from '../src/utils/errors';

type MockRedis = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

async function buildTestApp(redis: MockRedis): Promise<FastifyInstance> {
  const app = Fastify();
  app.decorate('redis', redis as unknown as Redis);
  app.log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as any;
  await app.register(registerAutoMode, { prefix: '/api' });
  await app.ready();
  return app;
}

describe('autoMode route', () => {
  let app: FastifyInstance | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  describe('GET /auto-mode/status', () => {
    it('should return current auto-mode status with default config when Redis is empty', async () => {
      const redis: MockRedis = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue('OK'),
      };

      app = await buildTestApp(redis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/auto-mode/status',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body).toHaveProperty('currentMode');
      expect(body).toHaveProperty('config');
      expect(body).toHaveProperty('lastUpdatedIso');
      expect(['Compact', 'Nav']).toContain(body.currentMode);
      expect(body.config).toHaveProperty('enabled');
      expect(body.config).toHaveProperty('timeWindows');
      expect(body.config).toHaveProperty('defaultMode');
      expect(body.config).toHaveProperty('navModeRefreshSeconds');
      expect(redis.get).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledTimes(1);
    });

    it('should return cached config from Redis when available', async () => {
      const cachedConfig: AutoModeConfig = {
        enabled: true,
        timeWindows: [
          {
            name: 'test-window',
            mode: 'Nav',
            startTime: { hour: 10, minute: 0 },
            endTime: { hour: 11, minute: 0 },
            daysOfWeek: [1],
            description: 'Test window',
          },
        ],
        defaultMode: 'Compact',
        navModeRefreshSeconds: 300,
      };

      const redis: MockRedis = {
        get: vi.fn().mockResolvedValue(JSON.stringify(cachedConfig)),
        set: vi.fn().mockResolvedValue('OK'),
      };

      app = await buildTestApp(redis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/auto-mode/status',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.config).toEqual(cachedConfig);
      expect(redis.get).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledTimes(1);
    });

    it('should bypass cache and use default config when forceRefresh is true', async () => {
      const cachedConfig: AutoModeConfig = {
        enabled: false,
        timeWindows: [],
        defaultMode: 'Compact',
        navModeRefreshSeconds: 300,
      };

      const redis: MockRedis = {
        get: vi.fn().mockResolvedValue(JSON.stringify(cachedConfig)),
        set: vi.fn().mockResolvedValue('OK'),
      };

      app = await buildTestApp(redis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/auto-mode/status?forceRefresh=true',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      // Should use default config, not cached config
      expect(body.config.enabled).toBe(true);
      expect(body.config.timeWindows.length).toBeGreaterThan(0);
      expect(redis.get).not.toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid query parameters', async () => {
      const redis: MockRedis = {
        get: vi.fn(),
        set: vi.fn(),
      };

      app = await buildTestApp(redis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/auto-mode/status?forceRefresh=invalid',
      });

      expect(response.statusCode).toBe(400);

      const payload = response.json<ApiErrorPayload>();

      expect(payload.code).toBe('FST_ERR_VALIDATION');
      expect(payload.message).toContain('querystring');
      expect(redis.get).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('should handle Redis read errors gracefully', async () => {
      const redis: MockRedis = {
        get: vi.fn().mockRejectedValue(new Error('Redis connection failed')),
        set: vi.fn().mockResolvedValue('OK'),
      };

      app = await buildTestApp(redis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/auto-mode/status',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      // Should fall back to default config
      expect(body).toHaveProperty('currentMode');
      expect(body).toHaveProperty('config');
      expect(redis.get).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledTimes(1);
    });

    it('should handle Redis write errors gracefully', async () => {
      const redis: MockRedis = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockRejectedValue(new Error('Redis write failed')),
      };

      app = await buildTestApp(redis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/auto-mode/status',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body).toHaveProperty('currentMode');
      expect(body).toHaveProperty('config');
      expect(redis.get).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledTimes(1);
    });

    it('should handle malformed cached config gracefully', async () => {
      const redis: MockRedis = {
        get: vi.fn().mockResolvedValue('{"invalid": "json"'),
        set: vi.fn().mockResolvedValue('OK'),
      };

      app = await buildTestApp(redis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/auto-mode/status',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      // Should fall back to default config
      expect(body).toHaveProperty('currentMode');
      expect(body).toHaveProperty('config');
      expect(redis.get).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /auto-mode/config', () => {
    it('should update auto-mode configuration successfully', async () => {
      const redis: MockRedis = {
        get: vi.fn(),
        set: vi.fn().mockResolvedValue('OK'),
      };

      app = await buildTestApp(redis);

      const newConfig: AutoModeConfig = {
        enabled: true,
        timeWindows: [
          {
            name: 'test-window',
            mode: 'Nav',
            startTime: { hour: 12, minute: 0 },
            endTime: { hour: 13, minute: 0 },
            daysOfWeek: [1, 2, 3],
            description: 'Lunch break',
          },
        ],
        defaultMode: 'Compact',
        navModeRefreshSeconds: 600,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/auto-mode/config',
        payload: { config: newConfig },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.success).toBe(true);
      expect(body.message).toContain('updated successfully');
      expect(body.config).toEqual(newConfig);
      expect(body).toHaveProperty('lastUpdatedIso');
      expect(redis.set).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid request body', async () => {
      const redis: MockRedis = {
        get: vi.fn(),
        set: vi.fn(),
      };

      app = await buildTestApp(redis);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auto-mode/config',
        payload: { invalid: 'data' },
      });

      expect(response.statusCode).toBe(400);

      const payload = response.json<ApiErrorPayload>();

      expect(payload.code).toBe('FST_ERR_VALIDATION');
      expect(payload.message).toContain('body');
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('should handle validation errors in config', async () => {
      const redis: MockRedis = {
        get: vi.fn(),
        set: vi.fn(),
      };

      app = await buildTestApp(redis);

      const invalidConfig = {
        enabled: 'true', // Should be boolean
        timeWindows: [], // Empty but valid
        defaultMode: 'InvalidMode', // Invalid mode
        navModeRefreshSeconds: 30, // Too low
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/auto-mode/config',
        payload: { config: invalidConfig },
      });

      expect(response.statusCode).toBe(400);

      const payload = response.json<ApiErrorPayload>();

      expect(payload.code).toBe('FST_ERR_VALIDATION');
      expect(payload.message).toContain('body');
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('should handle Redis write errors gracefully', async () => {
      const redis: MockRedis = {
        get: vi.fn(),
        set: vi.fn().mockRejectedValue(new Error('Redis write failed')),
      };

      app = await buildTestApp(redis);

      const newConfig: AutoModeConfig = {
        enabled: true,
        timeWindows: [],
        defaultMode: 'Compact',
        navModeRefreshSeconds: 300,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/auto-mode/config',
        payload: { config: newConfig },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.success).toBe(true);
      expect(body.config).toEqual(newConfig);
      expect(redis.set).toHaveBeenCalledTimes(1);
    });
  });
});
