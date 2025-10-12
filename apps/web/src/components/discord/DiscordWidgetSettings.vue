<template>
  <div class="discord-settings">
    <section class="discord-settings__group">
      <v-text-field
        class="discord-settings__field"
        v-model.number="refreshInterval"
        label="Refresh Interval (seconds)"
        type="number"
        :min="minRefreshSeconds"
        :max="maxRefreshSeconds"
        variant="outlined"
        density="compact"
        @keyup.enter="$emit('submit')"
      />
    </section>

    <v-divider class="discord-settings__divider" />

    <section class="discord-settings__group">
      <div class="discord-settings__heading text-subtitle-1 font-weight-medium">Display Settings</div>
      <div class="discord-settings__options">
        <v-checkbox
          class="discord-settings__checkbox"
          v-model="showBots"
          label="Show bots"
          density="compact"
          hide-details
        />

        <v-checkbox
          class="discord-settings__checkbox"
          v-model="showOfflineMembers"
          label="Show offline members"
          density="compact"
          hide-details
        />

        <v-checkbox
          class="discord-settings__checkbox"
          v-model="showAvatars"
          label="Show avatars"
          density="compact"
          hide-details
        />

        <v-checkbox
          class="discord-settings__checkbox"
          v-model="groupByStatus"
          label="Group by status"
          density="compact"
          hide-details
        />
      </div>

      <v-select
        class="discord-settings__field"
        v-model="sortBy"
        label="Sort by"
        :items="sortOptions"
        variant="outlined"
        density="compact"
      />
    </section>

    <v-divider class="discord-settings__divider" />

    <section class="discord-settings__group">
      <CompactModeControl class="discord-settings__compact" widget-name="discord-widget" />
    </section>

    <v-divider class="discord-settings__divider" />

    <section class="discord-settings__group">
      <v-text-field
        class="discord-settings__field"
        v-model.number="maxMembersToShow"
        label="Max members to show"
        type="number"
        :min="5"
        :max="200"
        variant="outlined"
        density="compact"
      />
    </section>
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

<style scoped lang="scss">
.discord-settings {
  display: grid;
  gap: clamp(1rem, 3vw, 1.5rem);
}

.discord-settings__group {
  display: grid;
  gap: clamp(0.75rem, 2vw, 1rem);
}

.discord-settings__field :deep(.v-field) {
  border-radius: 0.75rem;
}

.discord-settings__heading {
  padding-inline: clamp(0.25rem, 1.5vw, 0.5rem);
}

.discord-settings__options {
  display: grid;
  gap: clamp(0.5rem, 1.5vw, 0.75rem);
}

.discord-settings__checkbox :deep(.v-selection-control) {
  padding-inline: clamp(0.25rem, 1.5vw, 0.5rem);
}

.discord-settings__compact {
  padding-inline: clamp(0.25rem, 1.5vw, 0.5rem);
}

.discord-settings__divider {
  margin-block: 0;
}
</style>
