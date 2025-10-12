import { expect, test, type Page } from '@playwright/test';

const waitForToastsToClear = async (page: Page): Promise<void> => {
  const toastLocator = page.locator('.v-snackbar__content');
  if ((await toastLocator.count()) === 0) {
    return;
  }

  await toastLocator.first().waitFor({ state: 'hidden', timeout: 7_000 }).catch(() => {
    /* ignore timeout so the test can proceed */
  });
};

test.describe('Route Widget', () => {
  test('renders Compact mode by default', async ({ page }) => {
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
    await waitForToastsToClear(page);

    const toggle = page.getByLabel('Select monitoring mode');
    await expect(toggle.getByRole('button', { name: 'Compact' })).toBeVisible();
    await expect(toggle.getByRole('button', { name: 'Nav' })).toBeVisible();
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
    await waitForToastsToClear(page);

    const toggle = page.getByLabel('Select monitoring mode');
    await toggle.getByRole('button', { name: 'Nav' }).click();

    await expect(page.getByTestId('map-preview')).toBeVisible();
  });

  test('switching back to Compact mode hides the map placeholder', async ({ page }) => {
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
    await waitForToastsToClear(page);

    const toggle = page.getByLabel('Select monitoring mode');
    await toggle.getByRole('button', { name: 'Nav' }).click();

    const mapCard = page.getByTestId('map-preview');
    await expect(mapCard).toBeVisible();

    await waitForToastsToClear(page);
    await toggle.getByRole('button', { name: 'Compact' }).click();

    await expect(page.getByTestId('map-preview')).toHaveCount(0);
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
    await waitForToastsToClear(page);

    const toggle = page.getByLabel('Select monitoring mode');
    await toggle.getByRole('button', { name: 'Nav' }).click();

    const alertBanner = page.getByRole('alert');
    await expect(alertBanner.getByText(/Travel time 22.0 min exceeds threshold of 10 min./i)).toBeVisible();
  });
});
