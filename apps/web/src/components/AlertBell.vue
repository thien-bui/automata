<template>
<v-badge
  :model-value="unreadCount > 0"
  :content="badgeContent"
  color="secondary"
  floating
  aria-label="Unread alerts"
>
  <v-btn icon="mdi-bell" variant="text" :aria-label="ariaLabel" @click="$emit('open-alerts')" />
</v-badge>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  unreadCount: number;
}>();

defineEmits<{ (e: 'open-alerts'): void }>();

const ariaLabel = computed(() =>
  props.unreadCount > 0 ? `View ${props.unreadCount} unread alerts` : 'View alerts',
);

const badgeContent = computed(() => (props.unreadCount > 9 ? '9+' : props.unreadCount));
</script>
