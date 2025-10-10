<template>
  <div class="member-list">
    <div
      class="text-subtitle-1 font-weight-medium mb-3"
      :class="{ 'text-body-2': isCompact }"
    >
      Member List
    </div>

    <v-card
      elevation="2"
      rounded
      class="member-list-card"
      :class="{ 'member-list-card--compact': isCompact }"
    >
      <div
        class="member-list-container"
        :class="{ 'member-list-container--compact': isCompact }"
      >
        <div
          v-for="member in displayedMembers"
          :key="member.id"
          class="member-item"
          :class="{
            'member-bot': member.bot,
            'member-item--compact': isCompact,
          }"
        >
          <div class="member-avatar" v-if="showAvatars">
            <v-avatar
              :image="member.avatarUrl || undefined"
              :size="isCompact ? 20 : 32"
            >
              <v-icon v-if="!member.avatarUrl">mdi-account</v-icon>
            </v-avatar>
          </div>

          <div class="member-info">
            <div class="member-name" :class="{ 'member-name--compact': isCompact }">
              {{ member.displayName }}
              <v-chip
                v-if="member.bot"
                size="x-small"
                color="purple"
                variant="tonal"
                class="ml-2"
              >
                BOT
              </v-chip>
            </div>
            <div
              class="member-username text-caption text-medium-emphasis"
              :class="{ 'd-none': isCompact }"
            >
              @{{ member.username }}
            </div>
          </div>

          <div class="member-status">
            <v-icon
              :icon="getStatusIcon(member.status)"
              :color="getStatusColor(member.status)"
              :size="isCompact ? 14 : 20"
            />
            <span
              class="ml-1 text-caption"
              :class="{ 'd-none': isCompact }"
            >
              {{ member.status }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="hasMoreMembers && !isCompact" class="pa-3 text-center">
        <v-btn
          variant="text"
          size="small"
          @click="toggleShowAll"
        >
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

<style scoped>
.member-list {
  margin-top: 16px;
}

.member-list-card {
  overflow: hidden;
}

.member-list-card--compact {
  overflow: visible;
}

.member-list-container {
  max-height: 400px;
  overflow-y: auto;
}

.member-list-container--compact {
  max-height: 300px;
}

.member-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(var(--v-theme-surface-variant), 0.12);
  transition: background-color 0.2s ease-in-out;
}

.member-item--compact {
  padding: 8px 12px;
}

.member-item:hover {
  background-color: rgba(var(--v-theme-surface-variant), 0.04);
}

.member-item:last-child {
  border-bottom: none;
}

.member-item.member-bot {
  background-color: rgba(var(--v-theme-purple), 0.04);
}

.member-avatar {
  margin-right: 12px;
  flex-shrink: 0;
}

.member-item--compact .member-avatar {
  margin-right: 8px;
}

.member-info {
  flex-grow: 1;
  min-width: 0;
}

.member-name {
  font-weight: 500;
  font-size: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-name--compact {
  font-size: 0.8rem;
}

.member-username {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-status {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: 12px;
}

.member-item--compact .member-status {
  margin-left: 8px;
}

.member-list-container::-webkit-scrollbar,
.member-list-container--compact::-webkit-scrollbar {
  width: 6px;
}

.member-list-container::-webkit-scrollbar-track,
.member-list-container--compact::-webkit-scrollbar-track {
  background: rgba(var(--v-theme-surface-variant), 0.1);
  border-radius: 3px;
}

.member-list-container::-webkit-scrollbar-thumb,
.member-list-container--compact::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface-variant), 0.3);
  border-radius: 3px;
}

.member-list-container::-webkit-scrollbar-thumb:hover,
.member-list-container--compact::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--v-theme-on-surface-variant), 0.5);
}

@media (max-width: 960px) {
  .member-item {
    padding: 8px 12px;
  }

  .member-avatar {
    margin-right: 8px;
  }

  .member-name {
    font-size: 0.8rem;
  }

  .member-username {
    font-size: 0.7rem;
  }
}

@media (max-width: 640px) {
  .member-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .member-avatar {
    margin-right: 0;
  }

  .member-status {
    margin-left: 0;
  }
}
</style>
