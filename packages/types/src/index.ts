export type RouteMode = 'driving' | 'walking' | 'transit';

export interface RouteTimeCacheMetadata {
  hit: boolean;
  ageSeconds: number;
  staleWhileRevalidate: boolean;
}

export interface RouteTimeResponse {
  durationMinutes: number;
  distanceKm: number;
  provider: 'google-directions';
  mode: RouteMode;
  lastUpdatedIso: string;
  cache: RouteTimeCacheMetadata;
}

export interface RouteTimeQuery {
  from: string;
  to: string;
  mode?: RouteMode;
  freshnessSeconds?: number;
}

export interface HourlyWeatherData {
  timestamp: string;
  temperatureCelsius: number;
  temperatureFahrenheit: number;
  condition: string;
  humidityPercent?: number;
  windSpeedKph?: number;
  precipitationProbability?: number;
}

export interface WeatherCacheMetadata {
  hit: boolean;
  ageSeconds: number;
  staleWhileRevalidate: boolean;
}

export interface WeatherResponse {
  hourlyData: HourlyWeatherData[];
  provider: 'google-weather';
  lastUpdatedIso: string;
  cache: WeatherCacheMetadata;
}

export interface WeatherQuery {
  location: string;
  freshnessSeconds?: number;
  forceRefresh?: boolean;
}
