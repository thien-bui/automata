<template>
  <v-sheet
    class="weather-summary-card"
    :class="{ 'weather-summary-card--compact': isCompact }"
    elevation="1"
    rounded
  >
    <div class="weather-summary__layout">
      <div class="widget-summary__section">
        <div class="weather-summary__label text-overline text-medium-emphasis">
          Current Temperature
        </div>
        <div class="weather-summary__temperature text-h4 font-weight-medium" aria-live="polite">
          {{ temperature }}
        </div>
        <div class="weather-summary__condition text-body-1 text-medium-emphasis">
          {{ condition }}
        </div>
        <WeatherMetrics
          v-if="isCompact && showMetrics"
          class="weather-summary__metrics"
          v-bind="sanitizedMetrics"
          :show-humidity="showHumidity"
          :show-wind-speed="showWindSpeed"
          :show-precipitation="showPrecipitation"
          :is-compact="isCompact"
        />
      </div>
      <div v-if="!isCompact" class="widget-summary__section widget-summary__section--end">
        <WeatherMetrics
          class="weather-summary__metrics"
          v-bind="sanitizedMetrics"
          :show-humidity="showHumidity"
          :show-wind-speed="showWindSpeed"
          :show-precipitation="showPrecipitation"
          :is-compact="isCompact"
        />
      </div>
    </div>
  </v-sheet>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import WeatherMetrics from './WeatherMetrics.vue';

interface Props {
  temperature: string;
  condition: string;
  humidity?: number;
  windSpeed?: number;
  precipitation?: number;
  isCompact: boolean;
  showMetrics: boolean;
  showHumidity: boolean;
  showWindSpeed: boolean;
  showPrecipitation: boolean;
}

const props = defineProps<Props>();

const sanitizedMetrics = computed(() => ({
  humidity: props.showHumidity ? props.humidity : undefined,
  windSpeed: props.showWindSpeed ? props.windSpeed : undefined,
  precipitation: props.showPrecipitation ? props.precipitation : undefined,
}));
</script>

<style scoped lang="scss">
.weather-summary-card {
  padding: clamp(1rem, 2vw, 1.5rem);
  transition: padding 0.2s ease;
}

.weather-summary-card--compact {
  padding: clamp(0.75rem, 2vw, 1rem);
}

.weather-summary__layout {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: clamp(0.75rem, 3vw, 1.5rem);
  align-items: end;
}

.widget-summary__section {
  display: grid;
  gap: clamp(0.375rem, 1vw, 0.75rem);
  min-width: 0;
}

.widget-summary__section--end {
  justify-items: end;
  text-align: end;
}

.weather-summary__metrics {
  width: 100%;
}

.weather-summary-card--compact .weather-summary__metrics {
  width: auto;
}

.weather-summary__condition {
  max-width: 28rem;
}

@media (max-width: 640px) {
  .widget-summary__section--end {
    justify-items: start;
    text-align: start;
  }
}
</style>
