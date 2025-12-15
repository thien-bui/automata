import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigService } from './configService';
import type { 
  AppConfigResponse, 
  WeatherConfig, 
  DiscordConfig, 
  AutoModeConfig, 
  UiPreferencesState,
  ConfigUpdateRequest
} from '@automata/types';
import { DateTime } from 'luxon';

describe('ConfigService', () => {
  let configService: ConfigService;

  beforeEach(() => {
    configService = new ConfigService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('getDefaultConfig', () => {
    it('should return default configuration', () => {
      const config = configService.getDefaultConfig();

      // Check weather config
      expect(config.weather.defaultLocation).toBe('Kent, WA');
      expect(config.weather.defaultRefreshSeconds).toBe(300);
      expect(config.weather.minRefreshSeconds).toBe(60);
      expect(config.weather.maxRefreshSeconds).toBe(3600);
      expect(config.weather.displaySettings.showHourlyForecast).toBe(true);
      expect(config.weather.displaySettings.temperatureUnit).toBe('both');

      // Check discord config
      expect(config.discord.defaultRefreshSeconds).toBe(300);
      expect(config.discord.displaySettings.showBots).toBe(false);
      expect(config.discord.displaySettings.groupByStatus).toBe(true);

      // Check autoMode config
      expect(config.autoMode.enabled).toBe(true);
      expect(config.autoMode.timeWindows).toHaveLength(2);
      expect(config.autoMode.defaultMode).toBe('Compact');
      expect(config.autoMode.navModeRefreshSeconds).toBe(300);

      // Check ui config
      expect(config.ui.compactMode).toBe(true);
      expect(config.ui.widgetCompactModes).toEqual({});
    });

    it('should return new object instances each time', () => {
      const config1 = configService.getDefaultConfig();
      const config2 = configService.getDefaultConfig();

      expect(config1).not.toBe(config2); // Different object references
      expect(config1).toEqual(config2); // Same values

      // Modify config1 and ensure config2 is unaffected
      config1.weather.defaultLocation = 'New Location';
      expect(config2.weather.defaultLocation).toBe('Kent, WA');
    });
  });

  describe('getCurrentTimestamp', () => {
    it('should return ISO timestamp', () => {
      const mockDate = DateTime.utc(2024, 1, 1, 12, 0, 0) as DateTime<true>;
      vi.spyOn(DateTime, 'utc').mockReturnValue(mockDate);

      const timestamp = configService.getCurrentTimestamp();
      expect(timestamp).toBe(mockDate.toISO());
    });

    it('should throw error if timestamp generation fails', () => {
      vi.spyOn(DateTime, 'utc').mockReturnValue({
        toISO: () => null
      } as any);

      expect(() => configService.getCurrentTimestamp()).toThrow('Failed to generate ISO timestamp');
    });
  });

  describe('deepMerge', () => {
    it('should merge simple objects', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 } as any;
      
      const result = configService['deepMerge'](target, source);
      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should handle nested objects', () => {
      const target = { a: 1, b: { x: 1, y: 2 } };
      const source = { b: { y: 3, z: 4 }, c: 5 } as any;
      
      const result = configService['deepMerge'](target, source);
      expect(result).toEqual({ a: 1, b: { x: 1, y: 3, z: 4 }, c: 5 });
    });

    it('should handle arrays (replace, not merge)', () => {
      const target = { a: [1, 2], b: { arr: [3, 4] } };
      const source = { a: [5, 6], b: { arr: [7, 8] } } as any;
      
      const result = configService['deepMerge'](target, source);
      expect(result).toEqual({ a: [5, 6], b: { arr: [7, 8] } });
    });

    it('should handle null values', () => {
      const target = { a: 1, b: 2 };
      const source = { b: null, c: 3 } as any;
      
      const result = configService['deepMerge'](target, source);
      expect(result).toEqual({ a: 1, b: null, c: 3 });
    });

    it('should handle undefined values (skip)', () => {
      const target = { a: 1, b: 2 };
      const source = { b: undefined, c: 3 } as any;
      
      const result = configService['deepMerge'](target, source);
      expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });
  });

  describe('mergeConfigs', () => {
    const baseConfig: Omit<AppConfigResponse, 'lastUpdatedIso'> = {
      weather: {
        defaultLocation: 'Location A',
        defaultRefreshSeconds: 300,
        minRefreshSeconds: 60,
        maxRefreshSeconds: 3600,
        displaySettings: {
          showHourlyForecast: true,
          hourlyForecastHours: 24,
          hourlyForecastPastHours: 2,
          hourlyForecastFutureHours: 5,
          currentHourHighlight: true,
          showHumidity: true,
          showWindSpeed: true,
          showPrecipitation: false,
          temperatureUnit: 'both',
        },
        uiSettings: {
          compactMode: false,
          showCacheInfo: true,
          autoRefresh: true,
        },
      },
      discord: {
        defaultRefreshSeconds: 300,
        minRefreshSeconds: 60,
        maxRefreshSeconds: 3600,
        displaySettings: {
          showBots: false,
          showOfflineMembers: true,
          sortBy: 'status',
          groupByStatus: true,
          maxMembersToShow: 50,
          showAvatars: true,
          compactMode: false,
        },
        uiSettings: {
          compactMode: false,
          showCacheInfo: true,
          autoRefresh: true,
        },
      },
      autoMode: {
        enabled: true,
        timeWindows: [],
        defaultMode: 'Compact',
        navModeRefreshSeconds: 300,
      },
      ui: {
        compactMode: true,
        widgetCompactModes: {},
      },
    };

    it('should merge weather config updates', () => {
      const updates: ConfigUpdateRequest = {
        weather: {
          defaultLocation: 'Location B',
          displaySettings: {
            temperatureUnit: 'celsius',
            showHourlyForecast: true,
            hourlyForecastHours: 24,
            hourlyForecastPastHours: 2,
            hourlyForecastFutureHours: 5,
            currentHourHighlight: true,
            showHumidity: true,
            showWindSpeed: true,
            showPrecipitation: false,
          },
        },
      };

      const result = configService.mergeConfigs(baseConfig, updates);

      expect(result.weather.defaultLocation).toBe('Location B');
      expect(result.weather.defaultRefreshSeconds).toBe(300); // unchanged
      expect(result.weather.displaySettings.temperatureUnit).toBe('celsius');
      expect(result.weather.displaySettings.showHourlyForecast).toBe(true); // unchanged
    });

    it('should merge discord config updates', () => {
      const updates: ConfigUpdateRequest = {
        discord: {
          defaultRefreshSeconds: 600,
          displaySettings: {
            showBots: true,
            showOfflineMembers: true,
            sortBy: 'status',
            groupByStatus: true,
            maxMembersToShow: 100,
            showAvatars: true,
            compactMode: false,
          },
        },
      };

      const result = configService.mergeConfigs(baseConfig, updates);

      expect(result.discord.defaultRefreshSeconds).toBe(600);
      expect(result.discord.displaySettings.showBots).toBe(true);
      expect(result.discord.displaySettings.maxMembersToShow).toBe(100);
      expect(result.discord.displaySettings.groupByStatus).toBe(true); // unchanged
    });

    it('should merge autoMode config updates', () => {
      const updates: ConfigUpdateRequest = {
        autoMode: {
          enabled: false,
          navModeRefreshSeconds: 600,
        },
      };

      const result = configService.mergeConfigs(baseConfig, updates);

      expect(result.autoMode.enabled).toBe(false);
      expect(result.autoMode.navModeRefreshSeconds).toBe(600);
      expect(result.autoMode.defaultMode).toBe('Compact'); // unchanged
    });

    it('should merge ui config updates', () => {
      const updates: ConfigUpdateRequest = {
        ui: {
          compactMode: false,
          widgetCompactModes: {
            weather: 'force-compact',
          },
        },
      };

      const result = configService.mergeConfigs(baseConfig, updates);

      expect(result.ui.compactMode).toBe(false);
      expect(result.ui.widgetCompactModes).toEqual({
        weather: 'force-compact',
      });
    });

    it('should handle multiple config updates', () => {
      const updates: ConfigUpdateRequest = {
        weather: { defaultLocation: 'Location C' },
        discord: { defaultRefreshSeconds: 900 },
        autoMode: { enabled: false },
        ui: { compactMode: false },
      };

      const result = configService.mergeConfigs(baseConfig, updates);

      expect(result.weather.defaultLocation).toBe('Location C');
      expect(result.discord.defaultRefreshSeconds).toBe(900);
      expect(result.autoMode.enabled).toBe(false);
      expect(result.ui.compactMode).toBe(false);
    });

    it('should not modify original config when merging', () => {
      const updates: ConfigUpdateRequest = {
        weather: { defaultLocation: 'Modified Location' },
      };

      const originalWeatherLocation = baseConfig.weather.defaultLocation;
      const result = configService.mergeConfigs(baseConfig, updates);

      expect(result.weather.defaultLocation).toBe('Modified Location');
      expect(baseConfig.weather.defaultLocation).toBe(originalWeatherLocation);
    });
  });

  describe('validateConfig', () => {
    const validConfig: Omit<AppConfigResponse, 'lastUpdatedIso'> = {
      weather: {
        defaultLocation: 'Location',
        defaultRefreshSeconds: 300,
        minRefreshSeconds: 60,
        maxRefreshSeconds: 3600,
        displaySettings: {
          showHourlyForecast: true,
          hourlyForecastHours: 24,
          hourlyForecastPastHours: 2,
          hourlyForecastFutureHours: 5,
          currentHourHighlight: true,
          showHumidity: true,
          showWindSpeed: true,
          showPrecipitation: false,
          temperatureUnit: 'both',
        },
        uiSettings: {
          compactMode: false,
          showCacheInfo: true,
          autoRefresh: true,
        },
      },
      discord: {
        defaultRefreshSeconds: 300,
        minRefreshSeconds: 60,
        maxRefreshSeconds: 3600,
        displaySettings: {
          showBots: false,
          showOfflineMembers: true,
          sortBy: 'status',
          groupByStatus: true,
          maxMembersToShow: 50,
          showAvatars: true,
          compactMode: false,
        },
        uiSettings: {
          compactMode: false,
          showCacheInfo: true,
          autoRefresh: true,
        },
      },
      autoMode: {
        enabled: true,
        timeWindows: [
          {
            name: 'test-window',
            mode: 'Nav',
            startTime: { hour: 8, minute: 0 },
            endTime: { hour: 17, minute: 0 },
            daysOfWeek: [1, 2, 3, 4, 5],
          },
        ],
        defaultMode: 'Compact',
        navModeRefreshSeconds: 300,
      },
      ui: {
        compactMode: true,
        widgetCompactModes: {},
      },
    };

    it('should validate correct config', () => {
      expect(configService.validateConfig(validConfig)).toBe(true);
    });

    it('should reject invalid weather refresh seconds', () => {
      const invalidConfig = {
        ...validConfig,
        weather: {
          ...validConfig.weather,
          minRefreshSeconds: 400,
          maxRefreshSeconds: 200, // max < min
        },
      };
      expect(configService.validateConfig(invalidConfig)).toBe(false);
    });

    it('should reject weather default refresh outside range', () => {
      const invalidConfig1 = {
        ...validConfig,
        weather: {
          ...validConfig.weather,
          defaultRefreshSeconds: 50, // below min
        },
      };
      expect(configService.validateConfig(invalidConfig1)).toBe(false);

      const invalidConfig2 = {
        ...validConfig,
        weather: {
          ...validConfig.weather,
          defaultRefreshSeconds: 4000, // above max
        },
      };
      expect(configService.validateConfig(invalidConfig2)).toBe(false);
    });

    it('should reject invalid discord refresh seconds', () => {
      const invalidConfig = {
        ...validConfig,
        discord: {
          ...validConfig.discord,
          minRefreshSeconds: 400,
          maxRefreshSeconds: 200, // max < min
        },
      };
      expect(configService.validateConfig(invalidConfig)).toBe(false);
    });

    it('should reject discord default refresh outside range', () => {
      const invalidConfig1 = {
        ...validConfig,
        discord: {
          ...validConfig.discord,
          defaultRefreshSeconds: 50, // below min
        },
      };
      expect(configService.validateConfig(invalidConfig1)).toBe(false);

      const invalidConfig2 = {
        ...validConfig,
        discord: {
          ...validConfig.discord,
          defaultRefreshSeconds: 4000, // above max
        },
      };
      expect(configService.validateConfig(invalidConfig2)).toBe(false);
    });

    it('should reject invalid autoMode navModeRefreshSeconds', () => {
      const invalidConfig1 = {
        ...validConfig,
        autoMode: {
          ...validConfig.autoMode,
          navModeRefreshSeconds: 50, // below min
        },
      };
      expect(configService.validateConfig(invalidConfig1)).toBe(false);

      const invalidConfig2 = {
        ...validConfig,
        autoMode: {
          ...validConfig.autoMode,
          navModeRefreshSeconds: 4000, // above max
        },
      };
      expect(configService.validateConfig(invalidConfig2)).toBe(false);
    });

    it('should reject invalid time window range', () => {
      const invalidConfig = {
        ...validConfig,
        autoMode: {
          ...validConfig.autoMode,
          timeWindows: [
            {
              name: 'invalid-window',
              mode: 'Nav' as const,
              startTime: { hour: 10, minute: 0 },
              endTime: { hour: 25, minute: 0 }, // Invalid hour (25 > 23)
              daysOfWeek: [1],
            },
          ],
        },
      };
      expect(configService.validateConfig(invalidConfig)).toBe(false);
    });

    it('should reject invalid day of week', () => {
      const invalidConfig = {
        ...validConfig,
        autoMode: {
          ...validConfig.autoMode,
          timeWindows: [
            {
              name: 'invalid-window',
              mode: 'Nav' as const,
              startTime: { hour: 8, minute: 0 },
              endTime: { hour: 17, minute: 0 },
              daysOfWeek: [7], // invalid day (0-6)
            },
          ],
        },
      };
      expect(configService.validateConfig(invalidConfig)).toBe(false);
    });

    it('should handle valid time window crossing midnight', () => {
      const validConfigWithMidnight = {
        ...validConfig,
        autoMode: {
          ...validConfig.autoMode,
          timeWindows: [
            {
              name: 'midnight-window',
              mode: 'Nav' as const,
              startTime: { hour: 22, minute: 0 },
              endTime: { hour: 2, minute: 0 }, // crosses midnight
              daysOfWeek: [1, 2, 3],
            },
          ],
        },
      };
      expect(configService.validateConfig(validConfigWithMidnight)).toBe(true);
    });
  });

  describe('getWidgetConfig', () => {
    const config: AppConfigResponse = {
      weather: {
        defaultLocation: 'Location',
        defaultRefreshSeconds: 300,
        minRefreshSeconds: 60,
        maxRefreshSeconds: 3600,
        displaySettings: {
          showHourlyForecast: true,
          hourlyForecastHours: 24,
          hourlyForecastPastHours: 2,
          hourlyForecastFutureHours: 5,
          currentHourHighlight: true,
          showHumidity: true,
          showWindSpeed: true,
          showPrecipitation: false,
          temperatureUnit: 'both',
        },
        uiSettings: {
          compactMode: false,
          showCacheInfo: true,
          autoRefresh: true,
        },
      },
      discord: {
        defaultRefreshSeconds: 300,
        minRefreshSeconds: 60,
        maxRefreshSeconds: 3600,
        displaySettings: {
          showBots: false,
          showOfflineMembers: true,
          sortBy: 'status',
          groupByStatus: true,
          maxMembersToShow: 50,
          showAvatars: true,
          compactMode: false,
        },
        uiSettings: {
          compactMode: true,
          showCacheInfo: true,
          autoRefresh: true,
        },
      },
      autoMode: {
        enabled: true,
        timeWindows: [],
        defaultMode: 'Compact',
        navModeRefreshSeconds: 300,
      },
      ui: {
        compactMode: false,
        widgetCompactModes: {
          weather: 'force-compact',
          discord: 'force-full',
        },
      },
      lastUpdatedIso: '2024-01-01T00:00:00.000Z',
    };

    it('should return weather widget config', () => {
      const result = configService.getWidgetConfig(config, 'weather');

      expect(result.displaySettings).toBe(config.weather.displaySettings);
      expect(result.uiSettings).toBe(config.weather.uiSettings);
    });

    it('should return discord widget config', () => {
      const result = configService.getWidgetConfig(config, 'discord');

      expect(result.displaySettings).toBe(config.discord.displaySettings);
      expect(result.uiSettings).toBe(config.discord.uiSettings);
    });

    it('should return autoMode widget config', () => {
      const result = configService.getWidgetConfig(config, 'autoMode');

      expect(result.displaySettings).toEqual({});
      expect(result.uiSettings).toEqual({ compactMode: config.ui.compactMode });
    });

    it('should return default config for unknown widget', () => {
      const result = configService.getWidgetConfig(config, 'unknown');

      expect(result.displaySettings).toEqual({});
      expect(result.uiSettings).toEqual({ compactMode: config.ui.compactMode });
    });
  });
});
