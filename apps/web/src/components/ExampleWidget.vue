<template>
  <BaseWidget
    :overline-text="overlineText"
    :title="title"
    :subtitle="subtitle"
    :error="error"
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
            <div class="text-overline text-medium-emphasis">Example Data</div>
            <div class="text-h4 font-weight-medium" aria-live="polite">
              {{ exampleDataDisplay }}
            </div>
            <div class="text-body-1 text-medium-emphasis mt-1">
              {{ exampleStatusDisplay }}
            </div>
          </div>
          <div class="text-end">
            <div class="text-body-2 text-medium-emphasis">Count: {{ dataCount }}</div>
            <div v-if="cacheDescription" class="text-caption text-medium-emphasis mt-1">
              {{ cacheDescription }}
            </div>
          </div>
        </div>
      </v-sheet>
    </template>

    <template #status-extra>
      <div class="text-body-2 text-medium-emphasis mb-3">
        Example threshold: {{ thresholdMinutes }} min.
      </div>
    </template>

    <template #settings-content>
      <v-text-field
        v-model="locationInput"
        label="Example Location"
        placeholder="Enter location"
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
      <v-text-field
        v-model.number="thresholdInput"
        label="Alert Threshold (minutes)"
        type="number"
        min="1"
        max="120"
        variant="outlined"
        density="compact"
        @keyup.enter="updateThreshold"
      />
    </template>
  </BaseWidget>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import BaseWidget from './BaseWidget.vue';
import { useWidgetBase, type BaseFetchReason } from '../composables/useWidgetBase';

// Mock data and functions for demonstration
const DEFAULT_LOCATION = 'Seattle, WA';
const DEFAULT_REFRESH_SECONDS = 300;
const DEFAULT_THRESHOLD_MINUTES = 30;

const overlineText = 'Example';
const title = 'Example Widget';
const subtitle = computed(() => `Location: ${location.value}`);

const location = ref(DEFAULT_LOCATION);
const locationInput = ref(DEFAULT_LOCATION);
const refreshIntervalInput = ref(DEFAULT_REFRESH_SECONDS);
const thresholdInput = ref(DEFAULT_THRESHOLD_MINUTES);
const thresholdMinutes = ref(DEFAULT_THRESHOLD_MINUTES);

// Mock data
const exampleData = ref<{ value: number; status: string; count: number } | null>(null);
const error = ref<string | null>(null);
const lastUpdatedIso = ref<string | null>(null);
const isStale = ref(false);
const cacheDescription = ref('');

const exampleDataDisplay = computed(() => {
  if (!exampleData.value) {
    return '—';
  }
  return exampleData.value.value.toString();
});

const exampleStatusDisplay = computed(() => {
  if (!exampleData.value) {
    return '—';
  }
  return exampleData.value.status;
});

const dataCount = computed(() => {
  if (!exampleData.value) {
    return 0;
  }
  return exampleData.value.count;
});

// Use the shared widget base composable
const {
  isPolling,
  pollingSeconds,
  setupPolling,
  watchForErrors,
  watchForStaleData,
  triggerPolling,
} = useWidgetBase({
  successMessage: 'Example data refreshed.',
  hardRefreshSuccessMessage: 'Example data refreshed from provider.',
  staleWarningMessage: 'Showing cached example data while waiting for a fresh provider response.',
});

// Mock refresh function
async function mockRefresh(options: { background?: boolean; reason?: BaseFetchReason; forceRefresh?: boolean }) {
  console.log('Refreshing example data:', options);
  
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Simulate occasional errors
  if (Math.random() < 0.1) {
    error.value = 'Failed to fetch example data from provider.';
    return;
  }
  
  // Update mock data
  exampleData.value = {
    value: Math.floor(Math.random() * 100),
    status: ['Good', 'Fair', 'Poor'][Math.floor(Math.random() * 3)],
    count: Math.floor(Math.random() * 50) + 1,
  };
  
  lastUpdatedIso.value = new Date().toISOString();
  error.value = null;
  isStale.value = options.reason === 'interval' && Math.random() < 0.3; // Simulate stale data
  
  if (options.forceRefresh) {
    cacheDescription.value = 'Live provider data';
  } else if (options.reason === 'interval') {
    cacheDescription.value = Math.random() < 0.5 ? 'Cache hit • age 45s' : 'Live provider data';
  }
}

// Set up polling
setupPolling(mockRefresh, pollingSeconds);

// Watch for errors and stale data
watchForErrors(error);
watchForStaleData(computed(() => isStale.value), computed(() => exampleData.value !== null));

// Event handlers
function handleManualRefresh() {
  void triggerPolling('manual');
}

function handleHardRefresh() {
  void triggerPolling('hard-manual', { forceRefresh: true });
}

function handleSaveSettings() {
  updateLocation();
  updateRefreshInterval();
  updateThreshold();
}

function updateLocation() {
  location.value = locationInput.value;
}

function updateRefreshInterval() {
  pollingSeconds.value = refreshIntervalInput.value;
}

function updateThreshold() {
  thresholdMinutes.value = thresholdInput.value;
}

// Initialize
onMounted(() => {
  void triggerPolling('initial');
});
</script>
