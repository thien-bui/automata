import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../src/server';

describe('alert route', () => {
  let app: ReturnType<typeof buildServer>;

  beforeEach(async () => {
    app = buildServer({ redisUrl: 'redis://localhost:6379' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/alerts/threshold', () => {
    it('should return default alert threshold configuration', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/alerts/threshold',
      });

      expect(response.statusCode).toBe(200);
      
      const data = JSON.parse(response.payload);
      expect(data).toMatchObject({
        thresholdMinutes: 45,
        defaultThresholdMinutes: 45,
        minThresholdMinutes: 5,
        maxThresholdMinutes: 1440,
      });
      expect(data).toHaveProperty('lastUpdatedIso');
      expect(typeof data.lastUpdatedIso).toBe('string');
    });

    it('should handle forceRefresh parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/alerts/threshold?forceRefresh=true',
      });

      expect(response.statusCode).toBe(200);
      
      const data = JSON.parse(response.payload);
      expect(data).toMatchObject({
        thresholdMinutes: 45,
        defaultThresholdMinutes: 45,
        minThresholdMinutes: 5,
        maxThresholdMinutes: 1440,
      });
    });
  });

  describe('POST /api/alerts/threshold', () => {
    it('should update alert threshold', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts/threshold',
        payload: {
          thresholdMinutes: 60,
        },
      });

      expect(response.statusCode).toBe(200);
      
      const data = JSON.parse(response.payload);
      expect(data).toMatchObject({
        success: true,
        message: 'Alert threshold updated successfully',
        thresholdMinutes: 60,
      });
      expect(data).toHaveProperty('lastUpdatedIso');
    });

    it('should validate threshold bounds', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts/threshold',
        payload: {
          thresholdMinutes: 2, // Below minimum
        },
      });

      expect(response.statusCode).toBe(400);
      
      const data = JSON.parse(response.payload);
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('code');
      expect(data).toHaveProperty('message');
    });

    it('should validate threshold upper bounds', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts/threshold',
        payload: {
          thresholdMinutes: 2000, // Above maximum
        },
      });

      expect(response.statusCode).toBe(400);
      
      const data = JSON.parse(response.payload);
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('code');
      expect(data).toHaveProperty('message');
    });
  });
});
