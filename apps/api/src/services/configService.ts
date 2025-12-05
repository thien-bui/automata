import { DateTime } from 'luxon';
import type { 
  AppConfigResponse, 
  WeatherConfig, 
  DiscordConfig, 
  AutoModeConfig, 
  UiPreferencesState,
  ConfigUpdateRequest
} from '@automata/types';

export class ConfigService {
  private readonly DEFAULT_WEATHER_CONFIG: WeatherConfig = {
    defaultLocation: 'Kent, WA',
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
  };

  private readonly DEFAULT_DISCORD_CONFIG: DiscordConfig = {
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
  };

  private readonly DEFAULT_AUTOMODE_CONFIG: AutoModeConfig = {
    enabled: true,
    timeWindows: [
      {
        name: 'morning-commute',
        mode: 'Nav',
        startTime: { hour: 8, minute: 30 },
        endTime: { hour: 9, minute: 30 },
        daysOfWeek: [1, 2, 3, 4, 5],
        description: 'Morning commute window',
      },
      {
        name: 'evening-commute',
        mode: 'Nav',
        startTime: { hour: 17, minute: 0 },
        endTime: { hour: 20, minute: 0 },
        daysOfWeek: [1, 2, 3, 4, 5],
        description: 'Evening commute window',
      },
    ],
    defaultMode: 'Compact',
    navModeRefreshSeconds: 300,
  };

  private readonly DEFAULT_UI_CONFIG: UiPreferencesState = {
    compactMode: true,
    widgetCompactModes: {},
  };

  /**
   * Get the default application configuration
   */
  getDefaultConfig(): Omit<AppConfigResponse, 'lastUpdatedIso'> {
    return {
      weather: { ...this.DEFAULT_WEATHER_CONFIG },
      discord: { ...this.DEFAULT_DISCORD_CONFIG },
      autoMode: { ...this.DEFAULT_AUTOMODE_CONFIG },
      ui: { ...this.DEFAULT_UI_CONFIG },
    };
  }

  /**
   * Get current ISO timestamp
   */
  getCurrentTimestamp(): string {
    const now = DateTime.utc();
    const timestamp = now.toISO();
    
    if (!timestamp) {
      throw new Error('Failed to generate ISO timestamp');
    }
    
    return timestamp;
  }

  /**
   * Deep merge two objects
   */
  private deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] === undefined) {
        continue;
      }
      
      if (source[key] === null) {
        result[key] = null as any;
      } else if (typeof source[key] === 'object' && !Array.isArray(source[key]) && source[key] !== null) {
        // Ensure target has the key and it's an object
        if (!result[key] || typeof result[key] !== 'object' || Array.isArray(result[key])) {
          result[key] = {} as any;
        }
        result[key] = this.deepMerge(result[key] as any, source[key] as any);
      } else {
        result[key] = source[key] as any;
      }
    }
    
    return result;
  }

  /**
   * Merge configuration updates with existing config
   */
  mergeConfigs(
    existingConfig: Omit<AppConfigResponse, 'lastUpdatedIso'>,
    updates: ConfigUpdateRequest
  ): Omit<AppConfigResponse, 'lastUpdatedIso'> {
    const mergedConfig = { ...existingConfig };

    if (updates.weather) {
      mergedConfig.weather = this.deepMerge(mergedConfig.weather, updates.weather);
    }

    if (updates.discord) {
      mergedConfig.discord = this.deepMerge(mergedConfig.discord, updates.discord);
    }

    if (updates.autoMode) {
      mergedConfig.autoMode = this.deepMerge(mergedConfig.autoMode, updates.autoMode);
    }

    if (updates.ui) {
      mergedConfig.ui = this.deepMerge(mergedConfig.ui, updates.ui);
    }

    return mergedConfig;
  }

  /**
   * Validate configuration
   */
  validateConfig(config: Omit<AppConfigResponse, 'lastUpdatedIso'>): boolean {
    // Validate weather config
    if (config.weather.minRefreshSeconds > config.weather.maxRefreshSeconds) {
      return false;
    }
    if (config.weather.defaultRefreshSeconds < config.weather.minRefreshSeconds ||
        config.weather.defaultRefreshSeconds > config.weather.maxRefreshSeconds) {
      return false;
    }

    // Validate discord config
    if (config.discord.minRefreshSeconds > config.discord.maxRefreshSeconds) {
      return false;
    }
    if (config.discord.defaultRefreshSeconds < config.discord.minRefreshSeconds ||
        config.discord.defaultRefreshSeconds > config.discord.maxRefreshSeconds) {
      return false;
    }

    // Validate autoMode config
    if (config.autoMode.navModeRefreshSeconds < 60 || config.autoMode.navModeRefreshSeconds > 3600) {
      return false;
    }

    // Validate time windows
    for (const window of config.autoMode.timeWindows) {
      // Validate day of week values (0-6)
      if (window.daysOfWeek.some(day => day < 0 || day > 6)) {
        return false; // Invalid day of week
      }
      
      // Validate time values (0-23 for hours, 0-59 for minutes)
      if (window.startTime.hour < 0 || window.startTime.hour > 23 ||
          window.startTime.minute < 0 || window.startTime.minute > 59 ||
          window.endTime.hour < 0 || window.endTime.hour > 23 ||
          window.endTime.minute < 0 || window.endTime.minute > 59) {
        return false; // Invalid time value
      }
      
      // Note: startMinutes can be greater than endMinutes for windows that cross midnight
      // This is valid, so we don't validate the relationship between start and end times
    }

    return true;
  }

  /**
   * Get specific widget configuration
   */
  getWidgetConfig(config: AppConfigResponse, widgetName: string): {
    displaySettings: any;
    uiSettings: any;
  } {
    const widgetConfigs: Record<string, { displaySettings: any; uiSettings: any }> = {
      weather: {
        displaySettings: config.weather.displaySettings,
        uiSettings: config.weather.uiSettings,
      },
      discord: {
        displaySettings: config.discord.displaySettings,
        uiSettings: config.discord.uiSettings,
      },
      autoMode: {
        displaySettings: {}, // AutoMode doesn't have display settings
        uiSettings: { compactMode: config.ui.compactMode },
      },
    };

    return widgetConfigs[widgetName] || {
      displaySettings: {},
      uiSettings: { compactMode: config.ui.compactMode },
    };
  }
}
