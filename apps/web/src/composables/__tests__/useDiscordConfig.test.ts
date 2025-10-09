import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDiscordConfig } from '../useDiscordConfig';
import type { DiscordDisplaySettings, DiscordUISettings } from '@automata/types';

describe('useDiscordConfig', () => {
  beforeEach(() => {
    vi.stubGlobal('import.meta', {
      env: {
        VITE_DEFAULT_DISCORD_REFRESH: '300',
        VITE_MIN_DISCORD_REFRESH: '60',
        VITE_MAX_DISCORD_REFRESH: '3600'
      }
    });
  });

  describe('initial state', () => {
    it('should initialize with default values', () => {
      const {
        config,
        defaultRefreshSeconds,
        minRefreshSeconds,
        maxRefreshSeconds,
        displaySettings,
        uiSettings
      } = useDiscordConfig();

      expect(defaultRefreshSeconds.value).toBe(300);
      expect(minRefreshSeconds.value).toBe(60);
      expect(maxRefreshSeconds.value).toBe(3600);

      const expectedDisplaySettings: DiscordDisplaySettings = {
        showBots: false,
        showOfflineMembers: true,
        sortBy: 'status',
        groupByStatus: true,
        maxMembersToShow: 50,
        showAvatars: true,
        compactMode: false,
      };

      const expectedUISettings: DiscordUISettings = {
        compactMode: false,
        showCacheInfo: true,
        autoRefresh: true,
      };

      expect(displaySettings.value).toEqual(expectedDisplaySettings);
      expect(uiSettings.value).toEqual(expectedUISettings);
      expect(config.value).toEqual({
        defaultRefreshSeconds: 300,
        minRefreshSeconds: 60,
        maxRefreshSeconds: 3600,
        displaySettings: expectedDisplaySettings,
        uiSettings: expectedUISettings,
      });
    });
  });

  describe('validation helpers', () => {
    it('should validate refresh intervals correctly', () => {
      const { isValidRefreshInterval } = useDiscordConfig();

      expect(isValidRefreshInterval(300)).toBe(true);
      expect(isValidRefreshInterval(60)).toBe(true);
      expect(isValidRefreshInterval(3600)).toBe(true);
      expect(isValidRefreshInterval(59)).toBe(false);
      expect(isValidRefreshInterval(3601)).toBe(false);
      expect(isValidRefreshInterval(NaN)).toBe(false);
      expect(isValidRefreshInterval(Infinity)).toBe(false);
    });

    it('should clamp refresh intervals correctly', () => {
      const { clampRefreshInterval } = useDiscordConfig();

      expect(clampRefreshInterval(300)).toBe(300);
      expect(clampRefreshInterval(59)).toBe(60);
      expect(clampRefreshInterval(3601)).toBe(3600);
      expect(clampRefreshInterval(123.7)).toBe(124);
      expect(clampRefreshInterval(45)).toBe(60);
      expect(clampRefreshInterval(4000)).toBe(3600);
    });
  });

  describe('update functions', () => {
    it('should update display settings partially', () => {
      const { updateDisplaySettings, displaySettings } = useDiscordConfig();

      updateDisplaySettings({
        showBots: true,
        maxMembersToShow: 25,
        compactMode: true
      });

      expect(displaySettings.value).toEqual({
        showBots: true,
        showOfflineMembers: true,
        sortBy: 'status',
        groupByStatus: true,
        maxMembersToShow: 25,
        showAvatars: true,
        compactMode: true,
      });
    });

    it('should update UI settings partially', () => {
      const { updateUISettings, uiSettings } = useDiscordConfig();

      updateUISettings({
        showCacheInfo: false,
        autoRefresh: false
      });

      expect(uiSettings.value).toEqual({
        compactMode: false,
        showCacheInfo: false,
        autoRefresh: false,
      });
    });

    it('should handle empty update objects', () => {
      const { updateDisplaySettings, updateUISettings, displaySettings, uiSettings } = useDiscordConfig();

      const initialDisplay = { ...displaySettings.value };
      const initialUI = { ...uiSettings.value };

      updateDisplaySettings({});
      updateUISettings({});

      expect(displaySettings.value).toEqual(initialDisplay);
      expect(uiSettings.value).toEqual(initialUI);
    });

    it('should update multiple settings independently', () => {
      const { updateDisplaySettings, updateUISettings, displaySettings, uiSettings } = useDiscordConfig();

      updateDisplaySettings({ showBots: true, sortBy: 'username' });
      updateUISettings({ compactMode: true });

      expect(displaySettings.value.showBots).toBe(true);
      expect(displaySettings.value.sortBy).toBe('username');
      expect(uiSettings.value.compactMode).toBe(true);
    });
  });

  describe('reset functionality', () => {
    it('should reset all settings to defaults', () => {
      const {
        config,
        displaySettings,
        uiSettings,
        updateDisplaySettings,
        updateUISettings,
        resetToDefaults
      } = useDiscordConfig();

      // Store initial state for comparison
      const initialDisplaySettings = { ...displaySettings.value };
      const initialUISettings = { ...uiSettings.value };

      // Modify settings
      updateDisplaySettings({
        showBots: true,
        showOfflineMembers: false,
        sortBy: 'username',
        groupByStatus: false,
        maxMembersToShow: 10,
        showAvatars: false,
        compactMode: true,
      });

      updateUISettings({
        compactMode: true,
        showCacheInfo: false,
        autoRefresh: false,
      });

      // Verify settings were modified
      expect(displaySettings.value.showBots).toBe(true);
      expect(displaySettings.value.showOfflineMembers).toBe(false);
      expect(uiSettings.value.showCacheInfo).toBe(false);

      // Reset to defaults
      resetToDefaults();

      // Define expected default values
      const expectedDisplaySettings = {
        showBots: false,
        showOfflineMembers: true,
        sortBy: 'status',
        groupByStatus: true,
        maxMembersToShow: 50,
        showAvatars: true,
        compactMode: false,
      };

      const expectedUISettings = {
        compactMode: false,
        showCacheInfo: true,
        autoRefresh: true,
      };

      // Should be back to default state
      expect(displaySettings.value).toEqual(expectedDisplaySettings);
      expect(uiSettings.value).toEqual(expectedUISettings);
      expect(config.value.displaySettings).toEqual(expectedDisplaySettings);
      expect(config.value.uiSettings).toEqual(expectedUISettings);
    });
  });

  describe('reactive updates', () => {
    it('should reactively update computed properties when config changes', () => {
      const { config, defaultRefreshSeconds, displaySettings, uiSettings } = useDiscordConfig();

      // Update config directly
      config.value = {
        ...config.value,
        defaultRefreshSeconds: 600,
        displaySettings: {
          ...config.value.displaySettings,
          showBots: true,
          maxMembersToShow: 20,
        },
        uiSettings: {
          ...config.value.uiSettings,
          autoRefresh: false,
        },
      };

      expect(defaultRefreshSeconds.value).toBe(600);
      expect(displaySettings.value.showBots).toBe(true);
      expect(displaySettings.value.maxMembersToShow).toBe(20);
      expect(uiSettings.value.autoRefresh).toBe(false);
    });
  });
});
