<template>
  <v-card class="map-preview" elevation="2" :aria-label="ariaLabel" data-testid="map-preview">
    <div class="map-frame">
      <div class="map-surface">
        <div
          v-if="status !== 'ready'"
          class="placeholder d-flex align-center justify-center text-body-2 text-medium-emphasis"
        >
          <span v-if="status === 'inactive'">Enable Nav mode to display the map.</span>
          <span v-else-if="status === 'no-key'">
            Set <code>VITE_GOOGLE_MAPS_BROWSER_KEY</code> to enable the map preview.
          </span>
          <span v-else-if="status === 'loading'">Loading map…</span>
          <span v-else-if="status === 'error'">{{ errorMessage }}</span>
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
import { computed, ref, watch } from 'vue';
import { GoogleMap } from 'vue3-google-map';
import type { Library } from '@googlemaps/js-api-loader';
import MapRouteRenderer from './MapRouteRenderer.vue';

const props = defineProps<{
  active: boolean;
  origin: string;
  destination: string;
  lastUpdatedIso: string | null;
}>();

type MapStatus = 'inactive' | 'loading' | 'ready' | 'no-key' | 'error';

const status = ref<MapStatus>('inactive');
const errorMessage = ref('');

const defaultCenter: google.maps.LatLngLiteral = { lat: 37.7749, lng: -122.4194 };
const defaultZoom = 11;

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY ?? '';
const mapLibraries: Library[] = ['routes', 'marker'];

const ariaLabel = computed(() => `Route preview map from ${props.origin} to ${props.destination}.`);

const lastUpdatedLabel = computed(() => {
  if (!props.lastUpdatedIso) return '';
  const timestamp = new Date(props.lastUpdatedIso);
  return Number.isNaN(timestamp.getTime()) ? '' : timestamp.toLocaleTimeString();
});

const shouldRenderMap = computed(() => props.active && Boolean(apiKey));

watch(
  () => props.active,
  (isActive) => {
    if (!isActive) {
      status.value = 'inactive';
      errorMessage.value = '';
      return;
    }

    if (!apiKey) {
      status.value = 'no-key';
      errorMessage.value = '';
      return;
    }

    status.value = 'loading';
    errorMessage.value = '';
  },
  { immediate: true },
);

const handleRouteLoading = (): void => {
  status.value = 'loading';
  errorMessage.value = '';
};

const handleRouteReady = (): void => {
  status.value = 'ready';
  errorMessage.value = '';
};

const handleRouteCleared = (): void => {
  status.value = 'ready';
  errorMessage.value = '';
};

const handleRouteError = (message: string): void => {
  status.value = 'error';
  errorMessage.value = message;
};
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
