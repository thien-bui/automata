<template>
  <v-sheet class="pa-4" elevation="1" rounded>
    <div class="route-summary">
      <div class="route-summary__section">
        <div class="route-summary__label text-overline text-medium-emphasis">Estimated duration</div>
        <div class="route-summary__value text-h4 font-weight-medium" aria-live="polite">
          {{ durationDisplay }}
        </div>
      </div>
      <div class="route-summary__section route-summary__section--meta">
        <div class="route-summary__meta text-body-2 text-medium-emphasis">Distance: {{ distanceDisplay }}</div>
        <div v-if="cacheDescription" class="route-summary__cache text-caption text-medium-emphasis">
          {{ cacheDescription }}
        </div>
      </div>
    </div>
  </v-sheet>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RouteTimeResponse } from '@automata/types';

interface Props {
  routeData: RouteTimeResponse | null;
  isPolling: boolean;
  cacheDescription: string;
}

const props = defineProps<Props>();

function formatToSingleDecimal(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toFixed(1);
}

const durationDisplay = computed(() => {
  if (!props.routeData) {
    return props.isPolling ? 'Loading…' : '—';
  }
  return `${formatToSingleDecimal(props.routeData.durationMinutes)} min`;
});

const distanceDisplay = computed(() => {
  if (!props.routeData) {
    return '—';
  }
  return `${formatToSingleDecimal(props.routeData.distanceKm)} km`;
});
</script>

<style scoped lang="scss">
.route-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: clamp(0.75rem, 2vw, 1.5rem);
  align-items: end;
}

.route-summary__section {
  display: grid;
  gap: clamp(0.25rem, 1vw, 0.5rem);
  min-width: 0;
}

.route-summary__section--meta {
  justify-items: end;
  text-align: end;
}

.route-summary__cache {
  max-width: 22rem;
}

@media (max-width: 640px) {
  .route-summary__section--meta {
    justify-items: start;
    text-align: start;
  }
}
</style>
