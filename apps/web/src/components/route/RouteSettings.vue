<template>
  <div class="route-settings">
    <div class="mb-6">
      <v-list-subheader>Mode</v-list-subheader>
      <RouteModeToggle
        :model-value="mode"
        density="default"
        color="primary"
        class="my-2"
        aria-label="Toggle monitoring mode"
        @update:model-value="handleModeUpdate"
      />

      <v-list-subheader class="mt-6">Refresh cadence</v-list-subheader>
      <v-slider
        :model-value="refreshInterval"
        :min="15"
        :max="300"
        :step="15"
        thumb-label
        color="secondary"
        aria-label="Polling interval in seconds"
        @update:model-value="handleRefreshIntervalUpdate"
      />
      <div class="text-caption text-medium-emphasis px-2">
        Polling every {{ refreshInterval }} seconds.
      </div>

      <v-list-subheader class="mt-6">Alert threshold</v-list-subheader>
      <v-slider
        :model-value="thresholdMinutes"
        :min="5"
        :max="180"
        :step="5"
        thumb-label
        color="secondary"
        aria-label="Alert threshold in minutes"
        @update:model-value="handleThresholdUpdate"
      />
      <div class="text-caption text-medium-emphasis px-2 d-flex justify-space-between align-center">
        <span>Alerts fire above {{ thresholdMinutes }} minutes.</span>
        <v-btn size="small" variant="text" @click="handleResetThreshold">Reset</v-btn>
      </div>

      <v-divider class="my-4" />
      <CompactModeControl widget-name="route-widget" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { MonitoringMode } from '../monitoringMode';
import RouteModeToggle from './RouteModeToggle.vue';
import CompactModeControl from '../CompactModeControl.vue';

interface Props {
  mode: MonitoringMode;
  refreshInterval: number;
  thresholdMinutes: number;
  isNavMode: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:mode', value: MonitoringMode): void;
  (e: 'update:refreshInterval', value: number): void;
  (e: 'update:thresholdMinutes', value: number): void;
  (e: 'reset-threshold'): void;
  (e: 'save'): void;
}>();

function handleModeUpdate(value: MonitoringMode): void {
  emit('update:mode', value);
}

function handleRefreshIntervalUpdate(value: number): void {
  emit('update:refreshInterval', value);
}

function handleThresholdUpdate(value: number): void {
  emit('update:thresholdMinutes', value);
}

function handleResetThreshold(): void {
  emit('reset-threshold');
}
</script>
