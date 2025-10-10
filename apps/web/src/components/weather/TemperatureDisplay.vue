<template>
  <div class="temperature-display" aria-live="polite">
    {{ displayValue }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  celsius: number;
  fahrenheit: number;
  unit?: 'celsius' | 'fahrenheit' | 'both';
}

const props = withDefaults(defineProps<Props>(), {
  unit: 'both',
});

const displayValue = computed(() => {
  if (Number.isNaN(props.celsius) || Number.isNaN(props.fahrenheit)) {
    return '—';
  }

  switch (props.unit) {
    case 'celsius':
      return `${Math.round(props.celsius)}°C`;
  case 'fahrenheit':
    return `${Math.round(props.fahrenheit)}°F`;
    case 'both':
    default:
      return `${Math.round(props.celsius)}°C / ${Math.round(props.fahrenheit)}°F`;
  }
});
</script>

<style scoped>
.temperature-display {
  font-weight: 500;
}
</style>
