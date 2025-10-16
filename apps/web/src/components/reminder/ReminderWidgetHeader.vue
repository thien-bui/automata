<template>
  <div class="reminder-widget-header" :class="{ 'reminder-widget-header--compact': compact }">
    <div class="d-flex align-center flex-grow-1">
      <v-icon
        icon="mdi-bell-ring"
        color="primary"
        :class="compact ? 'me-2' : 'me-3'"
        :size="compact ? 'small' : 'default'"
      />
      <span :class="compact ? 'text-subtitle-1 font-weight-medium' : 'text-h6 font-weight-medium'">
        Reminders
      </span>
      
      <!-- Overdue indicator -->
      <v-chip
        v-if="overdueCount > 0"
        color="error"
        variant="elevated"
        :size="compact ? 'x-small' : 'small'"
        class="ms-2"
      >
        {{ overdueCount }} overdue
      </v-chip>
    </div>

    <div class="d-flex align-center ga-2">
      <!-- Date picker -->
      <v-menu
        v-model="dateMenu"
        :close-on-content-click="false"
        transition="scale-transition"
        min-width="auto"
      >
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            variant="outlined"
            :size="compact ? 'x-small' : 'small'"
            :loading="isLoading"
          >
            <v-icon 
              start 
              icon="mdi-calendar" 
              :size="compact ? 'small' : 'default'"
            />
            {{ formattedDate }}
          </v-btn>
        </template>
        
        <v-date-picker
          v-model="selectedDateInternal"
          :max="maxDate"
          @update:model-value="handleDateChange"
        />
      </v-menu>

      <!-- Refresh button -->
      <v-btn
        variant="outlined"
        :size="compact ? 'x-small' : 'small'"
        :loading="isLoading"
        @click="$emit('refresh')"
      >
        <v-icon 
          icon="mdi-refresh" 
          :size="compact ? 'small' : 'default'"
        />
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  addDays,
  formatDateKey,
  getFriendlyDateLabel,
  isValidDateKey,
  type DateKey,
} from '../../utils/dateOnly';

interface Props {
  /** Currently selected date in YYYY-MM-DD format */
  selectedDate: string;
  /** Loading state */
  isLoading: boolean;
  /** Number of overdue reminders */
  overdueCount: number;
  /** Enable compact mode for smaller display */
  compact?: boolean;
}

interface Emits {
  (e: 'date-change', date: string): void;
  (e: 'refresh'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Local state
const dateMenu = ref(false);
const selectedDateInternal = ref<DateKey>(
  isValidDateKey(props.selectedDate) ? (props.selectedDate as DateKey) : formatDateKey(new Date())
);

// Computed properties
const formattedDate = computed(() => {
  if (!isValidDateKey(props.selectedDate)) {
    return getFriendlyDateLabel(formatDateKey(new Date()));
  }

  return getFriendlyDateLabel(props.selectedDate as DateKey);
});

const maxDate = computed(() => {
  const max = addDays(new Date(), 7); // Allow selecting up to 7 days in advance
  return formatDateKey(max);
});

// Watch for external date changes
watch(() => props.selectedDate, (newDate) => {
  if (isValidDateKey(newDate)) {
    selectedDateInternal.value = newDate as DateKey;
  }
});

// Event handlers
function handleDateChange(date: Date | string | null): void {
  if (typeof date === 'string' && isValidDateKey(date)) {
    selectedDateInternal.value = date as DateKey;
    emit('date-change', date);
    dateMenu.value = false;
    return;
  }

  if (date instanceof Date) {
    const formatted = formatDateKey(date);
    selectedDateInternal.value = formatted;
    emit('date-change', formatted);
    dateMenu.value = false;
  }
}
</script>

<style scoped>
.v-card-title {
  min-height: 64px;
}
</style>
