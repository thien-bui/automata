import { computed, ref } from 'vue';
import type { WeatherConfig } from '@automata/types';

// Import the configuration file
import weatherConfigJson from '../config/weather-config.json';

const DEFAULT_CONFIG: WeatherConfig = {
  defaultLocation: 'Kent, WA',
  defaultRefreshSeconds: 300,
  minRefreshSeconds: 60,
  maxRefreshSeconds: 3600,
  displaySettings: {
    showHourlyForecast: true,
    hourlyForecastHours: 24,
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

export function useWeatherConfig() {
  // Use the imported config or fall back to default
  const config = ref<WeatherConfig>(
    (weatherConfigJson as any).weather || DEFAULT_CONFIG,
  );

  const defaultLocation = computed(() => config.value.defaultLocation);
  const defaultRefreshSeconds = computed(() => config.value.defaultRefreshSeconds);
  const minRefreshSeconds = computed(() => config.value.minRefreshSeconds);
  const maxRefreshSeconds = computed(() => config.value.maxRefreshSeconds);
  const displaySettings = computed(() => config.value.displaySettings);
  const uiSettings = computed(() => config.value.uiSettings);

  function isValidRefreshInterval(seconds: number): boolean {
    return seconds >= config.value.minRefreshSeconds && seconds <= config.value.maxRefreshSeconds;
  }

  function clampRefreshInterval(seconds: number): number {
    return Math.max(config.value.minRefreshSeconds, Math.min(config.value.maxRefreshSeconds, seconds));
  }

  function updateConfig(newConfig: Partial<WeatherConfig>) {
    config.value = { ...config.value, ...newConfig };
  }

  function updateDisplaySettings(newSettings: Partial<WeatherConfig['displaySettings']>) {
    config.value = {
      ...config.value,
      displaySettings: { ...config.value.displaySettings, ...newSettings },
    };
  }

  function updateUISettings(newSettings: Partial<WeatherConfig['uiSettings']>) {
    config.value = {
      ...config.value,
      uiSettings: { ...config.value.uiSettings, ...newSettings },
    };
  }

  function resetConfig() {
    config.value = DEFAULT_CONFIG;
  }

  return {
    config: computed(() => config.value),
    defaultLocation,
    defaultRefreshSeconds,
    minRefreshSeconds,
    maxRefreshSeconds,
    displaySettings,
    uiSettings,
    isValidRefreshInterval,
    clampRefreshInterval,
    updateConfig,
    updateDisplaySettings,
    updateUISettings,
    resetConfig,
  };
}
