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

test.describe('Calendar Page Refinement & Responsive Verification', () => {
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

  test('verifies Calendar at 1440px desktop: top-bar stability, no legend, and extra class scheduling', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigate(page, 'Calendar');

    // 1. Verify TopBar stability and clean single welcome message
    await expect(page.locator('header span:has-text("Welcome back,")')).toBeVisible();
    await expect(page.locator('header span:has-text("Authorized Administrator")')).toBeVisible();
    await expect(page.locator('h1:has-text("Class Calendar")')).toBeVisible();

    // 2. Verify legend is removed
    await expect(page.locator('text=Dated Session')).toHaveCount(0);
    await expect(page.locator('text=Recurring Slot (dashed)')).toHaveCount(0);

    // 3. Verify Monday as first column in Week view
    const firstDayHeader = page.locator('span[class*="dayName"]').first();
    await expect(firstDayHeader).toHaveText('Mon');

    // 4. Verify Schedule Extra Class button and modal flow
    const extraClassBtn = page.locator('button:has-text("+ Schedule Extra Class")');
    await expect(extraClassBtn).toBeVisible();
    await extraClassBtn.click();

    // Verify modal is open
    await expect(page.locator('h2:has-text("Schedule Extra Class")')).toBeVisible();
    await expect(page.locator('text=Active Package:')).toBeVisible();
    await expect(page.locator('button:has-text("Confirm Extra Class")')).toBeVisible();

    // Submit extra class
    await page.locator('button:has-text("Confirm Extra Class")').click();

    // Modal closes and extra class is scheduled
    await expect(page.locator('h2:has-text("Schedule Extra Class")')).toHaveCount(0);
  });

  test('verifies Calendar at 1280px desktop: no horizontal overflow and content scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await navigate(page, 'Calendar');
    await expect(page.locator('h1:has-text("Class Calendar")')).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

    // Scroll content area and ensure top-bar stays visible
    const content = page.locator('main');
    await content.evaluate((el) => { el.scrollTop = 200; });
    await expect(page.locator('header span:has-text("Welcome back,")')).toBeVisible();
  });

  test('verifies Calendar at 768px tablet: Month view and Day view action styling', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await navigate(page, 'Calendar');

    // Switch to Month View
    await page.locator('button[role="tab"]:has-text("month")').click();
    await expect(page.locator('text=MON').first()).toBeVisible();

    // Switch to Day View
    await page.locator('button[role="tab"]:has-text("day")').click();
    await expect(page.locator('button[role="tab"][aria-selected="true"]:has-text("day")')).toBeVisible();
  });

  test('verifies Calendar at 390px mobile: responsive navigation and layout', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await navigate(page, 'Calendar');
    await expect(page.locator('h1:has-text("Class Calendar")')).toBeVisible();
    await expect(page.locator('button:has-text("+ Schedule Extra Class")')).toBeVisible();
  });

  test('verifies profile picture synchronization between Dashboard and Sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigate(page, 'Dashboard');

    // Initial state: fallback avatar text in sidebar
    const sidebarAvatar = page.locator('aside [class*="userAvatar"]');
    await expect(sidebarAvatar).toBeVisible();

    // Set sample image dataUrl and dispatch smd_profile_image_updated
    const sampleDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    await page.evaluate((dataUrl) => {
      window.dispatchEvent(new CustomEvent('smd_profile_image_updated', { detail: dataUrl }));
    }, sampleDataUrl);

    // Sidebar avatar now immediately renders the image
    await expect(page.locator('aside [class*="userAvatar"] img')).toBeVisible({ timeout: 5000 });

    // Navigate to Calendar and verify sidebar image remains
    await navigate(page, 'Calendar');
    await expect(page.locator('aside [class*="userAvatar"] img')).toBeVisible();
  });
});
