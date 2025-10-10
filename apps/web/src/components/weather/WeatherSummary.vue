<template>
  <v-sheet
    class="weather-summary-card"
    :class="{ 'weather-summary-card--compact': isCompact }"
    elevation="1"
    rounded
  >
    <div class="widget-summary">
      <div class="widget-summary__section">
        <div class="text-overline text-medium-emphasis">Current Temperature</div>
        <div class="text-h4 font-weight-medium" aria-live="polite">
          {{ temperature }}
        </div>
        <div class="text-body-1 text-medium-emphasis mt-1">
          {{ condition }}
        </div>
        <WeatherMetrics
          v-if="isCompact && showMetrics"
          :humidity="humidity"
          :wind-speed="windSpeed"
          :show-humidity="showHumidity"
          :show-wind-speed="showWindSpeed"
          :show-precipitation="showPrecipitation"
          :is-compact="isCompact"
        />
      </div>
      <div
        v-if="!isCompact"
        class="widget-summary__section widget-summary__section--end"
      >
        <WeatherMetrics
          :humidity="humidity"
          :wind-speed="windSpeed"
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

defineProps<Props>();
</script>

<style scoped>
.weather-summary-card {
  padding: 16px;
  transition: padding 0.2s ease;
}

.weather-summary-card--compact {
  padding: 12px;
}

.widget-summary {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.widget-summary__section {
  flex: 1;
}

.widget-summary__section--end {
  text-align: right;
}
</style>
