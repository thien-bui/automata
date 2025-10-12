<template>
  <div v-if="showMap" class="map-preview">
    <div ref="mapContainer" class="map-preview__canvas"></div>
    <div v-if="isLoading" class="map-preview__overlay map-preview__overlay--loading">
      <v-progress-circular indeterminate color="primary" size="48" />
      <div class="map-preview__message text-body-2">Loading map...</div>
    </div>
    <div v-if="error" class="map-preview__overlay map-preview__overlay--error">
      <v-alert type="error" variant="tonal" class="map-preview__alert">
        {{ error }}
      </v-alert>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { Loader } from '@googlemaps/js-api-loader';
import { MonitoringMode } from './monitoringMode';

interface Props {
  mode?: MonitoringMode;
  from?: string;
  to?: string;
}

const props = withDefaults(defineProps<Props>(), {
  mode: MonitoringMode.Compact,
  from: '',
  to: '',
});

const mapContainer = ref<HTMLElement>();
const isLoading = ref(false);
const error = ref<string | null>(null);
let map: google.maps.Map | null = null;
let directionsService: google.maps.DirectionsService | null = null;
let directionsRenderer: google.maps.DirectionsRenderer | null = null;
let loader: Loader | null = null;

const showMap = computed(() => props.mode === MonitoringMode.Nav && props.from && props.to);

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY;

async function initializeGoogleMaps() {
  if (!GOOGLE_MAPS_API_KEY) {
    error.value = 'Google Maps API key is not configured';
    return false;
  }

  if (loader) {
    // Re-initialize services if they were cleaned up
    if (!directionsService || !directionsRenderer) {
      directionsService = new google.maps.DirectionsService();
      directionsRenderer = new google.maps.DirectionsRenderer({
        suppressMarkers: false,
        suppressInfoWindows: true,
        polylineOptions: {
          strokeColor: '#1976D2',
          strokeWeight: 4,
          strokeOpacity: 0.8,
        },
      });
    }
    return true; // Already initialized
  }

  try {
    isLoading.value = true;
    error.value = null;

    loader = new Loader({
      apiKey: GOOGLE_MAPS_API_KEY,
      version: 'weekly',
      libraries: ['geometry', 'places'],
    });

    await loader.load();
    
    // Initialize services
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: false,
      suppressInfoWindows: true,
      polylineOptions: {
        strokeColor: '#1976D2',
        strokeWeight: 4,
        strokeOpacity: 0.8,
      },
    });

    return true;
  } catch (err) {
    console.error('Failed to load Google Maps:', err);
    error.value = 'Failed to load Google Maps. Please check your API key configuration.';
    return false;
  } finally {
    isLoading.value = false;
  }
}

async function initializeMap() {
  if (!mapContainer.value || !showMap.value) {
    return;
  }

  const mapsInitialized = await initializeGoogleMaps();
  if (!mapsInitialized) {
    return;
  }

  try {
    isLoading.value = true;
    error.value = null;

    // Create map instance
    map = new google.maps.Map(mapContainer.value, {
      zoom: 10,
      center: { 
        lat: parseFloat(import.meta.env.VITE_DEFAULT_LATITUDE || '47.6062'), 
        lng: parseFloat(import.meta.env.VITE_DEFAULT_LONGITUDE || '-122.3321')
      }, // Default coordinates from environment
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      gestureHandling: 'cooperative',
    });

    // Bind directions renderer to map
    if (directionsRenderer) {
      directionsRenderer.setMap(map);
    }

    // Load the route
    await loadRoute();
  } catch (err) {
    console.error('Failed to initialize map:', err);
    error.value = 'Failed to initialize map';
  } finally {
    isLoading.value = false;
  }
}

async function loadRoute() {
  if (!directionsService || !directionsRenderer || !props.from || !props.to) {
    return;
  }

  try {
    isLoading.value = true;
    error.value = null;

    const request: google.maps.DirectionsRequest = {
      origin: props.from,
      destination: props.to,
      travelMode: google.maps.TravelMode.DRIVING,
      unitSystem: google.maps.UnitSystem.IMPERIAL,
    };

    const result = await directionsService.route(request);
    directionsRenderer.setDirections(result);

    // Fit map to route bounds
    if (result.routes[0]?.bounds && map) {
      map.fitBounds(result.routes[0].bounds);
    }
  } catch (err) {
    console.error('Failed to load route:', err);
    error.value = 'Failed to load route. Please check the addresses and try again.';
  } finally {
    isLoading.value = false;
  }
}

function cleanupMap() {
  if (directionsRenderer) {
    directionsRenderer.setMap(null);
  }
  map = null;
  directionsService = null;
  directionsRenderer = null;
}

// Watch for mode changes
watch(
  () => showMap.value,
  (shouldShow) => {
    if (shouldShow) {
      // Delay initialization to ensure DOM is ready
      setTimeout(() => {
        initializeMap();
      }, 100);
    } else {
      cleanupMap();
    }
  },
  { immediate: true }
);

// Watch for route changes
watch(
  [() => props.from, () => props.to],
  () => {
    if (showMap.value && map) {
      loadRoute();
    }
  }
);

onMounted(() => {
  // Component will initialize map when showMap becomes true
});

onBeforeUnmount(() => {
  cleanupMap();
});
</script>

<style scoped lang="scss">
.map-preview {
  position: relative;
  width: 100%;
  min-height: clamp(18rem, 40vw, 25rem);
  border-radius: clamp(0.5rem, 1vw, 0.75rem);
  overflow: hidden;
  margin-block-start: clamp(1rem, 3vw, 1.5rem);
  box-shadow: 0 6px 20px rgba(17, 24, 39, 0.12);
}

.map-preview__canvas {
  width: 100%;
  height: 100%;
  background-color: #f5f5f5;
}

.map-preview__overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  place-items: center;
  gap: 0.75rem;
  z-index: 10;
}

.map-preview__overlay--loading {
  background-color: rgba(255, 255, 255, 0.9);
}

.map-preview__overlay--error {
  padding: clamp(1rem, 3vw, 1.5rem);
  background-color: rgba(254, 242, 242, 0.92);
}

.map-preview__message {
  text-align: center;
}

.map-preview__alert {
  width: min(100%, 24rem);
}

@media (max-width: 960px) {
  .map-preview {
    min-height: clamp(16rem, 50vw, 22rem);
  }
}
</style>
