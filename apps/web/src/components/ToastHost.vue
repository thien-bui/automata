<template>
  <teleport to="body">
    <div class="toast-host" role="status" aria-live="polite">
      <v-snackbar
        v-for="message in messages"
        :key="message.id"
        :model-value="true"
        location="top right"
        :color="variantColors[message.variant]"
        :timeout="message.timeout ?? 5000"
        elevation="2"
        class="mb-2"
        @timeout="() => emit('dismiss', message.id)"
      >
        <div class="d-flex align-center justify-space-between w-100">
          <span>{{ message.text }}</span>
          <v-btn icon="mdi-close" variant="text" @click="emit('dismiss', message.id)" />
        </div>
      </v-snackbar>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import type { ToastMessage } from '../composables/useToasts';

const variantColors: Record<ToastMessage['variant'], string> = {
  info: 'secondary',
  success: 'success',
  warning: 'warning',
  error: 'error',
};

const props = defineProps<{
  messages: ToastMessage[];
}>();

const emit = defineEmits<{ (e: 'dismiss', id: number): void }>();

const messages = computed(() => props.messages);
</script>

<style scoped>
.toast-host {
  position: fixed;
  top: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 2000;
  pointer-events: none;
}

.toast-host :deep(.v-snackbar) {
  pointer-events: auto;
}
</style>
