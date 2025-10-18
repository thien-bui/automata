<template>
  <v-sheet
    class="discord-header"
    :class="{ 'discord-header--compact': isCompact }"
    elevation="1"
    rounded
  >
    <div v-if="!isCompact" class="discord-header__summary">
      <div class="discord-header__metric">
        <div class="discord-header__label text-overline text-medium-emphasis">Guild Overview</div>
        <div class="discord-header__total text-h4 font-weight-medium" aria-live="polite">
          {{ onlineCount }} / {{ totalCount }}
        </div>
        <div class="discord-header__subtitle text-body-1 text-medium-emphasis">
          Members Online
        </div>
      </div>
      <div class="discord-header__meta">
        <div class="discord-header__meta-line text-body-2 text-medium-emphasis">
          Total: {{ totalCount }}
        </div>
        <div class="discord-header__meta-line text-body-2 text-medium-emphasis">
          Online: {{ onlineCount }}
        </div>
        <div
          v-if="showCacheInfo && cacheDescription"
          class="discord-header__cache text-caption text-medium-emphasis"
        >
          {{ cacheDescription }}
        </div>
      </div>
    </div>

    <v-chip-group v-if="!isCompact" class="discord-header__chips" :class="{ 'discord-header__chips--compact': isCompact }">
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

<style scoped lang="scss">
.discord-header {
  padding: clamp(1rem, 2vw, 1.5rem);
  display: grid;
  gap: clamp(1rem, 3vw, 1.5rem);
}

.discord-header--compact {
  padding: clamp(0.375rem, 1vw, 0.5rem);
  gap: clamp(0.5rem, 1.5vw, 0.75rem);
}

.discord-header__summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: clamp(0.75rem, 2.5vw, 1.5rem);
  align-items: end;
}

.discord-header__metric,
.discord-header__meta {
  display: grid;
  gap: clamp(0.375rem, 1vw, 0.75rem);
  min-width: 0;
}

.discord-header__meta {
  justify-items: end;
  text-align: end;
}

.discord-header__cache {
  max-width: 22rem;
}

.discord-header__chips {
  display: flex;
  flex-wrap: wrap;
  gap: clamp(0.5rem, 1.5vw, 0.75rem);
}

.discord-header__chips--compact {
  gap: clamp(0.375rem, 1vw, 0.5rem);
}

:deep(.discord-header__chips .v-slide-group__container) {
  width: 100%;
}

:deep(.discord-header__chips .v-slide-group__content) {
  display: flex;
  flex-wrap: wrap;
  gap: clamp(0.5rem, 1.5vw, 0.75rem);
}

:deep(.discord-header__chips--compact .v-slide-group__content) {
  gap: clamp(0.375rem, 1vw, 0.5rem);
}

:deep(.discord-header__chips .v-slide-group__content > *) {
  margin: 0;
}

@media (max-width: 640px) {
  .discord-header__meta {
    justify-items: start;
    text-align: start;
  }
}
</style>
