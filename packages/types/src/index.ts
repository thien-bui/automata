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
