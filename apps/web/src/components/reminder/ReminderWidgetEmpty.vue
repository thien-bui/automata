<template>
  <div class="reminder-widget-empty text-center py-8">
    <v-icon
      icon="mdi-bell-off"
      color="medium-emphasis"
      size="64"
      class="mb-4"
    />
    
    <div class="text-h6 font-weight-regular text-medium-emphasis mb-2">
      {{ title }}
    </div>
    
    <div class="text-body-2 text-medium-emphasis mb-4">
      {{ message }}
    </div>

    <!-- Action buttons for specific scenarios -->
    <div v-if="showActions" class="d-flex justify-center ga-2">
      <v-btn
        v-if="isToday"
        variant="outlined"
        color="primary"
        @click="$emit('add-reminder')"
      >
        <v-icon start icon="mdi-plus" />
        Add Reminder
      </v-btn>
      
      <v-btn
        v-if="isPast"
        variant="text"
        color="primary"
        @click="$emit('go-to-today')"
      >
        <v-icon start icon="mdi-calendar-today" />
        Go to Today
      </v-btn>
    </div>

    <!-- Tips for empty state -->
    <div v-if="showTips" class="mt-6 pa-4 bg-grey-lighten-5 rounded-lg">
      <div class="text-caption text-medium-emphasis mb-2">
        <v-icon icon="mdi-lightbulb-outline" size="16" class="me-1" />
        Tips
      </div>
      <ul class="text-caption text-medium-emphasis text-start">
        <li>Reminders are automatically created from recurring templates</li>
        <li>Reminders expire after 15 minutes past their scheduled time</li>
        <li>Completed reminders are moved to a separate list</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  getTodayDateKey,
  isValidDateKey,
  parseDateKey,
  type DateKey,
} from '../../utils/dateOnly';

interface Props {
  /** Selected date in YYYY-MM-DD format */
  selectedDate: string;
  /** Whether to show action buttons */
  showActions?: boolean;
  /** Whether to show tips */
  showTips?: boolean;
}

interface Emits {
  (e: 'add-reminder'): void;
  (e: 'go-to-today'): void;
}

const props = withDefaults(defineProps<Props>(), {
  showActions: true,
  showTips: true,
});

defineEmits<Emits>();

// Computed properties
const todayKey = getTodayDateKey();
const selectedDateKey = computed<DateKey>(() => {
  return isValidDateKey(props.selectedDate) ? (props.selectedDate as DateKey) : todayKey;
});

const todayStart = computed(() => parseDateKey(todayKey));
const selectedDateStart = computed(() => parseDateKey(selectedDateKey.value));

const isToday = computed(() => selectedDateKey.value === todayKey);
const isPast = computed(() => selectedDateStart.value.getTime() < todayStart.value.getTime() && !isToday.value);
const isFuture = computed(() => selectedDateStart.value.getTime() > todayStart.value.getTime());

const title = computed(() => {
  if (isToday.value) {
    return 'No reminders for today';
  } else if (isPast.value) {
    return 'No reminders for this date';
  } else if (isFuture.value) {
    return 'No reminders scheduled';
  } else {
    return 'No reminders found';
  }
});

const message = computed(() => {
  if (isToday.value) {
    return 'You\'re all caught up! Enjoy your day.';
  } else if (isPast.value) {
    return 'There were no reminders scheduled for this date.';
  } else if (isFuture.value) {
    return 'No reminders have been scheduled for this date yet.';
  } else {
    return 'No reminders are available for the selected date.';
  }
});
</script>

<style scoped>
.reminder-widget-empty {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.bg-grey-lighten-5 {
  background-color: rgba(var(--v-theme-grey-lighten-5), 0.1);
}

ul {
  padding-left: 20px;
  margin: 0;
}

li {
  margin-bottom: 4px;
}

li:last-child {
  margin-bottom: 0;
}
</style>
