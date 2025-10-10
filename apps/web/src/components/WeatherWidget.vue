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
    :compact="isCompact"
    @manual-refresh="handleManualRefresh"
    @hard-refresh="handleHardRefresh"
    @save-settings="handleSaveSettings"
  >
    <template #main-content>
      <WeatherSummary
        :temperature="currentTemperatureDisplay"
        :condition="currentConditionDisplay"
        :humidity="currentHourEntry?.humidityPercent"
    :wind-speed="currentHourEntry?.windSpeedKph"
    :is-compact="isCompact"
    :show-metrics="displaySettings.showHumidity || displaySettings.showWindSpeed"
        :show-humidity="displaySettings.showHumidity"
        :show-wind-speed="displaySettings.showWindSpeed"
        :show-precipitation="displaySettings.showPrecipitation"
      />
      
      <HourlyForecast
        v-if="!isCompact && displaySettings.showHourlyForecast"
        :data="displayedHourlyData"
        :is-compact="isCompact"
    :show-hourly-forecast="displaySettings.showHourlyForecast"
        :current-hour-highlight="displaySettings.currentHourHighlight"
        :show-humidity="displaySettings.showHumidity"
        :show-wind-speed="displaySettings.showWindSpeed"
      />
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
        :min="minRefreshSeconds"
        :max="maxRefreshSeconds"
        variant="outlined"
        density="compact"
        @keyup.enter="updateRefreshInterval"
      />
      <v-divider class="my-4" />
      <v-switch
        :model-value="compactModeInput"
        :disabled="globalCompactEnabled"
        label="Compact mode (weather widget)"
        color="primary"
        density="compact"
        hide-details
        @update:model-value="handleCompactSwitch"
      />
      <div class="text-caption text-medium-emphasis">
        <span v-if="globalCompactEnabled">
          Controlled by global compact mode from the toolbar.
        </span>
        <span v-else>
          Applies only to the Weather widget layout.
        </span>
      </div>
    </template>
  </PollingWidget>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { HourlyWeatherData } from '@automata/types';
import PollingWidget from './PollingWidget.vue';
import WeatherSummary from './weather/WeatherSummary.vue';
import HourlyForecast from './weather/HourlyForecast.vue';
import { useWeather, type WeatherFetchReason } from '../composables/useWeather';
import { useToasts } from '../composables/useToasts';
import { useWeatherConfig } from '../composables/useWeatherConfig';
import { useUiPreferences } from '../composables/useUiPreferences';

const {
  defaultLocation,
  defaultRefreshSeconds,
  minRefreshSeconds,
  maxRefreshSeconds,
  displaySettings,
  uiSettings,
  isValidRefreshInterval,
  clampRefreshInterval,
  updateUISettings,
} = useWeatherConfig();

const { isCompact: globalCompactEnabled } = useUiPreferences();

const compactModeInput = ref(uiSettings.value.compactMode);

watch(
  () => uiSettings.value.compactMode,
  (value) => {
    compactModeInput.value = value;
  },
  { immediate: true },
);

const isCompact = computed(() => globalCompactEnabled.value || uiSettings.value.compactMode);

const DEFAULT_HOURLY_PAST_HOURS = 3;
const DEFAULT_HOURLY_FUTURE_HOURS = 7;

const drawerOpen = ref(false);
const locationInput = ref(defaultLocation.value);
const refreshIntervalInput = ref(defaultRefreshSeconds.value);

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
  location: defaultLocation.value,
  freshnessSeconds: defaultRefreshSeconds.value,
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

const currentHourTimestamp = computed<string | null>(() => {
  if (!weatherData.value || weatherData.value.hourlyData.length === 0) {
    return null;
  }

  const candidateOrder: Array<string | null> = [
    weatherData.value.lastUpdatedIso ?? null,
    lastUpdatedIso.value ?? null,
  ];

  for (const candidate of candidateOrder) {
    if (!candidate) {
      continue;
    }
    const hasExactMatch = weatherData.value.hourlyData.some((hour) => hour.timestamp === candidate);
    if (hasExactMatch) {
      return candidate;
    }

    const candidateDate = new Date(candidate);
    if (Number.isNaN(candidateDate.getTime())) {
      continue;
    }

    const floored = new Date(candidateDate.getTime());
    floored.setUTCMinutes(0, 0, 0);
    const candidateHourIso = floored.toISOString();
    const hasHourMatch = weatherData.value.hourlyData.some((hour) => hour.timestamp === candidateHourIso);
    if (hasHourMatch) {
      return candidateHourIso;
    }
  }

  let bestTimestamp = weatherData.value.hourlyData[0]?.timestamp ?? null;
  let bestDistance = Number.POSITIVE_INFINITY;
  const nowMs = Date.now();

  for (const hour of weatherData.value.hourlyData) {
    const timestamp = new Date(hour.timestamp);
    if (Number.isNaN(timestamp.getTime())) {
      continue;
    }

    const distance = Math.abs(timestamp.getTime() - nowMs);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestTimestamp = hour.timestamp;
    }
  }

  return bestTimestamp;
});

const currentHourIndex = computed<number>(() => {
  if (!weatherData.value || weatherData.value.hourlyData.length === 0) {
    return 0;
  }

  const timestamp = currentHourTimestamp.value;
  if (!timestamp) {
    return 0;
  }

  const matchIndex = weatherData.value.hourlyData.findIndex((hour) => hour.timestamp === timestamp);
  return matchIndex >= 0 ? matchIndex : 0;
});

const currentHourEntry = computed<HourlyWeatherData | null>(() => {
  if (!weatherData.value || weatherData.value.hourlyData.length === 0) {
    return null;
  }

  return weatherData.value.hourlyData[currentHourIndex.value] ?? null;
});

const currentTemperatureDisplay = computed(() => {
  if (!currentHourEntry.value) {
    return isPolling.value ? 'Loading…' : '—';
  }

  const { temperatureCelsius, temperatureFahrenheit } = currentHourEntry.value;
  return `${Math.round(temperatureCelsius)}°C / ${Math.round(temperatureFahrenheit)}°F`;
});

const currentConditionDisplay = computed(() => {
  if (!currentHourEntry.value) {
    return '—';
  }

  return currentHourEntry.value.condition;
});

const humidityDisplay = computed(() => {
  if (!currentHourEntry.value) {
    return '—';
  }

  const { humidityPercent } = currentHourEntry.value;
  return humidityPercent !== undefined ? `${humidityPercent}%` : '—';
});

const windDisplay = computed(() => {
  if (!currentHourEntry.value) {
    return '—';
  }

  const { windSpeedKph } = currentHourEntry.value;
  return windSpeedKph !== undefined ? `${windSpeedKph} km/h` : '—';
});

const displayedHourlyData = computed<HourlyWeatherData[]>(() => {
  if (!weatherData.value) {
    return [];
  }

  const settings = displaySettings.value;
  if (isCompact.value || !settings.showHourlyForecast) {
    return [];
  }

  const hourlyData = weatherData.value.hourlyData;
  if (hourlyData.length === 0) {
    return [];
  }

  const normalizeWindowValue = (value: number | undefined, fallback: number): number => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return fallback;
    }
    return Math.max(0, Math.floor(value));
  };

  const desiredPast = normalizeWindowValue(
    settings.hourlyForecastPastHours,
    DEFAULT_HOURLY_PAST_HOURS,
  );
  const desiredFuture = normalizeWindowValue(
    settings.hourlyForecastFutureHours,
    DEFAULT_HOURLY_FUTURE_HOURS,
  );

  const targetIndex = currentHourIndex.value;

  let start = targetIndex - desiredPast;
  let end = targetIndex + desiredFuture + 1; // exclusive upper bound

  if (start < 0) {
    end += -start;
    start = 0;
  }

  if (end > hourlyData.length) {
    const overshoot = end - hourlyData.length;
    start = Math.max(0, start - overshoot);
    end = hourlyData.length;
  }

  const slice = hourlyData.slice(start, end);
  const desiredTotal = Math.min(hourlyData.length, desiredPast + desiredFuture + 1);

  if (slice.length === desiredTotal) {
    return slice;
  }

  if (slice.length > desiredTotal) {
    return slice.slice(slice.length - desiredTotal);
  }

  const deficit = desiredTotal - slice.length;
  const adjustedStart = Math.max(0, start - deficit);
  return hourlyData.slice(adjustedStart, end);
});

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

function isCurrentHour(timestamp: string): boolean {
  const target = currentHourTimestamp.value;
  return Boolean(target && timestamp === target);
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
  const clampedValue = clampRefreshInterval(refreshIntervalInput.value);
  refreshIntervalInput.value = clampedValue;
  setFreshnessSeconds(clampedValue);
}

function handleCompactSwitch(value: boolean | null) {
  const nextValue = Boolean(value);
  compactModeInput.value = nextValue;
  updateUISettings({ compactMode: nextValue });
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
  updateUISettings({ compactMode: compactModeInput.value });
  pushToast({
    text: 'Weather settings saved.',
    variant: 'success',
  });
}

function saveSettings() {
  updateLocation();
  updateRefreshInterval();
  updateUISettings({ compactMode: compactModeInput.value });
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

defineExpose({
  getWeatherIcon,
});
</script>

<style scoped>
.weather-widget {
  max-width: 980px;
  margin: 0 auto;
}

.weather-summary-card {
  padding: 16px;
  transition: padding 0.2s ease;
}

.weather-summary-card--compact {
  padding: 12px;
}

.weather-summary__metrics {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
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

.hourly-item:hover:not(.current-hour) {
  opacity: 0.9;
  background: rgba(var(--v-theme-surface-variant), 0.5);
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
  .weather-widget {
    margin-inline: 16px;
  }

  .hourly-forecast-container {
    gap: 12px;
    padding: 12px;
  }

  .hourly-item {
    min-width: 70px;
    padding: 10px 6px;
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
