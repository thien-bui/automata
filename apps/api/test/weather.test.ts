import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildServer } from '../src/server';
import { fetchGoogleWeather } from '../src/adapters/googleWeather';

describe('Weather API', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeEach(async () => {
    app = buildServer();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/weather', () => {
    it('should return validation error for missing location', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/weather',
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.code).toBe('INVALID_REQUEST');
      expect(payload.message).toContain('Invalid query parameters');
    });

    it('should return validation error for empty location', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/weather?location=',
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.code).toBe('INVALID_REQUEST');
    });

    it('should handle weather API errors gracefully', async () => {
      // Mock the environment to have no API key
      const originalApiKey = process.env.VITE_GOOGLE_WEATHER_API_KEY;
      delete process.env.VITE_GOOGLE_WEATHER_API_KEY;

      const response = await app.inject({
        method: 'GET',
        url: '/api/weather?location=New York',
      });

      expect(response.statusCode).toBe(502);
      const payload = JSON.parse(response.payload);
      expect(payload.code).toBe('PROVIDER_ERROR');

      // Restore the original API key
      if (originalApiKey) {
        process.env.VITE_GOOGLE_WEATHER_API_KEY = originalApiKey;
      }
    });
  });

  describe('fetchGoogleWeather', () => {
    it('should throw error when API key is missing', async () => {
      const originalApiKey = process.env.VITE_GOOGLE_WEATHER_API_KEY;
      delete process.env.VITE_GOOGLE_WEATHER_API_KEY;

      await expect(fetchGoogleWeather({ location: 'New York' })).rejects.toThrow(
        'VITE_GOOGLE_WEATHER_API_KEY is not configured.'
      );

      // Restore the original API key
      if (originalApiKey) {
        process.env.VITE_GOOGLE_WEATHER_API_KEY = originalApiKey;
      }
    });
  });
});
