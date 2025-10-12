<template>
  <div class="route-settings">
    <section class="route-settings__group">
      <v-list-subheader class="route-settings__heading">Mode</v-list-subheader>
      <RouteModeToggle
        class="route-settings__toggle"
        :model-value="mode"
        density="default"
        color="primary"
        aria-label="Toggle monitoring mode"
        @update:model-value="handleModeUpdate"
      />
    </section>

    <section class="route-settings__group">
      <v-list-subheader class="route-settings__heading">Refresh cadence</v-list-subheader>
      <v-slider
        class="route-settings__slider"
        :model-value="refreshInterval"
        :min="15"
        :max="300"
        :step="15"
        thumb-label
        color="secondary"
        aria-label="Polling interval in seconds"
        @update:model-value="handleRefreshIntervalUpdate"
      />
      <div class="route-settings__note text-caption text-medium-emphasis">
        Polling every {{ refreshInterval }} seconds.
      </div>
    </section>

    <section class="route-settings__group">
      <v-list-subheader class="route-settings__heading">Alert threshold</v-list-subheader>
      <v-slider
        class="route-settings__slider"
        :model-value="thresholdMinutes"
        :min="5"
        :max="180"
        :step="5"
        thumb-label
        color="secondary"
        aria-label="Alert threshold in minutes"
        @update:model-value="handleThresholdUpdate"
      />
      <div class="route-settings__alert-note text-caption text-medium-emphasis">
        <span>Alerts fire above {{ thresholdMinutes }} minutes.</span>
        <v-btn class="route-settings__reset" size="small" variant="text" @click="handleResetThreshold">
          Reset
        </v-btn>
      </div>
    </section>

    <v-divider class="route-settings__divider" />
    <CompactModeControl class="route-settings__compact-control" widget-name="route-widget" />
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

<style scoped lang="scss">
.route-settings {
  display: grid;
  gap: clamp(1.5rem, 3vw, 2rem);
}

.route-settings__group {
  display: grid;
  gap: clamp(0.75rem, 2vw, 1rem);
}

.route-settings__heading {
  padding-inline: clamp(0.75rem, 2vw, 1.25rem);
}

.route-settings__toggle {
  justify-content: flex-start;
  padding-inline: clamp(0.75rem, 2vw, 1.25rem);
}

.route-settings__slider {
  padding-inline: clamp(0.75rem, 3vw, 1.5rem);
}

.route-settings__note {
  padding-inline: clamp(0.75rem, 2vw, 1.25rem);
}

.route-settings__alert-note {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-inline: clamp(0.75rem, 2vw, 1.25rem);
}

.route-settings__reset {
  align-self: center;
}

.route-settings__divider {
  margin-block: clamp(0.5rem, 2vw, 1rem);
}

.route-settings__compact-control {
  padding-inline: clamp(0.75rem, 2vw, 1.25rem);
}
</style>
