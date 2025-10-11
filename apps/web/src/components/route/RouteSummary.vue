<template>
  <v-sheet class="pa-4" elevation="1" rounded>
    <div class="widget-summary">
      <div class="widget-summary__section">
        <div class="text-overline text-medium-emphasis">Estimated duration</div>
        <div class="text-h4 font-weight-medium" aria-live="polite">
          {{ durationDisplay }}
        </div>
      </div>
      <div class="widget-summary__section widget-summary__section--end">
        <div class="text-body-2 text-medium-emphasis">Distance: {{ distanceDisplay }}</div>
        <div v-if="cacheDescription" class="text-caption text-medium-emphasis mt-1">
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

const durationDisplay = computed(() => {
  if (!props.routeData) {
    return props.isPolling ? 'Loading…' : '—';
  }
  return `${props.routeData.durationMinutes.toFixed(1)} min`;
});

const distanceDisplay = computed(() => {
  if (!props.routeData) {
    return '—';
  }
  return `${props.routeData.distanceKm.toFixed(1)} km`;
});
</script>

<style scoped>
.widget-summary {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.widget-summary__section {
  flex: 1;
}

.widget-summary__section--end {
  text-align: right;
  align-self: flex-end;
}
</style>
