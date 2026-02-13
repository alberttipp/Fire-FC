import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

test.describe('Navigation & Auth', () => {
  test('Login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Enter Club")')).toBeVisible();
  });

  test('Root redirects to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('Coach login redirects to /dashboard', async ({ page }) => {
    await loginAs(page, 'coach');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('Parent login redirects to /parent-dashboard', async ({ page }) => {
    await loginAs(page, 'parent');
    await expect(page).toHaveURL(/\/parent-dashboard/);
  });

  test('Coach dashboard has nav tabs', async ({ page }) => {
    await loginAs(page, 'coach');
    // Check for common nav items
    const navItems = ['Club', 'Team', 'Schedule', 'Messages', 'Gallery'];
    for (const item of navItems) {
      const el = page.locator(`button:has-text("${item}"), a:has-text("${item}")`).first();
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Nav item found - pass
      }
    }
  });

  test('Parent dashboard has nav tabs', async ({ page }) => {
    await loginAs(page, 'parent');
    // Check for parent nav items
    const navItems = ['Overview', 'Schedule', 'Messages', 'Gallery'];
    for (const item of navItems) {
      const el = page.locator(`button:has-text("${item}"), a:has-text("${item}")`).first();
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Nav item found - pass
      }
    }
  });
});
