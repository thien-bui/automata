import { computed, ref } from 'vue';
import type { DiscordConfig, DiscordDisplaySettings, DiscordUISettings } from '@automata/types';

const DEFAULT_REFRESH_SECONDS = Number(import.meta.env.VITE_DEFAULT_DISCORD_REFRESH ?? '300');
const MIN_REFRESH_SECONDS = Number(import.meta.env.VITE_MIN_DISCORD_REFRESH ?? '60');
const MAX_REFRESH_SECONDS = Number(import.meta.env.VITE_MAX_DISCORD_REFRESH ?? '3600');

const BASE_DISPLAY_SETTINGS: DiscordDisplaySettings = {
  showBots: false,
  showOfflineMembers: true,
  sortBy: 'status',
  groupByStatus: true,
  maxMembersToShow: 50,
  showAvatars: true,
  compactMode: false,
};

const BASE_UI_SETTINGS: DiscordUISettings = {
  compactMode: false,
  showCacheInfo: true,
  autoRefresh: true,
};

function createDefaultDisplaySettings(): DiscordDisplaySettings {
  return { ...BASE_DISPLAY_SETTINGS };
}

function createDefaultUISettings(): DiscordUISettings {
  return { ...BASE_UI_SETTINGS };
}

function createDefaultConfig(): DiscordConfig {
  return {
    defaultRefreshSeconds: DEFAULT_REFRESH_SECONDS,
    minRefreshSeconds: MIN_REFRESH_SECONDS,
    maxRefreshSeconds: MAX_REFRESH_SECONDS,
    displaySettings: createDefaultDisplaySettings(),
    uiSettings: createDefaultUISettings(),
  };
}

export function useDiscordConfig() {
  const config = ref<DiscordConfig>(createDefaultConfig());

  const defaultRefreshSeconds = computed(() => config.value.defaultRefreshSeconds);
  const minRefreshSeconds = computed(() => config.value.minRefreshSeconds);
  const maxRefreshSeconds = computed(() => config.value.maxRefreshSeconds);
  const displaySettings = computed(() => config.value.displaySettings);
  const uiSettings = computed(() => config.value.uiSettings);

  function isValidRefreshInterval(seconds: number): boolean {
    return Number.isFinite(seconds) && seconds >= minRefreshSeconds.value && seconds <= maxRefreshSeconds.value;
  }

  function clampRefreshInterval(seconds: number): number {
    return Math.max(minRefreshSeconds.value, Math.min(maxRefreshSeconds.value, Math.round(seconds)));
  }

  function updateDisplaySettings(settings: Partial<DiscordDisplaySettings>): void {
    config.value.displaySettings = {
      ...config.value.displaySettings,
      ...settings,
    };
  }

  function updateUISettings(settings: Partial<DiscordUISettings>): void {
    config.value.uiSettings = {
      ...config.value.uiSettings,
      ...settings,
    };
  }

  function resetToDefaults(): void {
    config.value = createDefaultConfig();
  }

  return {
    // Config values
    config,
    defaultRefreshSeconds,
    minRefreshSeconds,
    maxRefreshSeconds,
    displaySettings,
    uiSettings,

    // Validation helpers
    isValidRefreshInterval,
    clampRefreshInterval,

    // Update functions
    updateDisplaySettings,
    updateUISettings,
    resetToDefaults,
  };
}
