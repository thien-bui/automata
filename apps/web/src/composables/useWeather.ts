import { computed, ref, type ComputedRef, type Ref } from 'vue';
import type { WeatherResponse } from '@automata/types';

export type WeatherFetchReason = 'initial' | 'interval' | 'manual' | 'hard-manual';

const defaultFreshnessSeconds = Number(import.meta.env.VITE_DEFAULT_FRESHNESS ?? '300');

interface UseWeatherOptions {
  location: string;
  freshnessSeconds?: number;
}

interface RefreshOptions {
  background?: boolean;
  reason?: WeatherFetchReason;
  forceRefresh?: boolean;
}

interface UseWeatherResult {
  data: Ref<WeatherResponse | null>;
  error: Ref<string | null>;
  isLoading: Ref<boolean>;
  isRefreshing: Ref<boolean>;
  isStale: ComputedRef<boolean>;
  lastUpdatedIso: ComputedRef<string | null>;
  cacheAgeSeconds: ComputedRef<number | null>;
  cacheHit: ComputedRef<boolean>;
  freshnessSeconds: Ref<number>;
  location: Ref<string>;
  refresh: (options?: RefreshOptions) => Promise<void>;
  setLocation: (value: string) => void;
  setFreshnessSeconds: (value: number) => void;
}

function normaliseError(message: unknown): string {
  if (message instanceof Error) {
    return message.message;
  }

  if (typeof message === 'string') {
    return message;
  }

  return 'Unable to refresh weather information.';
}

export function useWeather(options: UseWeatherOptions): UseWeatherResult {
  const data = ref<WeatherResponse | null>(null);
  const error = ref<string | null>(null);
  const isLoading = ref(false);
  const isRefreshing = ref(false);

  const location = ref(options.location);
  const freshnessSeconds = ref(options.freshnessSeconds ?? defaultFreshnessSeconds);

  let inFlightController: AbortController | null = null;

  const refresh = async (refreshOptions: RefreshOptions = {}): Promise<void> => {
    if (!location.value) {
      error.value = 'Location is not configured.';
      return;
    }

    if (inFlightController) {
      inFlightController.abort();
    }

    const controller = new AbortController();
    inFlightController = controller;

    const background = refreshOptions.background ?? Boolean(data.value);

    if (background) {
      isRefreshing.value = true;
    } else {
      isLoading.value = true;
    }

    error.value = null;

    try {
      const search = new URLSearchParams({
        location: location.value,
      });

      if (freshnessSeconds.value > 0) {
        search.set('freshnessSeconds', String(freshnessSeconds.value));
      }

      if (refreshOptions.forceRefresh) {
        search.set('forceRefresh', 'true');
      }

      const response = await fetch(`/api/weather?${search.toString()}`, {
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        let body: unknown = null;
        try {
          body = await response.json();
        } catch (parseError) {
          body = null;
        }

        if (body && typeof body === 'object' && 'message' in body) {
          const { message } = body as { message?: unknown };
          throw new Error(normaliseError(message));
        }

        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as WeatherResponse;
      data.value = payload;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }

      error.value = normaliseError(err);
    } finally {
      if (inFlightController === controller) {
        inFlightController = null;
      }

      if (background) {
        isRefreshing.value = false;
      } else {
        isLoading.value = false;
      }
    }
  };

  const isStale = computed(() => data.value?.cache.staleWhileRevalidate ?? false);
  const lastUpdatedIso = computed(() => data.value?.lastUpdatedIso ?? null);
  const cacheAgeSeconds = computed(() => data.value?.cache.ageSeconds ?? null);
  const cacheHit = computed(() => data.value?.cache.hit ?? false);

  const setLocation = (value: string): void => {
    if (location.value !== value) {
      location.value = value;
    }
  };

  const setFreshnessSeconds = (value: number): void => {
    if (!Number.isFinite(value) || value <= 0) {
      freshnessSeconds.value = defaultFreshnessSeconds;
      return;
    }

    freshnessSeconds.value = Math.round(value);
  };

  const composable: UseWeatherResult = {
    data,
    error,
    isLoading,
    isRefreshing,
    isStale,
    lastUpdatedIso,
    cacheAgeSeconds,
    cacheHit,
    freshnessSeconds,
    location,
    refresh,
    setLocation,
    setFreshnessSeconds,
  };

  return composable;
}
