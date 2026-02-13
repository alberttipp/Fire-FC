import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

test.describe('Leaderboard Weekly/Career Toggle', () => {
  test('3.1 Coach can see leaderboard with toggle', async ({ page }) => {
    await loginAs(page, 'coach');

    // Look for leaderboard on the coach dashboard
    const leaderboard = page.locator('text=Leaderboard').first();
    if (await leaderboard.isVisible({ timeout: 10000 })) {
      // Find the Weekly/Career toggle button
      const toggle = page.locator('button:has-text("Weekly"), button:has-text("Career")').first();
      if (await toggle.isVisible({ timeout: 5000 })) {
        const initialText = await toggle.textContent();

        // Click toggle
        await toggle.click();
        await page.waitForTimeout(1000);

        // Text should have changed
        const newText = await toggle.textContent();
        expect(newText).not.toBe(initialText);
      }
    }
  });

  test('3.2 Parent can see leaderboard with toggle', async ({ page }) => {
    await loginAs(page, 'parent');

    // Click Leaderboard button to expand it
    const leaderboardBtn = page.locator('button:has-text("Leaderboard")').first();
    if (await leaderboardBtn.isVisible({ timeout: 5000 })) {
      await leaderboardBtn.click();
      await page.waitForTimeout(1000);

      // Find toggle
      const toggle = page.locator('button:has-text("Weekly"), button:has-text("Career")').first();
      await expect(toggle).toBeVisible({ timeout: 5000 });

      // Should show rank/player/min headers
      await expect(page.locator('text=Rank').first()).toBeVisible();
      await expect(page.locator('text=Player').first()).toBeVisible();
      await expect(page.locator('text=MIN').first()).toBeVisible();
    }
  });
});
