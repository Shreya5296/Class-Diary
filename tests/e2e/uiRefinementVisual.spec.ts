import { test, expect, Page } from '@playwright/test';
import path from 'path';

const MOCK_JWT = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ email: 'ashreya0502@gmail.com', name: 'Authorized Administrator' }))}.mocksig`;
const ARTIFACT_DIR = '/Users/shreya/.gemini/antigravity/brain/4968e0e3-ad47-410d-80eb-7556ec256c63';

async function navigate(page: Page, target: string) {
  const menuToggle = page.locator('button[aria-label="Toggle navigation menu"]');
  if (await menuToggle.isVisible()) {
    await menuToggle.click();
    await page.waitForTimeout(300);
  }

  if (target === 'settings') {
    await page.locator('button[aria-label="Settings & Regional Preferences"]').first().click();
  } else {
    await page.locator(`aside button:has-text("${target}")`).first().click();
  }
  await page.waitForTimeout(400);

  const backdrop = page.locator('div[class*="sidebarBackdrop"]');
  if (await backdrop.isVisible()) {
    await backdrop.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

test.describe('Visual Screenshot Inspection — UI Refinements', () => {
  const viewports = [
    { name: 'desktop-1440', width: 1440, height: 900 },
    { name: 'desktop-1280', width: 1280, height: 800 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'mobile-390', width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    test(`captures screenshots at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // 1. Unauthenticated Login Screen
      await page.goto('/');
      await page.evaluate(() => {
        sessionStorage.clear();
        localStorage.clear();
      });
      await page.goto('/');
      await expect(page.locator('h1:has-text("Personal Dashboard")')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, `login-${vp.name}.png`),
        fullPage: true,
      });

      // Set mock auth state
      await page.evaluate(({ token }) => {
        sessionStorage.setItem('smd_use_mock_data', 'true');
        sessionStorage.setItem('smd_auth_token', token);
        sessionStorage.setItem('smd_auth_user', JSON.stringify({
          email: 'ashreya0502@gmail.com',
          name: 'Authorized Administrator',
          isAdmin: true,
        }));
      }, { token: MOCK_JWT });

      await page.goto('/');
      await expect(page.locator('text=Welcome back').first()).toBeVisible({ timeout: 10000 });

      // 2. Student Directory
      await navigate(page, 'Students');
      await expect(page.locator('h1:has-text("Students Directory")')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, `student-directory-${vp.name}.png`),
        fullPage: true,
      });

      // 3. Class Schedule & Attendance
      await navigate(page, 'Class Schedule');
      await expect(page.locator('h1:has-text("Class Schedule & Attendance")')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, `class-schedule-${vp.name}.png`),
        fullPage: true,
      });

      // 4. Profile & Preferences (Settings)
      await navigate(page, 'settings');
      await expect(page.locator('h1:has-text("Profile & Preferences")')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, `profile-settings-${vp.name}.png`),
        fullPage: true,
      });

      // 5. Finances
      await navigate(page, 'Finances');
      await expect(page.locator('h1:has-text("Finances")')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, `finances-${vp.name}.png`),
        fullPage: true,
      });
    });
  }
});
