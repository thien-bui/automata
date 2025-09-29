import type { RouteMode } from '@automata/types';
import { RoutesClient, protos } from '@googlemaps/routing';

type GoogleTravelMode = RouteMode;
type RouteTravelMode = protos.google.maps.routing.v2.RouteTravelMode;
type Route = protos.google.maps.routing.v2.IRoute;
type Duration = protos.google.protobuf.IDuration | null | undefined;

const RESPONSE_FIELD_MASK = [
  'routes.duration',
  'routes.distanceMeters',
  'routes.routeLabels',
  'routes.warnings',
  'routes.legs.duration',
  'routes.legs.distanceMeters',
  'fallbackInfo',
].join(',');

const travelModeMap: Record<RouteMode, RouteTravelMode> = {
  driving: protos.google.maps.routing.v2.RouteTravelMode.DRIVE,
  walking: protos.google.maps.routing.v2.RouteTravelMode.WALK,
  transit: protos.google.maps.routing.v2.RouteTravelMode.TRANSIT,
};

const routesClient = new RoutesClient({ fallback: true });

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
  query: GoogleDirectionsQuery,
): Promise<GoogleDirectionsResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY is not configured.');
  }

  const travelMode = travelModeMap[query.mode];
  if (travelMode === undefined) {
    throw new Error(`Unsupported travel mode: ${query.mode}`);
  }

  const request: protos.google.maps.routing.v2.IComputeRoutesRequest = {
    origin: { address: query.from },
    destination: { address: query.to },
    travelMode,
  };

  if (query.mode === 'driving') {
    request.routingPreference = protos.google.maps.routing.v2.RoutingPreference.TRAFFIC_AWARE;
  }

  const [response] = await routesClient.computeRoutes(request, {
    otherArgs: {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': RESPONSE_FIELD_MASK,
      },
    },
  });

  const route = response.routes?.[0];
  if (!route) {
    throw new Error('Google Routes API returned no routes.');
  }

  const durationMinutes = roundToTwo(calculateDurationSeconds(route) / 60);
  const distanceKm = roundToTwo(calculateDistanceMeters(route) / 1000);

  if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
    throw new Error('Google Routes API returned an invalid duration.');
  }

  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new Error('Google Routes API returned an invalid distance.');
  }

  return {
    durationMinutes,
    distanceKm,
    providerStatus: {
      routeLabels: route.routeLabels ?? [],
      warnings: route.warnings ?? [],
      fallbackReason: response.fallbackInfo?.reason ?? null,
    },
  };
}

function calculateDurationSeconds(route: Route): number {
  const fromRoute = extractDurationSeconds(route.duration);
  if (fromRoute > 0) {
    return fromRoute;
  }

  const legs = route.legs ?? [];
  return legs.reduce((total, leg) => total + extractDurationSeconds(leg?.duration), 0);
}

function calculateDistanceMeters(route: Route): number {
  if (typeof route.distanceMeters === 'number') {
    return route.distanceMeters;
  }

  const legs = route.legs ?? [];
  return legs.reduce((total, leg) => total + (leg?.distanceMeters ?? 0), 0);
}

function extractDurationSeconds(value: Duration): number {
  if (!value) {
    return 0;
  }

  const seconds = value.seconds != null ? Number(value.seconds) : 0;
  const nanos = value.nanos != null ? Number(value.nanos) : 0;

  return seconds + nanos / 1_000_000_000;
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}
