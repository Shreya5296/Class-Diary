import { test, expect } from '@playwright/test';

const MOCK_JWT = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ email: 'ashreya0502@gmail.com', name: 'Authorized Administrator' }))}.mocksig`;

test.describe('E2E — Account Dropdown, Branding, Preferences & Calendar', () => {
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

  test('verifies single product title Student Manager and no dev/mock badge in top bar', async ({ page }) => {
    // Brand title is Student Manager
    await expect(page.locator('aside span:has-text("Student Manager")')).toBeVisible();
    await expect(page.locator('text=Tutor Administration')).toHaveCount(0);

    // Development / Mock badge is completely absent from top bar
    await expect(page.locator('header').locator('text="Development / Mock"')).toHaveCount(0);
    await expect(page.locator('header').locator('text="Demo / Mock Data"')).toHaveCount(0);
  });

  test('verifies Settings is absent from the sidebar and Finances replaces Fees and Earnings', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar.locator('button:has-text("Dashboard")')).toBeVisible();
    await expect(sidebar.locator('button:has-text("Students")')).toBeVisible();
    await expect(sidebar.locator('button:has-text("Class Schedule")')).toBeVisible();
    await expect(sidebar.locator('button:has-text("Finances")')).toBeVisible();
    await expect(sidebar.locator('button:has-text("Meeting Links")')).toHaveCount(0);

    // Verify Settings, Fees & Payments, and Earnings are completely absent from sidebar
    await expect(sidebar.locator('button:has-text("Settings")')).toHaveCount(0);
    await expect(sidebar.locator('button:has-text("Fees & Payments")')).toHaveCount(0);
    await expect(sidebar.locator('button:has-text("Earnings")')).toHaveCount(0);
  });

  test('verifies sidebar footer displays user profile controls and actions', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar.locator('text=Authorized Administrator')).toBeVisible();
    await expect(sidebar.locator('text=ashreya0502@gmail.com')).toBeVisible();

    const settingsBtn = page.locator('button[aria-label="Settings & Regional Preferences"]');
    const logoutBtn = page.locator('button[aria-label="Log out of session"]');
    await expect(settingsBtn).toBeVisible();
    await expect(logoutBtn).toBeVisible();
  });

  test('navigates to Profile, persists display name, timezone, and currency preferences', async ({ page }) => {
    await page.locator('button[aria-label="Settings & Regional Preferences"]').click();

    // Verify Profile page elements
    await expect(page.locator('h1:has-text("Profile & Preferences")')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Administrator Profile' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Regional Defaults & Preferences' })).toBeVisible();

    // Email is read-only
    await expect(page.locator('text=Account Email (Read-only)')).toBeVisible();
    await expect(page.locator('strong:has-text("ashreya0502@gmail.com")')).toBeVisible();

    // Edit display name
    const nameInput = page.locator('#displayNameInput');
    await nameInput.fill('Ashreya Persisted Admin');
    await page.locator('button:has-text("Save Display Name")').click();
    await expect(page.locator('text=Display name saved successfully.')).toBeVisible();

    // Edit timezone and currency dropdowns
    const tzSelect = page.locator('#timezoneSelect');
    await expect(tzSelect).toHaveValue('Asia/Kolkata');
    await tzSelect.selectOption('America/New_York');

    const currSelect = page.locator('#currencySelect');
    await expect(currSelect).toHaveValue('INR');
    await currSelect.selectOption('USD');

    await page.locator('button:has-text("Save Regional Preferences")').click();
    await expect(page.locator('text=Timezone and currency preferences saved successfully.')).toBeVisible();

    // Reload page and verify persistence across reload
    await page.reload();
    await expect(page.locator('aside').locator('text=Ashreya Persisted Admin')).toBeVisible({ timeout: 10000 });

    // Navigate back to profile and verify dropdowns retained their values
    await page.locator('button[aria-label="Settings & Regional Preferences"]').click();
    await expect(page.locator('#timezoneSelect')).toHaveValue('America/New_York');
    await expect(page.locator('#currencySelect')).toHaveValue('USD');
  });

  test('confirms Meeting Links is removed from sidebar and primary meeting link is managed in Students', async ({ page }) => {
    await expect(page.locator('aside button:has-text("Meeting Links")')).toHaveCount(0);
    await page.locator('aside button:has-text("Students")').click();
    await expect(page.locator('h1:has-text("Students Directory")')).toBeVisible();
  });

  test('displays weekly class schedule calendar on Dashboard starting on Monday', async ({ page }) => {
    await page.locator('aside button:has-text("Dashboard")').click();
    await expect(page.locator('h1:has-text("Administrative Dashboard")')).toBeVisible();

    // Calendar view header
    await expect(page.locator('h3:has-text("Weekly Class Schedule")')).toBeVisible();
    await expect(page.locator('button:has-text("This Week")')).toBeVisible();

    // Calendar week starts on Monday
    const firstColDay = page.locator('div[class*="dayCol"]').first();
    await expect(firstColDay.locator('text=Mon')).toBeVisible();
  });

  test('navigates to Finances page and displays summary cards and unified records', async ({ page }) => {
    await page.locator('aside button:has-text("Finances")').click();
    await expect(page.locator('h1:has-text("Finances")')).toBeVisible();
    const summaryCards = page.locator('[data-testid="finance-summary-cards"]');
    await expect(summaryCards.getByText('Lifetime Package Value')).toBeVisible();
    await expect(summaryCards.getByText('Lifetime Payments Received')).toBeVisible();
    await expect(summaryCards.getByText('Recorded INR Value')).toBeVisible();
    await expect(page.locator('button:has-text("Export Finances CSV")')).toBeVisible();
  });
});
