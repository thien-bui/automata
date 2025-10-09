import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref } from 'vue';
import { useDiscord, type DiscordFetchReason } from '../useDiscord';
import type { DiscordResponse } from '@automata/types';

// Mock fetch globally
global.fetch = vi.fn();

describe('useDiscord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('import.meta', {
      env: {
        VITE_DEFAULT_DISCORD_FRESHNESS: '300'
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mockDiscordResponse: DiscordResponse = {
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
      }
    ],
    lastUpdatedIso: '2024-01-01T12:00:00Z',
    cache: {
      hit: false,
      ageSeconds: 0,
      staleWhileRevalidate: false
    }
  };

  const mockCachedResponse: DiscordResponse = {
    ...mockDiscordResponse,
    cache: {
      hit: true,
      ageSeconds: 150,
      staleWhileRevalidate: false
    }
  };

  describe('initial state', () => {
    it('should initialize with default values', () => {
      const { data, error, isLoading, isRefreshing, freshnessSeconds } = useDiscord();

      expect(data.value).toBeNull();
      expect(error.value).toBeNull();
      expect(isLoading.value).toBe(false);
      expect(isRefreshing.value).toBe(false);
      expect(freshnessSeconds.value).toBe(300);
    });

    it('should accept custom freshness seconds', () => {
      const { freshnessSeconds } = useDiscord({ freshnessSeconds: 600 });

      expect(freshnessSeconds.value).toBe(600);
    });

    it('should handle invalid freshness seconds', () => {
      const { setFreshnessSeconds, freshnessSeconds } = useDiscord();
      
      setFreshnessSeconds(-100);

      expect(freshnessSeconds.value).toBe(300);
    });
  });

  describe('refresh functionality', () => {
    it('should successfully fetch data', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDiscordResponse
      } as Response);

      const { refresh, data, isLoading } = useDiscord();

      await refresh();

      expect(isLoading.value).toBe(false);
      expect(data.value).toEqual(mockDiscordResponse);
      expect(fetch).toHaveBeenCalledWith('/api/discord-status?freshnessSeconds=300', {
        headers: { Accept: 'application/json' },
        signal: expect.any(AbortSignal)
      });
    });

    it('should handle fetch errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const { refresh, error, isLoading } = useDiscord();

      await refresh();

      expect(isLoading.value).toBe(false);
      expect(error.value).toBe('Network error');
    });

    it('should handle HTTP errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Server error' })
      } as Response);

      const { refresh, error } = useDiscord();

      await refresh();

      expect(error.value).toBe('Server error');
    });

    it('should handle background refresh', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDiscordResponse
      } as Response);

      const { refresh, data, isRefreshing } = useDiscord();

      // Set initial data to simulate background refresh
      data.value = mockDiscordResponse;

      await refresh({ background: true });

      expect(isRefreshing.value).toBe(false);
      expect(data.value).toEqual(mockDiscordResponse);
    });

    it('should handle force refresh', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDiscordResponse
      } as Response);

      const { refresh } = useDiscord();

      await refresh({ forceRefresh: true });

      expect(fetch).toHaveBeenCalledWith('/api/discord-status?freshnessSeconds=300&forceRefresh=true', {
        headers: { Accept: 'application/json' },
        signal: expect.any(AbortSignal)
      });
    });

    it('should abort previous requests', async () => {
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
      
      // Create a promise that never resolves to simulate a pending request
      let resolveFirstRequest: (response: Response) => void;
      const firstRequestPromise = new Promise<Response>((resolve) => {
        resolveFirstRequest = resolve;
      });
      
      vi.mocked(fetch).mockImplementationOnce(() => firstRequestPromise);

      const { refresh } = useDiscord();

      // Start first refresh
      const firstRefresh = refresh();
      
      // Immediately start second refresh which should abort the first
      const secondRefresh = refresh();

      // Verify abort was called
      expect(abortSpy).toHaveBeenCalled();
      
      // Resolve the first request to clean up
      resolveFirstRequest!(new Response(null, { status: 204 }));
      
      // Wait for both to settle
      await Promise.allSettled([firstRefresh, secondRefresh]);
    });
  });

  describe('computed properties', () => {
    it('should compute isStale correctly', () => {
      const { data, isStale } = useDiscord();
      
      data.value = { ...mockDiscordResponse, cache: { ...mockDiscordResponse.cache, staleWhileRevalidate: true } };
      expect(isStale.value).toBe(true);

      data.value = { ...mockDiscordResponse, cache: { ...mockDiscordResponse.cache, staleWhileRevalidate: false } };
      expect(isStale.value).toBe(false);
    });

    it('should compute lastUpdatedIso correctly', () => {
      const { data, lastUpdatedIso } = useDiscord();
      
      data.value = mockDiscordResponse;
      expect(lastUpdatedIso.value).toBe('2024-01-01T12:00:00Z');

      data.value = null;
      expect(lastUpdatedIso.value).toBeNull();
    });

    it('should compute cacheAgeSeconds correctly', () => {
      const { data, cacheAgeSeconds } = useDiscord();
      
      data.value = mockCachedResponse;
      expect(cacheAgeSeconds.value).toBe(150);

      data.value = null;
      expect(cacheAgeSeconds.value).toBeNull();
    });

    it('should compute cacheHit correctly', () => {
      const { data, cacheHit } = useDiscord();
      
      data.value = mockCachedResponse;
      expect(cacheHit.value).toBe(true);

      data.value = mockDiscordResponse;
      expect(cacheHit.value).toBe(false);
    });
  });

  describe('setFreshnessSeconds', () => {
    it('should update freshness seconds with valid value', () => {
      const { setFreshnessSeconds, freshnessSeconds } = useDiscord();

      setFreshnessSeconds(600);

      expect(freshnessSeconds.value).toBe(600);
    });

    it('should reset to default with invalid value', () => {
      const { setFreshnessSeconds, freshnessSeconds } = useDiscord();

      setFreshnessSeconds(-100);

      expect(freshnessSeconds.value).toBe(300);
    });

    it('should round non-integer values', () => {
      const { setFreshnessSeconds, freshnessSeconds } = useDiscord();

      setFreshnessSeconds(123.7);

      expect(freshnessSeconds.value).toBe(124);
    });
  });

  describe('error normalization', () => {
    it('should normalize Error objects', () => {
      const { refresh } = useDiscord();
      
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Custom error'));

      return expect(refresh()).resolves.toBeUndefined();
    });

    it('should normalize string errors', () => {
      const { refresh } = useDiscord();
      
      vi.mocked(fetch).mockRejectedValueOnce('String error');

      return expect(refresh()).resolves.toBeUndefined();
    });

    it('should handle unknown error types', () => {
      const { refresh } = useDiscord();
      
      vi.mocked(fetch).mockRejectedValueOnce({ custom: 'object' });

      return expect(refresh()).resolves.toBeUndefined();
    });
  });
});
