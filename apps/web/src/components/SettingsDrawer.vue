<template>
  <v-navigation-drawer
    :model-value="modelValue"
    location="right"
    width="320"
    aria-label="Settings"
    @update:model-value="onUpdate"
  >
    <v-toolbar flat>
      <v-toolbar-title>Settings</v-toolbar-title>
      <v-spacer />
      <v-btn icon="mdi-close" variant="text" @click="close" />
    </v-toolbar>

    <v-divider />

    <v-list density="comfortable">
      <v-list-subheader>Mode</v-list-subheader>
      <v-btn-toggle
        v-model="localMode"
        color="primary"
        mandatory
        class="my-2"
        aria-label="Toggle monitoring mode"
      >
        <v-btn value="simple">Simple</v-btn>
        <v-btn value="nav">Nav</v-btn>
      </v-btn-toggle>

      <v-list-subheader class="mt-6">Refresh cadence</v-list-subheader>
      <v-slider
        v-model="interval"
        :min="15"
        :max="300"
        :step="15"
        thumb-label
        color="secondary"
        aria-label="Polling interval in seconds"
      />
      <div class="text-caption text-medium-emphasis px-2">
        Polling every {{ interval }} seconds.
      </div>

      <v-list-subheader class="mt-6">Alert threshold</v-list-subheader>
      <v-slider
        v-model="threshold"
        :min="5"
        :max="180"
        :step="5"
        thumb-label
        color="secondary"
        aria-label="Alert threshold in minutes"
      />
      <div class="text-caption text-medium-emphasis px-2 d-flex justify-space-between align-center">
        <span>Alerts fire above {{ threshold }} minutes.</span>
        <v-btn size="small" variant="text" @click="onResetThreshold">Reset</v-btn>
      </div>
    </v-list>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  mode: 'simple' | 'nav';
  refreshInterval: number;
  alertThreshold: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:mode', value: 'simple' | 'nav'): void;
  (e: 'update:refreshInterval', value: number): void;
  (e: 'update:alertThreshold', value: number): void;
  (e: 'reset-alert-threshold'): void;
}>();

const localMode = ref(props.mode);
const interval = ref(props.refreshInterval);
const clampThreshold = (value: number) => Math.max(5, Math.min(180, Math.round(value)));
const threshold = ref(clampThreshold(props.alertThreshold));

watch(
  () => props.mode,
  (value) => {
    localMode.value = value;
  },
);

watch(
  () => props.refreshInterval,
  (value) => {
    interval.value = value;
  },
);

watch(
  () => props.alertThreshold,
  (value) => {
    threshold.value = clampThreshold(value);
  },
);

watch(localMode, (value) => {
  emit('update:mode', value);
});

watch(interval, (value) => {
  emit('update:refreshInterval', value);
});

watch(threshold, (value) => {
  const next = clampThreshold(value);
  if (next !== value) {
    threshold.value = next;
    return;
  }
  emit('update:alertThreshold', next);
});

const close = () => emit('update:modelValue', false);

const onUpdate = (value: boolean) => {
  emit('update:modelValue', value);
};

const onResetThreshold = () => {
  emit('reset-alert-threshold');
};
</script>
