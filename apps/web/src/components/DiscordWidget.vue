<template>
  <PollingWidget
    overline-text="Friend List"
    title="Discord"
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
      <DiscordWidgetHeader
        :total-count="totalCount"
        :online-count="onlineCount"
        :cache-description="cacheDescription"
        :show-cache-info="uiSettings.showCacheInfo"
        :status-counts="statusCounts"
        :show-offline-members="showOfflineMembersInput"
        :is-compact="isCompact"
      />

      <DiscordMemberList
        :members="filteredMembers"
        :max-members-to-show="maxMembersToShowInput"
        :show-avatars="showAvatarsInput"
        :is-compact="isCompact"
      />
    </template>

    <template #settings-content>
      <div class="discord-widget__settings">
        <DiscordWidgetSettings
          v-model:refresh-interval="refreshIntervalInput"
          v-model:show-bots="showBotsInput"
          v-model:show-offline-members="showOfflineMembersInput"
          v-model:show-avatars="showAvatarsInput"
          v-model:group-by-status="groupByStatusInput"
          v-model:sort-by="sortByInput"
          v-model:max-members-to-show="maxMembersToShowInput"
          :min-refresh-seconds="minRefreshSeconds"
          :max-refresh-seconds="maxRefreshSeconds"
          :sort-options="sortOptions"
          @submit="updateRefreshInterval"
        />
      </div>
    </template>
  </PollingWidget>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { DiscordDisplaySettings, DiscordMemberStatus } from '@automata/types';
import PollingWidget from './PollingWidget.vue';
import { useDiscord, type DiscordFetchReason } from '../composables/useDiscord';
import { useToasts } from '../composables/useToasts';
import { useDiscordConfig } from '../composables/useDiscordConfig';
import { useUiPreferences } from '../composables/useUiPreferences';
import DiscordWidgetHeader from './discord/DiscordWidgetHeader.vue';
import DiscordMemberList from './discord/DiscordMemberList.vue';
import DiscordWidgetSettings from './discord/DiscordWidgetSettings.vue';
import { compareStatus } from './discord/status';

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

type SortOption = {
  readonly title: string;
  readonly value: DiscordDisplaySettings['sortBy'];
};

const sortOptions: ReadonlyArray<SortOption> = [
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

const isCompact = computed(() => isWidgetCompact('discord-widget'));

type DiscordPresenceStatus = DiscordMemberStatus['status'];

let intervalHandle: number | null = null;
let lastErrorMessage: string | null = null;

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

const filteredMembers = computed<DiscordMemberStatus[]>(() => {
  if (!discordData.value) {
    return [];
  }

  let members = [...discordData.value.members];

  if (!showBotsInput.value) {
    members = members.filter(member => !member.bot);
  }

  if (!showOfflineMembersInput.value) {
    members = members.filter(member => member.status !== 'offline');
  }

  members.sort((a, b) => {
    switch (sortByInput.value) {
      case 'username':
        return a.username.localeCompare(b.username);
      case 'displayName':
        return a.displayName.localeCompare(b.displayName);
      case 'status':
      default:
        return compareStatus(a.status, b.status);
    }
  });

  if (groupByStatusInput.value) {
    members.sort((a, b) => compareStatus(a.status, b.status));
  }

  return members;
});

const statusCounts = computed<Record<DiscordPresenceStatus, number>>(() => {
  const counts: Record<DiscordPresenceStatus, number> = {
    online: 0,
    idle: 0,
    dnd: 0,
    offline: 0,
  };

  for (const member of filteredMembers.value) {
    counts[member.status] += 1;
  }

  return counts;
});

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

<style scoped lang="scss">
.discord-widget__settings {
  display: grid;
  gap: clamp(1rem, 3vw, 1.5rem);
}
</style>
