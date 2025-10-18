<template>
  <v-sheet class="pa-4" elevation="1" rounded :class="{ 'route-summary--compact': isCompact }" data-test="route-summary">
    <div class="route-summary" :class="{ 'route-summary--compact': isCompact }">
      <div class="route-summary__section" :class="{ 'route-summary__section--compact': isCompact }">
        <div class="route-summary__label text-overline text-medium-emphasis" :class="{ 'text-caption': isCompact }">Estimated duration</div>
        <div class="route-summary__value text-h4 font-weight-medium" :class="{ 'text-h5': isCompact }" aria-live="polite" data-test="duration">
          {{ durationDisplay }}
        </div>
      </div>
      <div class="route-summary__section route-summary__section--meta" :class="{ 'route-summary__section--compact': isCompact }">
        <div class="route-summary__meta text-body-2 text-medium-emphasis" :class="{ 'text-caption': isCompact }" data-test="distance">Distance: {{ distanceDisplay }}</div>
        <div v-if="cacheDescription" class="route-summary__cache text-caption text-medium-emphasis" :class="{ 'text-caption': isCompact }">
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
  isCompact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isCompact: false,
});

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

.route-summary--compact {
  gap: clamp(0.5rem, 1.5vw, 0.75rem);
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
}

.route-summary__section {
  display: grid;
  gap: clamp(0.25rem, 1vw, 0.5rem);
  min-width: 0;
}

.route-summary__section--compact {
  gap: clamp(0.125rem, 0.5vw, 0.25rem);
}

.route-summary__section--meta {
  justify-items: end;
  text-align: end;
}

.route-summary__cache {
  max-width: 22rem;
}

.route-summary--compact .route-summary__cache {
  max-width: 18rem;
}

@media (max-width: 640px) {
  .route-summary__section--meta {
    justify-items: start;
    text-align: start;
  }
}

/* Compact mode specific styling */
.route-summary--compact {
  padding: clamp(0.5rem, 1.5vw, 0.75rem) !important;
}

.route-summary--compact .route-summary__value {
  font-size: clamp(1.2rem, 0.8vw + 1.1rem, 1.4rem) !important;
}

.route-summary--compact .route-summary__label {
  font-size: clamp(0.65rem, 0.3vw + 0.6rem, 0.75rem) !important;
}

.route-summary--compact .route-summary__meta {
  font-size: clamp(0.7rem, 0.3vw + 0.65rem, 0.8rem) !important;
}
</style>
