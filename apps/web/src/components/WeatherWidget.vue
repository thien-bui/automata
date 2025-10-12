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
      <div class="weather-widget__settings">
        <div class="weather-widget__fields">
          <v-text-field
            class="weather-widget__field"
            v-model="locationInput"
            label="Location"
            placeholder="Enter city or address"
            variant="outlined"
            density="compact"
            @keyup.enter="updateLocation"
          />
          <v-text-field
            class="weather-widget__field"
            v-model.number="refreshIntervalInput"
            label="Refresh Interval (seconds)"
            type="number"
            :min="minRefreshSeconds"
            :max="maxRefreshSeconds"
            variant="outlined"
            density="compact"
            @keyup.enter="updateRefreshInterval"
          />
        </div>
        <v-divider class="weather-widget__divider" />
        <CompactModeControl class="weather-widget__compact-control" widget-name="weather-widget" />
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
import CompactModeControl from './CompactModeControl.vue';

const {
  defaultLocation,
  defaultRefreshSeconds,
  minRefreshSeconds,
  maxRefreshSeconds,
  displaySettings,
  isValidRefreshInterval,
  clampRefreshInterval,
  updateUISettings,
} = useWeatherConfig();

const { isWidgetCompact } = useUiPreferences();

const isCompact = computed(() => isWidgetCompact('weather-widget'));

const DEFAULT_HOURLY_PAST_HOURS = 3;
const DEFAULT_HOURLY_FUTURE_HOURS = 7;

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

<style scoped lang="scss">
.weather-widget__settings {
  display: grid;
  gap: clamp(1.25rem, 3vw, 1.75rem);
}

.weather-widget__fields {
  display: grid;
  gap: clamp(0.75rem, 2vw, 1rem);
}

.weather-widget__field :deep(.v-field) {
  border-radius: 0.75rem;
}

.weather-widget__divider {
  margin-block: 0;
}

.weather-widget__compact-control {
  margin-inline: clamp(0rem, 1vw, 0.5rem);
}
</style>
