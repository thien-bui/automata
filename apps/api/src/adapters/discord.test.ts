import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { fetchDiscordGuildStatus, cleanupDiscordClient } from './discord';

// Mock discord.js
const mockLogin = vi.fn().mockResolvedValue(undefined);
const mockDestroy = vi.fn().mockResolvedValue(undefined);
const mockIsReady = vi.fn();
const mockOnce = vi.fn();
const mockGuildsFetch = vi.fn();

const mockClient = {
  login: mockLogin,
  destroy: mockDestroy,
  isReady: mockIsReady,
  once: mockOnce,
  guilds: {
    fetch: mockGuildsFetch,
  },
};

vi.mock('discord.js', () => {
  return {
    Client: vi.fn(() => mockClient),
    GatewayIntentBits: {
      Guilds: 1,
      GuildMembers: 2,
      GuildPresences: 3,
    },
  };
});

describe('discord adapter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = {
      ...originalEnv,
      DISCORD_BOT_TOKEN: 'test-token',
      DISCORD_SERVER_ID: 'test-guild-id',
    };
    // Ensure mock implementations are set after clearing
    mockLogin.mockResolvedValue(undefined);
    mockDestroy.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    // Reset the module-level discordClient variable
    vi.resetModules();
  });

  describe('fetchDiscordGuildStatus', () => {
    it('should throw error when DISCORD_BOT_TOKEN is missing', async () => {
      delete process.env.DISCORD_BOT_TOKEN;
      await expect(fetchDiscordGuildStatus()).rejects.toThrow('DISCORD_BOT_TOKEN environment variable is required');
    });

    it('should throw error when DISCORD_SERVER_ID is missing', async () => {
      delete process.env.DISCORD_SERVER_ID;
      // Ensure client is not created yet by resetting modules
      vi.resetModules();
      const { fetchDiscordGuildStatus } = await import('./discord');
      await expect(fetchDiscordGuildStatus()).rejects.toThrow('DISCORD_SERVER_ID environment variable is required');
    });

    it('should fetch guild status successfully when client is ready', async () => {
      // Import the mocked Client
      const { Client } = await import('discord.js');
      const mockClient = new Client({ intents: [] });
      const mockGuild = {
        id: 'test-guild-id',
        name: 'Test Guild',
        members: {
          cache: new Map([
            ['member-1', {
              id: 'member-1',
              user: { username: 'user1', avatarURL: () => null, bot: false },
              displayName: 'User One',
              presence: { status: 'online' },
            }],
            ['member-2', {
              id: 'member-2',
              user: { username: 'user2', avatarURL: () => null, bot: true },
              displayName: 'User Two',
              presence: { status: 'idle' },
            }],
            ['member-3', {
              id: 'member-3',
              user: { username: 'user3', avatarURL: () => null, bot: false },
              displayName: 'User Three',
              presence: { status: 'offline' },
            }],
            ['member-4', {
              id: 'member-4',
              user: { username: 'user4', avatarURL: () => null, bot: false },
              displayName: 'User Four',
              presence: { status: 'invisible' },
            }],
          ]),
          fetch: vi.fn(),
        },
      };

      (mockClient.isReady as any).mockReturnValue(true);
      (mockClient.guilds.fetch as any).mockResolvedValue(mockGuild);

      const result = await fetchDiscordGuildStatus();

      expect(result).toEqual({
        guildId: 'test-guild-id',
        guildName: 'Test Guild',
        totalMembers: 4,
        onlineMembers: 2, // online + idle (invisible maps to offline)
        members: [
          {
            id: 'member-1',
            username: 'user1',
            displayName: 'User One',
            status: 'online',
            avatarUrl: null,
            bot: false,
          },
          {
            id: 'member-2',
            username: 'user2',
            displayName: 'User Two',
            status: 'idle',
            avatarUrl: null,
            bot: true,
          },
          {
            id: 'member-3',
            username: 'user3',
            displayName: 'User Three',
            status: 'offline',
            avatarUrl: null,
            bot: false,
          },
          {
            id: 'member-4',
            username: 'user4',
            displayName: 'User Four',
            status: 'offline', // invisible mapped to offline
            avatarUrl: null,
            bot: false,
          },
        ],
        lastUpdatedIso: expect.any(String),
      });
      expect(mockClient.guilds.fetch).toHaveBeenCalledWith('test-guild-id');
      expect(mockGuild.members.fetch).toHaveBeenCalledWith({ withPresences: true });
    });

    it('should wait for client to be ready if not ready', async () => {
      const { Client } = await import('discord.js');
      const mockClient = new Client({ intents: [] });
      const mockGuild = {
        id: 'test-guild-id',
        name: 'Test Guild',
        members: {
          cache: new Map(),
          fetch: vi.fn(),
        },
      };

      (mockClient.isReady as any).mockReturnValue(false);
      let readyCallback: () => void = () => {};
      let errorCallback: (error: Error) => void = () => {};
      (mockClient.once as any).mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          readyCallback = callback;
        }
        if (event === 'error') {
          errorCallback = callback;
        }
        return mockClient;
      });
      (mockClient.guilds.fetch as any).mockResolvedValue(mockGuild);

      // Start the call
      const promise = fetchDiscordGuildStatus();
      // Simulate client becoming ready
      readyCallback();
      
      await expect(promise).resolves.toBeDefined();
      expect(mockClient.once).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockClient.once).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle client connection timeout', async () => {
      const { Client } = await import('discord.js');
      const mockClient = new Client({ intents: [] });

      (mockClient.isReady as any).mockReturnValue(false);
      (mockClient.once as any).mockImplementation((event: string, callback: any) => {
        // Don't call ready or error, let timeout happen
        return mockClient;
      });

      // Mock setTimeout to trigger timeout immediately
      vi.useFakeTimers();
      const promise = fetchDiscordGuildStatus();
      vi.advanceTimersByTime(10000); // Advance past the 10s timeout
      
      await expect(promise).rejects.toThrow('Discord client connection timeout');
      vi.useRealTimers();
    });

    it('should handle client error', async () => {
      const { Client } = await import('discord.js');
      const mockClient = new Client({ intents: [] });

      (mockClient.isReady as any).mockReturnValue(false);
      let errorCallback: (error: Error) => void = () => {};
      (mockClient.once as any).mockImplementation((event: string, callback: any) => {
        if (event === 'error') {
          errorCallback = callback;
        }
        return mockClient;
      });

      const promise = fetchDiscordGuildStatus();
      errorCallback(new Error('Connection failed'));
      
      await expect(promise).rejects.toThrow('Connection failed');
    });
  });

  describe('cleanupDiscordClient', () => {
    it('should destroy client if it exists', async () => {
      // First create a client by calling fetchDiscordGuildStatus
      const { Client } = await import('discord.js');
      const mockClient = new Client({ intents: [] });
      const mockGuild = {
        id: 'test-guild-id',
        name: 'Test Guild',
        members: {
          cache: new Map(),
          fetch: vi.fn(),
        },
      };

      (mockClient.isReady as any).mockReturnValue(true);
      (mockClient.guilds.fetch as any).mockResolvedValue(mockGuild);

      await fetchDiscordGuildStatus();
      await cleanupDiscordClient();

      expect(mockClient.destroy).toHaveBeenCalled();
    });

    it('should do nothing if client does not exist', async () => {
      const { Client } = await import('discord.js');
      const mockClient = new Client({ intents: [] });
      (mockClient.destroy as any).mockResolvedValue(undefined);

      // Ensure client is null by resetting modules
      vi.resetModules();
      await cleanupDiscordClient();
      expect(mockClient.destroy).not.toHaveBeenCalled();
    });
  });
});
