import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load test credentials from .env.test
function loadTestEnv() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.join(__dirname, '.env.test');
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    const vars = {};
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...rest] = line.split('=');
        vars[key.trim()] = rest.join('=').trim();
      }
    });
    return vars;
  } catch {
    return {};
  }
}

export const testEnv = loadTestEnv();

/**
 * Login as a specific role
 */
export async function loginAs(page, role) {
  const email = role === 'coach' ? testEnv.COACH_EMAIL : testEnv.PARENT_EMAIL;
  const password = role === 'coach' ? testEnv.COACH_PASSWORD : testEnv.PARENT_PASSWORD;

  if (!email || !password || email.includes('your-')) {
    throw new Error(`Missing ${role} credentials in tests/.env.test`);
  }

  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Make sure Member tab is active (not Player tab)
  const memberTab = page.locator('button:has-text("Member")');
  if (await memberTab.isVisible({ timeout: 3000 })) {
    await memberTab.click();
    await page.waitForTimeout(300);
  }

  // Fill login form - clear first to avoid stale values
  const emailInput = page.locator('input[type="email"], input[placeholder*="@"]').first();
  const passwordInput = page.locator('input[type="password"]').first();

  await emailInput.click();
  await emailInput.fill(email);
  await passwordInput.click();
  await passwordInput.fill(password);

  // Click login button and wait for Supabase auth response
  const submitBtn = page.locator('button[type="submit"]:has-text("Enter Club")');
  await submitBtn.waitFor({ state: 'visible', timeout: 5000 });

  // Click and simultaneously wait for the auth API response
  const [response] = await Promise.all([
    page.waitForResponse(
      resp => resp.url().includes('auth') && resp.url().includes('token'),
      { timeout: 15000 }
    ).catch(() => null),
    submitBtn.click(),
  ]);

  if (response) {
    const status = response.status();
    if (status !== 200) {
      const body = await response.json().catch(() => ({}));
      throw new Error(`Auth failed (${status}): ${body.error_description || body.msg || JSON.stringify(body)}`);
    }
  }

  // Wait for navigation away from login
  const expectedPath = role === 'coach' ? '/dashboard' : '/parent-dashboard';
  await page.waitForURL(`**${expectedPath}`, { timeout: 20000 });
  await page.waitForLoadState('networkidle');
}
