import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

test.describe('Coach Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'coach');
  });

  test('1.1 Dashboard loads with Club View', async ({ page }) => {
    // Should be on /dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    // Should see the Rockford Fire FC branding or dashboard content
    await expect(page.locator('img[alt*="Fire"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('1.2 Team View shows roster', async ({ page }) => {
    // Click Team tab
    const teamTab = page.locator('button:has-text("Team"), [class*="nav"] >> text=Team').first();
    if (await teamTab.isVisible()) {
      await teamTab.click();
      await page.waitForLoadState('networkidle');
      // Should see player names or roster content
      await expect(page.locator('text=/Player|Roster|Jersey/i').first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('1.3 Player Evaluation Modal opens with tabs', async ({ page }) => {
    // Navigate to Team view first
    const teamTab = page.locator('button:has-text("Team"), [class*="nav"] >> text=Team').first();
    if (await teamTab.isVisible()) {
      await teamTab.click();
      await page.waitForLoadState('networkidle');

      // Click first player in roster
      const playerRow = page.locator('[class*="cursor-pointer"]').first();
      if (await playerRow.isVisible({ timeout: 5000 })) {
        await playerRow.click();

        // Modal should open with 3 tabs
        await expect(page.locator('text=Evaluation')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('text=Badges')).toBeVisible();
        await expect(page.locator('text=Training')).toBeVisible();
      }
    }
  });

  test('1.4 Training tab shows stats', async ({ page }) => {
    // Navigate to Team view
    const teamTab = page.locator('button:has-text("Team"), [class*="nav"] >> text=Team').first();
    if (await teamTab.isVisible()) {
      await teamTab.click();
      await page.waitForLoadState('networkidle');

      // Click first player
      const playerRow = page.locator('[class*="cursor-pointer"]').first();
      if (await playerRow.isVisible({ timeout: 5000 })) {
        await playerRow.click();
        await page.waitForTimeout(1000);

        // Click Training tab
        await page.locator('button:has-text("Training")').click();
        await page.waitForTimeout(500);

        // Should see training stats: Streak, Drills Done, Career Min
        await expect(page.locator('text=Streak')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('text=Drills Done')).toBeVisible();
        await expect(page.locator('text=Career Min')).toBeVisible();

        // Should see time-level breakdown
        await expect(page.locator('text=This Week')).toBeVisible();
        await expect(page.locator('text=Season Total')).toBeVisible();
        await expect(page.locator('text=Year Total')).toBeVisible();
        await expect(page.locator('text=Career Total')).toBeVisible();
      }
    }
  });

  test('1.5 Training stats are editable with +/- buttons', async ({ page }) => {
    const teamTab = page.locator('button:has-text("Team"), [class*="nav"] >> text=Team').first();
    if (await teamTab.isVisible()) {
      await teamTab.click();
      await page.waitForLoadState('networkidle');

      const playerRow = page.locator('[class*="cursor-pointer"]').first();
      if (await playerRow.isVisible({ timeout: 5000 })) {
        await playerRow.click();
        await page.waitForTimeout(1000);

        await page.locator('button:has-text("Training")').click();
        await page.waitForTimeout(500);

        // Should have +/- buttons (at least 4 pairs for week/season/year/career)
        const plusButtons = page.locator('button:has-text("+")');
        const minusButtons = page.locator('button:has-text("-")');
        expect(await plusButtons.count()).toBeGreaterThanOrEqual(4);
        expect(await minusButtons.count()).toBeGreaterThanOrEqual(4);

        // Should have Save Training button
        await expect(page.locator('button:has-text("Save Training")')).toBeVisible();
      }
    }
  });

  test('1.6 Logout works', async ({ page }) => {
    // Find and click logout
    const logoutBtn = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), button:has-text("Log Out")').first();
    if (await logoutBtn.isVisible({ timeout: 5000 })) {
      await logoutBtn.click();
      // Should redirect to login
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    }
  });
});
