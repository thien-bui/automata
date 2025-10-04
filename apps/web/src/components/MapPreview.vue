<template>
  <div v-if="showMap" class="map-preview-container">
    <div ref="mapContainer" class="map-container"></div>
    <div v-if="isLoading" class="map-loading-overlay">
      <v-progress-circular indeterminate color="primary" size="48" />
      <div class="mt-2 text-body-2">Loading map...</div>
    </div>
    <div v-if="error" class="map-error-overlay">
      <v-alert type="error" variant="tonal" class="ma-2">
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
  mode: MonitoringMode.Simple,
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
      center: { lat: 47.6062, lng: -122.3321 }, // Default to Seattle
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

<style scoped>
.map-preview-container {
  position: relative;
  width: 100%;
  height: 400px;
  border-radius: 8px;
  overflow: hidden;
  margin-top: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.map-container {
  width: 100%;
  height: 100%;
  background-color: #f5f5f5;
}

.map-loading-overlay,
.map-error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.9);
  z-index: 10;
}

.map-error-overlay {
  padding: 16px;
}

@media (max-width: 960px) {
  .map-preview-container {
    height: 300px;
  }
}
</style>
