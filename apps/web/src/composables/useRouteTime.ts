import { computed, ref, type ComputedRef, type Ref } from 'vue';
import type { RouteMode, RouteTimeResponse } from '@automata/types';

export type RouteFetchReason = 'initial' | 'interval' | 'manual' | 'mode-change' | 'hard-manual';

const defaultFreshnessSeconds = Number(import.meta.env.VITE_DEFAULT_FRESHNESS ?? '300');

interface UseRouteTimeOptions {
  from: string;
  to: string;
  mode?: RouteMode;
  freshnessSeconds?: number;
}

interface RefreshOptions {
  background?: boolean;
  reason?: RouteFetchReason;
  forceRefresh?: boolean;
}

interface UseRouteTimeResult {
  data: Ref<RouteTimeResponse | null>;
  error: Ref<string | null>;
  isLoading: Ref<boolean>;
  isRefreshing: Ref<boolean>;
  isStale: ComputedRef<boolean>;
  lastUpdatedIso: ComputedRef<string | null>;
  cacheAgeSeconds: ComputedRef<number | null>;
  cacheHit: ComputedRef<boolean>;
  freshnessSeconds: Ref<number>;
  mode: Ref<RouteMode>;
  from: Ref<string>;
  to: Ref<string>;
  refresh: (options?: RefreshOptions) => Promise<void>;
  setMode: (value: RouteMode) => void;
  setEndpoints: (params: { from?: string; to?: string }) => void;
  setFreshnessSeconds: (value: number) => void;
}

type EndpointUpdate = {
  from?: string;
  to?: string;
};

function normaliseError(message: unknown): string {
  if (message instanceof Error) {
    return message.message;
  }

  if (typeof message === 'string') {
    return message;
  }

  return 'Unable to refresh route information.';
}

export function useRouteTime(options: UseRouteTimeOptions): UseRouteTimeResult {
  const data = ref<RouteTimeResponse | null>(null);
  const error = ref<string | null>(null);
  const isLoading = ref(false);
  const isRefreshing = ref(false);

  const mode = ref<RouteMode>(options.mode ?? 'driving');
  const from = ref(options.from);
  const to = ref(options.to);
  const freshnessSeconds = ref(options.freshnessSeconds ?? defaultFreshnessSeconds);

  let inFlightController: AbortController | null = null;

  const refresh = async (refreshOptions: RefreshOptions = {}): Promise<void> => {
    if (!from.value || !to.value) {
      error.value = 'Route endpoints are not configured.';
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
        from: from.value,
        to: to.value,
        mode: mode.value,
      });

      if (freshnessSeconds.value > 0) {
        search.set('freshnessSeconds', String(freshnessSeconds.value));
      }

      if (refreshOptions.forceRefresh) {
        search.set('forceRefresh', 'true');
      }

      const response = await fetch(`/api/route-time?${search.toString()}`, {
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

      const payload = (await response.json()) as RouteTimeResponse;
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

  const setMode = (value: RouteMode): void => {
    if (mode.value !== value) {
      mode.value = value;
    }
  };

  const setEndpoints = ({ from: nextFrom, to: nextTo }: EndpointUpdate): void => {
    if (typeof nextFrom === 'string') {
      from.value = nextFrom;
    }

    if (typeof nextTo === 'string') {
      to.value = nextTo;
    }
  };

  const setFreshnessSeconds = (value: number): void => {
    if (!Number.isFinite(value) || value <= 0) {
      freshnessSeconds.value = defaultFreshnessSeconds;
      return;
    }

    freshnessSeconds.value = Math.round(value);
  };

  const composable: UseRouteTimeResult = {
    data,
    error,
    isLoading,
    isRefreshing,
    isStale,
    lastUpdatedIso,
    cacheAgeSeconds,
    cacheHit,
    freshnessSeconds,
    mode,
    from,
    to,
    refresh,
    setMode,
    setEndpoints,
    setFreshnessSeconds,
  };

  return composable;
}
