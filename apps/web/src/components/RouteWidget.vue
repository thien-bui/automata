<template>
  <PollingWidget
    overline-text="Monitoring"
    :title="currentModeLabel"
    :subtitle="`${originLabel} → ${destinationLabel}`"
    error-title="Route Error"
    settings-title="Route Settings"
    :error="error"
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
    <template #title-actions>
      <RouteModeToggle
        :model-value="mode"
        density="compact"
        aria-label="Select monitoring mode"
        @update:model-value="handleModeUpdate"
      />
    </template>

    <template #main-content>
      <RouteSummary
        :route-data="data"
        :is-polling="isPolling"
        :cache-description="cacheDescription"
      />

      <!-- Map preview - hidden in compact mode but still available for nav mode switching -->
      <MapPreview v-if="!isCompact" :mode="mode" :from="origin" :to="destination"/>

      <!-- Alert display - detailed list in normal mode, compact icon in compact mode -->
      <RouteAlerts
        :alerts="activeAlerts"
        :compact="isCompact"
        @acknowledge-alerts="handleAcknowledgeAlerts"
      />
    </template>

    <template #status-extra>
      <div class="text-body-2 text-medium-emphasis mb-3">
        Alert threshold {{ thresholdMinutes }} min.
      </div>
    </template>

    <template #settings-content>
      <RouteSettings
        :mode="mode"
        :refresh-interval="refreshInterval"
        :threshold-minutes="thresholdMinutes"
        :is-nav-mode="isNavMode"
        @update:mode="handleModeUpdate"
        @update:refresh-interval="handleRefreshIntervalUpdate"
        @update:threshold-minutes="handleThresholdUpdate"
        @reset-threshold="handleResetThreshold"
        @save="handleSaveSettings"
      />
    </template>
  </PollingWidget>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';

import PollingWidget from './PollingWidget.vue';
import MapPreview from './MapPreview.vue';
import { RouteSummary, RouteAlerts, RouteModeToggle, RouteSettings } from './route';
import { useRoutePolling } from '../composables/useRoutePolling';
import { useRouteAlerts } from '../composables/useRouteAlerts';
import { useAlertThreshold } from '../composables/useAlertThreshold';
import { useToasts } from '../composables/useToasts';
import { useUiPreferences } from '../composables/useUiPreferences';
import { MonitoringMode } from './monitoringMode';

const emit = defineEmits<{
  (e: 'alerts-acknowledged'): void;
  (e: 'alerts-updated', count: number): void;
}>();

const DEFAULT_FROM = '443 Ramsay Way, Kent, WA 98032';
const DEFAULT_TO = '35522 21st Ave SW ste B, Federal Way, WA 98023';

const {
  data,
  error,
  isPolling,
  isStale,
  lastUpdatedIso,
  cacheAgeSeconds,
  cacheHit,
  from: origin,
  to: destination,
  mode,
  refreshInterval,
  pollingSeconds,
  triggerPolling,
  setMode,
  setRefreshInterval,
  setFreshnessSeconds,
} = useRoutePolling({
  from: DEFAULT_FROM,
  to: DEFAULT_TO,
  initialMode: MonitoringMode.Simple,
  initialRefreshInterval: 120,
});

const { thresholdMinutes, setThreshold, resetThreshold } = useAlertThreshold();
const { push: pushToast } = useToasts();
const { isWidgetCompact } = useUiPreferences();

const isCompact = computed(() => isWidgetCompact('route-widget'));
const isNavMode = computed(() => mode.value === MonitoringMode.Nav);

const currentModeLabel = computed(() =>
  mode.value === MonitoringMode.Simple ? 'Simple Mode' : 'Navigation Mode',
);

const cacheDescription = computed(() => {
  if (!data.value) {
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

const originLabel = computed(() => origin.value);
const destinationLabel = computed(() => destination.value);

// Route alerts
const { activeAlerts, acknowledgeAlerts, emitAlertCount } = useRouteAlerts({
  routeData: data,
  thresholdMinutes,
});

// Event handlers
function handleModeUpdate(newMode: MonitoringMode): void {
  setMode(newMode);
}

function handleRefreshIntervalUpdate(interval: number): void {
  setRefreshInterval(interval);
}

function handleThresholdUpdate(threshold: number): void {
  setThreshold(threshold);
}

function handleResetThreshold(): void {
  resetThreshold();
}

function handleManualRefresh(): void {
  void triggerPolling('manual');
}

function handleHardRefresh(): void {
  void triggerPolling('hard-manual', { forceRefresh: true });
}

function handleSaveSettings(): void {
  pushToast({
    text: 'Route settings saved.',
    variant: 'success',
  });
}

function handleAcknowledgeAlerts(): void {
  acknowledgeAlerts();
  emit('alerts-acknowledged');
}

// Watch for alert count changes and emit to parent
watch(
  () => activeAlerts.value.length,
  (count: number) => {
    emitAlertCount(count);
    emit('alerts-updated', count);
  }
);
</script>
