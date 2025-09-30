<template>
  <v-card class="map-preview" elevation="2" :aria-label="ariaLabel">
    <v-responsive aspect-ratio="16/9">
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
    </v-responsive>
  </v-card>
</template>

<script setup lang="ts">
import { Loader } from '@googlemaps/js-api-loader';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

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
const loader = ref<Loader | null>(null);

type LoadedGoogle = Awaited<ReturnType<Loader['load']>>;

let googleModule: LoadedGoogle | null = null;
let mapInstance: unknown = null;

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

async function ensureMap() {
  if (!props.active) {
    status.value = 'inactive';
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

  if (!loader.value) {
    loader.value = new Loader({
      apiKey,
      version: 'weekly',
    });
  }

  status.value = 'loading';

  try {
    googleModule = await loader.value.load();

    if (!mapContainer.value) {
      status.value = 'error';
      errorMessage.value = 'Unable to attach map container.';
      return;
    }

    const mapsApi = googleModule as LoadedGoogle;

    mapInstance = new mapsApi.maps.Map(mapContainer.value, {
      center: { lat: 37.7749, lng: -122.4194 },
      zoom: 11,
      disableDefaultUI: true,
      keyboardShortcuts: false,
    });

    status.value = 'ready';
  } catch (error) {
    status.value = 'error';
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load map.';
  }
}

watch(
  () => props.active,
  () => {
    ensureMap();
  },
  { immediate: true },
);

watch(
  () => mapContainer.value,
  (container) => {
    if (container && props.active) {
      ensureMap();
    }
  },
);

onMounted(() => {
  ensureMap();
});

onBeforeUnmount(() => {
  mapInstance = null;
  googleModule = null;
});
</script>

<style scoped>
.map-preview {
  overflow: hidden;
}

.map-surface {
  position: relative;
  width: 100%;
  height: 100%;
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
