<template>
  <v-card class="polling-widget" elevation="4">
    <v-card-title class="d-flex align-center justify-space-between">
      <div>
        <div class="text-overline text-medium-emphasis">{{ overlineText }}</div>
        <div class="text-h6 font-weight-medium">{{ title }}</div>
        <div class="text-body-2 text-medium-emphasis mt-1">
          {{ subtitle }}
        </div>
      </div>

      <div class="d-flex align-center gap-2">
        <slot name="title-actions" />
        <v-btn 
          icon="mdi-cog" 
          variant="text" 
          :aria-label="settingsAria" 
          @click="drawerOpen = true" 
        />
      </div>
    </v-card-title>

    <v-divider />

    <v-card-text>
      <div class="d-flex flex-column flex-md-row gap-6">
        <div class="flex-grow-1">
          <slot name="main-content" />
          
          <v-alert
            v-if="error"
            type="error"
            variant="tonal"
            class="mt-4"
            elevation="1"
            border="start"
          >
            <div class="text-subtitle-1 font-weight-medium">{{ errorTitle }}</div>
            <div class="mt-2">{{ error }}</div>
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
            <slot name="status-extra" />

            <v-btn-group class="w-100 d-flex" divided>
              <v-btn
                class="flex-grow-1"
                color="primary"
                size="large"
                prepend-icon="mdi-refresh"
                :loading="isPolling"
                :disabled="isPolling"
                @click="handleManualRefresh"
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
                @click="handleHardRefresh"
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
          <span>{{ settingsTitle }}</span>
          <v-btn icon="mdi-close" variant="text" @click="drawerOpen = false" />
        </v-card-title>
        <v-divider />
        <v-card-text>
          <slot name="settings-content" />
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn @click="drawerOpen = false">Cancel</v-btn>
          <v-btn color="primary" @click="handleSaveSettings">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useToasts } from '../composables/useToasts';

/**
 * Props for the PollingWidget component
 */
interface Props {
  /** 
   * The overline text displayed in the header (typically a category label)
   * @example 'Weather' or 'Monitoring'
   */
  overlineText: string;
  
  /** 
   * The main title displayed in the header
   * @example 'Current Conditions' or 'Simple Mode'
   */
  title: string;
  
  /** 
   * The subtitle displayed in the header (typically location or route info)
   * @example 'Seattle, WA' or '443 Ramsay Way → 35522 21st Ave SW'
   */
  subtitle: string;
  
  /** 
   * Title for error alerts displayed in the main content area
   * @default 'Error'
   * @example 'Weather Error' or 'Route Error'
   */
  errorTitle?: string;
  
  /** 
   * Title for the settings dialog
   * @default 'Settings'
   * @example 'Weather Settings' or 'Route Settings'
   */
  settingsTitle?: string;
  
  /** 
   * Current error message to display in the alert. If null, no error is shown
   * @example 'Failed to fetch weather data from provider.'
   */
  error: string | null;
  
  /** 
   * Whether the widget is currently refreshing data (shows loading state)
   * Controls the progress indicator and button disabled states
   */
  isPolling: boolean;
  
  /** 
   * ISO timestamp of the last successful data update
   * Used to calculate and display the "Last updated" time
   * @example '2023-12-07T10:30:00.000Z'
   */
  lastUpdatedIso: string | null;
  
  /** 
   * Whether the current data is stale (served from cache while provider recovers)
   * Affects the status text display and shows stale data warnings
   */
  isStale: boolean;
  
  /** 
   * Current polling interval in seconds
   * Displayed in the status panel and used for interval calculations
   * @example 300 for 5 minutes
   */
  pollingSeconds: number;
  
  /** 
   * Description of cache status displayed in the main content area
   * If empty, no cache description is shown
   * @example 'Cache hit • age 45s' or 'Live provider data'
   */
  cacheDescription?: string;
}

/**
 * Events emitted by the PollingWidget component
 */
interface Emits {
  /** 
   * Emitted when the user clicks the "Refresh now" button
   * Triggers a normal refresh operation
   */
  (e: 'manual-refresh'): void;
  
  /** 
   * Emitted when the user clicks the "Hard refresh" button
   * Triggers a force refresh operation that bypasses cache
   */
  (e: 'hard-refresh'): void;
  
  /** 
   * Emitted when the user clicks the "Save" button in the settings dialog
   * Indicates that settings should be applied and persisted
   */
  (e: 'save-settings'): void;
}

const props = withDefaults(defineProps<Props>(), {
  errorTitle: 'Error',
  settingsTitle: 'Settings',
  cacheDescription: '',
});

const emit = defineEmits<Emits>();

const { push: pushToast } = useToasts();

const drawerOpen = ref(false);

const statusText = computed(() => {
  if (props.isPolling) {
    return 'Refreshing data…';
  }
  if (props.error) {
    return props.error;
  }
  if (!props.lastUpdatedIso) {
    return 'Awaiting first update.';
  }
  const timestamp = new Date(props.lastUpdatedIso);
  if (Number.isNaN(timestamp.getTime())) {
    return 'Awaiting first update.';
  }
  const formatted = timestamp.toLocaleTimeString();
  return props.isStale ? `Showing cached data from ${formatted}.` : `Last updated ${formatted}.`;
});

const progressValue = computed(() => (props.isPolling ? undefined : 100));

const settingsAria = computed(() => `Open settings for ${props.title}.`);

function handleManualRefresh() {
  emit('manual-refresh');
}

function handleHardRefresh() {
  emit('hard-refresh');
}

function handleSaveSettings() {
  emit('save-settings');
  drawerOpen.value = false;
  pushToast({
    text: 'Settings saved.',
    variant: 'success',
  });
}
</script>

<style scoped>
.polling-widget {
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
  .polling-widget {
    margin-inline: 16px;
  }
}
</style>
