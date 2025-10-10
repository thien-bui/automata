<template>
  <div v-if="!isCompact && showHourlyForecast" class="mt-4">
    <div class="text-subtitle-1 font-weight-medium mb-3">Hourly Forecast</div>
    <v-card elevation="2" rounded class="hourly-forecast-card">
      <div class="hourly-forecast-container">
        <div
          v-for="(hour, index) in data"
          :key="hour.timestamp"
          class="hourly-item"
          :class="{ 
            'current-hour': currentHourHighlight && isCurrentHour(hour.timestamp) 
          }"
        >
          <div class="hourly-time">
            {{ currentHourHighlight && isCurrentHour(hour.timestamp) ? 'Now' : formatHour(hour.timestamp) }}
          </div>
          <div class="hourly-icon">
            <v-icon
              :icon="getWeatherIcon(hour.condition)"
              :size="currentHourHighlight && isCurrentHour(hour.timestamp) ? 32 : 24"
              :color="currentHourHighlight && isCurrentHour(hour.timestamp) ? 'primary' : 'grey-darken-1'"
            />
          </div>
          <div class="hourly-temperature" :class="{ 
            'current-temp': currentHourHighlight && isCurrentHour(hour.timestamp) 
            }">
              {{ formatTemperature(hour.temperatureFahrenheit) }}
            </div>
            <div v-if="currentHourHighlight && isCurrentHour(hour.timestamp)" class="hourly-details">
            <div class="text-caption text-medium-emphasis">{{ hour.condition }}</div>
            <div class="text-caption text-medium-emphasis">
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

defineProps<Props>();

function formatTemperature(fahrenheit: number): string {
  return `${Math.round(fahrenheit)}°`;
}

function formatHour(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
}

function getWeatherIcon(condition: string): string {
  const normalizedCondition = condition.toLowerCase();
  
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
  if (normalizedCondition.includes('partly') || normalizedCondition.includes('partly cloudy')) {
    return 'mdi-weather-partly-cloudy';
  }
  
  // Default icon
  return 'mdi-weather-sunny';
}

function isCurrentHour(timestamp: string): boolean {
  // This would need to be implemented based on current hour logic
  return false;
}
</script>

<style scoped>
.hourly-forecast-card {
  overflow: hidden;
}

.hourly-forecast-container {
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow-x: auto;
  align-items: flex-start;
}

.hourly-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 80px;
  padding: 12px 8px;
  border-radius: 8px;
  transition: all 0.2s ease-in-out;
  opacity: 0.7;
  background: transparent;
}

.hourly-item.current-hour {
  opacity: 1;
  background: rgba(var(--v-theme-primary), 0.1);
  border: 2px solid rgb(var(--v-theme-primary));
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(var(--v-theme-primary), 0.2);
}

.hourly-time {
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  margin-bottom: 8px;
  text-align: center;
}

.hourly-item.current-hour .hourly-time {
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}

.hourly-icon {
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hourly-temperature {
  font-size: 1.125rem;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  margin-bottom: 4px;
}

.hourly-item.current-hour .hourly-temperature {
  font-size: 1.375rem;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}

.hourly-details {
  text-align: center;
  margin-top: 8px;
  max-width: 120px;
}

/* Scrollbar styling for horizontal scroll */
.hourly-forecast-container::-webkit-scrollbar {
  height: 4px;
}

.hourly-forecast-container::-webkit-scrollbar-track {
  background: rgba(var(--v-theme-surface-variant), 0.3);
  border-radius: 2px;
}

.hourly-forecast-container::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface-variant), 0.5);
  border-radius: 2px;
}

.hourly-forecast-container::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--v-theme-on-surface-variant), 0.7);
}

@media (max-width: 960px) {
  .hourly-forecast-container {
    gap: 12px;
    padding: 12px;
  }

  .hourly-item {
    min-width: 70px;
    padding: 10px 6px;
  }

  .hourly-time {
    font-size: 0.75rem;
  }

  .hourly-temperature {
    font-size: 1rem;
  }

  .hourly-item.current-hour .hourly-temperature {
    font-size: 1.25rem;
  }

  .hourly-details {
    max-width: 100px;
  }
}

@media (max-width: 600px) {
  .hourly-forecast-container {
    gap: 8px;
    padding: 8px;
  }

  .hourly-item {
    min-width: 60px;
    padding: 8px 4px;
  }

  .hourly-time {
    font-size: 0.75rem;
  }

  .hourly-temperature {
    font-size: 1rem;
  }

  .hourly-item.current-hour .hourly-temperature {
    font-size: 1.25rem;
  }

  .hourly-details {
    max-width: 100px;
  }
}
</style>
