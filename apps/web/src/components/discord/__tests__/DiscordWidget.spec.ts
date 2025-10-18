import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h, ref, computed } from 'vue';
import DiscordWidget from '../DiscordWidget.vue';
import { provideToasts } from '../../../composables/useToasts';
import type { DiscordResponse } from '@automata/types';

const createSlotStub = (tag: string) =>
  defineComponent({
    name: `${tag}-slot-stub`,
    setup(_, { slots }) {
      return () => h(tag, slots.default ? slots.default() : undefined);
    },
  });

// Mock the useDiscord composable
const mockDiscordData: DiscordResponse = {
  guildId: '123456789',
  guildName: 'Test Guild',
  totalMembers: 100,
  onlineMembers: 25,
  members: [
    {
      id: '1',
      username: 'user1',
      displayName: 'User One',
      status: 'online',
      avatarUrl: 'https://example.com/avatar1.png',
      bot: false
    },
    {
      id: '2',
      username: 'bot1',
      displayName: 'Bot One',
      status: 'online',
      avatarUrl: 'https://example.com/bot1.png',
      bot: true
    },
    {
      id: '3',
      username: 'user2',
      displayName: 'User Two',
      status: 'idle',
      avatarUrl: null,
      bot: false
    },
    {
      id: '4',
      username: 'user3',
      displayName: 'User Three',
      status: 'dnd',
      avatarUrl: 'https://example.com/avatar3.png',
      bot: false
    },
    {
      id: '5',
      username: 'user4',
      displayName: 'User Four',
      status: 'offline',
      avatarUrl: 'https://example.com/avatar4.png',
      bot: false
    },
    {
      id: '6',
      username: 'user5',
      displayName: 'User Five',
      status: 'online',
      avatarUrl: 'https://example.com/avatar5.png',
      bot: false
    }
  ],
  lastUpdatedIso: '2024-01-01T12:00:00Z',
  cache: {
    hit: false,
    ageSeconds: 0,
    staleWhileRevalidate: false
  }
};

vi.mock('../../composables/useDiscord', () => ({
  useDiscord: vi.fn(() => ({
    data: ref(mockDiscordData),
    error: ref(null),
    isLoading: ref(false),
    isRefreshing: ref(false),
    isStale: computed(() => false),
    lastUpdatedIso: computed(() => mockDiscordData.lastUpdatedIso),
    cacheAgeSeconds: computed(() => mockDiscordData.cache.ageSeconds),
    cacheHit: computed(() => mockDiscordData.cache.hit),
    freshnessSeconds: ref(300),
    refresh: vi.fn(),
    setFreshnessSeconds: vi.fn()
  })),
  DiscordFetchReason: {
    initial: 'initial',
    interval: 'interval',
    manual: 'manual',
    hardManual: 'hard-manual'
  }
}));

// Mock the useDiscordConfig composable
vi.mock('../../composables/useDiscordConfig', () => ({
  useDiscordConfig: vi.fn()
}));

// Mock the useToasts composable
vi.mock('../../composables/useToasts', () => ({
  useToasts: () => ({
    push: vi.fn()
  }),
  provideToasts: vi.fn()
}));

// Mock the useUiPreferences composable
const mockIsWidgetCompact = vi.fn(() => false); // Default to non-compact for tests

vi.mock('../../composables/useUiPreferences', () => ({
  useUiPreferences: () => ({
    isWidgetCompact: mockIsWidgetCompact
  })
}));

// Mock PollingWidget component
const PollingWidgetMock = defineComponent({
  name: 'PollingWidget',
  props: [
    'overlineText',
    'title',
    'subtitle',
    'errorTitle',
    'settingsTitle',
    'error',
    'isPolling',
    'lastUpdatedIso',
    'isStale',
    'pollingSeconds',
    'cacheDescription',
    'compact'
  ],
  emits: ['manual-refresh', 'hard-refresh', 'save-settings'],
  setup(props, { slots }) {
    return () => h('div', { 'data-test': 'polling-widget' }, [
      h('div', { 'data-test': 'overline-text' }, props.overlineText),
      h('div', { 'data-test': 'title' }, props.title),
      h('div', { 'data-test': 'subtitle' }, props.subtitle),
      h('div', { 'data-test': 'compact' }, props.compact),
      slots['main-content']?.(),
      slots['settings-content']?.(),
    ]);
  },
});

vi.mock('../PollingWidget.vue', () => ({
  default: PollingWidgetMock,
}));

describe('DiscordWidget', () => {
  let mockUseDiscordConfig: Mock;
  
  beforeEach(async () => {
    vi.useFakeTimers();

    const module = await import('../../../composables/useDiscordConfig');
    mockUseDiscordConfig = module.useDiscordConfig as Mock;
    mockUseDiscordConfig.mockReset();
    
    // Setup default mock for useDiscordConfig
    mockUseDiscordConfig.mockReturnValue({
      defaultRefreshSeconds: computed(() => 300),
      minRefreshSeconds: computed(() => 60),
      maxRefreshSeconds: computed(() => 3600),
      displaySettings: computed(() => ({
        showBots: false,
        showOfflineMembers: true,
        sortBy: 'status',
        groupByStatus: true,
        maxMembersToShow: 50,
        showAvatars: true,
        compactMode: false,
      })),
      uiSettings: computed(() => ({
        compactMode: false,
        showCacheInfo: true,
        autoRefresh: true,
      })),
      isValidRefreshInterval: vi.fn((seconds: number) => seconds >= 60 && seconds <= 3600),
      clampRefreshInterval: vi.fn((seconds: number) => Math.max(60, Math.min(3600, Math.round(seconds)))),
      updateDisplaySettings: vi.fn(),
      updateUISettings: vi.fn(),
      resetToDefaults: vi.fn()
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const mountComponent = () => {
    const Wrapper = defineComponent({
      name: 'DiscordWidgetTestWrapper',
      setup() {
        provideToasts();
        return () => h(DiscordWidget);
      },
    });

    return mount(Wrapper, {
      global: {
        stubs: {
          'v-sheet': createSlotStub('div'),
          'v-card': createSlotStub('div'),
          'v-chip-group': createSlotStub('div'),
          'v-chip': createSlotStub('div'),
          'v-icon': defineComponent({
            name: 'VIconStub',
            setup(_, { attrs }) {
              return () => h('i', { ...attrs });
            },
          }),
          'v-avatar': createSlotStub('div'),
          'v-text-field': createSlotStub('input'),
          'v-checkbox': defineComponent({
            name: 'VCheckboxStub',
            props: ['modelValue'],
            emits: ['update:modelValue'],
            setup(props, { emit }) {
              return () => h('input', {
                type: 'checkbox',
                checked: props.modelValue,
                onChange: (e: any) => emit('update:modelValue', e.target.checked)
              });
            },
          }),
          'v-select': defineComponent({
            name: 'VSelectStub',
            props: ['modelValue', 'items'],
            emits: ['update:modelValue'],
            setup(props, { emit }) {
              return () => h('select', {
                value: props.modelValue,
                onChange: (e: any) => emit('update:modelValue', e.target.value)
              }, props.items?.map((item: any) => h('option', { value: item.value }, item.title)));
            },
          }),
          'v-divider': createSlotStub('div'),
          'v-btn': defineComponent({
            name: 'VBtnStub',
            setup(_, { slots, attrs }) {
              return () => h('button', { ...attrs }, slots.default ? slots.default() : undefined);
            },
          }),
          'CompactModeControl': createSlotStub('div'),
        },
      },
    });
  };

  describe('rendering', () => {
    it('renders guild overview with correct member counts', () => {
      const wrapper = mountComponent();

      // Check for content in the main component
      expect(wrapper.text()).toContain('Guild Overview');
      expect(wrapper.text()).toContain('25 / 100');
      expect(wrapper.text()).toContain('Members Online');
      expect(wrapper.text()).toContain('Total: 100');
      expect(wrapper.text()).toContain('Online: 25');
    });

    it('hides guild overview in compact mode', () => {
      mockIsWidgetCompact.mockReturnValue(true);
      const wrapper = mountComponent();

      // Guild overview should be hidden in compact mode
      expect(wrapper.text()).not.toContain('Guild Overview');
      expect(wrapper.text()).not.toContain('25 / 100');
      expect(wrapper.text()).not.toContain('Members Online');
      expect(wrapper.text()).not.toContain('Total: 100');
      expect(wrapper.text()).not.toContain('Online: 25');
    });

    it('renders status chips with correct counts', () => {
      const wrapper = mountComponent();

      // Since v-chip-group and v-chip are stubbed, we need to check for the text content
      expect(wrapper.text()).toContain('Online: 2');
      expect(wrapper.text()).toContain('Idle: 1');
      expect(wrapper.text()).toContain('DND: 1');
      expect(wrapper.text()).toContain('Offline: 1');
    });

    it('renders member list with correct data', () => {
      const wrapper = mountComponent();

      const memberItems = wrapper.findAll('.discord-member-list__item');
      expect(memberItems).toHaveLength(5); // 5 members (bot filtered out)

      const firstMember = memberItems[0];
      expect(firstMember.text()).toContain('User One');
      expect(firstMember.text()).toContain('@user1');
      expect(firstMember.text()).toContain('online');

      // Bot should be filtered out
      const botMember = memberItems.find(item => item.text().includes('Bot One'));
      expect(botMember).toBeUndefined();
    });

    it('shows bot indicator for bot members when showBots is enabled', async () => {
      // Mock useDiscordConfig to show bots
      mockUseDiscordConfig.mockReturnValueOnce({
        defaultRefreshSeconds: computed(() => 300),
        minRefreshSeconds: computed(() => 60),
        maxRefreshSeconds: computed(() => 3600),
        displaySettings: computed(() => ({
          showBots: true,
          showOfflineMembers: true,
          sortBy: 'status',
          groupByStatus: true,
          maxMembersToShow: 50,
          showAvatars: true,
          compactMode: false,
        })),
        uiSettings: computed(() => ({
          compactMode: false,
          showCacheInfo: true,
          autoRefresh: true,
        })),
        isValidRefreshInterval: vi.fn((seconds: number) => seconds >= 60 && seconds <= 3600),
        clampRefreshInterval: vi.fn((seconds: number) => Math.max(60, Math.min(3600, Math.round(seconds)))),
        updateDisplaySettings: vi.fn(),
        updateUISettings: vi.fn(),
        resetToDefaults: vi.fn()
      });

      const wrapper = mountComponent();

      const memberItems = wrapper.findAll('.discord-member-list__item');
      expect(memberItems).toHaveLength(6); // All 6 members including bot

      const botMember = memberItems.find(item => item.text().includes('Bot One'));
      expect(botMember).toBeDefined();
      expect(botMember?.text()).toContain('BOT');
    });
  });

  describe('member filtering and sorting', () => {
    it('filters offline members when showOfflineMembers is disabled', async () => {
      mockUseDiscordConfig.mockReturnValueOnce({
        defaultRefreshSeconds: computed(() => 300),
        minRefreshSeconds: computed(() => 60),
        maxRefreshSeconds: computed(() => 3600),
        displaySettings: computed(() => ({
          showBots: false,
          showOfflineMembers: false,
          sortBy: 'status',
          groupByStatus: true,
          maxMembersToShow: 50,
          showAvatars: true,
          compactMode: false,
        })),
        uiSettings: computed(() => ({
          compactMode: false,
          showCacheInfo: true,
          autoRefresh: true,
        })),
        isValidRefreshInterval: vi.fn((seconds: number) => seconds >= 60 && seconds <= 3600),
        clampRefreshInterval: vi.fn((seconds: number) => Math.max(60, Math.min(3600, Math.round(seconds)))),
        updateDisplaySettings: vi.fn(),
        updateUISettings: vi.fn(),
        resetToDefaults: vi.fn()
      });

      const wrapper = mountComponent();

      const memberItems = wrapper.findAll('.discord-member-list__item');
      expect(memberItems).toHaveLength(4); // 4 members (bot and offline filtered out)

      const offlineMember = memberItems.find(item => item.text().includes('User Four'));
      expect(offlineMember).toBeUndefined();
    });

    it('sorts members by username when sortBy is username', async () => {
      mockUseDiscordConfig.mockReturnValueOnce({
        defaultRefreshSeconds: computed(() => 300),
        minRefreshSeconds: computed(() => 60),
        maxRefreshSeconds: computed(() => 3600),
        displaySettings: computed(() => ({
          showBots: false,
          showOfflineMembers: true,
          sortBy: 'username',
          groupByStatus: false,
          maxMembersToShow: 50,
          showAvatars: true,
          compactMode: false,
        })),
        uiSettings: computed(() => ({
          compactMode: false,
          showCacheInfo: true,
          autoRefresh: true,
        })),
        isValidRefreshInterval: vi.fn((seconds: number) => seconds >= 60 && seconds <= 3600),
        clampRefreshInterval: vi.fn((seconds: number) => Math.max(60, Math.min(3600, Math.round(seconds)))),
        updateDisplaySettings: vi.fn(),
        updateUISettings: vi.fn(),
        resetToDefaults: vi.fn()
      });

      const wrapper = mountComponent();

      const memberItems = wrapper.findAll('.discord-member-list__item');
      const usernames = memberItems.map(item => item.text());

      // Should be sorted alphabetically by username
      expect(usernames[0]).toContain('@user1');
      expect(usernames[1]).toContain('@user2');
      expect(usernames[2]).toContain('@user3');
      expect(usernames[3]).toContain('@user4');
      expect(usernames[4]).toContain('@user5');
    });
  });

  describe('display settings', () => {
    it('shows "Show More" button when there are more members than maxMembersToShow', async () => {
      mockUseDiscordConfig.mockReturnValueOnce({
        defaultRefreshSeconds: computed(() => 300),
        minRefreshSeconds: computed(() => 60),
        maxRefreshSeconds: computed(() => 3600),
        displaySettings: computed(() => ({
          showBots: false,
          showOfflineMembers: true,
          sortBy: 'status',
          groupByStatus: true,
          maxMembersToShow: 3,
          showAvatars: true,
          compactMode: false,
        })),
        uiSettings: computed(() => ({
          compactMode: false,
          showCacheInfo: true,
          autoRefresh: true,
        })),
        isValidRefreshInterval: vi.fn((seconds: number) => seconds >= 60 && seconds <= 3600),
        clampRefreshInterval: vi.fn((seconds: number) => Math.max(60, Math.min(3600, Math.round(seconds)))),
        updateDisplaySettings: vi.fn(),
        updateUISettings: vi.fn(),
        resetToDefaults: vi.fn()
      });

      const wrapper = mountComponent();

      const showMoreButton = wrapper.find('button');
      expect(showMoreButton.exists()).toBe(true);
      expect(showMoreButton.text()).toContain('Show 2 More');
    });

    it('toggles between showing all members and limited members', async () => {
      mockUseDiscordConfig.mockReturnValueOnce({
        defaultRefreshSeconds: computed(() => 300),
        minRefreshSeconds: computed(() => 60),
        maxRefreshSeconds: computed(() => 3600),
        displaySettings: computed(() => ({
          showBots: false,
          showOfflineMembers: true,
          sortBy: 'status',
          groupByStatus: true,
          maxMembersToShow: 3,
          showAvatars: true,
          compactMode: false,
        })),
        uiSettings: computed(() => ({
          compactMode: false,
          showCacheInfo: true,
          autoRefresh: true,
        })),
        isValidRefreshInterval: vi.fn((seconds: number) => seconds >= 60 && seconds <= 3600),
        clampRefreshInterval: vi.fn((seconds: number) => Math.max(60, Math.min(3600, Math.round(seconds)))),
        updateDisplaySettings: vi.fn(),
        updateUISettings: vi.fn(),
        resetToDefaults: vi.fn()
      });

      const wrapper = mountComponent();

      // Initially shows limited members
      let memberItems = wrapper.findAll('.discord-member-list__item');
      expect(memberItems).toHaveLength(3);

      // Click "Show More" button
      const showMoreButton = wrapper.find('button');
      await showMoreButton.trigger('click');

      // Should show all members
      memberItems = wrapper.findAll('.discord-member-list__item');
      expect(memberItems).toHaveLength(5);

      // Button should now say "Show Less"
      expect(showMoreButton.text()).toContain('Show Less');

      // Click "Show Less" button
      await showMoreButton.trigger('click');

      // Should show limited members again
      memberItems = wrapper.findAll('.discord-member-list__item');
      expect(memberItems).toHaveLength(3);
    });
  });


  describe('compact mode', () => {
    beforeEach(() => {
      mockIsWidgetCompact.mockReturnValue(false); // Reset to non-compact
    });

    it('hides status chips in compact mode', () => {
      mockIsWidgetCompact.mockReturnValue(true);
      const wrapper = mountComponent();

      // The v-chip-group should be hidden in compact mode
      // Since it's stubbed, we check that the conditional rendering is working
      // by verifying the component structure rather than text content
      const chipGroup = wrapper.find('.status-chip-group');
      expect(chipGroup.exists()).toBe(false);
    });

    it('shows status chips in full mode', () => {
      mockIsWidgetCompact.mockReturnValue(false);
      const wrapper = mountComponent();

      // Status chips should be visible in full mode
      expect(wrapper.text()).toContain('Online: 2');
      expect(wrapper.text()).toContain('Idle: 1');
      expect(wrapper.text()).toContain('DND: 1');
      expect(wrapper.text()).toContain('Offline: 1');
    });

    it('omits usernames in compact mode', () => {
      mockIsWidgetCompact.mockReturnValue(true);
      const wrapper = mountComponent();

      const memberItems = wrapper.findAll('.discord-member-list__item');
      expect(memberItems.length).toBeGreaterThan(0);
      expect(wrapper.findAll('.discord-member-list__username')).toHaveLength(0);
      expect(memberItems[0].text()).toContain('User One');
    });

    it('shows usernames in full mode', () => {
      mockIsWidgetCompact.mockReturnValue(false);
      const wrapper = mountComponent();

      const usernames = wrapper.findAll('.discord-member-list__username');
      expect(usernames.length).toBeGreaterThan(0);
      expect(usernames[0].text()).toContain('@user1');
    });

    it('omits status labels in compact mode', () => {
      mockIsWidgetCompact.mockReturnValue(true);
      const wrapper = mountComponent();

      expect(wrapper.findAll('.discord-member-list__status-label')).toHaveLength(0);
    });

    it('shows status labels in full mode', () => {
      mockIsWidgetCompact.mockReturnValue(false);
      const wrapper = mountComponent();

      const statusLabels = wrapper.findAll('.discord-member-list__status-label');
      expect(statusLabels.length).toBeGreaterThan(0);
      expect(statusLabels[0].text()).toContain('online');
    });

    it('hides "Show More" button in compact mode', async () => {
      mockIsWidgetCompact.mockReturnValue(true);
      
      mockUseDiscordConfig.mockReturnValueOnce({
        defaultRefreshSeconds: computed(() => 300),
        minRefreshSeconds: computed(() => 60),
        maxRefreshSeconds: computed(() => 3600),
        displaySettings: computed(() => ({
          showBots: false,
          showOfflineMembers: true,
          sortBy: 'status',
          groupByStatus: true,
          maxMembersToShow: 3,
          showAvatars: true,
          compactMode: false,
        })),
        uiSettings: computed(() => ({
          compactMode: false,
          showCacheInfo: true,
          autoRefresh: true,
        })),
        isValidRefreshInterval: vi.fn((seconds: number) => seconds >= 60 && seconds <= 3600),
        clampRefreshInterval: vi.fn((seconds: number) => Math.max(60, Math.min(3600, Math.round(seconds)))),
        updateDisplaySettings: vi.fn(),
        updateUISettings: vi.fn(),
        resetToDefaults: vi.fn()
      });

      const wrapper = mountComponent();

      // Should not show "Show More" button in compact mode
      const showMoreButton = wrapper.find('button');
      expect(showMoreButton.exists()).toBe(false);
    });

    it('passes compact flag to PollingWidget when compact mode is enabled', () => {
      mockIsWidgetCompact.mockReturnValue(true);
      const wrapper = mountComponent();

      const pollingWidget = wrapper.findComponent({ name: 'PollingWidget' });
      expect(pollingWidget.props('compact')).toBe(true);
    });

    it('passes compact flag to PollingWidget when compact mode is disabled', () => {
      mockIsWidgetCompact.mockReturnValue(false);
      const wrapper = mountComponent();

      const pollingWidget = wrapper.findComponent({ name: 'PollingWidget' });
      expect(pollingWidget.props('compact')).toBe(false);
    });

    it('still shows member list in compact mode', () => {
      mockIsWidgetCompact.mockReturnValue(true);
      const wrapper = mountComponent();

      const memberItems = wrapper.findAll('.discord-member-list__item');
      expect(memberItems).toHaveLength(5); // Should still show members

      const firstMember = memberItems[0];
      expect(firstMember.text()).toContain('User One');
      // The bot indicator should not be visible since bots are filtered out by default
      expect(firstMember.text()).not.toContain('BOT');
    });
  });

  describe('cache information', () => {
    it('displays cache information when showCacheInfo is enabled', () => {
      const wrapper = mountComponent();

      const cacheInfo = wrapper
        .findAll('.text-caption')
        .find(node => node.text().includes('Live provider data'));
      expect(cacheInfo).toBeDefined();
    });

    it('hides cache information when showCacheInfo is disabled', async () => {
      mockUseDiscordConfig.mockReturnValueOnce({
        defaultRefreshSeconds: computed(() => 300),
        minRefreshSeconds: computed(() => 60),
        maxRefreshSeconds: computed(() => 3600),
        displaySettings: computed(() => ({
          showBots: false,
          showOfflineMembers: true,
          sortBy: 'status',
          groupByStatus: true,
          maxMembersToShow: 50,
          showAvatars: true,
          compactMode: false,
        })),
        uiSettings: computed(() => ({
          compactMode: false,
          showCacheInfo: false,
          autoRefresh: true,
        })),
        isValidRefreshInterval: vi.fn((seconds: number) => seconds >= 60 && seconds <= 3600),
        clampRefreshInterval: vi.fn((seconds: number) => Math.max(60, Math.min(3600, Math.round(seconds)))),
        updateDisplaySettings: vi.fn(),
        updateUISettings: vi.fn(),
        resetToDefaults: vi.fn()
      });

      const wrapper = mountComponent();

      const hasCacheInfo = wrapper
        .findAll('.text-caption')
        .some(node => node.text().includes('Live provider data'));
      expect(hasCacheInfo).toBe(false);
    });
  });
});
