import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { fetchGoogleWeather, type GoogleWeatherQuery } from './googleWeather';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('googleWeather adapter', () => {
  const originalEnv = process.env;
  const validQuery: GoogleWeatherQuery = { location: 'Seattle, WA' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = {
      ...originalEnv,
      GOOGLE_WEATHER_API_KEY: 'test-weather-key',
      WEATHER_LATITUDE: '47.6062',
      WEATHER_LONGITUDE: '-122.3321',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('fetchGoogleWeather', () => {
    const mockHistoryResponse = {
      historyHours: [
        {
          interval: { startTime: '2024-01-01T00:00:00Z' },
          temperature: { unit: 'CELSIUS', degrees: 10.5 },
          weatherCondition: { description: { text: 'Partly cloudy', languageCode: 'en' }, type: 'PARTLY_CLOUDY' },
          relativeHumidity: 65,
          wind: { speed: { unit: 'KILOMETERS_PER_HOUR', value: 15.3 } },
          precipitation: { probability: { type: 'PERCENT', percent: 20 } },
        },
        {
          interval: { startTime: '2024-01-01T01:00:00Z' },
          temperature: { unit: 'CELSIUS', degrees: 9.8 },
          weatherCondition: { description: { text: 'Clear', languageCode: 'en' }, type: 'CLEAR' },
          relativeHumidity: 70,
          wind: { speed: { unit: 'KILOMETERS_PER_HOUR', value: 12.1 } },
          precipitation: { probability: { type: 'PERCENT', percent: 10 } },
        },
      ],
    };

    const mockForecastResponse = {
      forecastHours: [
        {
          interval: { startTime: '2024-01-01T02:00:00Z' },
          temperature: { unit: 'CELSIUS', degrees: 8.5 },
          weatherCondition: { description: { text: 'Rain', languageCode: 'en' }, type: 'RAIN' },
          relativeHumidity: 85,
          wind: { speed: { unit: 'KILOMETERS_PER_HOUR', value: 20.5 } },
          precipitation: { probability: { type: 'PERCENT', percent: 90 } },
        },
        {
          interval: { startTime: '2024-01-01T03:00:00Z' },
          temperature: { unit: 'CELSIUS', degrees: 7.2 },
          weatherCondition: { description: { text: 'Light rain', languageCode: 'en' }, type: 'LIGHT_RAIN' },
          relativeHumidity: 88,
          wind: { speed: { unit: 'KILOMETERS_PER_HOUR', value: 18.2 } },
          precipitation: { probability: { type: 'PERCENT', percent: 80 } },
        },
      ],
    };

    it('should throw error when GOOGLE_WEATHER_API_KEY is missing', async () => {
      delete process.env.GOOGLE_WEATHER_API_KEY;
      await expect(fetchGoogleWeather(validQuery)).rejects.toThrow('GOOGLE_WEATHER_API_KEY is not configured.');
    });

    it('should make parallel API calls for historical and forecast data', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockHistoryResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockForecastResponse),
        });

      const result = await fetchGoogleWeather(validQuery);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      const historyUrl = 'https://weather.googleapis.com/v1/history/hours:lookup?key=test-weather-key&location.latitude=47.6062&location.longitude=-122.3321&hours=3';
      const forecastUrl = 'https://weather.googleapis.com/v1/forecast/hours:lookup?key=test-weather-key&location.latitude=47.6062&location.longitude=-122.3321&hours=12';
      
      expect(mockFetch).toHaveBeenCalledWith(historyUrl);
      expect(mockFetch).toHaveBeenCalledWith(forecastUrl);
      
      expect(result).toEqual({
        hourlyData: [
          {
            timestamp: '2024-01-01T00:00:00Z',
            temperatureCelsius: 10.5,
            temperatureFahrenheit: 50.9, // (10.5 * 9/5 + 32) = 50.9, rounded to 1 decimal = 50.9
            condition: 'Partly cloudy',
            humidityPercent: 65,
            windSpeedKph: 15.3,
            precipitationProbability: 20,
          },
          {
            timestamp: '2024-01-01T01:00:00Z',
            temperatureCelsius: 9.8,
            temperatureFahrenheit: 49.6, // (9.8 * 9/5 + 32) = 49.64, rounded to 1 decimal = 49.6
            condition: 'Clear',
            humidityPercent: 70,
            windSpeedKph: 12.1,
            precipitationProbability: 10,
          },
          {
            timestamp: '2024-01-01T02:00:00Z',
            temperatureCelsius: 8.5,
            temperatureFahrenheit: 47.3, // (8.5 * 9/5 + 32) = 47.3, rounded to 1 decimal = 47.3
            condition: 'Rain',
            humidityPercent: 85,
            windSpeedKph: 20.5,
            precipitationProbability: 90,
          },
          {
            timestamp: '2024-01-01T03:00:00Z',
            temperatureCelsius: 7.2,
            temperatureFahrenheit: 45, // (7.2 * 9/5 + 32) = 44.96, rounded to 1 decimal = 45.0 (represented as 45)
            condition: 'Light rain',
            humidityPercent: 88,
            windSpeedKph: 18.2,
            precipitationProbability: 80,
          },
        ],
        provider: 'google-weather',
        lastUpdatedIso: expect.any(String),
      });
    });

    it('should sort combined data chronologically', async () => {
      // Provide data out of order
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            historyHours: [
              {
                interval: { startTime: '2024-01-01T02:00:00Z' },
                temperature: { unit: 'CELSIUS', degrees: 8.5 },
                weatherCondition: { description: { text: 'Rain', languageCode: 'en' }, type: 'RAIN' },
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            forecastHours: [
              {
                interval: { startTime: '2024-01-01T01:00:00Z' },
                temperature: { unit: 'CELSIUS', degrees: 9.8 },
                weatherCondition: { description: { text: 'Clear', languageCode: 'en' }, type: 'CLEAR' },
              },
            ],
          }),
        });

      const result = await fetchGoogleWeather(validQuery);

      // Should be sorted by timestamp
      expect(result.hourlyData[0].timestamp).toBe('2024-01-01T01:00:00Z');
      expect(result.hourlyData[1].timestamp).toBe('2024-01-01T02:00:00Z');
    });

    it('should handle missing optional fields in API response', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            historyHours: [
              {
                interval: { startTime: '2024-01-01T00:00:00Z' },
                temperature: { unit: 'CELSIUS', degrees: 10.5 },
                weatherCondition: { description: { text: 'Partly cloudy', languageCode: 'en' }, type: 'PARTLY_CLOUDY' },
                // No humidity, wind, precipitation
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            forecastHours: [
              {
                interval: { startTime: '2024-01-01T01:00:00Z' },
                temperature: { unit: 'CELSIUS', degrees: 9.8 },
                weatherCondition: { description: { text: 'Clear', languageCode: 'en' }, type: 'CLEAR' },
                // No humidity, wind, precipitation
              },
            ],
          }),
        });

      const result = await fetchGoogleWeather(validQuery);

      expect(result.hourlyData[0]).toEqual({
        timestamp: '2024-01-01T00:00:00Z',
        temperatureCelsius: 10.5,
        temperatureFahrenheit: 50.9,
        condition: 'Partly cloudy',
        humidityPercent: undefined,
        windSpeedKph: undefined,
        precipitationProbability: undefined,
      });
    });

    it('should handle non-KILOMETERS_PER_HOUR wind speed unit', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            historyHours: [
              {
                interval: { startTime: '2024-01-01T00:00:00Z' },
                temperature: { unit: 'CELSIUS', degrees: 10.5 },
                weatherCondition: { description: { text: 'Partly cloudy', languageCode: 'en' }, type: 'PARTLY_CLOUDY' },
                wind: { speed: { unit: 'MILES_PER_HOUR', value: 10 } },
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            forecastHours: [],
          }),
        });

      const result = await fetchGoogleWeather(validQuery);

      expect(result.hourlyData[0].windSpeedKph).toBeUndefined();
    });

    it('should use default coordinates when environment variables are not set', async () => {
      delete process.env.WEATHER_LATITUDE;
      delete process.env.WEATHER_LONGITUDE;

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ historyHours: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ forecastHours: [] }),
        });

      await fetchGoogleWeather(validQuery);

      // Should use defaults from code: latitude=47.3809335, longitude=-122.2348431
      const expectedUrl = 'https://weather.googleapis.com/v1/history/hours:lookup?key=test-weather-key&location.latitude=47.3809335&location.longitude=-122.2348431&hours=3';
      expect(mockFetch).toHaveBeenCalledWith(expectedUrl);
    });

    it('should throw error when historical API request fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ forecastHours: [] }),
        });

      await expect(fetchGoogleWeather(validQuery)).rejects.toThrow(
        'Google Weather History API request failed: 500 Internal Server Error'
      );
    });

    it('should throw error when forecast API request fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ historyHours: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });

      await expect(fetchGoogleWeather(validQuery)).rejects.toThrow(
        'Google Weather API request failed: 404 Not Found'
      );
    });

    it('should throw error when historical response has invalid format', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ invalid: 'data' }), // Missing historyHours
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ forecastHours: [] }),
        });

      await expect(fetchGoogleWeather(validQuery)).rejects.toThrow(
        'Invalid historical weather data response from Google Weather API'
      );
    });

    it('should throw error when forecast response has invalid format', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ historyHours: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ invalid: 'data' }), // Missing forecastHours
        });

      await expect(fetchGoogleWeather(validQuery)).rejects.toThrow(
        'Invalid weather data response from Google Weather API'
      );
    });

    it('should handle empty data arrays', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ historyHours: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ forecastHours: [] }),
        });

      const result = await fetchGoogleWeather(validQuery);

      expect(result.hourlyData).toEqual([]);
      expect(result.provider).toBe('google-weather');
      expect(result.lastUpdatedIso).toBeDefined();
    });

    it('should handle missing weatherCondition description', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            historyHours: [
              {
                interval: { startTime: '2024-01-01T00:00:00Z' },
                temperature: { unit: 'CELSIUS', degrees: 10.5 },
                // No weatherCondition
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            forecastHours: [],
          }),
        });

      const result = await fetchGoogleWeather(validQuery);

      expect(result.hourlyData[0].condition).toBe('unknown');
    });

    it('should handle missing weatherCondition entirely', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            historyHours: [
              {
                interval: { startTime: '2024-01-01T00:00:00Z' },
                temperature: { unit: 'CELSIUS', degrees: 10.5 },
                // No weatherCondition property
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            forecastHours: [],
          }),
        });

      const result = await fetchGoogleWeather(validQuery);

      expect(result.hourlyData[0].condition).toBe('unknown');
    });

    it('should handle missing precipitation probability', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            historyHours: [
              {
                interval: { startTime: '2024-01-01T00:00:00Z' },
                temperature: { unit: 'CELSIUS', degrees: 10.5 },
                weatherCondition: { description: { text: 'Clear', languageCode: 'en' }, type: 'CLEAR' },
                // No precipitation property
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            forecastHours: [],
          }),
        });

      const result = await fetchGoogleWeather(validQuery);

      expect(result.hourlyData[0].precipitationProbability).toBeUndefined();
    });
  });
});
