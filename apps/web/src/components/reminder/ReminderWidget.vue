<template>
  <v-card
    class="reminder-widget"
    :class="{ 'reminder-widget--loading': isLoading }"
    elevation="2"
  >
    <!-- Widget Header -->
    <ReminderWidgetHeader
      :selected-date="selectedDate"
      :is-loading="isLoading"
      :overdue-count="overdueCount"
      @date-change="handleDateChange"
      @refresh="handleRefresh"
    />

    <!-- Widget Content -->
    <v-card-text class="pa-4">
      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-8">
        <v-progress-circular
          indeterminate
          color="primary"
          size="40"
          class="mb-3"
        />
        <div class="text-body-2 text-medium-emphasis">
          Loading reminders...
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-8">
        <v-icon
          icon="mdi-alert-circle"
          color="error"
          size="48"
          class="mb-3"
        />
        <div class="text-body-2 text-error mb-3">
          {{ error }}
        </div>
        <v-btn
          variant="outlined"
          color="primary"
          size="small"
          @click="handleRefresh"
        >
          <v-icon start icon="mdi-refresh" />
          Retry
        </v-btn>
      </div>

      <!-- Empty State -->
      <ReminderWidgetEmpty
        v-else-if="reminders.length === 0"
        :selected-date="selectedDate"
      />

      <!-- Reminders List -->
      <div v-else class="reminder-list">
        <v-list class="pa-0">
          <TransitionGroup name="reminder" tag="div">
            <ReminderListItem
              v-for="(reminder, index) in sortedReminders"
              :key="reminder.id"
              :reminder="reminder"
              :is-last="index === sortedReminders.length - 1"
              @complete="handleCompleteReminder"
            />
          </TransitionGroup>
        </v-list>

        <!-- Summary -->
        <div v-if="reminders.length > 0" class="mt-4 pt-3 border-t">
          <div class="d-flex justify-space-between align-center text-caption">
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
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { DailyReminder } from '@automata/types';
import { useDailyReminders, formatReminderTime, isReminderOverdue } from '../../composables/useDailyReminders';
import { useToasts } from '../../composables/useToasts';
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
}

interface Emits {
  (e: 'reminder-completed', reminderId: string): void;
  (e: 'error', error: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  refreshInterval: 60000, // 1 minute
  autoRefresh: true,
});

const emit = defineEmits<Emits>();

const { push: addToast } = useToasts();

// Use the daily reminders composable
const {
  reminders,
  overdueCount,
  isLoading,
  error,
  selectedDate,
  refresh,
  setDate,
  completeReminder,
} = useDailyReminders({
  date: props.date,
  refreshInterval: props.refreshInterval,
  autoRefresh: props.autoRefresh,
});

// Computed properties
const sortedReminders = computed(() => {
  return [...reminders].sort((a, b) => {
    // Sort by completion status first (incomplete first), then by time
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? 1 : -1;
    }
    return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
  });
});

const completedCount = computed(() => {
  return reminders.filter((r: DailyReminder) => r.isCompleted).length;
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
    await refresh();
  } catch (err) {
    console.error('Error refreshing reminders:', err);
    emit('error', 'Failed to refresh reminders');
  }
}

async function handleCompleteReminder(reminderId: string): Promise<void> {
  try {
    await completeReminder(reminderId);
    
    // Find the reminder to show in toast
    const reminder = reminders.find(r => r.id === reminderId);
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
</style>
