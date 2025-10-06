<template>
  <PollingWidget
    overline-text="Monitoring"
    :title="currentModeLabel"
    :subtitle="`${originLabel} → ${destinationLabel}`"
    error-title="Route Error"
    settings-title="Route Settings"
    :error="routeError"
    :is-polling="isPolling"
    :last-updated-iso="lastUpdatedIso"
    :is-stale="isStale"
    :polling-seconds="pollingSeconds"
    :cache-description="cacheDescription"
    @manual-refresh="handleManualRefresh"
    @hard-refresh="handleHardRefresh"
    @save-settings="handleSaveSettings"
  >
    <template #title-actions>
      <v-btn-toggle
        v-model="mode"
        mandatory
        density="compact"
        aria-label="Select monitoring mode"
      >
        <v-btn :value="MonitoringMode.Simple">Simple</v-btn>
        <v-btn :value="MonitoringMode.Nav">Nav</v-btn>
      </v-btn-toggle>
    </template>

    <template #main-content>
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

      <MapPreview :mode="mode" :from="origin" :to="destination"/>

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
    </template>

    <template #status-extra>
      <div class="text-body-2 text-medium-emphasis mb-3">
        Alert threshold {{ thresholdMinutes }} min.
      </div>
    </template>

    <template #settings-content>
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
    </template>
  </PollingWidget>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import PollingWidget from './PollingWidget.vue';
import MapPreview from './MapPreview.vue';
import SettingsDrawer from './SettingsDrawer.vue';
import { useRouteTime, type RouteFetchReason } from '../composables/useRouteTime';
import { useAlertThreshold } from '../composables/useAlertThreshold';
import { useToasts } from '../composables/useToasts';
import { MonitoringMode } from './monitoringMode';

const emit = defineEmits<{
  (e: 'alerts-acknowledged'): void;
  (e: 'alerts-updated', count: number): void;
}>();

type PollingReason = RouteFetchReason;

type RouteAlert = {
  id: number;
  message: string;
};

const DEFAULT_FROM = '443 Ramsay Way, Kent, WA 98032';
const DEFAULT_TO = '35522 21st Ave SW ste B, Federal Way, WA 98023';
const NAV_MODE_REFRESH_SECONDS = 300;

const AUTO_NAV_START_HOUR = 17;
const AUTO_NAV_END_HOUR = 20;

function resolveModeForDate(date: Date): MonitoringMode {
  const hour = date.getHours();
  return hour >= AUTO_NAV_START_HOUR && hour < AUTO_NAV_END_HOUR
    ? MonitoringMode.Nav
    : MonitoringMode.Simple;
}

function nextAutoModeBoundary(from: Date): Date {
  const navStartToday = new Date(from);
  navStartToday.setHours(AUTO_NAV_START_HOUR, 0, 0, 0);

  const navEndToday = new Date(from);
  navEndToday.setHours(AUTO_NAV_END_HOUR, 0, 0, 0);

  if (from < navStartToday) {
    return navStartToday;
  }

  if (from < navEndToday) {
    return navEndToday;
  }

  const navStartTomorrow = new Date(navStartToday);
  navStartTomorrow.setDate(navStartTomorrow.getDate() + 1);
  return navStartTomorrow;
}

const mode = ref<MonitoringMode>(MonitoringMode.Simple);
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
let autoSwitchHandle: number | null = null;
let lastAlertKey: string | null = null;
let acknowledgedAlertKey: string | null = null;
let lastErrorMessage: string | null = null;
let staleNotified = false;
let lastEmittedAlertCount = 0;

const isNavMode = computed(() => mode.value === MonitoringMode.Nav);

const pollingSeconds = computed(() => (isNavMode.value ? NAV_MODE_REFRESH_SECONDS : refreshInterval.value));

const isPolling = computed(() => isLoading.value || isRefreshing.value);

const currentModeLabel = computed(() =>
  mode.value === MonitoringMode.Simple ? 'Simple Mode' : 'Navigation Mode',
);

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

function clearAutoSwitchTimer() {
  if (autoSwitchHandle) {
    window.clearTimeout(autoSwitchHandle);
    autoSwitchHandle = null;
  }
}

function applyAutoMode(now = new Date()) {
  const nextMode = resolveModeForDate(now);
  if (mode.value !== nextMode) {
    mode.value = nextMode;
  }
}

function scheduleNextAutoMode(now = new Date()) {
  clearAutoSwitchTimer();
  const boundary = nextAutoModeBoundary(now);
  const delay = Math.max(boundary.getTime() - now.getTime(), 0);
  autoSwitchHandle = window.setTimeout(() => {
    const current = new Date();
    applyAutoMode(current);
    scheduleNextAutoMode(current);
  }, delay);
}

async function triggerPolling(reason: PollingReason, options: { forceRefresh?: boolean } = {}) {
  const background = reason === 'interval' || reason === 'mode-change';
  await refreshRoute({ background, reason, forceRefresh: options.forceRefresh });
  const manualTrigger = reason === 'manual' || reason === 'hard-manual';
  if (manualTrigger && !routeError.value) {
    pushToast({
      text: options.forceRefresh ? 'Route data refreshed from provider.' : 'Route data refreshed.',
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

function handleManualRefresh() {
  void triggerPolling('manual');
}

function handleHardRefresh() {
  void triggerPolling('hard-manual', { forceRefresh: true });
}

function handleSaveSettings() {
  // Settings are handled by the SettingsDrawer component
  pushToast({
    text: 'Route settings saved.',
    variant: 'success',
  });
}

function acknowledgeAlerts() {
  acknowledgedAlertKey = lastAlertKey;
  activeAlerts.value = [];
  emitAlertCount(0);
  emit('alerts-acknowledged');
}

onMounted(() => {
  const now = new Date();
  applyAutoMode(now);
  scheduleNextAutoMode(now);
  void triggerPolling('initial');
});

onBeforeUnmount(() => {
  clearIntervalHandle();
  clearAutoSwitchTimer();
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

watch(
  () => mode.value,
  async (value, previous) => {
    if (value === previous) {
      return;
    }
    setRouteMode('driving');
    await triggerPolling('mode-change');
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
