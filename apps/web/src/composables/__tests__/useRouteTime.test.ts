import { computed } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import type { RouteTimeResponse } from '@automata/types';
import { useRouteTime } from '../useRouteTime';

describe('useRouteTime', () => {
  const buildResponse = (payload: RouteTimeResponse, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  const basePayload: RouteTimeResponse = {
    durationMinutes: 42,
    distanceKm: 12,
    provider: 'google-directions',
    mode: 'driving',
    lastUpdatedIso: new Date('2024-01-02T03:04:05Z').toISOString(),
    cache: {
      hit: false,
      ageSeconds: 0,
      staleWhileRevalidate: false,
    },
  };

  it('flags stale cache responses for downstream consumers', async () => {
    const payload: RouteTimeResponse = {
      ...basePayload,
      cache: {
        hit: true,
        ageSeconds: 180,
        staleWhileRevalidate: true,
      },
    };

    const fetchMock = vi.fn().mockResolvedValue(buildResponse(payload));
    vi.stubGlobal('fetch', fetchMock);

    const composable = useRouteTime({
      from: 'Origin A',
      to: 'Destination B',
    });

    await composable.refresh();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/route-time'),
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: 'application/json' }),
      }),
    );

    expect(composable.data.value).toEqual(payload);
    expect(composable.isStale.value).toBe(true);
  });

  it('surface durations that downstream alert logic can evaluate', async () => {
    const payload: RouteTimeResponse = {
      ...basePayload,
      durationMinutes: 58,
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(buildResponse(payload)));

    const composable = useRouteTime({
      from: 'Origin A',
      to: 'Destination B',
    });

    await composable.refresh();

    const thresholdMinutes = 45;
    const shouldAlert = computed(() => {
      const duration = composable.data.value?.durationMinutes ?? 0;
      return duration > thresholdMinutes;
    });

    expect(composable.data.value?.durationMinutes).toBe(58);
    expect(shouldAlert.value).toBe(true);
  });
});
