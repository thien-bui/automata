<template>
  <div class="weather-settings">
    <v-text-field
      v-model="localLocation"
      label="Location"
      placeholder="Enter city or address"
      variant="outlined"
      density="compact"
      @keyup.enter="handleSave"
    />
    
    <v-text-field
      v-model.number="localRefreshInterval"
      label="Refresh Interval (seconds)"
      type="number"
      :min="minRefreshSeconds"
      :max="maxRefreshSeconds"
      variant="outlined"
      density="compact"
      @keyup.enter="handleSave"
    />
    
    <v-divider />
    
    <v-switch
      v-model="localCompactMode"
      :label="`Compact mode (weather widget)`"
      color="primary"
      :disabled="globalCompactEnabled"
      density="compact"
      hide-details
    />
    
    <div class="text-caption text-medium-emphasis mt-1">
      {{ globalCompactEnabled 
        ? 'Controlled by global compact mode from the toolbar.' 
        : 'Applies only to the Weather widget layout.' 
      }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface Props {
  location: string;
  refreshInterval: number;
  compactMode: boolean;
  globalCompactEnabled: boolean;
  minRefreshSeconds: number;
  maxRefreshSeconds: number;
  onSave: (data: { location: string; refreshInterval: number; compactMode: boolean }) => void;
}

const props = withDefaults(defineProps<Props>(), {
  location: '',
  refreshInterval: 300,
  compactMode: false,
  globalCompactEnabled: false,
  minRefreshSeconds: 60,
  maxRefreshSeconds: 3600,
});

const localLocation = ref(props.location);
const localRefreshInterval = ref(props.refreshInterval);
const localCompactMode = ref(props.compactMode);

// Watch for prop changes and update local state
watch(() => props.location, (newValue) => {
  localLocation.value = newValue;
});

watch(() => props.refreshInterval, (newValue) => {
  localRefreshInterval.value = newValue;
});

watch(() => props.compactMode, (newValue) => {
  localCompactMode.value = newValue;
});

// Watch for local changes and emit save
watch([localLocation, localRefreshInterval, localCompactMode], () => {
  handleSave();
});

function handleSave() {
  props.onSave({
    location: localLocation.value,
    refreshInterval: localRefreshInterval.value,
    compactMode: Boolean(localCompactMode.value),
  });
}
</script>

<style scoped lang="scss">
.weather-settings {
  display: grid;
  gap: 1rem;
}
</style>
