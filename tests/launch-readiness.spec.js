import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

// Launch-readiness regression tests covering the scenarios surfaced by
// the 2026-05-22 Codex audit. These run in Chromium (desktop) — phone-
// install + push-delivery paths still need real-device verification
// from FAMILY_BETA_TEST_PLAN.md, but everything that can be automated
// in a browser lives here.

test.describe('Launch readiness', () => {

    // ----- LOGOUT (the black-screen regression) ----------------------
    test('coach logout lands cleanly on /login (no black screen)', async ({ page }) => {
        await loginAs(page, 'coach');
        await expect(page).toHaveURL(/\/dashboard/);

        // Find any logout affordance — Dashboard has a logout button with
        // title="Logout" plus a desktop nav variant. Try both selectors.
        const logoutBtn = page
            .locator('button[title="Logout"], button:has-text("Logout"), button:has-text("Log out"), button:has-text("Sign out")')
            .first();
        await logoutBtn.click({ timeout: 10000 });

        // Expect to land back on /login within a reasonable time, with
        // the login form visible (no black screen). The previous bug
        // had us stuck on bg-brand-dark forever after the catch-all
        // reload loop kept appending __r.
        await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
        await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 10000 });
    });

    test('parent logout lands cleanly on /login (no black screen)', async ({ page }) => {
        await loginAs(page, 'parent');
        await expect(page).toHaveURL(/\/parent-dashboard/);

        const logoutBtn = page
            .locator('button[title="Logout"], button:has-text("Logout"), button:has-text("Log out"), button:has-text("Sign out")')
            .first();
        await logoutBtn.click({ timeout: 10000 });

        await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
        await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 10000 });
    });

    test('sign out then sign back in works in the same session', async ({ page }) => {
        await loginAs(page, 'coach');
        const logoutBtn = page
            .locator('button[title="Logout"], button:has-text("Logout"), button:has-text("Log out"), button:has-text("Sign out")')
            .first();
        await logoutBtn.click({ timeout: 10000 });
        await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
        // Round-trip: sign back in. loginAs handles the full flow.
        await loginAs(page, 'coach');
        await expect(page).toHaveURL(/\/dashboard/);
    });

    // ----- UNKNOWNROUTERELOAD BACKSTOP ------------------------------
    // The catch-all route used to infinitely reload (appending __r=<ts>
    // every visit). The 2026-05-22 fix: if __r is already present we
    // render a visible "Page Not Found" card with a Go-to-Login button
    // instead of looping.
    test('UnknownRouteReload shows visible fallback on second hit', async ({ page }) => {
        await page.goto('/some-route-that-does-not-exist?__r=' + Date.now());
        // The fallback card has the heading "Page Not Found" and a
        // "Go to Login" button. Either one being visible is the success
        // signal — what we are checking is that we did NOT stay on a
        // pure bg-brand-dark screen with no content.
        await expect(
            page.locator('text=Page Not Found, button:has-text("Go to Login")').first()
        ).toBeVisible({ timeout: 8000 });
    });

    // ----- iOS INSTALL PROMPT HIDES ON CHROMIUM ---------------------
    test('iOS install prompt does NOT show on desktop chromium', async ({ page }) => {
        await loginAs(page, 'coach');
        // The component renders an "Install Fire FC on your iPhone"
        // heading. Chromium user-agent doesn't match the iPhone regex,
        // so it should never appear. Wait briefly to make sure it has
        // had a chance to mount.
        await page.waitForTimeout(2000);
        await expect(page.locator('text=Install Fire FC on your iPhone')).toHaveCount(0);
    });

    // ----- CHAT CONNECTION STATUS BADGE ------------------------------
    // After the 2026-05-21 incident, ChatView shows a Live / Connecting
    // / Reconnecting / Offline indicator in the chat header. Any of
    // those texts existing once the chat is open means the badge wired
    // up correctly.
    test('chat tab shows realtime connection-status badge', async ({ page }) => {
        await loginAs(page, 'coach');
        // Open the Chat tab. Selector covers the desktop nav button.
        const chatTab = page
            .locator('button:has-text("Chat"), button:has-text("Messages"), a:has-text("Chat")')
            .first();
        if (await chatTab.isVisible({ timeout: 3000 }).catch(() => false)) {
            await chatTab.click();
        }
        // Wait for the realtime channel to attempt a subscription.
        // We accept any of the four states — what matters is that
        // the badge mounted, not which state it ended up in.
        const badge = page.locator(
            'span[title*="Realtime"], text=/Live|Connecting|Reconnecting|Offline/i'
        ).first();
        await expect(badge).toBeVisible({ timeout: 15000 });
    });

    // ----- CALENDAR LOADS AS COACH -----------------------------------
    test('calendar tab loads for coach without errors', async ({ page }) => {
        await loginAs(page, 'coach');
        const scheduleTab = page
            .locator('button:has-text("Schedule"), button:has-text("Calendar"), a:has-text("Schedule")')
            .first();
        if (await scheduleTab.isVisible({ timeout: 3000 }).catch(() => false)) {
            await scheduleTab.click();
        }
        // The CalendarHub renders a "Calendar" heading and view-mode
        // toggle (Month / Week / List). One of those should appear.
        await expect(
            page.locator('text=Calendar, button:has-text("Month"), button:has-text("Week")').first()
        ).toBeVisible({ timeout: 10000 });
    });

    test('calendar tab loads for parent without errors', async ({ page }) => {
        await loginAs(page, 'parent');
        const scheduleTab = page
            .locator('button:has-text("Schedule"), button:has-text("Calendar"), a:has-text("Schedule")')
            .first();
        if (await scheduleTab.isVisible({ timeout: 3000 }).catch(() => false)) {
            await scheduleTab.click();
        }
        await expect(
            page.locator('text=Calendar, button:has-text("Month"), button:has-text("Week"), text=Upcoming Events').first()
        ).toBeVisible({ timeout: 10000 });
    });

    // ----- LIVE DB DIAGNOSTICS (smoke check the RPC works) ----------
    // We can't call the RPC from Playwright without service-role
    // credentials, but we can confirm the network requests our auth'd
    // pages make come back successfully — the absence of 5xx is
    // already a meaningful smoke signal.
    test('coach session makes no 5xx requests on first load', async ({ page }) => {
        const failures = [];
        page.on('response', (resp) => {
            if (resp.status() >= 500) {
                failures.push(`${resp.status()} ${resp.url()}`);
            }
        });
        await loginAs(page, 'coach');
        // Give the dashboard a chance to settle its initial fetches.
        await page.waitForTimeout(4000);
        expect(failures, `Got 5xx responses:\n${failures.join('\n')}`).toEqual([]);
    });

});
