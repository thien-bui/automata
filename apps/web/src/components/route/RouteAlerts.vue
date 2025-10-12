<template>
  <template v-if="alerts.length > 0">
    <!-- Full alert display for normal mode -->
    <v-alert
      v-if="!compact"
      type="warning"
      variant="tonal"
      class="route-alerts__panel"
      elevation="1"
      dismissible
      border="start"
      @click:close="handleAcknowledgeAlerts"
    >
      <div class="route-alerts__title text-subtitle-1 font-weight-medium">Route Alerts</div>
      <ul class="route-alerts__list">
        <li v-for="alert in alerts" :key="alert.id">
          {{ alert.message }}
        </li>
      </ul>
    </v-alert>
    
    <!-- Compact mode alert indicator -->
    <div v-else class="route-alerts__compact">
      <v-icon class="route-alerts__icon" color="warning" icon="mdi-alert" size="small" />
      <span class="route-alerts__count text-body-2 text-medium-emphasis">
        {{ alerts.length }} alert{{ alerts.length > 1 ? 's' : '' }}
      </span>
      <v-btn
        class="route-alerts__dismiss"
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

<style scoped lang="scss">
.route-alerts__panel {
  margin-block-start: clamp(1rem, 2vw, 1.5rem);
  padding-block: clamp(1rem, 2vw, 1.25rem);
  padding-inline: clamp(1rem, 3vw, 1.5rem);
}

.route-alerts__title {
  margin-block-end: clamp(0.5rem, 1.5vw, 0.75rem);
}

.route-alerts__list {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding-inline-start: 1.25rem;
}

.route-alerts__compact {
  display: inline-flex;
  align-items: center;
  gap: clamp(0.5rem, 1.5vw, 0.75rem);
  margin-block-start: clamp(1rem, 2vw, 1.5rem);
}

.route-alerts__icon {
  flex: 0 0 auto;
}

.route-alerts__dismiss {
  padding-inline: 0.25rem;
}
</style>
