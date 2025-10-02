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

type GoogleMapsApi = typeof google;

let googleMapsPromise: Promise<GoogleMapsApi> | null = null;
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

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY;

async function loadGoogleMaps(apiKey: string): Promise<GoogleMapsApi> {
  if (typeof window === 'undefined') {
    throw new Error('Google Maps is unavailable in this environment.');
  }

  if (window.google?.maps) {
    return window.google;
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  const waitForScript = (script: HTMLScriptElement, removeOnError: boolean): Promise<GoogleMapsApi> =>
    new Promise<GoogleMapsApi>((resolve, reject) => {
      const cleanup = () => {
        script.removeEventListener('load', handleLoad);
        script.removeEventListener('error', handleError);
      };

      const handleLoad = () => {
        cleanup();
        if (window.google?.maps) {
          resolve(window.google);
          return;
        }

        if (removeOnError) {
          script.remove();
        }

        reject(new Error('Google Maps script loaded without maps namespace.'));
      };

      const handleError = () => {
        cleanup();
        if (removeOnError) {
          script.remove();
        }

        reject(new Error('Failed to load Google Maps script.'));
      };

      script.addEventListener('load', handleLoad, { once: true });
      script.addEventListener('error', handleError, { once: true });
    });

  const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-maps-loader="true"]');

  const loaderPromise: Promise<GoogleMapsApi> = existingScript
    ? waitForScript(existingScript, true)
    : (() => {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=routes`;
        script.async = true;
        script.defer = true;
        script.dataset.googleMapsLoader = 'true';
        const promise = waitForScript(script, true);
        document.head.appendChild(script);
        return promise;
      })();

  googleMapsPromise = (async (): Promise<GoogleMapsApi> => {
    try {
      return await loaderPromise;
    } catch (error) {
      googleMapsPromise = null;
      throw error;
    }
  })();

  return googleMapsPromise;
}

function clearRoute(): void {
  latestRouteRequestId += 1;
  if (directionsRenderer) {
    directionsRenderer.setDirections(null);
  }
  if (mapInstance) {
    mapInstance.setCenter(defaultCenter);
    mapInstance.setZoom(defaultZoom);
  }
}

async function ensureMap(): Promise<void> {
  if (!props.active) {
    status.value = MapStatus.Inactive;
    clearRoute();
    return;
  }

  if (!mapContainer.value) {
    return;
  }

  if (!apiKey) {
    status.value = MapStatus.NoKey;
    return;
  }

  if (mapInstance) {
    status.value = MapStatus.Ready;
    return;
  }

  status.value = MapStatus.Loading;

  try {
    const mapsApi = await loadGoogleMaps(apiKey);

    if (!mapContainer.value) {
      status.value = MapStatus.Error;
      errorMessage.value = 'Unable to attach map container.';
      return;
    }

    mapInstance = new mapsApi.maps.Map(mapContainer.value, {
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
  } catch (error) {
    status.value = MapStatus.Error;
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load map.';
  }
}

async function updateRoute(): Promise<void> {
  if (!props.active) {
    return;
  }

  const service = directionsService;
  const renderer = directionsRenderer;

  if (!mapInstance || !service || !renderer) {
    return;
  }

  const trimmedOrigin = props.origin.trim();
  const trimmedDestination = props.destination.trim();

  if (!trimmedOrigin || !trimmedDestination) {
    status.value = MapStatus.Ready;
    errorMessage.value = '';
    clearRoute();
    return;
  }

  status.value = MapStatus.Ready;
  errorMessage.value = '';

  const requestId = ++latestRouteRequestId;

  try {
    const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
      service.route(
        {
          origin: trimmedOrigin,
          destination: trimmedDestination,
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

    if (requestId !== latestRouteRequestId) {
      return;
    }

    renderer.setDirections(result);
    status.value = MapStatus.Ready;
  } catch (error) {
    if (requestId !== latestRouteRequestId) {
      return;
    }

    status.value = MapStatus.Error;
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load the navigation preview.';
    clearRoute();
  }
}

async function refreshMap(): Promise<void> {
  await ensureMap();
  await updateRoute();
}

watch(
  () => props.active,
  async (isActive: boolean) => {
    if (isActive) {
      await refreshMap();
    } else {
      clearRoute();
      status.value = MapStatus.Inactive;
    }
  },
  { immediate: true },
);

watch(
  () => mapContainer.value,
  async (container: HTMLDivElement | null) => {
    if (container && props.active) {
      await refreshMap();
    }
  },
);

watch(
  () => [props.origin, props.destination],
  async () => {
    if (props.active) {
      await refreshMap();
    } else {
      clearRoute();
    }
  },
);

onBeforeUnmount(() => {
  mapInstance = null;
  directionsService = null;
  if (directionsRenderer) {
    directionsRenderer.setMap(null);
    directionsRenderer = null;
  }
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
