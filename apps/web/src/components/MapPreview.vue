<template>
  <v-card class="map-preview" elevation="2" :aria-label="ariaLabel">
    <div class="map-frame">
      <div ref="mapContainer" class="map-surface">
        <div v-if="status !== 'ready'" class="placeholder d-flex align-center justify-center text-body-2 text-medium-emphasis">
          <span v-if="status === 'inactive'">Enable Nav mode to display the map.</span>
          <span v-else-if="status === 'no-key'">
            Set <code>VITE_GOOGLE_MAPS_BROWSER_KEY</code> to enable the map preview.
          </span>
          <span v-else-if="status === 'loading'">Loading map…</span>
          <span v-else-if="status === 'error'">{{ errorMessage }}</span>
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

type MapStatus = 'inactive' | 'loading' | 'ready' | 'no-key' | 'error';

const mapContainer = ref<HTMLDivElement | null>(null);
const status = ref<MapStatus>('inactive');
const errorMessage = ref('');

const defaultCenter: google.maps.LatLngLiteral = { lat: 37.7749, lng: -122.4194 };
const defaultZoom = 11;

let googleMapsPromise: Promise<any> | null = null;
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

function loadGoogleMaps(apiKey: string): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps is unavailable in this environment.'));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-maps-loader="true"]');

  if (existingScript) {
    googleMapsPromise = new Promise((resolve, reject) => {
      existingScript.addEventListener('load', () => {
        if (window.google?.maps) {
          resolve(window.google);
          return;
        }
        reject(new Error('Google Maps script loaded without maps namespace.'));
      });
      existingScript.addEventListener('error', () => {
        googleMapsPromise = null;
        reject(new Error('Failed to load Google Maps script.'));
      });
    });
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=routes`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsLoader = 'true';
    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google);
      } else {
        googleMapsPromise = null;
        reject(new Error('Google Maps script loaded without maps namespace.'));
      }
    };
    script.onerror = () => {
      script.remove();
      googleMapsPromise = null;
      reject(new Error('Failed to load Google Maps script.'));
    };
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

function clearRoute() {
  latestRouteRequestId += 1;
  if (directionsRenderer) {
    directionsRenderer.setDirections(null);
  }
  if (mapInstance) {
    mapInstance.setCenter(defaultCenter);
    mapInstance.setZoom(defaultZoom);
  }
}

async function ensureMap() {
  if (!props.active) {
    status.value = 'inactive';
    clearRoute();
    return;
  }

  if (!mapContainer.value) {
    return;
  }

  if (!apiKey) {
    status.value = 'no-key';
    return;
  }

  if (mapInstance) {
    status.value = 'ready';
    return;
  }

  status.value = 'loading';

  try {
    const mapsApi = await loadGoogleMaps(apiKey);

    if (!mapContainer.value) {
      status.value = 'error';
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

    status.value = 'ready';
  } catch (error) {
    status.value = 'error';
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load map.';
  }
}

async function updateRoute() {
  if (!props.active) {
    return;
  }

  if (!mapInstance || !directionsService || !directionsRenderer) {
    return;
  }

  const trimmedOrigin = props.origin.trim();
  const trimmedDestination = props.destination.trim();

  if (!trimmedOrigin || !trimmedDestination) {
    status.value = 'ready';
    errorMessage.value = '';
    clearRoute();
    return;
  }

  status.value = 'ready';
  errorMessage.value = '';

  const requestId = ++latestRouteRequestId;

  try {
    const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
      directionsService.route(
        {
          origin: trimmedOrigin,
          destination: trimmedDestination,
          travelMode: google.maps.TravelMode.DRIVING,
          provideRouteAlternatives: false,
        },
        (response, responseStatus) => {
          if (responseStatus === 'OK' && response) {
            resolve(response);
            return;
          }

          const statusMessageMap: Record<string, string> = {
            INVALID_REQUEST: 'The navigation request is invalid. Check the addresses.',
            MAX_WAYPOINTS_EXCEEDED: 'Too many waypoints were requested.',
            NOT_FOUND: 'One or both addresses could not be found.',
            OVER_QUERY_LIMIT: 'Route requests are temporarily limited. Try again later.',
            REQUEST_DENIED: 'Navigation preview is not permitted with the current API key.',
            UNKNOWN_ERROR: 'An unknown error occurred while fetching the route.',
            ZERO_RESULTS: 'No routes could be found between the specified addresses.',
          };

          const message = statusMessageMap[responseStatus] || 'Failed to load the navigation preview.';
          reject(new Error(message));
        },
      );
    });

    if (requestId !== latestRouteRequestId) {
      return;
    }

    directionsRenderer.setDirections(result);
    status.value = 'ready';
  } catch (error) {
    if (requestId !== latestRouteRequestId) {
      return;
    }

    status.value = 'error';
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load the navigation preview.';
    clearRoute();
  }
}

async function refreshMap() {
  await ensureMap();
  await updateRoute();
}

watch(
  () => props.active,
  async (isActive) => {
    if (isActive) {
      await refreshMap();
    } else {
      clearRoute();
      status.value = 'inactive';
    }
  },
  { immediate: true },
);

watch(
  () => mapContainer.value,
  async (container) => {
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