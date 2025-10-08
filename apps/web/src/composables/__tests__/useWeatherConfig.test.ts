import { describe, it, expect, beforeEach } from 'vitest';
import { useWeatherConfig } from '../useWeatherConfig';

describe('useWeatherConfig', () => {
  beforeEach(() => {
    // Reset any module state if needed
  });

  it('should provide default configuration values', () => {
    const {
      defaultLocation,
      defaultRefreshSeconds,
      minRefreshSeconds,
      maxRefreshSeconds,
      displaySettings,
      uiSettings,
    } = useWeatherConfig();

    expect(defaultLocation.value).toBe('Kent, WA');
    expect(defaultRefreshSeconds.value).toBe(300);
    expect(minRefreshSeconds.value).toBe(60);
    expect(maxRefreshSeconds.value).toBe(3600);
    
    expect(displaySettings.value.showHourlyForecast).toBe(true);
    expect(displaySettings.value.hourlyForecastHours).toBe(24);
    expect(displaySettings.value.currentHourHighlight).toBe(true);
    expect(displaySettings.value.showHumidity).toBe(true);
    expect(displaySettings.value.showWindSpeed).toBe(true);
    expect(displaySettings.value.showPrecipitation).toBe(false);
    expect(displaySettings.value.temperatureUnit).toBe('both');
    
    expect(uiSettings.value.compactMode).toBe(false);
    expect(uiSettings.value.showCacheInfo).toBe(true);
    expect(uiSettings.value.autoRefresh).toBe(true);
  });

  it('should validate refresh intervals correctly', () => {
    const { isValidRefreshInterval, minRefreshSeconds, maxRefreshSeconds } = useWeatherConfig();

    expect(isValidRefreshInterval(60)).toBe(true);
    expect(isValidRefreshInterval(300)).toBe(true);
    expect(isValidRefreshInterval(3600)).toBe(true);
    expect(isValidRefreshInterval(30)).toBe(false);
    expect(isValidRefreshInterval(4000)).toBe(false);
    expect(isValidRefreshInterval(0)).toBe(false);
    expect(isValidRefreshInterval(-1)).toBe(false);
  });

  it('should clamp refresh intervals to valid range', () => {
    const { clampRefreshInterval, minRefreshSeconds, maxRefreshSeconds } = useWeatherConfig();

    expect(clampRefreshInterval(300)).toBe(300);
    expect(clampRefreshInterval(30)).toBe(minRefreshSeconds.value);
    expect(clampRefreshInterval(4000)).toBe(maxRefreshSeconds.value);
    expect(clampRefreshInterval(0)).toBe(minRefreshSeconds.value);
  });
});
