<template>
  <v-card class="route-widget" elevation="4">
    <v-card-title class="d-flex align-center justify-space-between">
      <div>
        <div class="text-overline text-medium-emphasis">Monitoring</div>
        <div class="text-h6 font-weight-medium">{{ currentModeLabel }}</div>
        <div class="text-body-2 text-medium-emphasis mt-1">
          {{ originLabel }} → {{ destinationLabel }}
        </div>
      </div>

      <div class="d-flex align-center gap-2">
        <v-btn-toggle
          v-model="mode"
          mandatory
          density="compact"
          aria-label="Select monitoring mode"
        >
          <v-btn value="simple">Simple</v-btn>
          <v-btn value="nav">Nav</v-btn>
        </v-btn-toggle>
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
                <div class="text-overline text-medium-emphasis">Estimated duration</div>
                <div class="text-h4 font-weight-medium" aria-live="polite">
                  {{ durationDisplay }}
                </div>
              </div>
              <div class="text-end">
                <div class="text-body-2 text-medium-emphasis">Distance: {{ distanceDisplay }}</div>
                <div v-if="cacheDescription" class="text-caption text-medium-emphasis mt-1">
                  {{ cacheDescription }}
                </div>
              </div>
            </div>
          </v-sheet>

          <MapPreview
            class="mt-4"
            :active="mode === 'nav'"
            :origin="originLabel"
            :destination="destinationLabel"
            :last-updated-iso="lastUpdatedIso"
          />

          <v-alert
            v-if="activeAlerts.length > 0"
            type="warning"
            variant="tonal"
            class="mt-4"
            elevation="1"
            dismissible
            border="start"
            @click:close="acknowledgeAlerts"
          >
            <div class="text-subtitle-1 font-weight-medium">Route Alerts</div>
            <ul class="mt-2 mb-0 ps-4">
              <li v-for="alert in activeAlerts" :key="alert.id">
                {{ alert.message }}
              </li>
            </ul>
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
            <div class="text-body-2 text-medium-emphasis mb-3">
              Alert threshold {{ thresholdMinutes }} min.
            </div>

            <v-btn
              class="w-100"
              color="primary"
              size="large"
              prepend-icon="mdi-refresh"
              :loading="isPolling"
              :disabled="isPolling"
              @click="triggerPolling('manual')"
            >
              Refresh now
            </v-btn>
          </v-sheet>
        </div>
      </div>
    </v-card-text>

    <SettingsDrawer
      v-model="drawerOpen"
      :mode="mode"
      :refresh-interval="refreshInterval"
      :alert-threshold="thresholdMinutes"
      @update:mode="onModeUpdate"
      @update:refresh-interval="onRefreshIntervalUpdate"
      @update:alert-threshold="onAlertThresholdUpdate"
      @reset-alert-threshold="resetAlertThreshold"
    />
  </v-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { RouteMode } from '@automata/types';

import MapPreview from './MapPreview.vue';
import SettingsDrawer from './SettingsDrawer.vue';
import { useRouteTime, type RouteFetchReason } from '../composables/useRouteTime';
import { useAlertThreshold } from '../composables/useAlertThreshold';
import { useToasts } from '../composables/useToasts';

const emit = defineEmits<{
  (e: 'alerts-acknowledged'): void;
  (e: 'alerts-updated', count: number): void;
}>();

type MonitoringMode = 'simple' | 'nav';
type PollingReason = RouteFetchReason;

type RouteAlert = {
  id: number;
  message: string;
};

const DEFAULT_FROM = 'Automata HQ, Innovation Way';
const DEFAULT_TO = 'Central Transit Depot, Downtown';
const NAV_MODE_REFRESH_SECONDS = 300;

const mode = ref<MonitoringMode>('simple');
const refreshInterval = ref(120);
const drawerOpen = ref(false);

const {
  data: routeData,
  error: routeError,
  isLoading,
  isRefreshing,
  isStale,
  lastUpdatedIso,
  cacheAgeSeconds,
  cacheHit,
  refresh: refreshRoute,
  setMode: setRouteMode,
  setFreshnessSeconds,
  from: origin,
  to: destination,
} = useRouteTime({
  from: DEFAULT_FROM,
  to: DEFAULT_TO,
  mode: 'driving',
  freshnessSeconds: refreshInterval.value,
});

const { thresholdMinutes, setThreshold, resetThreshold } = useAlertThreshold();
const { push: pushToast } = useToasts();

const activeAlerts = ref<RouteAlert[]>([]);
let intervalHandle: number | null = null;
let lastAlertKey: string | null = null;
let acknowledgedAlertKey: string | null = null;
let lastErrorMessage: string | null = null;
let staleNotified = false;
let lastEmittedAlertCount = 0;

const pollingSeconds = computed(() => (mode.value === 'nav' ? NAV_MODE_REFRESH_SECONDS : refreshInterval.value));

const isPolling = computed(() => isLoading.value || isRefreshing.value);

const currentModeLabel = computed(() => (mode.value === 'simple' ? 'Simple Mode' : 'Navigation Mode'));

const settingsAria = computed(() => `Open settings. Current mode ${currentModeLabel.value}.`);

const statusText = computed(() => {
  if (isPolling.value) {
    return 'Refreshing route data…';
  }
  if (routeError.value) {
    return routeError.value;
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
  if (!routeData.value) {
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

const durationDisplay = computed(() => {
  if (!routeData.value) {
    return isPolling.value ? 'Loading…' : '—';
  }
  return `${routeData.value.durationMinutes.toFixed(1)} min`;
});

const distanceDisplay = computed(() => {
  if (!routeData.value) {
    return '—';
  }
  return `${routeData.value.distanceKm.toFixed(1)} km`;
});

const originLabel = computed(() => origin.value);
const destinationLabel = computed(() => destination.value);

function emitAlertCount(count: number) {
  if (count === lastEmittedAlertCount) {
    return;
  }
  lastEmittedAlertCount = count;
  emit('alerts-updated', count);
}

function clearIntervalHandle() {
  if (intervalHandle) {
    window.clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

function schedulePolling() {
  clearIntervalHandle();
  const intervalMs = pollingSeconds.value * 1000;
  setFreshnessSeconds(pollingSeconds.value);
  intervalHandle = window.setInterval(() => {
    triggerPolling('interval');
  }, intervalMs);
}

async function triggerPolling(reason: PollingReason) {
  const background = reason === 'interval' || reason === 'mode-change';
  await refreshRoute({ background, reason });
  if (reason === 'manual' && !routeError.value) {
    pushToast({
      text: 'Route data refreshed.',
      variant: 'success',
    });
  }
}

function onModeUpdate(nextMode: MonitoringMode) {
  if (mode.value === nextMode) {
    return;
  }
  mode.value = nextMode;
}

function onRefreshIntervalUpdate(nextInterval: number) {
  if (refreshInterval.value === nextInterval) {
    return;
  }
  refreshInterval.value = nextInterval;
}

function onAlertThresholdUpdate(nextThreshold: number) {
  setThreshold(nextThreshold);
}

function resetAlertThreshold() {
  resetThreshold();
}

function acknowledgeAlerts() {
  acknowledgedAlertKey = lastAlertKey;
  activeAlerts.value = [];
  emitAlertCount(0);
  emit('alerts-acknowledged');
}

onMounted(() => {
  triggerPolling('initial');
  schedulePolling();
});

onBeforeUnmount(() => {
  clearIntervalHandle();
});

watch(
  () => refreshInterval.value,
  () => {
    if (mode.value === 'simple') {
      schedulePolling();
    }
  },
);

watch(
  () => mode.value,
  (value, previous) => {
    if (value === previous) {
      return;
    }
    const routeMode: RouteMode = value === 'nav' ? 'driving' : 'transit';
    setRouteMode(routeMode);
    schedulePolling();
    triggerPolling('mode-change');
  },
);

watch(routeError, (message) => {
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
  if (value && !staleNotified && routeData.value) {
    pushToast({
      text: 'Showing cached route data while waiting for a fresh provider response.',
      variant: 'warning',
      timeout: 7000,
    });
    staleNotified = true;
  } else if (!value) {
    staleNotified = false;
  }
});

watch(
  [routeData, thresholdMinutes],
  ([payload, threshold]) => {
    if (!payload) {
      activeAlerts.value = [];
      lastAlertKey = null;
      acknowledgedAlertKey = null;
      emitAlertCount(0);
      return;
    }

    const overThreshold = payload.durationMinutes > threshold;
    const alertKey = `${payload.lastUpdatedIso}:${threshold}`;

    if (!overThreshold) {
      activeAlerts.value = [];
      lastAlertKey = null;
      acknowledgedAlertKey = null;
      emitAlertCount(0);
      return;
    }

    if (acknowledgedAlertKey === alertKey) {
      activeAlerts.value = [];
      emitAlertCount(0);
      return;
    }

    const message = `Travel time ${payload.durationMinutes.toFixed(1)} min exceeds threshold of ${threshold} min.`;

    if (acknowledgedAlertKey && acknowledgedAlertKey !== alertKey) {
      acknowledgedAlertKey = null;
    }

    activeAlerts.value = [
      {
        id: Date.now(),
        message,
      },
    ];
    emitAlertCount(activeAlerts.value.length);

    if (lastAlertKey !== alertKey) {
      pushToast({
        text: message,
        variant: 'warning',
        timeout: 7000,
      });
    }

    lastAlertKey = alertKey;
  },
  { immediate: true },
);
</script>

<style scoped>
.route-widget {
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

@media (max-width: 960px) {
  .route-widget {
    margin-inline: 16px;
  }
}
</style>
