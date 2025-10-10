import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h, ref, computed } from 'vue';
import DiscordWidget from '../DiscordWidget.vue';
import { provideToasts } from '../../composables/useToasts';
import type { DiscordResponse, DiscordMemberStatus } from '@automata/types';

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
vi.mock('../PollingWidget.vue', () => ({
  default: {
    name: 'PollingWidget',
    template: `
      <div>
        <slot name="main-content"></slot>
        <slot name="settings-content"></slot>
      </div>
    `,
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
      'cacheDescription'
    ],
    emits: ['manual-refresh', 'hard-refresh', 'save-settings']
  }
}));

describe('DiscordWidget', () => {
  let mockUseDiscordConfig: Mock;
  
  beforeEach(async () => {
    vi.useFakeTimers();

    const module = await import('../../composables/useDiscordConfig');
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

      const memberItems = wrapper.findAll('.member-item');
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

      const memberItems = wrapper.findAll('.member-item');
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

      const memberItems = wrapper.findAll('.member-item');
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

      const memberItems = wrapper.findAll('.member-item');
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
      let memberItems = wrapper.findAll('.member-item');
      expect(memberItems).toHaveLength(3);

      // Click "Show More" button
      const showMoreButton = wrapper.find('button');
      await showMoreButton.trigger('click');

      // Should show all members
      memberItems = wrapper.findAll('.member-item');
      expect(memberItems).toHaveLength(5);

      // Button should now say "Show Less"
      expect(showMoreButton.text()).toContain('Show Less');

      // Click "Show Less" button
      await showMoreButton.trigger('click');

      // Should show limited members again
      memberItems = wrapper.findAll('.member-item');
      expect(memberItems).toHaveLength(3);
    });
  });

  describe('status helper functions', () => {
    it('returns correct status icons', () => {
      const wrapper = mountComponent();
      const vm = wrapper.findComponent(DiscordWidget).vm as any;

      expect(vm.getStatusIcon('online')).toBe('mdi-circle');
      expect(vm.getStatusIcon('idle')).toBe('mdi-minus-circle');
      expect(vm.getStatusIcon('dnd')).toBe('mdi-do-not-disturb');
      expect(vm.getStatusIcon('offline')).toBe('mdi-circle-outline');
    });

    it('returns correct status colors', () => {
      const wrapper = mountComponent();
      const vm = wrapper.findComponent(DiscordWidget).vm as any;

      expect(vm.getStatusColor('online')).toBe('success');
      expect(vm.getStatusColor('idle')).toBe('warning');
      expect(vm.getStatusColor('dnd')).toBe('error');
      expect(vm.getStatusColor('offline')).toBe('grey');
    });

    it('calculates status counts correctly', () => {
      const wrapper = mountComponent();
      const vm = wrapper.findComponent(DiscordWidget).vm as any;

      expect(vm.getStatusCount('online')).toBe(2);
      expect(vm.getStatusCount('idle')).toBe(1);
      expect(vm.getStatusCount('dnd')).toBe(1);
      expect(vm.getStatusCount('offline')).toBe(1);
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

    it('hides usernames in compact mode', () => {
      mockIsWidgetCompact.mockReturnValue(true);
      const wrapper = mountComponent();

      // Check that the username element has the d-none class in compact mode
      const usernameElements = wrapper.findAll('.member-username');
      expect(usernameElements.length).toBeGreaterThan(0);
      expect(usernameElements[0].classes()).toContain('d-none');
    });

    it('shows usernames in full mode', () => {
      mockIsWidgetCompact.mockReturnValue(false);
      const wrapper = mountComponent();

      const memberItems = wrapper.findAll('.member-item');
      const firstMember = memberItems[0];
      
      // Should show both display name and username
      expect(firstMember.text()).toContain('User One');
      expect(firstMember.text()).toContain('@user1');
    });

    it('hides status text in compact mode', () => {
      mockIsWidgetCompact.mockReturnValue(true);
      const wrapper = mountComponent();

      // Check that the status text span has the d-none class in compact mode
      const statusTextElements = wrapper.findAll('.member-status span');
      expect(statusTextElements.length).toBeGreaterThan(0);
      expect(statusTextElements[0].classes()).toContain('d-none');
    });

    it('shows status text in full mode', () => {
      mockIsWidgetCompact.mockReturnValue(false);
      const wrapper = mountComponent();

      const memberItems = wrapper.findAll('.member-item');
      const firstMember = memberItems[0];
      
      // Should show status text in full mode
      expect(firstMember.text()).toContain('online');
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

    it('applies compact CSS classes when in compact mode', () => {
      mockIsWidgetCompact.mockReturnValue(true);
      const wrapper = mountComponent();

      // Should have compact CSS classes
      expect(wrapper.find('.discord-widget--compact').exists()).toBe(true);
      // Widget summary is completely hidden in compact mode, so no compact class needed
      expect(wrapper.find('.widget-summary--compact').exists()).toBe(false);
      expect(wrapper.find('.member-list-card--compact').exists()).toBe(true);
      expect(wrapper.find('.member-list-container--compact').exists()).toBe(true);
      expect(wrapper.find('.member-item--compact').exists()).toBe(true);
    });

    it('does not apply compact CSS classes in full mode', () => {
      mockIsWidgetCompact.mockReturnValue(false);
      const wrapper = mountComponent();

      // Should not have compact CSS classes
      expect(wrapper.find('.discord-widget--compact').exists()).toBe(false);
      expect(wrapper.find('.widget-summary--compact').exists()).toBe(false);
      expect(wrapper.find('.member-list-card--compact').exists()).toBe(false);
      expect(wrapper.find('.member-list-container--compact').exists()).toBe(false);
      expect(wrapper.find('.member-item--compact').exists()).toBe(false);
    });

    it('still shows member list in compact mode', () => {
      mockIsWidgetCompact.mockReturnValue(true);
      const wrapper = mountComponent();

      const memberItems = wrapper.findAll('.member-item');
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
