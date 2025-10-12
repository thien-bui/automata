<template>
  <v-card
    class="polling-widget"
    :class="{ 'polling-widget--compact': isCompact }"
    elevation="4"
  >
    <v-card-title class="widget-header">
      <div class="widget-header__titles">
        <div v-if="shouldShowOverline" class="widget-header__overline text-overline text-medium-emphasis">{{ overlineText }}</div>
        <div class="widget-header__title text-h6 font-weight-medium">{{ title }}</div>
        <div class="widget-header__subtitle text-body-2 text-medium-emphasis">
          {{ subtitle }}
        </div>
        <div v-if="lastUpdateDisplay" class="widget-header__timestamp text-caption text-medium-emphasis">
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
   * @example 'Current Conditions' or 'Compact Mode'
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

const shouldShowOverline = computed(() => {
  // Hide overline text in compact mode or when overlineText is empty
  return !props.compact && props.overlineText.trim() !== '';
});

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

<style scoped lang="scss">
.polling-widget {
  width: min(61.25rem, calc(100% - clamp(1.5rem, 5vw, 2.5rem)));
  margin-inline: auto;
}

.polling-widget--compact {
  width: min(45rem, calc(100% - clamp(1.5rem, 5vw, 2.5rem)));
}

.widget-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: clamp(0.75rem, 2vw, 1.25rem);
}

.widget-header__titles {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
  align-content: start;
}

.widget-header__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  justify-self: end;
  gap: 0.5rem;
}

.widget-header__title,
.widget-header__subtitle,
.widget-header__timestamp {
  min-width: 0;
}

.polling-widget--compact .widget-header {
  gap: clamp(0.5rem, 2vw, 0.75rem);
  padding-block: 0.625rem;
  padding-inline: clamp(1rem, 3vw, 1.5rem);
}

.polling-widget--compact .widget-header__actions {
  gap: 0.25rem;
}

.polling-widget--compact .widget-header__titles {
  gap: 0.125rem;
}

.polling-widget--compact .widget-header__title {
  font-size: clamp(1.05rem, 1vw + 1rem, 1.15rem);
}

.polling-widget--compact .widget-header__subtitle {
  font-size: clamp(0.85rem, 0.5vw + 0.8rem, 0.95rem);
}

.polling-widget--compact .widget-header__timestamp {
  font-size: clamp(0.75rem, 0.4vw + 0.7rem, 0.875rem);
}

.widget-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: clamp(0.75rem, 2vw, 1rem);
}

.widget-summary__section {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.widget-summary__section--end {
  justify-self: end;
  justify-content: flex-end;
  text-align: end;
}

.polling-widget--compact .widget-summary {
  grid-template-columns: 1fr;
  align-items: stretch;
  gap: 0.75rem;
}

.polling-widget--compact .widget-summary__section--end {
  justify-self: start;
  justify-content: flex-start;
  text-align: start;
}

@media (max-width: 640px) {
  .widget-header {
    grid-template-columns: 1fr;
  }

  .widget-header__actions {
    justify-self: end;
    justify-content: flex-end;
  }

  .widget-summary {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .widget-summary__section--end {
    justify-self: start;
    justify-content: flex-start;
    text-align: start;
  }
}
</style>
