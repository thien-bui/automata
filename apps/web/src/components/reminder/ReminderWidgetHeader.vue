<template>
  <v-card-title class="d-flex align-center pa-4">
    <div class="d-flex align-center flex-grow-1">
      <v-icon
        icon="mdi-bell-ring"
        color="primary"
        class="me-3"
      />
      <span class="text-h6 font-weight-medium">Reminders</span>
      
      <!-- Overdue indicator -->
      <v-chip
        v-if="overdueCount > 0"
        color="error"
        variant="elevated"
        size="small"
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
            size="small"
            :loading="isLoading"
          >
            <v-icon start icon="mdi-calendar" />
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
        size="small"
        :loading="isLoading"
        @click="$emit('refresh')"
      >
        <v-icon icon="mdi-refresh" />
      </v-btn>
    </div>
  </v-card-title>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

interface Props {
  /** Currently selected date in YYYY-MM-DD format */
  selectedDate: string;
  /** Loading state */
  isLoading: boolean;
  /** Number of overdue reminders */
  overdueCount: number;
}

interface Emits {
  (e: 'date-change', date: string): void;
  (e: 'refresh'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Local state
const dateMenu = ref(false);
const selectedDateInternal = ref<Date>(new Date(props.selectedDate));

// Computed properties
const formattedDate = computed(() => {
  const date = new Date(props.selectedDate);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }
});

const maxDate = computed(() => {
  const max = new Date();
  max.setDate(max.getDate() + 7); // Allow selecting up to 7 days in advance
  return max.toISOString().split('T')[0];
});

// Watch for external date changes
watch(() => props.selectedDate, (newDate) => {
  selectedDateInternal.value = new Date(newDate);
});

// Event handlers
function handleDateChange(date: Date | string): void {
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  emit('date-change', dateStr);
  dateMenu.value = false;
}
</script>

<style scoped>
.v-card-title {
  min-height: 64px;
}
</style>
