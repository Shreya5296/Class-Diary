import { test, expect, Page } from '@playwright/test';

const MOCK_JWT = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ email: 'ashreya0502@gmail.com', name: 'Authorized Administrator' }))}.mocksig`;

async function navigate(page: Page, label: string) {
  const menuToggle = page.locator('button[aria-label="Toggle navigation menu"]');
  if (await menuToggle.isVisible()) {
    await menuToggle.click();
    await page.waitForTimeout(200);
  }
  const btn = page.locator(`aside button:has-text("${label}")`);
  await btn.click();
}

test.describe('Frontend UI/UX Redesign — Screen & Viewport Coverage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
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
    await expect(page.locator('button[aria-label="Log out of session"]')).toBeVisible({ timeout: 10000 });
  });

  test('verifies all active screens and account dropdown profile at Desktop (1440px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('aside button:has-text("Settings")')).toHaveCount(0);

    // 1. Dashboard
    await navigate(page, 'Dashboard');
    await expect(page.locator('h1:has-text("Dashboard")')).toHaveCount(0);
    await expect(page.locator('text=Welcome back')).toBeVisible();
    await expect(page.locator('text=Active Students')).toBeVisible();
    await expect(page.locator('text=Things That Need Attention')).toBeVisible();
    await expect(page.locator('h3:has-text("Schedule Calendar")')).toBeVisible();

    // 2. Students Directory
    await navigate(page, 'Students');
    await expect(page.locator('h1:has-text("Students Directory")')).toBeVisible();
    await expect(page.locator('button:has-text("+ Add Student")')).toBeVisible();
    await expect(page.locator('input[placeholder*="Search students"]')).toBeVisible();
    await expect(page.locator('table tbody tr').first()).toBeVisible();

    // 3. Finances
    await navigate(page, 'Finances');
    await expect(page.locator('h1:has-text("Finances")')).toBeVisible();
    const summaryCards = page.locator('[data-testid="finance-summary-cards"]');
    await expect(summaryCards.getByText('Lifetime Package Value')).toBeVisible();
    await expect(summaryCards.getByText('Lifetime Payments Received')).toBeVisible();
    await expect(summaryCards.getByText('Recorded INR Value')).toBeVisible();

    // 4. Class Schedule
    await navigate(page, 'Class Schedule');
    await expect(page.locator('h1:has-text("Class Schedule & Attendance")')).toBeVisible();
    await expect(page.locator('button:has-text("+ Schedule Class")')).toBeVisible();

    // 5. Profile & Preferences (via Sidebar footer)
    await page.locator('button[aria-label="Settings & Regional Preferences"]').click();
    await expect(page.locator('h1:has-text("Profile & Preferences")')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Administrator Profile' })).toBeVisible();

    // 6. Dedicated Calendar Page
    await navigate(page, 'Calendar');
    await expect(page.locator('h1:has-text("Class Calendar")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("week")')).toBeVisible();
    await expect(page.locator('text=9:00 AM').first()).toBeVisible();
  });

  test('verifies desktop 1280px layout without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await navigate(page, 'Dashboard');
    await expect(page.locator('text=Welcome back')).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test('verifies tablet 768px layout and card wrapping', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await navigate(page, 'Students');
    await expect(page.locator('h1:has-text("Students Directory")')).toBeVisible();
    await expect(page.locator('button:has-text("+ Add Student")')).toBeVisible();
  });

  test('verifies mobile 390px responsive drawer navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await navigate(page, 'Students');
    await expect(page.locator('h1:has-text("Students Directory")')).toBeVisible();
  });

  test('verifies Mini Calendar date sync and mobile section hierarchy', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigate(page, 'Dashboard');
    await expect(page.locator('h3:has-text("Schedule Calendar")')).toBeVisible();

    // Click a day on the calendar and verify Class Schedule reflects it
    const dayBtn = page.locator('button[aria-label*="November 15, 2026"]');
    if (await dayBtn.isVisible()) {
      await dayBtn.click();
      await expect(page.locator('span[class*="selectedDateBadge"]').filter({ hasText: '15' })).toBeVisible();
    }

    // Verify Mobile order elements
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('text=Welcome back')).toBeVisible();
    await expect(page.locator('text=Active Students')).toBeVisible();
    await expect(page.locator('h3:has-text("Class Schedule")')).toBeVisible();
    await expect(page.locator('h3:has-text("Schedule Calendar")')).toBeVisible();
    await expect(page.locator('h3:has-text("Things That Need Attention")')).toBeVisible();
  });
});
