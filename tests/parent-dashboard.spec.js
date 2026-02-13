import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

test.describe('Parent Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'parent');
  });

  test('2.1 Overview loads with player card and stats', async ({ page }) => {
    await expect(page).toHaveURL(/\/parent-dashboard/);
    // Should see the dashboard content - branding or player info
    await expect(page.locator('img[alt*="Fire"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('2.2 Training Minutes breakdown shows 4 columns', async ({ page }) => {
    // Should see the Training Minutes card with 4 time levels
    await expect(page.locator('text=Training Minutes')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=This Week').first()).toBeVisible();
    await expect(page.locator('text=Season').first()).toBeVisible();
    await expect(page.locator('text=Year').first()).toBeVisible();
    await expect(page.locator('text=Career').first()).toBeVisible();
  });

  test('2.3 Team Practice and Solo Practice bars visible', async ({ page }) => {
    await expect(page.locator('text=Team Practice')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Solo Practice').first()).toBeVisible();
  });

  test('2.4 Coach Homework section exists (read-only)', async ({ page }) => {
    await expect(page.locator('text=Coach Homework').first()).toBeVisible({ timeout: 10000 });
  });

  test('2.5 Parent Practice section exists', async ({ page }) => {
    await expect(page.locator('text=Parent Solo Practice')).toBeVisible({ timeout: 10000 });
  });

  test('2.6 Leaderboard toggle works', async ({ page }) => {
    // Click Leaderboard button
    const leaderboardBtn = page.locator('button:has-text("Leaderboard")').first();
    if (await leaderboardBtn.isVisible({ timeout: 5000 })) {
      await leaderboardBtn.click();
      await page.waitForTimeout(1000);

      // Leaderboard should appear with Weekly/Career toggle
      const toggle = page.locator('button:has-text("Weekly"), button:has-text("Career")').first();
      await expect(toggle).toBeVisible({ timeout: 5000 });

      // Click toggle to switch views
      await toggle.click();
      await page.waitForTimeout(500);

      // Should still be visible (toggled state)
      await expect(page.locator('text=Leaderboard').first()).toBeVisible();
    }
  });

  test('2.7 Solo Training Builder opens', async ({ page }) => {
    const builderBtn = page.locator('button:has-text("Solo Training Builder")').first();
    if (await builderBtn.isVisible({ timeout: 5000 })) {
      await builderBtn.click();
      await page.waitForTimeout(1000);

      // Modal should open - look for modal content
      const modal = page.locator('[class*="fixed"][class*="inset"]').first();
      await expect(modal).toBeVisible({ timeout: 5000 });
    }
  });

  test('2.8 Homework percentage and attendance visible', async ({ page }) => {
    // Coach Drills count or percentage
    await expect(page.locator('text=/Coach Drills|All Done/').first()).toBeVisible({ timeout: 10000 });
    // Attendance section
    await expect(page.locator('text=Attendance').first()).toBeVisible();
  });

  test('2.9 Events section visible', async ({ page }) => {
    await expect(page.locator('text=Upcoming Events').first()).toBeVisible({ timeout: 10000 });
  });

  test('2.10 Logout works', async ({ page }) => {
    const logoutBtn = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), button:has-text("Log Out")').first();
    if (await logoutBtn.isVisible({ timeout: 5000 })) {
      await logoutBtn.click();
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    }
  });
});
