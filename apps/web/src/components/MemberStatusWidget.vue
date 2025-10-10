<template>
  <PollingWidget
    overline-text="Discord"
    title="Member Status"
    :subtitle="guildName"
    error-title="Discord Error"
    settings-title="Discord Settings"
    :error="discordError"
    :is-polling="isPolling"
    :last-updated-iso="lastUpdatedIso"
    :is-stale="isStale"
    :polling-seconds="pollingSeconds"
    :cache-description="cacheDescription"
    :compact="isCompact"
    @manual-refresh="handleManualRefresh"
    @hard-refresh="handleHardRefresh"
    @save-settings="handleSaveSettings"
  >
    <template #main-content>
      <v-sheet class="pa-4" elevation="1" rounded>
        <div class="widget-summary mb-4">
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
            <div class="text-body-2 text-medium-emphasis">Total Members: {{ totalCount }}</div>
            <div class="text-body-2 text-medium-emphasis">Online: {{ onlineCount }}</div>
            <div v-if="uiSettings.showCacheInfo && cacheDescription" class="text-caption text-medium-emphasis mt-1">
              {{ cacheDescription }}
            </div>
          </div>
        </div>

        <v-chip-group v-if="!isCompact" class="status-chip-group mb-3">
          <v-chip
            size="small"
            :color="getStatusColor('online')"
            variant="tonal"
            prepend-icon="mdi-circle"
          >
            Online: {{ getStatusCount('online') }}
          </v-chip>
          <v-chip
            size="small"
            :color="getStatusColor('idle')"
            variant="tonal"
            prepend-icon="mdi-minus-circle"
          >
            Idle: {{ getStatusCount('idle') }}
          </v-chip>
          <v-chip
            size="small"
            :color="getStatusColor('dnd')"
            variant="tonal"
            prepend-icon="mdi-do-not-disturb"
          >
            DND: {{ getStatusCount('dnd') }}
          </v-chip>
          <v-chip
            v-if="displaySettings.showOfflineMembers"
            size="small"
            :color="getStatusColor('offline')"
            variant="tonal"
            prepend-icon="mdi-circle-outline"
          >
            Offline: {{ getStatusCount('offline') }}
          </v-chip>
        </v-chip-group>
      </v-sheet>

      <div class="mt-4">
        <div class="text-subtitle-1 font-weight-medium mb-3">Member List</div>
        <v-card elevation="2" rounded class="member-list-card">
          <div class="member-list-container">
            <div
              v-for="member in displayedMembers"
              :key="member.id"
              class="member-item"
              :class="{ 'member-bot': member.bot }"
            >
              <div class="member-avatar" v-if="displaySettings.showAvatars">
                <v-avatar
                  :image="member.avatarUrl || undefined"
                  :size="isCompact ? 24 : 32"
                >
                  <v-icon v-if="!member.avatarUrl">mdi-account</v-icon>
                </v-avatar>
              </div>
              <div class="member-info">
                <div class="member-name">
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
                <div class="member-username text-caption text-medium-emphasis">
                  @{{ member.username }}
                </div>
              </div>
              <div class="member-status">
                <v-icon
                  :icon="getStatusIcon(member.status)"
                  :color="getStatusColor(member.status)"
                  :size="isCompact ? 16 : 20"
                />
                <span class="ml-1 text-caption">{{ member.status }}</span>
              </div>
            </div>
          </div>
          
          <div v-if="hasMoreMembers" class="pa-3 text-center">
            <v-btn
              variant="text"
              size="small"
              @click="showAllMembers = !showAllMembers"
            >
              {{ showAllMembers ? 'Show Less' : `Show ${remainingMembersCount} More` }}
            </v-btn>
          </div>
        </v-card>
      </div>
    </template>

    <template #settings-content>
      <v-text-field
        v-model.number="refreshIntervalInput"
        label="Refresh Interval (seconds)"
        type="number"
        :min="minRefreshSeconds"
        :max="maxRefreshSeconds"
        variant="outlined"
        density="compact"
        @keyup.enter="updateRefreshInterval"
      />
      
      <v-divider class="my-4" />
      
      <div class="text-subtitle-1 font-weight-medium mb-3">Display Settings</div>
      
      <v-checkbox
        v-model="showBotsInput"
        label="Show bots"
        density="compact"
        hide-details
      />
      
      <v-checkbox
        v-model="showOfflineMembersInput"
        label="Show offline members"
        density="compact"
        hide-details
      />
      
      <v-checkbox
        v-model="showAvatarsInput"
        label="Show avatars"
        density="compact"
        hide-details
      />
      
      <v-checkbox
        v-model="groupByStatusInput"
        label="Group by status"
        density="compact"
        hide-details
      />
      
      <v-select
        v-model="sortByInput"
        label="Sort by"
        :items="sortOptions"
        variant="outlined"
        density="compact"
      />
      
      <v-divider class="my-4" />
      <CompactModeControl widget-name="member-status-widget" />
      
      <v-divider class="my-4" />
      
      <v-text-field
        v-model.number="maxMembersToShowInput"
        label="Max members to show"
        type="number"
        :min="5"
        :max="200"
        variant="outlined"
        density="compact"
      />
    </template>
  </PollingWidget>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { DiscordMemberStatus } from '@automata/types';
import PollingWidget from './PollingWidget.vue';
import { useDiscord, type DiscordFetchReason } from '../composables/useDiscord';
import { useToasts } from '../composables/useToasts';
import { useDiscordConfig } from '../composables/useDiscordConfig';
import { useUiPreferences } from '../composables/useUiPreferences';
import CompactModeControl from './CompactModeControl.vue';

const {
  defaultRefreshSeconds,
  minRefreshSeconds,
  maxRefreshSeconds,
  displaySettings,
  uiSettings,
  isValidRefreshInterval,
  clampRefreshInterval,
  updateDisplaySettings,
} = useDiscordConfig();

const refreshIntervalInput = ref(defaultRefreshSeconds.value);
const showBotsInput = ref(displaySettings.value.showBots);
const showOfflineMembersInput = ref(displaySettings.value.showOfflineMembers);
const showAvatarsInput = ref(displaySettings.value.showAvatars);
const groupByStatusInput = ref(displaySettings.value.groupByStatus);
const sortByInput = ref(displaySettings.value.sortBy);
const maxMembersToShowInput = ref(displaySettings.value.maxMembersToShow);
const compactModeInput = ref(displaySettings.value.compactMode);

const sortOptions = [
  { title: 'Status', value: 'status' },
  { title: 'Username', value: 'username' },
  { title: 'Display Name', value: 'displayName' },
];

const {
  data: discordData,
  error: discordError,
  isLoading,
  isRefreshing,
  isStale,
  lastUpdatedIso,
  cacheAgeSeconds,
  cacheHit,
  refresh: refreshDiscord,
  setFreshnessSeconds,
  freshnessSeconds,
} = useDiscord({
  freshnessSeconds: defaultRefreshSeconds.value,
});

const { push: pushToast } = useToasts();
const { isWidgetCompact } = useUiPreferences();

const isCompact = computed(() => isWidgetCompact('member-status-widget'));

let intervalHandle: number | null = null;
let lastErrorMessage: string | null = null;
const showAllMembers = ref(false);

const isPolling = computed(() => isLoading.value || isRefreshing.value);

const pollingSeconds = computed(() => freshnessSeconds.value);

const cacheDescription = computed(() => {
  if (!discordData.value) {
    return '';
  }
  if (isStale.value) {
    return 'Serving cached data while provider recovers.';
  }
  if (cacheHit.value) {
    return cacheAgeSeconds.value !== null
      ? `Cache hit • age ${cacheAgeSeconds.value}s`
      : 'Cache hit';
  }
  return 'Live provider data';
});

const guildName = computed(() => discordData.value?.guildName ?? 'Unknown Guild');

const totalCount = computed(() => discordData.value?.totalMembers ?? 0);

const onlineCount = computed(() => discordData.value?.onlineMembers ?? 0);

const filteredMembers = computed(() => {
  if (!discordData.value) {
    return [];
  }

  let members = discordData.value.members;

  // Filter bots if disabled
  if (!showBotsInput.value) {
    members = members.filter(member => !member.bot);
  }

  // Filter offline members if disabled
  if (!showOfflineMembersInput.value) {
    members = members.filter(member => member.status !== 'offline');
  }

  // Sort members
  members.sort((a, b) => {
    switch (sortByInput.value) {
      case 'username':
        return a.username.localeCompare(b.username);
      case 'displayName':
        return a.displayName.localeCompare(b.displayName);
      case 'status':
      default:
        const statusOrder = { online: 0, idle: 1, dnd: 2, offline: 3 };
        return statusOrder[a.status] - statusOrder[b.status];
    }
  });

  // Group by status if enabled
  if (groupByStatusInput.value) {
    const statusOrder = { online: 0, idle: 1, dnd: 2, offline: 3 };
    members.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  }

  return members;
});

const displayedMembers = computed(() => {
  const members = filteredMembers.value;
  const maxToShow = showAllMembers.value ? members.length : maxMembersToShowInput.value;
  return members.slice(0, maxToShow);
});

const hasMoreMembers = computed(() => {
  return filteredMembers.value.length > maxMembersToShowInput.value;
});

const remainingMembersCount = computed(() => {
  return filteredMembers.value.length - maxMembersToShowInput.value;
});

function getStatusCount(status: string): number {
  return filteredMembers.value.filter(member => member.status === status).length;
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'online':
      return 'mdi-circle';
    case 'idle':
      return 'mdi-minus-circle';
    case 'dnd':
      return 'mdi-do-not-disturb';
    case 'offline':
    default:
      return 'mdi-circle-outline';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'online':
      return 'success';
    case 'idle':
      return 'warning';
    case 'dnd':
      return 'error';
    case 'offline':
    default:
      return 'grey';
  }
}

function clearIntervalHandle() {
  if (intervalHandle) {
    window.clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

async function triggerPolling(reason: DiscordFetchReason, options: { forceRefresh?: boolean } = {}) {
  const background = reason === 'interval';
  await refreshDiscord({ background, reason, forceRefresh: options.forceRefresh });
  const manualTrigger = reason === 'manual' || reason === 'hard-manual';
  if (manualTrigger && !discordError.value) {
    pushToast({
      text: options.forceRefresh ? 'Discord data refreshed from provider.' : 'Discord data refreshed.',
      variant: 'success',
    });
  }
}

function updateRefreshInterval() {
  const clampedValue = clampRefreshInterval(refreshIntervalInput.value);
  refreshIntervalInput.value = clampedValue;
  setFreshnessSeconds(clampedValue);
}

function handleManualRefresh() {
  void triggerPolling('manual');
}

function handleHardRefresh() {
  void triggerPolling('hard-manual', { forceRefresh: true });
}

function handleSaveSettings() {
  updateRefreshInterval();
  updateDisplaySettings({
    showBots: showBotsInput.value,
    showOfflineMembers: showOfflineMembersInput.value,
    showAvatars: showAvatarsInput.value,
    groupByStatus: groupByStatusInput.value,
    sortBy: sortByInput.value,
    maxMembersToShow: maxMembersToShowInput.value,
    compactMode: compactModeInput.value,
  });
  pushToast({
    text: 'Discord settings saved.',
    variant: 'success',
  });
}

onMounted(() => {
  refreshIntervalInput.value = freshnessSeconds.value;
  void triggerPolling('initial');
});

onBeforeUnmount(() => {
  clearIntervalHandle();
});

watch(
  () => pollingSeconds.value,
  (seconds, _previous, onCleanup) => {
    setFreshnessSeconds(seconds);
    clearIntervalHandle();

    if (!Number.isFinite(seconds) || seconds <= 0) {
      return;
    }

    intervalHandle = window.setInterval(() => {
      void triggerPolling('interval');
    }, seconds * 1000);

    onCleanup(() => {
      clearIntervalHandle();
    });
  },
  { immediate: true },
);

watch(discordError, (message) => {
  if (message && message !== lastErrorMessage) {
    pushToast({
      text: message,
      variant: 'error',
      timeout: 6000,
    });
    lastErrorMessage = message;
  } else if (!message) {
    lastErrorMessage = null;
  }
});

watch(isStale, (value) => {
  if (value && discordData.value) {
    pushToast({
      text: 'Showing cached Discord data while waiting for a fresh provider response.',
      variant: 'warning',
      timeout: 7000,
    });
  }
});
</script>

<style scoped>
.member-list-card {
  overflow: hidden;
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

.member-list-container {
  max-height: 400px;
  overflow-y: auto;
}

.member-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(var(--v-theme-surface-variant), 0.12);
  transition: background-color 0.2s ease-in-out;
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

/* Scrollbar styling */
.member-list-container::-webkit-scrollbar {
  width: 6px;
}

.member-list-container::-webkit-scrollbar-track {
  background: rgba(var(--v-theme-surface-variant), 0.1);
  border-radius: 3px;
}

.member-list-container::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface-variant), 0.3);
  border-radius: 3px;
}

.member-list-container::-webkit-scrollbar-thumb:hover {
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
