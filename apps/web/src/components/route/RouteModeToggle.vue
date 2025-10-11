<template>
  <v-btn-toggle
    :model-value="modelValue"
    :mandatory="mandatory"
    :density="density"
    :color="color"
    :class="buttonClass"
    :aria-label="ariaLabel"
    @update:model-value="handleModeChange"
  >
    <v-btn :value="MonitoringMode.Simple">Simple</v-btn>
    <v-btn :value="MonitoringMode.Nav">Nav</v-btn>
  </v-btn-toggle>
</template>

<script setup lang="ts">
import { MonitoringMode } from '../monitoringMode';

interface Props {
  modelValue: MonitoringMode;
  mandatory?: boolean;
  density?: 'default' | 'comfortable' | 'compact';
  color?: string;
  buttonClass?: string;
  ariaLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  mandatory: true,
  density: 'default',
  color: 'primary',
  buttonClass: '',
  ariaLabel: 'Select monitoring mode',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: MonitoringMode): void;
}>();

function handleModeChange(value: MonitoringMode): void {
  emit('update:modelValue', value);
}
</script>
