<template>
  <div class="discord-widget-settings">
    <v-text-field
      v-model.number="refreshInterval"
      label="Refresh Interval (seconds)"
      type="number"
      :min="minRefreshSeconds"
      :max="maxRefreshSeconds"
      variant="outlined"
      density="compact"
      @keyup.enter="$emit('submit')"
    />

    <v-divider class="my-4" />

    <div class="text-subtitle-1 font-weight-medium mb-3">Display Settings</div>

    <v-checkbox
      v-model="showBots"
      label="Show bots"
      density="compact"
      hide-details
    />

    <v-checkbox
      v-model="showOfflineMembers"
      label="Show offline members"
      density="compact"
      hide-details
    />

    <v-checkbox
      v-model="showAvatars"
      label="Show avatars"
      density="compact"
      hide-details
    />

    <v-checkbox
      v-model="groupByStatus"
      label="Group by status"
      density="compact"
      hide-details
    />

    <v-select
      v-model="sortBy"
      label="Sort by"
      :items="sortOptions"
      variant="outlined"
      density="compact"
    />

    <v-divider class="my-4" />
    <CompactModeControl widget-name="discord-widget" />

    <v-divider class="my-4" />

    <v-text-field
      v-model.number="maxMembersToShow"
      label="Max members to show"
      type="number"
      :min="5"
      :max="200"
      variant="outlined"
      density="compact"
    />
  </div>
</template>

<script setup lang="ts">
import CompactModeControl from '../CompactModeControl.vue';

type SortOption = {
  readonly title: string;
  readonly value: string;
};

defineProps<{
  minRefreshSeconds: number;
  maxRefreshSeconds: number;
  sortOptions: readonly SortOption[];
}>();

defineEmits<{
  submit: [];
}>();

const refreshInterval = defineModel<number>('refreshInterval', { required: true });
const showBots = defineModel<boolean>('showBots', { required: true });
const showOfflineMembers = defineModel<boolean>('showOfflineMembers', { required: true });
const showAvatars = defineModel<boolean>('showAvatars', { required: true });
const groupByStatus = defineModel<boolean>('groupByStatus', { required: true });
const sortBy = defineModel<string>('sortBy', { required: true });
const maxMembersToShow = defineModel<number>('maxMembersToShow', { required: true });
</script>
