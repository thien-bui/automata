<template>
  <PollingWidget
    overline-text="Weather"
    title="Current Conditions"
    :subtitle="locationLabel"
    error-title="Weather Error"
    settings-title="Weather Settings"
    :error="weatherError"
    :is-polling="isPolling"
    :last-updated-iso="lastUpdatedIso"
    :is-stale="isStale"
    :polling-seconds="pollingSeconds"
    :cache-description="cacheDescription"
    @manual-refresh="handleManualRefresh"
    @hard-refresh="handleHardRefresh"
    @save-settings="handleSaveSettings"
  >
    <template #main-content>
      <v-sheet class="pa-4" elevation="1" rounded>
        <div class="d-flex align-center justify-space-between">
          <div>
            <div class="text-overline text-medium-emphasis">Current Temperature</div>
            <div class="text-h4 font-weight-medium" aria-live="polite">
              {{ currentTemperatureDisplay }}
            </div>
            <div class="text-body-1 text-medium-emphasis mt-1">
              {{ currentConditionDisplay }}
            </div>
          </div>
          <div class="text-end">
            <div class="text-body-2 text-medium-emphasis">Humidity: {{ humidityDisplay }}</div>
            <div class="text-body-2 text-medium-emphasis">Wind: {{ windDisplay }}</div>
            <div v-if="cacheDescription" class="text-caption text-medium-emphasis mt-1">
              {{ cacheDescription }}
            </div>
          </div>
        </div>
      </v-sheet>

      <div class="mt-4">
        <div class="text-subtitle-1 font-weight-medium mb-3">Hourly Forecast</div>
        <div class="hourly-forecast-cards">
          <v-card
            v-for="hour in displayedHourlyData"
            :key="hour.timestamp"
            class="hourly-weather-card"
            elevation="2"
            rounded
          >
            <v-card-item>
              <template v-slot:subtitle>
                <div class="text-caption text-medium-emphasis">
                  {{ formatHour(hour.timestamp) }}
                </div>
              </template>
            </v-card-item>

            <v-card-text class="py-2">
              <v-row align="center" no-gutters>
                <v-col class="text-center" cols="12">
                  <div class="text-h5 font-weight-medium">
                    {{ formatTemperature(hour.temperatureCelsius) }}
                  </div>
                  <div class="text-caption text-medium-emphasis mt-1">
                    {{ hour.condition }}
                  </div>
                </v-col>
              </v-row>
            </v-card-text>

            <div class="d-flex py-2 justify-space-around">
              <v-list-item
                density="compact"
                prepend-icon="mdi-water-percent"
              >
                <v-list-item-subtitle>{{ hour.humidityPercent }}%</v-list-item-subtitle>
              </v-list-item>

              <v-list-item
                density="compact"
                prepend-icon="mdi-weather-windy"
              >
                <v-list-item-subtitle>{{ hour.windSpeedKph }} km/h</v-list-item-subtitle>
              </v-list-item>

              <v-list-item
                v-if="hour.precipitationProbability !== undefined"
                density="compact"
                prepend-icon="mdi-weather-rainy"
              >
                <v-list-item-subtitle>{{ hour.precipitationProbability }}%</v-list-item-subtitle>
              </v-list-item>
            </div>
          </v-card>
        </div>
      </div>
    </template>

    <template #settings-content>
      <v-text-field
        v-model="locationInput"
        label="Location"
        placeholder="Enter city or address"
        variant="outlined"
        density="compact"
        @keyup.enter="updateLocation"
      />
      <v-text-field
        v-model.number="refreshIntervalInput"
        label="Refresh Interval (seconds)"
        type="number"
        min="60"
        max="3600"
        variant="outlined"
        density="compact"
        @keyup.enter="updateRefreshInterval"
      />
    </template>
  </PollingWidget>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { HourlyWeatherData } from '@automata/types';
import PollingWidget from './PollingWidget.vue';
import { useWeather, type WeatherFetchReason } from '../composables/useWeather';
import { useToasts } from '../composables/useToasts';

const DEFAULT_LOCATION = 'Seattle, WA';
const DEFAULT_REFRESH_SECONDS = 300;

const drawerOpen = ref(false);
const locationInput = ref(DEFAULT_LOCATION);
const refreshIntervalInput = ref(DEFAULT_REFRESH_SECONDS);

const {
  data: weatherData,
  error: weatherError,
  isLoading,
  isRefreshing,
  isStale,
  lastUpdatedIso,
  cacheAgeSeconds,
  cacheHit,
  refresh: refreshWeather,
  setLocation,
  setFreshnessSeconds,
  location,
  freshnessSeconds,
} = useWeather({
  location: DEFAULT_LOCATION,
  freshnessSeconds: DEFAULT_REFRESH_SECONDS,
});

const { push: pushToast } = useToasts();

let intervalHandle: number | null = null;
let lastErrorMessage: string | null = null;

const isPolling = computed(() => isLoading.value || isRefreshing.value);

const pollingSeconds = computed(() => freshnessSeconds.value);

const statusText = computed(() => {
  if (isPolling.value) {
    return 'Refreshing weather data…';
  }
  if (weatherError.value) {
    return weatherError.value;
  }
  if (!lastUpdatedIso.value) {
    return 'Awaiting first update.';
  }
  const timestamp = new Date(lastUpdatedIso.value);
  if (Number.isNaN(timestamp.getTime())) {
    return 'Awaiting first update.';
  }
  const formatted = timestamp.toLocaleTimeString();
  return isStale.value ? `Showing cached data from ${formatted}.` : `Last updated ${formatted}.`;
});

const progressValue = computed(() => (isPolling.value ? undefined : 100));

const cacheDescription = computed(() => {
  if (!weatherData.value) {
    return '';
  }
  if (isStale.value) {
    return 'Serving cached data while provider recovers.';
  }
  if (cacheHit.value) {
    return cacheAgeSeconds.value !== null
      ? `Cache hit • age ${cacheAgeSeconds.value}s`
      : 'Cache hit';
  }
  return 'Live provider data';
});

const locationLabel = computed(() => location.value);

const settingsAria = computed(() => `Open weather settings for ${location.value}.`);

const currentTemperatureDisplay = computed(() => {
  if (!weatherData.value || weatherData.value.hourlyData.length === 0) {
    return isPolling.value ? 'Loading…' : '—';
  }
  const current = weatherData.value.hourlyData[0];
  return `${Math.round(current.temperatureCelsius)}°C / ${Math.round(current.temperatureFahrenheit)}°F`;
});

const currentConditionDisplay = computed(() => {
  if (!weatherData.value || weatherData.value.hourlyData.length === 0) {
    return '—';
  }
  return weatherData.value.hourlyData[0].condition;
});

const humidityDisplay = computed(() => {
  if (!weatherData.value || weatherData.value.hourlyData.length === 0) {
    return '—';
  }
  const current = weatherData.value.hourlyData[0];
  return current.humidityPercent !== undefined ? `${current.humidityPercent}%` : '—';
});

const windDisplay = computed(() => {
  if (!weatherData.value || weatherData.value.hourlyData.length === 0) {
    return '—';
  }
  const current = weatherData.value.hourlyData[0];
  return current.windSpeedKph !== undefined ? `${current.windSpeedKph} km/h` : '—';
});

const displayedHourlyData = computed(() => {
  if (!weatherData.value) {
    return [];
  }
  // Show next 12 hours or available hours, whichever is less
  return weatherData.value.hourlyData.slice(0, 12);
});

function formatTemperature(celsius: number): string {
  return `${Math.round(celsius)}°`;
}

function formatHour(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
}

function clearIntervalHandle() {
  if (intervalHandle) {
    window.clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

async function triggerPolling(reason: WeatherFetchReason, options: { forceRefresh?: boolean } = {}) {
  const background = reason === 'interval';
  await refreshWeather({ background, reason, forceRefresh: options.forceRefresh });
  const manualTrigger = reason === 'manual' || reason === 'hard-manual';
  if (manualTrigger && !weatherError.value) {
    pushToast({
      text: options.forceRefresh ? 'Weather data refreshed from provider.' : 'Weather data refreshed.',
      variant: 'success',
    });
  }
}

function updateLocation() {
  setLocation(locationInput.value);
}

function updateRefreshInterval() {
  setFreshnessSeconds(refreshIntervalInput.value);
}

function handleManualRefresh() {
  void triggerPolling('manual');
}

function handleHardRefresh() {
  void triggerPolling('hard-manual', { forceRefresh: true });
}

function handleSaveSettings() {
  updateLocation();
  updateRefreshInterval();
  pushToast({
    text: 'Weather settings saved.',
    variant: 'success',
  });
}

function saveSettings() {
  updateLocation();
  updateRefreshInterval();
  drawerOpen.value = false;
  pushToast({
    text: 'Weather settings saved.',
    variant: 'success',
  });
}

onMounted(() => {
  locationInput.value = location.value;
  refreshIntervalInput.value = freshnessSeconds.value;
  void triggerPolling('initial');
});

onBeforeUnmount(() => {
  clearIntervalHandle();
});

watch(
  () => pollingSeconds.value,
  (seconds, _previous, onCleanup) => {
    setFreshnessSeconds(seconds);
    clearIntervalHandle();

    if (!Number.isFinite(seconds) || seconds <= 0) {
      return;
    }

    intervalHandle = window.setInterval(() => {
      void triggerPolling('interval');
    }, seconds * 1000);

    onCleanup(() => {
      clearIntervalHandle();
    });
  },
  { immediate: true },
);

watch(weatherError, (message) => {
  if (message && message !== lastErrorMessage) {
    pushToast({
      text: message,
      variant: 'error',
      timeout: 6000,
    });
    lastErrorMessage = message;
  } else if (!message) {
    lastErrorMessage = null;
  }
});

watch(isStale, (value) => {
  if (value && weatherData.value) {
    pushToast({
      text: 'Showing cached weather data while waiting for a fresh provider response.',
      variant: 'warning',
      timeout: 7000,
    });
  }
});
</script>

<style scoped>
.weather-widget {
  max-width: 980px;
  margin: 0 auto;
}

.gap-6 {
  gap: 24px;
}

.gap-2 {
  gap: 8px;
}

.min-width-240 {
  min-width: 240px;
}

.hourly-forecast-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.hourly-weather-card {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}

.hourly-weather-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

@media (max-width: 960px) {
  .weather-widget {
    margin-inline: 16px;
  }

  .hourly-forecast-cards {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
  }
}

@media (max-width: 600px) {
  .hourly-forecast-cards {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}
</style>
