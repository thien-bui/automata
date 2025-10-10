<template>
  <div class="weather-metrics" :class="{ 'weather-metrics--compact': isCompact }">
    <div v-if="showHumidity && humidity !== undefined" class="weather-metric">
      Humidity: {{ humidity }}%
    </div>
    <div v-if="showWindSpeed && windSpeed !== undefined" class="weather-metric">
      Wind: {{ windSpeed }} km/h
    </div>
    <div v-if="showPrecipitation && precipitation !== undefined" class="weather-metric">
      Precip: {{ precipitation }}%
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  humidity?: number;
  windSpeed?: number;
  precipitation?: number;
  showHumidity: boolean;
  showWindSpeed: boolean;
  showPrecipitation: boolean;
  isCompact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isCompact: false,
  showHumidity: false,
  showWindSpeed: false,
  showPrecipitation: false,
});
</script>

<style scoped>
.weather-metrics {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.weather-metrics--compact {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
}

.weather-metric {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.weather-metrics--compact .weather-metric:not(:last-child)::after {
  content: '•';
  margin-left: 8px;
}
</style>
