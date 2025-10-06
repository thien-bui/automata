<template>
  <v-card class="weather-widget" elevation="4">
    <v-card-title class="d-flex align-center justify-space-between">
      <div>
        <div class="text-overline text-medium-emphasis">Weather</div>
        <div class="text-h6 font-weight-medium">Current Conditions</div>
        <div class="text-body-2 text-medium-emphasis mt-1">
          {{ locationLabel }}
        </div>
      </div>

      <div class="d-flex align-center gap-2">
        <v-btn icon="mdi-cog" variant="text" :aria-label="settingsAria" @click="drawerOpen = true" />
      </div>
    </v-card-title>

    <v-divider />

    <v-card-text>
      <div class="d-flex flex-column flex-md-row gap-6">
        <div class="flex-grow-1">
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

          <v-sheet class="pa-4 mt-4" elevation="1" rounded>
            <div class="text-subtitle-1 font-weight-medium mb-3">Hourly Forecast</div>
            <div class="hourly-forecast">
              <div
                v-for="hour in displayedHourlyData"
                :key="hour.timestamp"
                class="hourly-item text-center"
              >
                <div class="text-caption text-medium-emphasis">
                  {{ formatHour(hour.timestamp) }}
                </div>
                <div class="text-body-2 font-weight-medium">
                  {{ formatTemperature(hour.temperatureCelsius) }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ hour.condition }}
                </div>
              </div>
            </div>
          </v-sheet>

          <v-alert
            v-if="weatherError"
            type="error"
            variant="tonal"
            class="mt-4"
            elevation="1"
            border="start"
          >
            <div class="text-subtitle-1 font-weight-medium">Weather Error</div>
            <div class="mt-2">{{ weatherError }}</div>
          </v-alert>
        </div>

        <div class="flex-grow-1 min-width-240">
          <v-sheet class="pa-4" elevation="1" rounded>
            <div class="text-subtitle-1 font-weight-medium mb-2">Status</div>
            <div class="d-flex align-center justify-space-between">
              <span aria-live="polite">{{ statusText }}</span>
              <v-progress-circular
                :indeterminate="isPolling"
                :model-value="progressValue"
                color="primary"
                size="32"
                width="3"
                aria-hidden="true"
              />
            </div>

            <v-divider class="my-4" />

            <div class="text-body-2 text-medium-emphasis mb-1">
              Automatic refresh every {{ pollingSeconds }}s.
            </div>

            <v-btn-group class="w-100 d-flex" divided>
              <v-btn
                class="flex-grow-1"
                color="primary"
                size="large"
                prepend-icon="mdi-refresh"
                :loading="isPolling"
                :disabled="isPolling"
                @click="triggerPolling('manual')"
              >
                Refresh now
              </v-btn>
              <v-btn
                class="flex-grow-1"
                color="secondary"
                size="large"
                prepend-icon="mdi-refresh-alert"
                :loading="isPolling"
                :disabled="isPolling"
                @click="triggerPolling('hard-manual', { forceRefresh: true })"
              >
                Hard refresh
              </v-btn>
            </v-btn-group>
          </v-sheet>
        </div>
      </div>
    </v-card-text>

    <v-dialog v-model="drawerOpen" max-width="400">
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between">
          <span>Weather Settings</span>
          <v-btn icon="mdi-close" variant="text" @click="drawerOpen = false" />
        </v-card-title>
        <v-divider />
        <v-card-text>
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
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn @click="drawerOpen = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveSettings">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { HourlyWeatherData } from '@automata/types';
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

.hourly-forecast {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 16px;
}

.hourly-item {
  padding: 8px;
  border-radius: 8px;
  background-color: rgba(var(--v-theme-surface-variant), 0.3);
}

@media (max-width: 960px) {
  .weather-widget {
    margin-inline: 16px;
  }

  .hourly-forecast {
    grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
    gap: 8px;
  }
}
</style>
