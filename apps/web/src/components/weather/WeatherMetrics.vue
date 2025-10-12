<template>
  <div class="weather-metrics" :class="{ 'weather-metrics--compact': isCompact }">
    <div v-if="showHumidity && humidity !== undefined" class="weather-metrics__item">
      Humidity: {{ humidity }}%
    </div>
    <div v-if="showWindSpeed && windSpeed !== undefined" class="weather-metrics__item">
      Wind: {{ windSpeed }} km/h
    </div>
    <div v-if="showPrecipitation && precipitation !== undefined" class="weather-metrics__item">
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

<style scoped lang="scss">
.weather-metrics {
  display: grid;
  gap: clamp(0.25rem, 1vw, 0.5rem);
  font-size: clamp(0.8rem, 0.3vw + 0.75rem, 0.9rem);
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.weather-metrics--compact {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: clamp(0.5rem, 1vw, 0.75rem);
}

.weather-metrics__item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.weather-metrics--compact .weather-metrics__item:not(:last-child)::after {
  content: '•';
  margin-inline-start: 0.5rem;
  opacity: 0.6;
}
</style>
