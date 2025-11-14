<template>
  <PollingWidget
    overline-text="Reminders"
    :title="widgetTitle"
    :subtitle="widgetSubtitle"
    error-title="Reminder Error"
    settings-title="Reminder Settings"
    :error="error"
    :is-polling="isLoading"
    :last-updated-iso="lastUpdatedIso"
    :is-stale="isStale"
    :polling-seconds="Math.floor(refreshInterval / 1000)"
    :cache-description="cacheDescription"
    :compact="compact"
    @manual-refresh="handleManualRefresh"
    @hard-refresh="handleHardRefresh"
    @save-settings="handleSaveSettings"
  >
    <template #title-actions>
      <ReminderWidgetHeader
        :selected-date="selectedDate"
        :is-loading="isLoading"
        :overdue-count="overdueCount"
        :compact="true"
        @date-change="handleDateChange"
        @refresh="handleRefresh"
      />
    </template>

    <template #main-content>
      <!-- Empty State -->
      <ReminderWidgetEmpty
        v-if="reminders.length === 0 && !isLoading"
        :selected-date="selectedDate"
      />

      <!-- Reminders List -->
      <div v-else-if="reminders.length > 0" class="reminder-list" :class="{ 'reminder-list--compact': compact }">
        <v-list class="pa-0" :class="{ 'pa-1': compact }">
          <TransitionGroup name="reminder" tag="div">
            <ReminderListItem
              v-for="(reminder, index) in sortedReminders"
              :key="reminder.id"
              :reminder="reminder"
              :is-last="index === sortedReminders.length - 1"
              :compact="compact"
              @complete="handleCompleteReminder"
            />
          </TransitionGroup>
        </v-list>

        <!-- Summary -->
        <div class="mt-4 pt-3 border-t" :class="{ 'mt-2 pt-2': compact }">
          <div class="d-flex justify-space-between align-center text-caption" :class="{ 'text-caption': !compact, 'text-caption--compact': compact }">
            <span class="text-medium-emphasis">
              {{ completedCount }} of {{ reminders.length }} completed
            </span>
            <span
              v-if="overdueCount > 0"
              class="text-error font-weight-medium"
            >
              {{ overdueCount }} overdue
            </span>
          </div>
        </div>
      </div>
    </template>

    <template #settings-content>
      <div class="reminder-widget__settings" :class="{ 'reminder-widget__settings--compact': compact }">
        <v-row :class="{ 'ma-0': compact }">
          <v-col cols="12" :class="{ 'pa-2': compact, 'pb-1': compact }">
            <v-text-field
              v-model="settingsRefreshInterval"
              label="Refresh Interval (seconds)"
              type="number"
              min="10"
              max="3600"
              hint="How often to check for new reminders"
              persistent-hint
              :density="compact ? 'compact' : 'default'"
            />
          </v-col>
          <v-col cols="12" :class="{ 'pa-2': compact, 'py-1': compact }">
            <v-switch
              v-model="settingsAutoRefresh"
              label="Auto-refresh"
              hint="Automatically refresh reminders at the specified interval"
              persistent-hint
              :density="compact ? 'compact' : 'default'"
            />
          </v-col>
          <v-col cols="12" :class="{ 'pa-2': compact, 'py-1': compact }">
            <v-switch
              v-model="settingsMidnightUpdate"
              label="Midnight Auto-update"
              hint="Automatically switch to today's reminders at midnight"
              persistent-hint
              :density="compact ? 'compact' : 'default'"
            />
          </v-col>
          <v-col cols="12" :class="{ 'pa-2': compact, 'pt-1': compact }">
            <CompactModeControl widget-name="reminder-widget" />
          </v-col>
        </v-row>
      </div>
    </template>

    <template #status-extra>
      <div v-if="cacheDescription" class="text-body-2 text-medium-emphasis mb-2">
        {{ cacheDescription }}
      </div>
      <div class="text-body-2 text-medium-emphasis">
        Date: {{ selectedDate }}
      </div>
    </template>
  </PollingWidget>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { DailyReminder } from '@automata/types';
import { useDailyReminders } from '../../composables/useDailyReminders';
import { useToasts } from '../../composables/useToasts';
import { useUiPreferences } from '../../composables/useUiPreferences';
import PollingWidget from '../PollingWidget.vue';
import CompactModeControl from '../CompactModeControl.vue';
import ReminderWidgetHeader from './ReminderWidgetHeader.vue';
import ReminderListItem from './ReminderListItem.vue';
import ReminderWidgetEmpty from './ReminderWidgetEmpty.vue';

interface Props {
  /** Optional date to display reminders for (defaults to today) */
  date?: string;
  /** Auto-refresh interval in milliseconds */
  refreshInterval?: number;
  /** Enable auto-refresh */
  autoRefresh?: boolean;
  /** Enable midnight auto-update to today */
  midnightUpdate?: boolean;
}

interface Emits {
  (e: 'reminder-completed', reminderId: string): void;
  (e: 'error', error: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  refreshInterval: 60000, // 1 minute
  autoRefresh: true,
  midnightUpdate: true,
});

const emit = defineEmits<Emits>();

const { push: addToast } = useToasts();
const { isWidgetCompact } = useUiPreferences();

// Settings state
const settingsRefreshInterval = ref(Math.floor(props.refreshInterval / 1000));
const settingsAutoRefresh = ref(props.autoRefresh);
const settingsMidnightUpdate = ref(props.midnightUpdate);

// Internal state for PollingWidget
const refreshInterval = computed(() => settingsRefreshInterval.value * 1000);
const compact = computed(() => isWidgetCompact('reminder-widget'));

// Use the daily reminders composable with reactive settings
const reminderState = useDailyReminders({
  date: props.date,
  refreshInterval: refreshInterval.value,
  autoRefresh: settingsAutoRefresh.value,
  midnightUpdate: settingsMidnightUpdate.value,
});
const {
  reminders,
  overdueCount,
  isLoading,
  error,
  selectedDate,
  serverTime,
  refresh,
  setDate,
  completeReminder,
  startAutoRefresh,
  stopAutoRefresh,
} = reminderState;

// Watch for settings changes and update polling behavior
watch([refreshInterval, settingsAutoRefresh], ([newInterval, newAutoRefresh]) => {
  if (newAutoRefresh) {
    stopAutoRefresh();
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
}, { immediate: false });

// Computed properties for PollingWidget
const widgetTitle = computed(() => {
  const today = new Date().toISOString().split('T')[0];
  if (selectedDate.value === today) {
    return "Today's Reminders";
  }
  const date = new Date(selectedDate.value + 'T00:00:00');
  return date.toLocaleDateString(undefined, { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });
});

const widgetSubtitle = computed(() => {
  if (reminders.value.length === 0) {
    return 'No reminders scheduled';
  }
  const pending = reminders.value.filter(r => !r.isCompleted).length;
  return `${pending} pending • ${reminders.value.length} total`;
});

// Mock values for PollingWidget compatibility
const lastUpdatedIso = ref<string | null>(null);
const isStale = ref(false);
const cacheDescription = ref<string>('');

// Computed properties for reminder list
const sortedReminders = computed<DailyReminder[]>(() => {
  return [...reminders.value].sort((a, b) => {
    // Sort by completion status first (incomplete first), then by time
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? 1 : -1;
    }
    return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
  });
});

const completedCount = computed(() => {
  return reminders.value.filter(reminder => reminder.isCompleted).length;
});

// Event handlers
async function handleDateChange(date: string): Promise<void> {
  try {
    await setDate(date);
  } catch (err) {
    console.error('Error changing date:', err);
    emit('error', 'Failed to change date');
  }
}

async function handleRefresh(): Promise<void> {
  try {
    lastUpdatedIso.value = new Date().toISOString();
    await refresh();
  } catch (err) {
    console.error('Error refreshing reminders:', err);
    emit('error', 'Failed to refresh reminders');
  }
}

async function handleManualRefresh(): Promise<void> {
  await handleRefresh();
}

async function handleHardRefresh(): Promise<void> {
  try {
    lastUpdatedIso.value = new Date().toISOString();
    isStale.value = false;
    cacheDescription.value = 'Live data';
    await refresh();
  } catch (err) {
    console.error('Error hard refreshing reminders:', err);
    emit('error', 'Failed to refresh reminders');
  }
}

function handleSaveSettings(): void {
  // Settings are already reactive, just show a toast
  addToast({
    text: 'Reminder settings updated',
    variant: 'success',
    timeout: 3000,
  });
}

async function handleCompleteReminder(reminderId: string): Promise<void> {
  try {
    await completeReminder(reminderId);
    
    // Find the reminder to show in toast
    const reminder = reminders.value.find(r => r.id === reminderId);
    if (reminder) {
      addToast({
        text: `Completed: ${reminder.title}`,
        variant: 'success',
        timeout: 3000,
      });
    }
    
    emit('reminder-completed', reminderId);
  } catch (err) {
    console.error('Error completing reminder:', err);
    const errorMessage = err instanceof Error ? err.message : 'Failed to complete reminder';
    
    addToast({
      text: errorMessage,
      variant: 'error',
      timeout: 5000,
    });
    
    emit('error', errorMessage);
  }
}
</script>

<style scoped>
.reminder-widget {
  transition: opacity 0.2s ease;
}

.reminder-widget--loading {
  opacity: 0.7;
}

.reminder-list {
  min-height: 200px;
}

.reminder-list--compact {
  min-height: 150px;
}

/* Transition animations for reminder items */
.reminder-enter-active,
.reminder-leave-active {
  transition: all 0.3s ease;
}

.reminder-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.reminder-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.reminder-move {
  transition: transform 0.3s ease;
}

.border-t {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.text-caption--compact {
  font-size: clamp(0.65rem, 0.3vw + 0.6rem, 0.75rem) !important;
}

.reminder-widget__settings {
  padding: clamp(1rem, 3vw, 1.5rem);
}

.reminder-widget__settings--compact {
  padding: clamp(0.75rem, 2vw, 1rem);
}
</style>
