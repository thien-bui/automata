<template>
  <v-card class="map-preview" elevation="2" :aria-label="ariaLabel" data-testid="map-preview">
    <div class="map-frame">
      <div class="map-surface">
        <div
          v-if="status !== MapStatus.Ready"
          class="placeholder d-flex align-center justify-center text-body-2 text-medium-emphasis"
        >
          <span v-if="status === MapStatus.Inactive">Enable Nav mode to display the map.</span>
          <span v-else-if="status === MapStatus.NoKey">
            Set <code>VITE_GOOGLE_MAPS_BROWSER_KEY</code> to enable the map preview.
          </span>
          <span v-else-if="status === MapStatus.Loading">Loading map…</span>
          <span v-else-if="status === MapStatus.Error">{{ errorMessage }}</span>
        </div>

        <GoogleMap
          v-if="shouldRenderMap"
          class="map-canvas"
          :api-key="apiKey"
          :libraries="mapLibraries"
          :center="defaultCenter"
          :zoom="defaultZoom"
          :disable-default-ui="true"
          :keyboard-shortcuts="false"
        >
          <MapRouteRenderer
            :active="props.active"
            :origin="props.origin"
            :destination="props.destination"
            :last-updated-iso="props.lastUpdatedIso"
            :default-center="defaultCenter"
            :default-zoom="defaultZoom"
            @route-loading="handleRouteLoading"
            @route-ready="handleRouteReady"
            @route-error="handleRouteError"
            @route-cleared="handleRouteCleared"
          />
        </GoogleMap>

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
import {
  computed,
  defineComponent,
  inject,
  onBeforeUnmount,
  ref,
  watch,
  type PropType,
} from 'vue';

import { GoogleMap, apiSymbol, mapSymbol } from 'vue3-google-map';
import type { Library } from '@googlemaps/js-api-loader';

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

const status = ref<MapStatus>(MapStatus.Inactive);
const errorMessage = ref('');

const defaultCenter: google.maps.LatLngLiteral = { lat: 37.7749, lng: -122.4194 };
const defaultZoom = 11;

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY ?? '';
const mapLibraries: Library[] = ['routes', 'marker'];

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

const shouldRenderMap = computed(() => props.active && Boolean(apiKey));

watch(
  () => props.active,
  (isActive) => {
    if (!isActive) {
      status.value = MapStatus.Inactive;
      errorMessage.value = '';
      return;
    }

    if (!apiKey) {
      status.value = MapStatus.NoKey;
      errorMessage.value = '';
      return;
    }

    status.value = MapStatus.Loading;
    errorMessage.value = '';
  },
  { immediate: true },
);

function handleRouteLoading(): void {
  status.value = MapStatus.Loading;
  errorMessage.value = '';
}

function handleRouteReady(): void {
  status.value = MapStatus.Ready;
  errorMessage.value = '';
}

function handleRouteCleared(): void {
  status.value = MapStatus.Ready;
  errorMessage.value = '';
}

function handleRouteError(message: string): void {
  status.value = MapStatus.Error;
  errorMessage.value = message;
}

const MapRouteRenderer = defineComponent({
  name: 'MapRouteRenderer',
  props: {
    active: {
      type: Boolean,
      required: true,
    },
    origin: {
      type: String,
      required: true,
    },
    destination: {
      type: String,
      required: true,
    },
    lastUpdatedIso: {
      type: String as PropType<string | null>,
      default: null,
    },
    defaultCenter: {
      type: Object as PropType<google.maps.LatLngLiteral>,
      required: true,
    },
    defaultZoom: {
      type: Number,
      required: true,
    },
  },
  emits: {
    'route-loading': () => true,
    'route-ready': () => true,
    'route-error': (message: string) => typeof message === 'string',
    'route-cleared': () => true,
  },
  setup(componentProps, { emit }) {
    const mapRef = inject(mapSymbol, ref<google.maps.Map | undefined>());
    const apiRef = inject(apiSymbol, ref<typeof google.maps | undefined>());

    const directionsService = ref<google.maps.DirectionsService | null>(null);
    const directionsRenderer = ref<google.maps.DirectionsRenderer | null>(null);
    const latestRequestId = ref(0);

    const ensureDirections = (): boolean => {
      const map = mapRef.value;
      const api = apiRef.value;

      if (!map || !api) {
        return false;
      }

      if (!directionsService.value) {
        directionsService.value = new api.DirectionsService();
      }

      if (!directionsRenderer.value) {
        directionsRenderer.value = new api.DirectionsRenderer({
          map,
          suppressMarkers: false,
          preserveViewport: false,
        });
      } else {
        directionsRenderer.value.setMap(map);
      }

      return Boolean(directionsService.value && directionsRenderer.value);
    };

    const resetViewport = (): void => {
      const map = mapRef.value;
      if (!map) {
        return;
      }
      map.setCenter(componentProps.defaultCenter);
      map.setZoom(componentProps.defaultZoom);
    };

    const clearRoute = (cancelOutstanding: boolean): void => {
      if (cancelOutstanding) {
        latestRequestId.value += 1;
      }
      directionsRenderer.value?.setDirections(null);
      resetViewport();
    };

    const statusMessageMap: Partial<Record<google.maps.DirectionsStatus, string>> = {
      INVALID_REQUEST: 'The navigation request is invalid. Check the addresses.',
      MAX_WAYPOINTS_EXCEEDED: 'Too many waypoints were requested.',
      NOT_FOUND: 'One or both addresses could not be found.',
      OVER_QUERY_LIMIT: 'Route requests are temporarily limited. Try again later.',
      REQUEST_DENIED: 'Navigation preview is not permitted with the current API key.',
      UNKNOWN_ERROR: 'An unknown error occurred while fetching the route.',
      ZERO_RESULTS: 'No routes could be found between the specified addresses.',
    };

    const fetchRoute = async (
      origin: string,
      destination: string,
      isCancelled: () => boolean,
    ): Promise<void> => {
      if (!ensureDirections()) {
        return;
      }

      emit('route-loading');

      const requestId = ++latestRequestId.value;

      try {
        const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
          directionsService.value?.route(
            {
              origin,
              destination,
              travelMode: apiRef.value?.TravelMode.DRIVING ?? google.maps.TravelMode.DRIVING,
              provideRouteAlternatives: false,
            },
            (response, responseStatus: google.maps.DirectionsStatus) => {
              if (responseStatus === 'OK' && response) {
                resolve(response);
                return;
              }

              const message = statusMessageMap[responseStatus] ?? 'Failed to load the navigation preview.';
              reject(new Error(message));
            },
          );
        });

        if (isCancelled() || latestRequestId.value !== requestId) {
          return;
        }

        directionsRenderer.value?.setDirections(result);
        emit('route-ready');
      } catch (error) {
        if (isCancelled() || latestRequestId.value !== requestId) {
          return;
        }

        clearRoute(false);
        const message = error instanceof Error ? error.message : 'Failed to load the navigation preview.';
        emit('route-error', message);
      }
    };

    watch(
      [
        () => componentProps.active,
        () => componentProps.origin,
        () => componentProps.destination,
        () => componentProps.lastUpdatedIso,
        mapRef,
        apiRef,
      ],
      async ([isActive, origin, destination], _oldValue, onCleanup) => {
        let cancelled = false;
        onCleanup(() => {
          cancelled = true;
          latestRequestId.value += 1;
        });

        if (!isActive) {
          clearRoute(true);
          return;
        }

        if (!mapRef.value || !apiRef.value) {
          return;
        }

        const trimmedOrigin = origin.trim();
        const trimmedDestination = destination.trim();

        if (!trimmedOrigin || !trimmedDestination) {
          clearRoute(true);
          emit('route-cleared');
          return;
        }

        await fetchRoute(trimmedOrigin, trimmedDestination, () => cancelled);
      },
      { immediate: true },
    );

    onBeforeUnmount(() => {
      latestRequestId.value += 1;
      directionsRenderer.value?.setMap(null);
      directionsRenderer.value = null;
      directionsService.value = null;
    });

    return {};
  },
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

.map-canvas {
  position: absolute;
  inset: 0;
}

.map-canvas :deep(.mapdiv) {
  width: 100%;
  height: 100%;
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
