<template>
  <template v-if="alerts.length > 0">
    <!-- Full alert display for normal mode -->
    <v-alert
      v-if="!compact"
      type="warning"
      variant="tonal"
      class="mt-4"
      elevation="1"
      dismissible
      border="start"
      @click:close="handleAcknowledgeAlerts"
    >
      <div class="text-subtitle-1 font-weight-medium">Route Alerts</div>
      <ul class="mt-2 mb-0 ps-4">
        <li v-for="alert in alerts" :key="alert.id">
          {{ alert.message }}
        </li>
      </ul>
    </v-alert>
    
    <!-- Compact mode alert indicator -->
    <div v-else class="mt-4 d-flex align-center gap-2">
      <v-icon color="warning" icon="mdi-alert" size="small" />
      <span class="text-body-2 text-medium-emphasis">
        {{ alerts.length }} alert{{ alerts.length > 1 ? 's' : '' }}
      </span>
      <v-btn
        variant="text"
        size="x-small"
        color="warning"
        @click="handleAcknowledgeAlerts"
      >
        Dismiss
      </v-btn>
    </div>
  </template>
</template>

<script setup lang="ts">
interface RouteAlert {
  id: number;
  message: string;
}

interface Props {
  alerts: RouteAlert[];
  compact: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'acknowledge-alerts'): void;
}>();

function handleAcknowledgeAlerts(): void {
  emit('acknowledge-alerts');
}
</script>
