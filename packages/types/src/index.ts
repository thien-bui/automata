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

export interface TimeConfig {
  hour: number;
  minute: number;
}

export interface AutoModeTimeWindow {
  name: string;
  mode: 'Simple' | 'Nav';
  startTime: TimeConfig;
  endTime: TimeConfig;
  daysOfWeek: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  description?: string;
}

export interface AutoModeConfig {
  enabled: boolean;
  timeWindows: AutoModeTimeWindow[];
  defaultMode: 'Simple' | 'Nav';
  navModeRefreshSeconds: number;
}

export interface WeatherDisplaySettings {
  showHourlyForecast: boolean;
  hourlyForecastHours: number;
  hourlyForecastPastHours: number;
  hourlyForecastFutureHours: number;
  currentHourHighlight: boolean;
  showHumidity: boolean;
  showWindSpeed: boolean;
  showPrecipitation: boolean;
  temperatureUnit: 'celsius' | 'fahrenheit' | 'both';
}

export interface WeatherUISettings {
  compactMode: boolean;
  showCacheInfo: boolean;
  autoRefresh: boolean;
}

export interface WeatherConfig {
  defaultLocation: string;
  defaultRefreshSeconds: number;
  minRefreshSeconds: number;
  maxRefreshSeconds: number;
  displaySettings: WeatherDisplaySettings;
  uiSettings: WeatherUISettings;
}

export interface DiscordMemberStatus {
  id: string;
  username: string;
  displayName: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  avatarUrl: string | null;
  bot: boolean;
}

export interface DiscordGuildStatus {
  guildId: string;
  guildName: string;
  totalMembers: number;
  onlineMembers: number;
  members: DiscordMemberStatus[];
  lastUpdatedIso: string;
}

export interface DiscordCacheMetadata {
  hit: boolean;
  ageSeconds: number;
  staleWhileRevalidate: boolean;
}

export interface DiscordResponse extends DiscordGuildStatus {
  cache: DiscordCacheMetadata;
}

export interface DiscordQuery {
  forceRefresh?: boolean;
}

export interface DiscordDisplaySettings {
  showBots: boolean;
  showOfflineMembers: boolean;
  sortBy: 'status' | 'username' | 'displayName';
  groupByStatus: boolean;
  maxMembersToShow: number;
  showAvatars: boolean;
  compactMode: boolean;
}

export interface DiscordUISettings {
  compactMode: boolean;
  showCacheInfo: boolean;
  autoRefresh: boolean;
}

export interface DiscordConfig {
  defaultRefreshSeconds: number;
  minRefreshSeconds: number;
  maxRefreshSeconds: number;
  displaySettings: DiscordDisplaySettings;
  uiSettings: DiscordUISettings;
}
