<template>
  <v-sheet
    class="discord-widget"
    :class="{ 'discord-widget--compact': isCompact }"
    elevation="1"
    rounded
  >
    <div v-if="!isCompact" class="widget-summary">
      <div class="widget-summary__section">
        <div class="text-overline text-medium-emphasis">Guild Overview</div>
        <div class="text-h4 font-weight-medium" aria-live="polite">
          {{ onlineCount }} / {{ totalCount }}
        </div>
        <div class="text-body-1 text-medium-emphasis mt-1">
          Members Online
        </div>
      </div>
      <div class="widget-summary__section widget-summary__section--end">
        <div class="text-body-2 text-medium-emphasis">
          Total: {{ totalCount }}
        </div>
        <div class="text-body-2 text-medium-emphasis">
          Online: {{ onlineCount }}
        </div>
        <div
          v-if="showCacheInfo && cacheDescription"
          class="text-caption text-medium-emphasis mt-1"
        >
          {{ cacheDescription }}
        </div>
      </div>
    </div>

    <v-chip-group v-if="!isCompact" class="status-chip-group mb-3">
      <v-chip
        v-for="chip in statusChips"
        :key="chip.status"
        size="small"
        :color="chip.color"
        variant="tonal"
        :prepend-icon="chip.icon"
      >
        {{ chip.label }}: {{ chip.count }}
      </v-chip>
    </v-chip-group>
  </v-sheet>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { DiscordMemberStatus } from '@automata/types';
import { getStatusColor, getStatusIcon, getStatusMeta } from './status';

type DiscordPresenceStatus = DiscordMemberStatus['status'];

type StatusCounts = Record<DiscordPresenceStatus, number>;

const props = defineProps<{
  totalCount: number;
  onlineCount: number;
  cacheDescription: string;
  showCacheInfo: boolean;
  statusCounts: StatusCounts;
  showOfflineMembers: boolean;
  isCompact: boolean;
}>();

const statusChips = computed(() => {
  const statuses: DiscordPresenceStatus[] = ['online', 'idle', 'dnd', 'offline'];
  const items = statuses
    .map(status => ({
      status,
      count: props.statusCounts[status] ?? 0,
      label: getStatusMeta(status).label,
      color: getStatusColor(status),
      icon: getStatusIcon(status),
    }))
    .filter(item => (item.status === 'offline' ? props.showOfflineMembers : true));

  return items;
});
</script>

<style scoped>
.discord-widget {
  padding: 16px;
}

.discord-widget--compact {
  padding: 0;
}

.widget-summary {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 16px;
}

.widget-summary__section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.widget-summary__section--end {
  text-align: right;
}

.status-chip-group {
  display: flex;
}

:deep(.status-chip-group .v-slide-group__container) {
  width: 100%;
}

:deep(.status-chip-group .v-slide-group__content) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

:deep(.status-chip-group .v-slide-group__content > *) {
  margin: 0;
}
</style>
