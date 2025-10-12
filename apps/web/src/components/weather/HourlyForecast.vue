<template>
  <div v-if="!isCompact && showHourlyForecast" class="hourly-forecast">
    <div class="hourly-forecast__title text-subtitle-1 font-weight-medium">Hourly Forecast</div>
    <v-card elevation="2" rounded class="hourly-forecast__card">
      <div class="hourly-forecast__scroller">
        <div
          v-for="(hour, index) in data"
          :key="hour.timestamp"
          class="hourly-forecast__item"
          :class="{ 'hourly-forecast__item--current': isHighlighted(hour.timestamp) }"
        >
          <div class="hourly-forecast__time">
            {{ isHighlighted(hour.timestamp) ? 'Now' : formatHour(hour.timestamp) }}
          </div>
          <div class="hourly-forecast__icon">
            <v-icon
              :icon="getWeatherIcon(hour.condition)"
              :size="isHighlighted(hour.timestamp) ? 32 : 24"
              :color="isHighlighted(hour.timestamp) ? 'primary' : 'grey-darken-1'"
            />
          </div>
          <div
            class="hourly-forecast__temperature"
            :class="{ 'hourly-forecast__temperature--current': isHighlighted(hour.timestamp) }"
          >
            {{ formatTemperature(hour.temperatureFahrenheit) }}
          </div>
          <div v-if="isHighlighted(hour.timestamp)" class="hourly-forecast__details">
            <div class="hourly-forecast__details-text text-caption text-medium-emphasis">
              {{ hour.condition }}
            </div>
            <div class="hourly-forecast__details-text text-caption text-medium-emphasis">
              <span v-if="showHumidity">{{ hour.humidityPercent }}%</span>
              <span v-if="showHumidity && showWindSpeed"> • </span>
              <span v-if="showWindSpeed">{{ hour.windSpeedKph }} km/h</span>
            </div>
          </div>
        </div>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import type { HourlyWeatherData } from '@automata/types';

interface Props {
  data: HourlyWeatherData[];
  isCompact: boolean;
  showHourlyForecast: boolean;
  currentHourHighlight: boolean;
  showHumidity: boolean;
  showWindSpeed: boolean;
}

const props = defineProps<Props>();

function formatTemperature(fahrenheit: number): string {
  return `${Math.round(fahrenheit)}°`;
}

function formatHour(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: true,
    timeZone: 'UTC',
  }).format(date);
}

function getWeatherIcon(condition: string): string {
  const normalizedCondition = condition.toLowerCase();

  if (normalizedCondition.includes('partly')) {
    return 'mdi-weather-partly-cloudy';
  }
  if (normalizedCondition.includes('clear') || normalizedCondition.includes('sunny')) {
    return 'mdi-weather-sunny';
  }
  if (normalizedCondition.includes('cloud') || normalizedCondition.includes('overcast')) {
    return 'mdi-weather-cloudy';
  }
  if (normalizedCondition.includes('rain') || normalizedCondition.includes('shower')) {
    return 'mdi-weather-rainy';
  }
  if (normalizedCondition.includes('snow') || normalizedCondition.includes('flurry')) {
    return 'mdi-weather-snowy';
  }
  if (normalizedCondition.includes('storm') || normalizedCondition.includes('thunder')) {
    return 'mdi-weather-lightning';
  }
  if (normalizedCondition.includes('fog') || normalizedCondition.includes('mist')) {
    return 'mdi-weather-fog';
  }
  if (normalizedCondition.includes('wind')) {
    return 'mdi-weather-windy';
  }

  // Default icon
  return 'mdi-weather-sunny';
}

function isCurrentHour(timestamp: string): boolean {
  const hourDate = new Date(timestamp);
  if (Number.isNaN(hourDate.getTime())) {
    return false;
  }
  
  const now = new Date();
  
  // Check if the timestamp is within the current hour
  // We compare the year, month, date, and hour to ensure it's the same hour
  return (
    hourDate.getFullYear() === now.getFullYear() &&
    hourDate.getMonth() === now.getMonth() &&
    hourDate.getDate() === now.getDate() &&
    hourDate.getHours() === now.getHours()
  );
}

function isHighlighted(timestamp: string): boolean {
  return props.currentHourHighlight && isCurrentHour(timestamp);
}
</script>

<style scoped lang="scss">
.hourly-forecast {
  display: grid;
  gap: clamp(0.75rem, 2.5vw, 1.5rem);
  margin-block-start: clamp(1rem, 3vw, 1.5rem);
}

.hourly-forecast__title {
  padding-inline: clamp(0.25rem, 2vw, 0.5rem);
}

.hourly-forecast__card {
  overflow: hidden;
}

.hourly-forecast__scroller {
  display: flex;
  align-items: flex-start;
  gap: clamp(0.75rem, 2vw, 1.25rem);
  padding: clamp(0.75rem, 2vw, 1.25rem);
  overflow-x: auto;
}

.hourly-forecast__item {
  display: grid;
  justify-items: center;
  gap: clamp(0.5rem, 1.5vw, 0.75rem);
  min-width: clamp(4.5rem, 10vw, 5.5rem);
  padding-block: clamp(0.75rem, 2vw, 1rem);
  padding-inline: clamp(0.5rem, 1.5vw, 0.75rem);
  border-radius: clamp(0.5rem, 1vw, 0.75rem);
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out,
    background-color 0.2s ease-in-out, opacity 0.2s ease-in-out;
  background-color: transparent;
  opacity: 0.75;
}

.hourly-forecast__item--current {
  opacity: 1;
  background-color: rgba(var(--v-theme-primary), 0.08);
  border: 2px solid rgb(var(--v-theme-primary));
  box-shadow: 0 8px 20px rgba(var(--v-theme-primary), 0.2);
  transform: scale(1.03);
}

.hourly-forecast__time {
  font-size: clamp(0.8rem, 0.5vw + 0.75rem, 0.95rem);
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  text-align: center;
}

.hourly-forecast__item--current .hourly-forecast__time {
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}

.hourly-forecast__icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.hourly-forecast__temperature {
  font-size: clamp(1rem, 0.75vw + 0.9rem, 1.2rem);
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
}

.hourly-forecast__temperature--current {
  font-size: clamp(1.15rem, 0.75vw + 1rem, 1.4rem);
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}

.hourly-forecast__details {
  display: grid;
  gap: 0.25rem;
  text-align: center;
  max-width: 8.5rem;
}

.hourly-forecast__details-text {
  line-height: 1.2;
}

.hourly-forecast__scroller::-webkit-scrollbar {
  height: 0.25rem;
}

.hourly-forecast__scroller::-webkit-scrollbar-track {
  background: rgba(var(--v-theme-surface-variant), 0.3);
  border-radius: 999px;
}

.hourly-forecast__scroller::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface-variant), 0.5);
  border-radius: 999px;
}

.hourly-forecast__scroller::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--v-theme-on-surface-variant), 0.7);
}

@media (max-width: 960px) {
  .hourly-forecast__item {
    min-width: clamp(4rem, 12vw, 5rem);
  }
}

@media (max-width: 600px) {
  .hourly-forecast__item {
    min-width: clamp(3.5rem, 14vw, 4.75rem);
  }
}
</style>
