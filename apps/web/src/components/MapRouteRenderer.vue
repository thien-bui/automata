<template>
  <!-- This component handles the Google Maps route rendering logic -->
</template>

<script setup lang="ts">
import { inject, onBeforeUnmount, ref, watch, type PropType } from 'vue';
import { apiSymbol, mapSymbol } from 'vue3-google-map';

const props = defineProps<{
  active: boolean;
  origin: string;
  destination: string;
  lastUpdatedIso: string | null;
  defaultCenter: google.maps.LatLngLiteral;
  defaultZoom: number;
}>();

const emit = defineEmits<{
  'route-loading': [];
  'route-ready': [];
  'route-error': [message: string];
  'route-cleared': [];
}>();

const mapRef = inject(mapSymbol, ref<google.maps.Map | undefined>());
const apiRef = inject(apiSymbol, ref<typeof google.maps | undefined>());

const directionsService = ref<google.maps.DirectionsService | null>(null);
const directionsRenderer = ref<google.maps.DirectionsRenderer | null>(null);
const latestRequestId = ref(0);

const ensureDirections = (): boolean => {
  const map = mapRef.value;
  const api = apiRef.value;

  if (!map || !api) return false;

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

  return true;
};

const resetViewport = (): void => {
  const map = mapRef.value;
  if (map) {
    map.setCenter(props.defaultCenter);
    map.setZoom(props.defaultZoom);
  }
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
  if (!ensureDirections()) return;

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

    if (isCancelled() || latestRequestId.value !== requestId) return;

    directionsRenderer.value?.setDirections(result);
    emit('route-ready');
  } catch (error) {
    if (isCancelled() || latestRequestId.value !== requestId) return;

    clearRoute(false);
    const message = error instanceof Error ? error.message : 'Failed to load the navigation preview.';
    emit('route-error', message);
  }
};

watch(
  [
    () => props.active,
    () => props.origin,
    () => props.destination,
    () => props.lastUpdatedIso,
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

    if (!mapRef.value || !apiRef.value) return;

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
</script>
