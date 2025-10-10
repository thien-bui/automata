<template>
  <v-text-field
    v-model="locationInput"
    label="Location"
    placeholder="Enter city or address"
    variant="outlined"
    density="compact"
    @keyup.enter="updateLocation"
  />
  <v-text-field
    v-model.number="refreshIntervalInput"
    label="Refresh Interval (seconds)"
    type="number"
    :min="minRefreshSeconds"
    :max="maxRefreshSeconds"
    variant="outlined"
    density="compact"
    @keyup.enter="updateRefreshInterval"
  />
  <v-divider class="my-4" />
  <v-switch
    :model-value="compactModeInput"
    :disabled="globalCompactEnabled"
    label="Compact mode (weather widget)"
    color="primary"
    density="compact"
    hide-details
    @update:model-value="handleCompactSwitch"
  />
  <div class="text-caption text-medium-emphasis">
    <span v-if="globalCompactEnabled">
      Controlled by global compact mode from the toolbar.
    </span>
    <span v-else>
      Applies only to the Weather widget layout.
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface WeatherSettingsData {
  location: string;
  refreshInterval: number;
  compactMode: boolean;
}

interface Props {
  location: string;
  refreshInterval: number;
  compactMode: boolean;
  globalCompactEnabled: boolean;
  minRefreshSeconds: number;
  maxRefreshSeconds: number;
  onSave: (settings: WeatherSettingsData) => void;
}

const props = defineProps<Props>();

const locationInput = ref(props.location);
const refreshIntervalInput = ref(props.refreshInterval);
const compactModeInput = ref(props.compactMode);

watch(
  () => props.location,
  (value) => {
    locationInput.value = value;
  },
  { immediate: true },
);

watch(
  () => props.refreshInterval,
  (value) => {
    refreshIntervalInput.value = value;
  },
  { immediate: true },
);

function updateLocation() {
  props.onSave({
    location: locationInput.value,
    refreshInterval: refreshIntervalInput.value,
    compactMode: compactModeInput.value,
  });
}

function updateRefreshInterval() {
  props.onSave({
    location: locationInput.value,
    refreshInterval: refreshIntervalInput.value,
    compactMode: compactModeInput.value,
  });
}

function handleCompactSwitch(value: boolean | null) {
  const nextValue = Boolean(value);
  compactModeInput.value = nextValue;
  props.onSave({
    location: locationInput.value,
    refreshInterval: refreshIntervalInput.value,
    compactMode: nextValue,
  });
}
</script>

<style scoped>
/* Settings-specific styles if needed */
</style>
