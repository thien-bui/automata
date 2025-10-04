<template>
  <v-card class="map-preview" elevation="2" :aria-label="ariaLabel" data-testid="map-preview">
    <div class="map-frame">
      <div ref="mapContainer" class="map-surface">
        <div v-if="status !== MapStatus.Ready" class="placeholder d-flex align-center justify-center text-body-2 text-medium-emphasis">
          <span v-if="status === MapStatus.Inactive">Enable Nav mode to display the map.</span>
          <span v-else-if="status === MapStatus.NoKey">
            Set <code>VITE_GOOGLE_MAPS_BROWSER_KEY</code> to enable the map preview.
          </span>
          <span v-else-if="status === MapStatus.Loading">Loading map…</span>
          <span v-else-if="status === MapStatus.Error">{{ errorMessage }}</span>
        </div>
        <div class="map-overlay text-caption">
          <div>Origin: {{ origin }}</div>
          <div>Destination: {{ destination }}</div>
          <div v-if="lastUpdatedLabel">Last update {{ lastUpdatedLabel }}</div>
        </div>
      </div>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { useGoogleMaps } from '../composables/useGoogleMaps';

const props = defineProps<{
  active: boolean;
  origin: string;
  destination: string;
  lastUpdatedIso: string | null;
}>();

enum MapStatus {
  Inactive = 'inactive',
  Loading = 'loading',
  Ready = 'ready',
  NoKey = 'no-key',
  Error = 'error',
}

const mapContainer = ref<HTMLDivElement | null>(null);
const status = ref<MapStatus>(MapStatus.Inactive);
const errorMessage = ref('');

const defaultCenter: google.maps.LatLngLiteral = { lat: 37.7749, lng: -122.4194 };
const defaultZoom = 11;

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY;
const mapsLoader = useGoogleMaps({
  apiKey,
  libraries: ['routes'],
});

let mapInstance: google.maps.Map | null = null;
let directionsService: google.maps.DirectionsService | null = null;
let directionsRenderer: google.maps.DirectionsRenderer | null = null;
let latestRouteRequestId = 0;

const ariaLabel = computed(
  () => `Route preview map from ${props.origin} to ${props.destination}.`,
);

const lastUpdatedLabel = computed(() => {
  if (!props.lastUpdatedIso) {
    return '';
  }
  const timestamp = new Date(props.lastUpdatedIso);
  if (Number.isNaN(timestamp.getTime())) {
    return '';
  }
  return timestamp.toLocaleTimeString();
});

function cancelInFlightRequests(): void {
  latestRouteRequestId += 1;
}

function clearRoute(): void {
  cancelInFlightRequests();
  directionsRenderer?.setDirections(null);
  if (mapInstance) {
    mapInstance.setCenter(defaultCenter);
    mapInstance.setZoom(defaultZoom);
  }
}

function teardownMap(): void {
  clearRoute();
  directionsRenderer?.setMap(null);
  directionsRenderer = null;
  directionsService = null;
  mapInstance = null;
}

async function ensureMap(container: HTMLDivElement, isCancelled: () => boolean): Promise<boolean> {
  if (mapInstance) {
    status.value = MapStatus.Ready;
    return true;
  }

  status.value = MapStatus.Loading;

  try {
    const mapsApi = await mapsLoader.load();

    if (isCancelled() || !mapContainer.value) {
      return false;
    }

    mapInstance = new mapsApi.maps.Map(container, {
      center: defaultCenter,
      zoom: defaultZoom,
      disableDefaultUI: true,
      keyboardShortcuts: false,
    });

    directionsService = new mapsApi.maps.DirectionsService();
    directionsRenderer = new mapsApi.maps.DirectionsRenderer({
      map: mapInstance,
      suppressMarkers: false,
      preserveViewport: false,
    });

    status.value = MapStatus.Ready;
    errorMessage.value = '';
    return true;
  } catch (error) {
    if (isCancelled()) {
      return false;
    }

    status.value = MapStatus.Error;
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load map.';
    teardownMap();
    return false;
  }
}

async function renderRoute(origin: string, destination: string, isCancelled: () => boolean): Promise<void> {
  if (!mapInstance || !directionsService || !directionsRenderer) {
    return;
  }

  status.value = MapStatus.Ready;
  errorMessage.value = '';

  const requestId = ++latestRouteRequestId;

  try {
    const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
      directionsService?.route(
        {
          origin,
          destination,
          travelMode: google.maps.TravelMode.DRIVING,
          provideRouteAlternatives: false,
        },
        (response, responseStatus: google.maps.DirectionsStatus) => {
          if (responseStatus === 'OK' && response) {
            resolve(response);
            return;
          }

          const statusMessageMap: Partial<Record<google.maps.DirectionsStatus, string>> = {
            INVALID_REQUEST: 'The navigation request is invalid. Check the addresses.',
            MAX_WAYPOINTS_EXCEEDED: 'Too many waypoints were requested.',
            NOT_FOUND: 'One or both addresses could not be found.',
            OVER_QUERY_LIMIT: 'Route requests are temporarily limited. Try again later.',
            REQUEST_DENIED: 'Navigation preview is not permitted with the current API key.',
            UNKNOWN_ERROR: 'An unknown error occurred while fetching the route.',
            ZERO_RESULTS: 'No routes could be found between the specified addresses.',
          };

          const message = statusMessageMap[responseStatus] ?? 'Failed to load the navigation preview.';
          reject(new Error(message));
        },
      );
    });

    if (isCancelled() || requestId !== latestRouteRequestId) {
      return;
    }

    directionsRenderer.setDirections(result);
  } catch (error) {
    if (isCancelled() || requestId !== latestRouteRequestId) {
      return;
    }

    status.value = MapStatus.Error;
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load the navigation preview.';
    clearRoute();
  }
}

watch(
  () => [props.active, props.origin, props.destination, props.lastUpdatedIso, mapContainer.value] as const,
  async ([isActive, origin, destination, _lastUpdatedIso, container], _oldValue, onCleanup) => {
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
      cancelInFlightRequests();
    });

    if (!isActive) {
      status.value = MapStatus.Inactive;
      clearRoute();
      return;
    }

    if (!container) {
      return;
    }

    if (!apiKey) {
      status.value = MapStatus.NoKey;
      errorMessage.value = '';
      clearRoute();
      return;
    }

    const ready = await ensureMap(container, () => cancelled);
    if (!ready || cancelled) {
      return;
    }

    const trimmedOrigin = origin.trim();
    const trimmedDestination = destination.trim();

    if (!trimmedOrigin || !trimmedDestination) {
      status.value = MapStatus.Ready;
      errorMessage.value = '';
      clearRoute();
      return;
    }

    await renderRoute(trimmedOrigin, trimmedDestination, () => cancelled);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  teardownMap();
  status.value = MapStatus.Inactive;
});
</script>

<style scoped>
.map-preview {
  overflow: hidden;
}

.map-frame {
  position: relative;
  width: 100%;
  min-height: 280px;
}

.map-surface {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    rgba(30, 136, 229, 0.08),
    rgba(30, 136, 229, 0.08) 10px,
    rgba(30, 136, 229, 0.16) 10px,
    rgba(30, 136, 229, 0.16) 20px
  );
}

.placeholder {
  position: absolute;
  inset: 0;
  padding: 0 16px;
  text-align: center;
  background: rgba(18, 18, 18, 0.12);
}

.map-overlay {
  position: absolute;
  left: 12px;
  bottom: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(33, 33, 33, 0.64);
  color: rgba(255, 255, 255, 0.92);
  pointer-events: none;
  max-width: calc(100% - 24px);
  line-height: 1.4;
}
</style>
