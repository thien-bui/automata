<template>
  <v-card class="route-widget" elevation="4">
    <v-card-title class="d-flex align-center justify-space-between">
      <div>
        <div class="text-overline text-medium-emphasis">Monitoring</div>
        <div class="text-h6 font-weight-medium">{{ currentModeLabel }}</div>
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
          <MapPreview />
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

            <div class="text-body-2 text-medium-emphasis mb-3">
              Automatic refresh every {{ refreshInterval }}s.
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
      @update:mode="onModeUpdate"
      @update:refresh-interval="onRefreshIntervalUpdate"
    />
  </v-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import MapPreview from './MapPreview.vue';
import SettingsDrawer from './SettingsDrawer.vue';

const emit = defineEmits<{
  (e: 'alerts-acknowledged'): void;
  (e: 'alerts-updated', count: number): void;
}>();

type MonitoringMode = 'simple' | 'nav';

type PollingReason = 'initial' | 'interval' | 'mode-change' | 'manual';

type RouteAlert = {
  id: number;
  message: string;
};

const mode = ref<MonitoringMode>('simple');
const refreshInterval = ref(120);
const drawerOpen = ref(false);
const isPolling = ref(false);
const lastUpdatedIso = ref<string | null>(null);
const activeAlerts = ref<RouteAlert[]>([
  {
    id: 1,
    message: 'Traffic slowing on primary commute route.',
  },
]);

let intervalHandle: number | null = null;

const currentModeLabel = computed(() =>
  mode.value === 'simple' ? 'Simple Mode' : 'Navigation Mode',
);

const settingsAria = computed(() => `Open settings. Current mode ${currentModeLabel.value}.`);

const statusText = computed(() => {
  if (isPolling.value) {
    return 'Refreshing route data…';
  }
  if (!lastUpdatedIso.value) {
    return 'Awaiting first update.';
  }
  return `Last updated ${new Date(lastUpdatedIso.value).toLocaleTimeString()}`;
});

const progressValue = computed(() => (isPolling.value ? undefined : 100));

function clearIntervalHandle() {
  if (intervalHandle) {
    window.clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

function schedulePolling() {
  clearIntervalHandle();
  intervalHandle = window.setInterval(() => triggerPolling('interval'), refreshInterval.value * 1000);
}

function triggerPolling(reason: PollingReason) {
  isPolling.value = true;

  // Placeholder for upcoming data fetch wiring.
  window.setTimeout(() => {
    isPolling.value = false;
    lastUpdatedIso.value = new Date().toISOString();

    if (reason === 'manual') {
      activeAlerts.value = [
        {
          id: Date.now(),
          message: `Manual refresh captured at ${new Date().toLocaleTimeString()}.`,
        },
      ];
    }

    emit('alerts-updated', activeAlerts.value.length);
  }, 450);
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
  schedulePolling();
}

function acknowledgeAlerts() {
  activeAlerts.value = [];
  emit('alerts-updated', 0);
  emit('alerts-acknowledged');
}

watch(
  () => refreshInterval.value,
  () => {
    schedulePolling();
  },
);

watch(
  () => mode.value,
  (newValue, oldValue) => {
    if (newValue !== oldValue) {
      triggerPolling('mode-change');
    }
  },
);

onMounted(() => {
  triggerPolling('initial');
  schedulePolling();
});

onBeforeUnmount(() => {
  clearIntervalHandle();
});
</script>

<style scoped>
.route-widget {
  max-width: 980px;
  margin: 0 auto;
}

.gap-6 {
  gap: 24px;
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
