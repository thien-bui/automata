<template>
  <div class="discord-member-list" :class="{ 'discord-member-list--compact': isCompact }">
    <div class="discord-member-list__title text-subtitle-1 font-weight-medium" :class="{ 'text-body-2': isCompact }">
      Member List
    </div>

    <v-card
      elevation="1"
      rounded
      class="discord-member-list__card"
      :class="{ 'discord-member-list__card--compact': isCompact }"
    >
      <div
        class="discord-member-list__items"
        :class="{ 'discord-member-list__items--compact': isCompact }"
      >
        <div
          v-for="member in displayedMembers"
          :key="member.id"
          class="discord-member-list__item"
          :class="{
            'discord-member-list__item--bot': member.bot,
            'discord-member-list__item--compact': isCompact,
          }"
        >
          <div v-if="showAvatars" class="discord-member-list__avatar">
            <v-avatar
              :image="member.avatarUrl || undefined"
              :size="isCompact ? 20 : 32"
            >
              <v-icon v-if="!member.avatarUrl">mdi-account</v-icon>
            </v-avatar>
          </div>

          <div class="discord-member-list__details">
            <div class="discord-member-list__name" :class="{ 'discord-member-list__name--compact': isCompact }">
              {{ member.displayName }}
              <v-chip
                v-if="member.bot"
                size="x-small"
                color="purple"
                variant="tonal"
                class="discord-member-list__bot-chip"
                :class="{ 'discord-member-list__bot-chip--compact': isCompact }"
              >
                BOT
              </v-chip>
            </div>
            <div
              v-if="!isCompact"
              class="discord-member-list__username text-caption text-medium-emphasis"
            >
              @{{ member.username }}
            </div>
          </div>

          <div class="discord-member-list__status">
            <v-icon
              :icon="getStatusIcon(member.status)"
              :color="getStatusColor(member.status)"
              :size="isCompact ? 14 : 20"
            />
            <span
              v-if="!isCompact"
              class="discord-member-list__status-label text-caption"
            >
              {{ member.status }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="hasMoreMembers && !isCompact" class="discord-member-list__more">
        <v-btn variant="text" size="small" @click="toggleShowAll">
          {{ showAll ? 'Show Less' : `Show ${remainingMembersCount} More` }}
        </v-btn>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { DiscordMemberStatus } from '@automata/types';
import { getStatusColor, getStatusIcon } from './status';

const props = defineProps<{
  members: readonly DiscordMemberStatus[];
  maxMembersToShow: number;
  showAvatars: boolean;
  isCompact: boolean;
}>();

const showAll = ref(false);

const hasMoreMembers = computed(() => props.members.length > props.maxMembersToShow);

const remainingMembersCount = computed(() =>
  Math.max(0, props.members.length - props.maxMembersToShow),
);

const displayedMembers = computed(() =>
  showAll.value ? props.members : props.members.slice(0, props.maxMembersToShow),
);

function toggleShowAll(): void {
  showAll.value = !showAll.value;
}

watch(
  () => [props.members.length, props.maxMembersToShow] as const,
  ([memberCount, maxToShow]) => {
    if (memberCount <= maxToShow && showAll.value) {
      showAll.value = false;
    }
  },
);
</script>

<style scoped lang="scss">
.discord-member-list {
  display: grid;
  gap: clamp(0.75rem, 2vw, 1rem);
  margin-block-start: clamp(1rem, 3vw, 1.5rem);
}

.discord-member-list--compact {
  gap: clamp(0.5rem, 1.5vw, 0.75rem);
  margin-block-start: clamp(0.5rem, 2vw, 0.75rem);
}

.discord-member-list__title {
  padding-inline: clamp(0.25rem, 1.5vw, 0.5rem);
}

.discord-member-list__card {
  overflow: hidden;
}

.discord-member-list__card--compact {
  overflow: visible;
}

.discord-member-list__items {
  max-height: clamp(18rem, 40vh, 24rem);
  overflow-y: auto;
}

.discord-member-list__items--compact {
  max-height: clamp(12rem, 30vh, 18rem);
}

.discord-member-list__item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: clamp(0.75rem, 2vw, 1rem);
  padding-block: clamp(0.75rem, 2vw, 1rem);
  padding-inline: clamp(1rem, 3vw, 1.25rem);
  border-bottom: 1px solid rgba(var(--v-theme-surface-variant), 0.12);
  transition: background-color 0.2s ease-in-out;
}

.discord-member-list__item:last-child {
  border-bottom: none;
}

.discord-member-list__item:hover {
  background-color: rgba(var(--v-theme-surface-variant), 0.04);
}

.discord-member-list__item--bot {
  background-color: rgba(var(--v-theme-purple), 0.04);
}

.discord-member-list__item--compact {
  padding-block: clamp(0.375rem, 1vw, 0.5rem);
  padding-inline: clamp(0.625rem, 1.5vw, 0.875rem);
  gap: clamp(0.375rem, 1vw, 0.5rem);
}

.discord-member-list__avatar {
  flex-shrink: 0;
}

.discord-member-list__details {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}

.discord-member-list__name {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  font-size: clamp(0.85rem, 0.3vw + 0.8rem, 0.95rem);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.discord-member-list__name--compact {
  font-size: clamp(0.7rem, 0.25vw + 0.65rem, 0.8rem);
}

.discord-member-list__bot-chip {
  padding-inline: 0.5rem;
}

.discord-member-list__bot-chip--compact {
  padding-inline: 0.375rem;
  font-size: 0.7rem;
  height: 1.25rem;
}

.discord-member-list__username {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.discord-member-list__status {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.discord-member-list__status-label {
  letter-spacing: 0.01em;
}

.discord-member-list__more {
  display: flex;
  justify-content: center;
  padding: clamp(0.75rem, 2vw, 1rem);
  border-top: 1px solid rgba(var(--v-theme-surface-variant), 0.12);
}

:deep(.discord-member-list__items::-webkit-scrollbar) {
  width: 0.4rem;
}

:deep(.discord-member-list__items::-webkit-scrollbar-track) {
  background: rgba(var(--v-theme-surface-variant), 0.1);
  border-radius: 999px;
}

:deep(.discord-member-list__items::-webkit-scrollbar-thumb) {
  background: rgba(var(--v-theme-on-surface-variant), 0.3);
  border-radius: 999px;
}

:deep(.discord-member-list__items::-webkit-scrollbar-thumb:hover) {
  background: rgba(var(--v-theme-on-surface-variant), 0.5);
}

@media (max-width: 640px) {
  .discord-member-list__item {
    grid-template-columns: minmax(0, 1fr);
    align-items: flex-start;
    gap: clamp(0.5rem, 5vw, 0.75rem);
  }

  .discord-member-list__status {
    justify-content: flex-start;
  }
}
</style>
