import { RouteMode } from '@automata/types';

type GoogleTravelMode = RouteMode;

export interface GoogleDirectionsQuery {
  from: string;
  to: string;
  mode: GoogleTravelMode;
}

export interface GoogleDirectionsResult {
  durationMinutes: number;
  distanceKm: number;
  providerStatus?: unknown;
}

export async function fetchGoogleDirections(
  _query: GoogleDirectionsQuery,
): Promise<GoogleDirectionsResult> {
  // TODO: Replace with real Google Directions API integration.
  return {
    durationMinutes: 18,
    distanceKm: 12.5,
    providerStatus: { mocked: true },
  };
}
