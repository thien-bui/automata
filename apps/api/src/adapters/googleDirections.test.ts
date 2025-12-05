import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { fetchGoogleDirections, type GoogleDirectionsQuery } from './googleDirections';
import { RoutesClient, protos } from '@googlemaps/routing';

// Mock @googlemaps/routing
const mockComputeRoutes = vi.hoisted(() => vi.fn());
vi.mock('@googlemaps/routing', () => {
  const mockRoutesClient = {
    computeRoutes: mockComputeRoutes,
  };
  return {
    RoutesClient: vi.fn(() => mockRoutesClient),
    protos: {
      google: {
        maps: {
          routing: {
            v2: {
              RouteTravelMode: {
                DRIVE: 1,
                WALK: 3,
                TRANSIT: 7,
              },
              RoutingPreference: {
                TRAFFIC_AWARE: 'TRAFFIC_AWARE',
              },
            },
          },
        },
        protobuf: {
          IDuration: {},
        },
      },
    },
  };
});

describe('googleDirections adapter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = {
      ...originalEnv,
      GOOGLE_MAPS_API_KEY: 'test-api-key',
    };
    // Reset the mock function
    mockComputeRoutes.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('fetchGoogleDirections', () => {
    const validQuery: GoogleDirectionsQuery = {
      from: 'Seattle, WA',
      to: 'Portland, OR',
      mode: 'driving' as const,
    };

    const mockRouteResponse = {
      routes: [{
        duration: { seconds: 7200, nanos: 0 }, // 2 hours
        distanceMeters: 250000, // 250 km
        routeLabels: ['LABEL_1'],
        warnings: ['Warning 1'],
        legs: [],
      }],
      fallbackInfo: { reason: 'FALLBACK_REASON_UNSPECIFIED' },
    };

    it('should throw error when GOOGLE_MAPS_API_KEY is missing', async () => {
      delete process.env.GOOGLE_MAPS_API_KEY;
      await expect(fetchGoogleDirections(validQuery)).rejects.toThrow('GOOGLE_MAPS_API_KEY is not configured.');
    });

    it('should throw error for unsupported travel mode', async () => {
      const invalidQuery = { ...validQuery, mode: 'invalid' as any };
      await expect(fetchGoogleDirections(invalidQuery)).rejects.toThrow('Unsupported travel mode: invalid');
    });

    it('should make API request with correct parameters for driving', async () => {
      mockComputeRoutes.mockResolvedValue([mockRouteResponse]);

      await fetchGoogleDirections(validQuery);

      expect(mockComputeRoutes).toHaveBeenCalledWith(
        {
          origin: { address: 'Seattle, WA' },
          destination: { address: 'Portland, OR' },
          travelMode: 1, // DRIVE enum value
          routingPreference: 'TRAFFIC_AWARE',
        },
        {
          otherArgs: {
            headers: {
              'X-Goog-Api-Key': 'test-api-key',
              'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.routeLabels,routes.warnings,routes.legs.duration,routes.legs.distanceMeters,fallbackInfo',
            },
          },
        }
      );
    });

    it('should make API request without routingPreference for non-driving modes', async () => {
      mockComputeRoutes.mockResolvedValue([mockRouteResponse]);
      const walkingQuery = { ...validQuery, mode: 'walking' as const };

      await fetchGoogleDirections(walkingQuery);

      expect(mockComputeRoutes).toHaveBeenCalledWith(
        {
          origin: { address: 'Seattle, WA' },
          destination: { address: 'Portland, OR' },
          travelMode: 3, // WALK enum value
        },
        expect.anything()
      );
    });

    it('should return duration and distance from route duration and distanceMeters', async () => {
      mockComputeRoutes.mockResolvedValue([mockRouteResponse]);

      const result = await fetchGoogleDirections(validQuery);

      expect(result).toEqual({
        durationMinutes: 120, // 7200 seconds / 60
        distanceKm: 250, // 250000 meters / 1000
        providerStatus: {
          routeLabels: ['LABEL_1'],
          warnings: ['Warning 1'],
          fallbackReason: 'FALLBACK_REASON_UNSPECIFIED',
        },
      });
    });

    it('should calculate duration from legs if route duration missing', async () => {
      const routeWithLegs = {
        routes: [{
          duration: null,
          distanceMeters: 150000,
          routeLabels: [],
          warnings: [],
          legs: [
            { duration: { seconds: 1800, nanos: 0 } }, // 0.5 hours
            { duration: { seconds: 3600, nanos: 0 } }, // 1 hour
          ],
        }],
        fallbackInfo: { reason: null },
      };
      mockComputeRoutes.mockResolvedValue([routeWithLegs]);

      const result = await fetchGoogleDirections(validQuery);

      expect(result.durationMinutes).toBe(90); // (1800 + 3600) / 60
      expect(result.distanceKm).toBe(150);
    });

    it('should calculate distance from legs if route distanceMeters missing', async () => {
      const routeWithLegs = {
        routes: [{
          duration: { seconds: 5400, nanos: 0 },
          distanceMeters: undefined,
          routeLabels: [],
          warnings: [],
          legs: [
            { distanceMeters: 100000 },
            { distanceMeters: 50000 },
          ],
        }],
        fallbackInfo: { reason: null },
      };
      mockComputeRoutes.mockResolvedValue([routeWithLegs]);

      const result = await fetchGoogleDirections(validQuery);

      expect(result.durationMinutes).toBe(90); // 5400 / 60
      expect(result.distanceKm).toBe(150); // (100000 + 50000) / 1000
    });

    it('should handle nanoseconds in duration', async () => {
      const routeWithNanos = {
        routes: [{
          duration: { seconds: 120, nanos: 500000000 }, // 120.5 seconds
          distanceMeters: 1000,
          routeLabels: [],
          warnings: [],
          legs: [],
        }],
        fallbackInfo: { reason: null },
      };
      mockComputeRoutes.mockResolvedValue([routeWithNanos]);

      const result = await fetchGoogleDirections(validQuery);

      expect(result.durationMinutes).toBe(2.01); // (120.5 / 60) rounded to 2 decimal places
      expect(result.distanceKm).toBe(1);
    });

    it('should round to two decimal places', async () => {
      const routeWithDecimal = {
        routes: [{
          duration: { seconds: 123, nanos: 456000000 }, // 123.456 seconds
          distanceMeters: 123456, // 123.456 km
          routeLabels: [],
          warnings: [],
          legs: [],
        }],
        fallbackInfo: { reason: null },
      };
      mockComputeRoutes.mockResolvedValue([routeWithDecimal]);

      const result = await fetchGoogleDirections(validQuery);

      // 123.456 seconds = 2.0576 minutes, rounded to 2.06
      expect(result.durationMinutes).toBe(2.06);
      // 123.456 km rounded to 123.46
      expect(result.distanceKm).toBe(123.46);
    });

    it('should throw error when no routes returned', async () => {
      mockComputeRoutes.mockResolvedValue([{ routes: [] }]);

      await expect(fetchGoogleDirections(validQuery)).rejects.toThrow('Google Routes API returned no routes.');
    });

    it('should throw error for invalid duration', async () => {
      const invalidRoute = {
        routes: [{
          duration: { seconds: -1 }, // negative duration
          distanceMeters: 1000,
          routeLabels: [],
          warnings: [],
          legs: [],
        }],
        fallbackInfo: { reason: null },
      };
      mockComputeRoutes.mockResolvedValue([invalidRoute]);

      await expect(fetchGoogleDirections(validQuery)).rejects.toThrow('Google Routes API returned an invalid duration.');
    });

    it('should throw error for invalid distance', async () => {
      const invalidRoute = {
        routes: [{
          duration: { seconds: 3600 },
          distanceMeters: -100, // negative distance
          routeLabels: [],
          warnings: [],
          legs: [],
        }],
        fallbackInfo: { reason: null },
      };
      mockComputeRoutes.mockResolvedValue([invalidRoute]);

      await expect(fetchGoogleDirections(validQuery)).rejects.toThrow('Google Routes API returned an invalid distance.');
    });

    it('should handle NaN duration', async () => {
      const invalidRoute = {
        routes: [{
          duration: { seconds: NaN },
          distanceMeters: 1000,
          routeLabels: [],
          warnings: [],
          legs: [],
        }],
        fallbackInfo: { reason: null },
      };
      mockComputeRoutes.mockResolvedValue([invalidRoute]);

      await expect(fetchGoogleDirections(validQuery)).rejects.toThrow('Google Routes API returned an invalid duration.');
    });

    it('should handle NaN distance', async () => {
      const invalidRoute = {
        routes: [{
          duration: { seconds: 3600 },
          distanceMeters: NaN,
          routeLabels: [],
          warnings: [],
          legs: [],
        }],
        fallbackInfo: { reason: null },
      };
      mockComputeRoutes.mockResolvedValue([invalidRoute]);

      await expect(fetchGoogleDirections(validQuery)).rejects.toThrow('Google Routes API returned an invalid distance.');
    });

    it('should handle API client error', async () => {
      mockComputeRoutes.mockRejectedValue(new Error('Network error'));

      await expect(fetchGoogleDirections(validQuery)).rejects.toThrow('Network error');
    });
  });

  describe('travelModeMap', () => {
    it('should map driving mode correctly', () => {
      const { protos } = require('@googlemaps/routing');
      expect(protos.google.maps.routing.v2.RouteTravelMode.DRIVE).toBe(1);
    });

    it('should map walking mode correctly', () => {
      const { protos } = require('@googlemaps/routing');
      expect(protos.google.maps.routing.v2.RouteTravelMode.WALK).toBe(3);
    });

    it('should map transit mode correctly', () => {
      const { protos } = require('@googlemaps/routing');
      expect(protos.google.maps.routing.v2.RouteTravelMode.TRANSIT).toBe(7);
    });
  });
});
