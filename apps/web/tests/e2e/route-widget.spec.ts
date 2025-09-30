import { test, expect } from '@playwright/test';

test.describe('Route Widget', () => {
  test('renders simple mode by default', async ({ page }) => {
    await page.route('**/api/route-time?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          durationMinutes: 24,
          distanceKm: 9.2,
          provider: 'google-directions',
          mode: 'driving',
          lastUpdatedIso: new Date().toISOString(),
          cache: {
            hit: true,
            ageSeconds: 30,
            staleWhileRevalidate: false,
          },
        }),
      });
    });

    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Simple' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nav' })).toBeVisible();
    await expect(page.getByText(/Estimated duration/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh now' })).toBeVisible();
  });

  test('switching to Nav mode shows the map placeholder', async ({ page }) => {
    await page.route('**/api/route-time?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          durationMinutes: 18,
          distanceKm: 7,
          provider: 'google-directions',
          mode: 'driving',
          lastUpdatedIso: new Date().toISOString(),
          cache: {
            hit: false,
            ageSeconds: 0,
            staleWhileRevalidate: false,
          },
        }),
      });
    });

    await page.goto('/');

    await page.getByRole('button', { name: 'Nav' }).click();

    await expect(
      page.getByText('Set VITE_GOOGLE_MAPS_BROWSER_KEY to enable the map preview.', {
        exact: false,
      }),
    ).toBeVisible();
  });

  test('shows an alert banner when travel time exceeds threshold', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('automata.alertThresholdMinutes', '10');
    });

    await page.route('**/api/route-time?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          durationMinutes: 22,
          distanceKm: 9,
          provider: 'google-directions',
          mode: 'driving',
          lastUpdatedIso: new Date().toISOString(),
          cache: {
            hit: false,
            ageSeconds: 0,
            staleWhileRevalidate: false,
          },
        }),
      });
    });

    await page.goto('/');

    await expect(
      page.getByText(/Travel time 22.0 min exceeds threshold of 10 min./i),
    ).toBeVisible();
  });
});
