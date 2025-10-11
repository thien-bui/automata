<template>
  <v-card
    class="polling-widget"
    :class="{ 'polling-widget--compact': isCompact }"
    elevation="4"
  >
    <v-card-title class="widget-header">
      <div class="widget-header__titles">
        <div class="text-overline text-medium-emphasis">{{ overlineText }}</div>
        <div class="text-h6 font-weight-medium">{{ title }}</div>
        <div class="text-body-2 text-medium-emphasis mt-1">
          {{ subtitle }}
        </div>
        <div v-if="lastUpdateDisplay" class="text-caption text-medium-emphasis mt-1">
          {{ lastUpdateDisplay }}
        </div>
      </div>

      <div class="widget-header__actions">
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
    </v-card-text>

    <v-dialog v-model="drawerOpen" max-width="500">
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between">
          <span>{{ settingsTitle }}</span>
          <v-btn icon="mdi-close" variant="text" @click="drawerOpen = false" />
        </v-card-title>
        <v-divider />
        <v-card-text>
          <div class="mb-6">
            <slot name="settings-content" />
          </div>

          <v-divider class="my-4" />

          <div class="text-subtitle-1 font-weight-medium mb-3">Status</div>
          <v-sheet class="pa-4" elevation="1" rounded>
            <div class="widget-summary mb-3">
              <div class="widget-summary__section">
                <span aria-live="polite">{{ statusText }}</span>
              </div>
              <div class="widget-summary__section widget-summary__section--end status-indicator">
                <v-progress-circular
                  :indeterminate="isPolling"
                  :model-value="progressValue"
                  color="primary"
                  size="32"
                  width="3"
                  aria-hidden="true"
                />
              </div>
            </div>

            <v-divider class="my-3" />

            <div class="text-body-2 text-medium-emphasis mb-3">
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
   * @example 'Kent, WA' or '443 Ramsay Way → 35522 21st Ave SW'
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
  
  /**
   * Enables compact layout styling for the widget container
   */
  compact?: boolean;
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
  compact: false,
});

const emit = defineEmits<Emits>();

const { push: pushToast } = useToasts();

const drawerOpen = ref(false);
const isCompact = computed(() => props.compact);

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

const lastUpdateDisplay = computed(() => {
  if (!props.lastUpdatedIso) {
    return null;
  }
  const timestamp = new Date(props.lastUpdatedIso);
  if (Number.isNaN(timestamp.getTime())) {
    return null;
  }
  const formatted = timestamp.toLocaleTimeString();
  return props.isStale ? `Cached from ${formatted}` : `Updated ${formatted}`;
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

.polling-widget--compact {
  max-width: 720px;
}

.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.widget-header__titles {
  min-width: 0;
}

.widget-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.polling-widget--compact .widget-header {
  gap: 10px;
  padding: 10px 16px;
}

.polling-widget--compact .widget-header__actions {
  gap: 4px;
}

.polling-widget--compact .widget-header__titles {
  display: grid;
  gap: 2px;
}

.polling-widget--compact :deep(.widget-header__titles .text-overline) {
  display: none;
  margin: 0 !important;
  padding: 0 !important;
}

.polling-widget--compact :deep(.widget-header__titles .text-h6) {
  font-size: 1.1rem;
}

.polling-widget--compact :deep(.widget-header__titles .text-body-2) {
  font-size: 0.85rem;
}

.polling-widget--compact :deep(.widget-header__titles .text-caption) {
  font-size: 0.75rem;
}

.polling-widget--compact :deep(.widget-header__titles .mt-1) {
  margin-top: 2px !important;
}

:deep(.widget-summary__section.status-indicator) {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

:deep(.widget-summary) {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.polling-widget--compact :deep(.widget-summary) {
  flex-direction: column;
  gap: 12px;
}

:deep(.widget-summary__section) {
  flex: 1 1 240px;
}

.polling-widget--compact :deep(.widget-summary__section) {
  flex: 1 1 auto;
}

:deep(.widget-summary__section--end) {
  text-align: end;
}

.polling-widget--compact :deep(.widget-summary__section--end) {
  text-align: start;
}

@media (max-width: 960px) {
  .polling-widget {
    margin-inline: 16px;
  }

  .widget-header {
    align-items: flex-start;
  }
}

@media (max-width: 640px) {
  .widget-header {
    flex-direction: column;
    align-items: stretch;
  }

  .widget-header__actions {
    width: 100%;
    justify-content: flex-end;
  }

  :deep(.widget-summary) {
    flex-direction: column;
    gap: 12px;
  }

  :deep(.widget-summary__section) {
    width: 100%;
  }

  :deep(.widget-summary__section--end) {
    text-align: start;
  }

  :deep(.widget-summary__section.status-indicator) {
    justify-content: flex-start;
  }
}
</style>
