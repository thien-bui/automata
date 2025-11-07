import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type Redis from 'ioredis';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { 
  AlertThresholdResponse, 
  AlertThresholdUpdateRequest,
  RouteAlertResponse,
  RouteTimeResponse,
  AlertAcknowledgeRequest
} from '@automata/types';

type MockRedis = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  keys: ReturnType<typeof vi.fn>;
};

async function buildTestApp(redis: MockRedis): Promise<FastifyInstance> {
  const app = Fastify();
  app.decorate('redis', redis as unknown as Redis);
  await app.register(import('../src/routes/alert'), { prefix: '/api' });
  await app.ready();
  return app;
}

describe('alert route', () => {
  let app: FastifyInstance | null = null;
  let mockRedis: MockRedis;

  beforeEach(() => {
    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
    };
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  describe('GET /alerts/threshold', () => {
    it('returns default threshold when no cached value exists', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/alerts/threshold',
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json<AlertThresholdResponse>();
      expect(body.thresholdMinutes).toBe(45); // DEFAULT_THRESHOLD_MINUTES
      expect(body.defaultThresholdMinutes).toBe(45);
      expect(body.minThresholdMinutes).toBe(5);
      expect(body.maxThresholdMinutes).toBe(1440);
      expect(body.lastUpdatedIso).toBeDefined();
      expect(DateTime.fromISO(body.lastUpdatedIso).isValid).toBe(true);

      expect(mockRedis.get).toHaveBeenCalledWith('alert:threshold:current');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'alert:threshold:current',
        '45',
        'EX',
        3600
      );
    });

    it('returns cached threshold when valid value exists', async () => {
      mockRedis.get.mockResolvedValue('60');
      mockRedis.set.mockResolvedValue('OK');

      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/alerts/threshold',
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json<AlertThresholdResponse>();
      expect(body.thresholdMinutes).toBe(60);
      expect(body.defaultThresholdMinutes).toBe(45);

      expect(mockRedis.get).toHaveBeenCalledWith('alert:threshold:current');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'alert:threshold:current',
        '60',
        'EX',
        3600
      );
    });

    it('returns default threshold when cached value is invalid', async () => {
      mockRedis.get.mockResolvedValue('invalid');
      mockRedis.set.mockResolvedValue('OK');

      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/alerts/threshold',
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json<AlertThresholdResponse>();
      expect(body.thresholdMinutes).toBe(45); // Falls back to default
    });

    it('ignores cache when forceRefresh is true', async () => {
      mockRedis.get.mockResolvedValue('60');
      mockRedis.set.mockResolvedValue('OK');

      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/alerts/threshold?forceRefresh=true',
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json<AlertThresholdResponse>();
      expect(body.thresholdMinutes).toBe(45); // Should use default, not cached

      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalledWith(
        'alert:threshold:current',
        '45',
        'EX',
        3600
      );
    });

    it('handles Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
      mockRedis.set.mockResolvedValue('OK');

      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/alerts/threshold',
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json<AlertThresholdResponse>();
      expect(body.thresholdMinutes).toBe(45); // Falls back to default
    });

    it('handles timestamp generation gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);

      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/alerts/threshold',
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json<AlertThresholdResponse>();
      expect(body.lastUpdatedIso).toBeDefined();
      expect(DateTime.fromISO(body.lastUpdatedIso).isValid).toBe(true);
    });
  });

  describe('POST /alerts/threshold', () => {
    it('updates threshold successfully', async () => {
      mockRedis.set.mockResolvedValue('OK');

      app = await buildTestApp(mockRedis);

      const payload: AlertThresholdUpdateRequest = {
        thresholdMinutes: 60,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts/threshold',
        payload,
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.message).toBe('Alert threshold updated successfully');
      expect(body.thresholdMinutes).toBe(60);
      expect(body.lastUpdatedIso).toBeDefined();
      expect(DateTime.fromISO(body.lastUpdatedIso).isValid).toBe(true);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'alert:threshold:current',
        '60',
        'EX',
        86400
      );
    });

    it('returns 400 error for invalid threshold (too low)', async () => {
      app = await buildTestApp(mockRedis);

      const payload: AlertThresholdUpdateRequest = {
        thresholdMinutes: 3, // Below MIN_THRESHOLD_MINUTES (5)
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts/threshold',
        payload,
      });

      expect(response.statusCode).toBe(400);
      
      const body = response.json();
      expect(body.error).toBe('Bad Request');
      expect(body.message).toContain('thresholdMinutes');
    });

    it('returns 400 error for invalid threshold (too high)', async () => {
      app = await buildTestApp(mockRedis);

      const payload: AlertThresholdUpdateRequest = {
        thresholdMinutes: 2000, // Above MAX_THRESHOLD_MINUTES (1440)
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts/threshold',
        payload,
      });

      expect(response.statusCode).toBe(400);
      
      const body = response.json();
      expect(body.error).toBe('Bad Request');
      expect(body.message).toContain('thresholdMinutes');
    });

    it('returns 400 error for missing thresholdMinutes', async () => {
      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts/threshold',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      
      const body = response.json();
      expect(body.error).toBe('Bad Request');
      expect(body.message).toContain('thresholdMinutes');
    });

    it('handles Redis errors gracefully during update', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis connection failed'));

      app = await buildTestApp(mockRedis);

      const payload: AlertThresholdUpdateRequest = {
        thresholdMinutes: 60,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts/threshold',
        payload,
      });

      expect(response.statusCode).toBe(200); // Still succeeds, just logs warning
      
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.thresholdMinutes).toBe(60);
    });

    it('handles timestamp generation gracefully in POST', async () => {
      mockRedis.set.mockResolvedValue('OK');

      app = await buildTestApp(mockRedis);

      const payload: AlertThresholdUpdateRequest = {
        thresholdMinutes: 60,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts/threshold',
        payload,
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.lastUpdatedIso).toBeDefined();
      expect(DateTime.fromISO(body.lastUpdatedIso).isValid).toBe(true);
    });
  });

  describe('GET /alerts/route', () => {
    const mockRouteData: RouteTimeResponse = {
      durationMinutes: 50,
      distanceKm: 10,
      provider: 'google-directions',
      mode: 'driving',
      lastUpdatedIso: '2024-01-01T12:00:00.000Z',
      cache: {
        hit: false,
        ageSeconds: 0,
        staleWhileRevalidate: false,
      },
    };

    it('generates alert when route duration exceeds threshold', async () => {
      mockRedis.get.mockResolvedValue('45'); // Current threshold

      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'GET',
        url: `/api/alerts/route?routeData=${encodeURIComponent(JSON.stringify(mockRouteData))}`,
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json<RouteAlertResponse>();
      expect(body.alerts).toHaveLength(1);
      expect(body.totalCount).toBe(1);
      expect(body.unacknowledgedCount).toBe(1);
      
      const alert = body.alerts[0];
      expect(alert.message).toContain('Travel time 50.0 min exceeds threshold of 45 min');
      expect(alert.routeData).toEqual(mockRouteData);
      expect(alert.thresholdMinutes).toBe(45);
      expect(alert.acknowledged).toBe(false);
      expect(alert.createdAtIso).toBeDefined();
    });

    it('generates compact alert message when compactMode is true', async () => {
      mockRedis.get.mockResolvedValue('45');

      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'GET',
        url: `/api/alerts/route?routeData=${encodeURIComponent(JSON.stringify(mockRouteData))}&compactMode=true`,
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json<RouteAlertResponse>();
      expect(body.alerts).toHaveLength(1);
      
      const alert = body.alerts[0];
      expect(alert.message).toBe('Travel time 50.0 min exceeds threshold of 45 min.');
    });

    it('returns no alerts when route duration is within threshold', async () => {
      const shortRouteData: RouteTimeResponse = {
        ...mockRouteData,
        durationMinutes: 30,
      };

      mockRedis.get.mockResolvedValue('45');

      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'GET',
        url: `/api/alerts/route?routeData=${encodeURIComponent(JSON.stringify(shortRouteData))}`,
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json<RouteAlertResponse>();
      expect(body.alerts).toHaveLength(0);
      expect(body.totalCount).toBe(0);
      expect(body.unacknowledgedCount).toBe(0);
    });

    it('uses provided thresholdMinutes parameter', async () => {
      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'GET',
        url: `/api/alerts/route?routeData=${encodeURIComponent(JSON.stringify(mockRouteData))}&thresholdMinutes=55`,
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json<RouteAlertResponse>();
      expect(body.alerts).toHaveLength(0); // 50 < 55, so no alert
      
      // Redis should still be called for acknowledgment check
      expect(mockRedis.get).toHaveBeenCalledTimes(1);
    });

    it('filters out acknowledged alerts', async () => {
      mockRedis.get
        .mockResolvedValueOnce('45') // For threshold lookup
        .mockResolvedValueOnce('true'); // For acknowledged check

      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'GET',
        url: `/api/alerts/route?routeData=${encodeURIComponent(JSON.stringify(mockRouteData))}`,
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json<RouteAlertResponse>();
      expect(body.alerts).toHaveLength(0); // Alert filtered out due to acknowledgment
      expect(body.totalCount).toBe(1); // Still counts total alerts generated
      expect(body.unacknowledgedCount).toBe(0);
    });

    it('returns 400 error when routeData is missing', async () => {
      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/alerts/route',
      });

      expect(response.statusCode).toBe(400);
      
      const body = response.json();
      expect(body.error).toBe('Validation failed');
      expect(body.code).toBe('INVALID_REQUEST');
      expect(body.message).toBe('Missing required routeData parameter');
    });

    it('returns 400 error when routeData is invalid JSON', async () => {
      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'GET',
        url: '/api/alerts/route?routeData=invalid-json',
      });

      expect(response.statusCode).toBe(400);
      
      const body = response.json();
      expect(body.error).toBe('Validation failed');
      expect(body.code).toBe('INVALID_REQUEST');
      expect(body.message).toBe('Invalid routeData JSON format');
    });

    it('returns 400 error when routeData is missing required fields', async () => {
      const incompleteRouteData = {
        distanceKm: 10,
        // Missing durationMinutes and lastUpdatedIso
      };

      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'GET',
        url: `/api/alerts/route?routeData=${encodeURIComponent(JSON.stringify(incompleteRouteData))}`,
      });

      expect(response.statusCode).toBe(400);
      
      const body = response.json();
      expect(body.error).toBe('Validation failed');
      expect(body.code).toBe('INVALID_REQUEST');
      expect(body.message).toBe('Invalid routeData structure: missing required fields');
    });

    it('returns 400 error when thresholdMinutes is invalid', async () => {
      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'GET',
        url: `/api/alerts/route?routeData=${encodeURIComponent(JSON.stringify(mockRouteData))}&thresholdMinutes=3`,
      });

      expect(response.statusCode).toBe(400);
      
      const body = response.json();
      expect(body.error).toBe('Validation failed');
      expect(body.code).toBe('INVALID_REQUEST');
      expect(body.message).toContain('Threshold must be between 5 and 1440 minutes');
    });

    it('falls back to default threshold when Redis fails', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'GET',
        url: `/api/alerts/route?routeData=${encodeURIComponent(JSON.stringify(mockRouteData))}`,
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json<RouteAlertResponse>();
      expect(body.alerts).toHaveLength(1); // Should use default threshold of 45
      
      const alert = body.alerts[0];
      expect(alert.thresholdMinutes).toBe(45);
    });

    it('returns 500 error when timestamp generation fails', async () => {
      // Mock DateTime.utc().toISO() to return null
      const originalToISO = DateTime.prototype.toISO;
      vi.spyOn(DateTime.prototype, 'toISO').mockReturnValue(null);

      mockRedis.get.mockResolvedValue('45');

      app = await buildTestApp(mockRedis);

      const response = await app.inject({
        method: 'GET',
        url: `/api/alerts/route?routeData=${encodeURIComponent(JSON.stringify(mockRouteData))}`,
      });

      expect(response.statusCode).toBe(500);
      
      const body = response.json();
      expect(body.code).toBe('INTERNAL_ERROR');
      expect(body.message).toBe('Unexpected server error.');

      // Restore original method
      DateTime.prototype.toISO = originalToISO;
    });
  });

  describe('POST /alerts/acknowledge', () => {
    it('acknowledges all alerts when acknowledgeAll is true', async () => {
      mockRedis.keys.mockResolvedValue(['alert:acknowledged:key1', 'alert:acknowledged:key2']);
      mockRedis.del.mockResolvedValue(2);

      app = await buildTestApp(mockRedis);

      const payload: AlertAcknowledgeRequest = {
        acknowledgeAll: true,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts/acknowledge',
        payload,
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.message).toBe('Successfully acknowledged 2 alerts');
      expect(body.acknowledgedCount).toBe(2);
      expect(body.lastUpdatedIso).toBeDefined();

      expect(mockRedis.keys).toHaveBeenCalledWith('alert:acknowledged:*');
      expect(mockRedis.del).toHaveBeenCalledWith('alert:acknowledged:key1', 'alert:acknowledged:key2');
    });

    it('acknowledges specific alert IDs', async () => {
      mockRedis.set.mockResolvedValue('OK');

      app = await buildTestApp(mockRedis);

      const payload: AlertAcknowledgeRequest = {
        alertIds: [1, 2, 3],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts/acknowledge',
        payload,
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.message).toBe('Successfully acknowledged 3 alerts');
      expect(body.acknowledgedCount).toBe(3);

      expect(mockRedis.set).toHaveBeenCalledTimes(3);
      expect(mockRedis.set).toHaveBeenCalledWith('alert:acknowledged:generic:1', 'true', 'EX', 86400);
      expect(mockRedis.set).toHaveBeenCalledWith('alert:acknowledged:generic:2', 'true', 'EX', 86400);
      expect(mockRedis.set).toHaveBeenCalledWith('alert:acknowledged:generic:3', 'true', 'EX', 86400);
    });

    it('returns 400 error when neither alertIds nor acknowledgeAll is provided', async () => {
      app = await buildTestApp(mockRedis);

      const payload: AlertAcknowledgeRequest = {};

      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts/acknowledge',
        payload,
      });

      expect(response.statusCode).toBe(400);
      
      const body = response.json();
      expect(body.error).toBe('Validation failed');
      expect(body.code).toBe('INVALID_REQUEST');
      expect(body.message).toBe('Either alertIds or acknowledgeAll must be provided');
    });

    it('handles empty alertIds array gracefully', async () => {
      app = await buildTestApp(mockRedis);

      const payload: AlertAcknowledgeRequest = {
        alertIds: [],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts/acknowledge',
        payload,
      });

      expect(response.statusCode).toBe(400);
      
      const body = response.json();
      expect(body.error).toBe('Validation failed');
      expect(body.code).toBe('INVALID_REQUEST');
      expect(body.message).toBe('Either alertIds or acknowledgeAll must be provided');
    });

    it('handles Redis errors during acknowledgment gracefully', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis connection failed'));

      app = await buildTestApp(mockRedis);

      const payload: AlertAcknowledgeRequest = {
        alertIds: [1, 2],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts/acknowledge',
        payload,
      });

      expect(response.statusCode).toBe(200); // Still succeeds, just logs warnings
      
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.acknowledgedCount).toBe(0); // No acknowledgments succeeded
    });

    it('handles partial failures during specific alert acknowledgment', async () => {
      mockRedis.set
        .mockResolvedValueOnce('OK') // First alert succeeds
        .mockRejectedValueOnce(new Error('Redis failed')) // Second alert fails
        .mockResolvedValueOnce('OK'); // Third alert succeeds

      app = await buildTestApp(mockRedis);

      const payload: AlertAcknowledgeRequest = {
        alertIds: [1, 2, 3],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts/acknowledge',
        payload,
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.acknowledgedCount).toBe(2); // Only 2 out of 3 succeeded
    });

    it('handles timestamp generation gracefully in acknowledge', async () => {
      mockRedis.keys.mockResolvedValue([]);

      app = await buildTestApp(mockRedis);

      const payload: AlertAcknowledgeRequest = {
        acknowledgeAll: true,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/alerts/acknowledge',
        payload,
      });

      expect(response.statusCode).toBe(200);
      
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.lastUpdatedIso).toBeDefined();
      expect(DateTime.fromISO(body.lastUpdatedIso).isValid).toBe(true);
    });
  });
});
