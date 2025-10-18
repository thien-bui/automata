<template>
  <div class="reminder-list-item-wrapper">
    <v-list-item
      :class="[
        'reminder-list-item',
        {
          'reminder-list-item--completed': reminder.isCompleted,
          'reminder-list-item--overdue': isOverdue,
          'reminder-list-item--compact': compact,
        }
      ]"
      :disabled="reminder.isCompleted"
    >
      <!-- Leading icon -->
      <template #prepend>
        <v-icon
          :icon="statusIcon"
          :color="statusColor"
          :size="compact ? 20 : 24"
          :class="compact ? 'me-2' : 'me-3'"
        />
      </template>

      <!-- Content -->
      <v-list-item-title
        :class="[
          compact ? 'text-body-2' : 'text-body-1',
          {
            'text-decoration-line-through text-medium-emphasis': reminder.isCompleted,
          }
        ]"
      >
        {{ reminder.title }}
      </v-list-item-title>

      <v-list-item-subtitle
        v-if="reminder.description && !compact"
        :class="[
          'text-body-2 mt-1',
          {
            'text-medium-emphasis': reminder.isCompleted,
          }
        ]"
      >
        {{ reminder.description }}
      </v-list-item-subtitle>

      <!-- Time and badges -->
      <template #append>
        <div class="d-flex flex-column align-end" :class="compact ? 'ga-0' : 'ga-1'">
          <!-- Time display -->
          <div
            :class="[
              compact ? 'text-caption--compact' : 'text-caption',
              {
                'text-medium-emphasis': reminder.isCompleted,
                'text-error': isOverdue && !reminder.isCompleted,
                'text-primary': !isOverdue && !reminder.isCompleted,
              }
            ]"
          >
            {{ formattedTime }}
          </div>

          <!-- Badges -->
          <div class="d-flex" :class="compact ? 'ga-0' : 'ga-1'">
            <!-- Recurring badge -->
            <v-chip
              v-if="reminder.isRecurring && !compact"
              color="primary"
              variant="outlined"
              size="x-small"
            >
              <v-icon start icon="mdi-repeat" size="12" />
              Daily
            </v-chip>

            <!-- Overdue badge -->
            <v-chip
              v-if="isOverdue && !reminder.isCompleted"
              color="error"
              variant="flat"
              :size="compact ? 'x-small' : 'x-small'"
            >
              {{ compact ? '!' : 'Overdue' }}
            </v-chip>
          </div>

          <!-- Complete button -->
          <v-btn
            v-if="!reminder.isCompleted"
            variant="text"
            color="success"
            :size="compact ? 'x-small' : 'small'"
            @click="handleComplete"
          >
            <v-icon :icon="compact ? 'mdi-check' : 'mdi-check'" :size="compact ? 16 : 20" />
          </v-btn>
        </div>
      </template>
    </v-list-item>

    <!-- Divider (except for last item) -->
    <v-divider v-if="!isLast" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { DailyReminder } from '@automata/types';
import { formatReminderTime, isReminderOverdue } from '../../composables/useDailyReminders';

interface Props {
  /** Reminder data */
  reminder: DailyReminder;
  /** Whether this is the last item in the list */
  isLast?: boolean;
  /** Whether to display in compact mode */
  compact?: boolean;
}

interface Emits {
  (e: 'complete', reminderId: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  isLast: false,
  compact: false,
});

const emit = defineEmits<Emits>();

// Computed properties
const isOverdue = computed(() => isReminderOverdue(props.reminder));

const formattedTime = computed(() => {
  return formatReminderTime(props.reminder.scheduledAt);
});

const statusIcon = computed(() => {
  if (props.reminder.isCompleted) {
    return 'mdi-check-circle';
  } else if (isOverdue.value) {
    return 'mdi-alert-circle';
  } else {
    return 'mdi-clock-outline';
  }
});

const statusColor = computed(() => {
  if (props.reminder.isCompleted) {
    return 'success';
  } else if (isOverdue.value) {
    return 'error';
  } else {
    return 'primary';
  }
});

// Event handlers
function handleComplete(): void {
  emit('complete', props.reminder.id);
}
</script>

<style scoped>
.reminder-list-item {
  transition: all 0.2s ease;
  padding: 12px 16px;
}

.reminder-list-item--compact {
  padding: 8px 12px;
}

.reminder-list-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.04);
}

.reminder-list-item--completed {
  opacity: 0.7;
}

.reminder-list-item--overdue {
  background-color: rgba(var(--v-theme-error), 0.04);
}

.reminder-list-item--overdue:hover {
  background-color: rgba(var(--v-theme-error), 0.08);
}

.v-list-item__title {
  line-height: 1.4;
}

.v-list-item__subtitle {
  line-height: 1.3;
}

.text-caption--compact {
  font-size: clamp(0.65rem, 0.3vw + 0.6rem, 0.75rem) !important;
}
</style>
