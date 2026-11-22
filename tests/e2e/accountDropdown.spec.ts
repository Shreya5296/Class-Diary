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

  test('verifies Student Manager is removed and no dev/mock badge in top bar', async ({ page }) => {
    // Brand title Student Manager is removed globally
    await expect(page.locator('aside span:has-text("Student Manager")')).toHaveCount(0);
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
    await expect(page.locator('text=Email')).toBeVisible();
    await expect(page.locator('main').locator('text=ashreya0502@gmail.com')).toBeVisible();

    // Edit display name
    const nameInput = page.locator('#displayNameInput');
    await nameInput.fill('Ashreya Persisted Admin');
    await page.locator('button:has-text("Save Changes")').click();
    await expect(page.locator('text=Settings saved successfully.')).toBeVisible();

    // Edit timezone and currency dropdowns
    const tzSelect = page.locator('#timezoneSelect');
    await expect(tzSelect).toHaveValue('Asia/Kolkata');
    await tzSelect.selectOption('America/New_York');

    const currSelect = page.locator('#currencySelect');
    await expect(currSelect).toHaveValue('INR');
    await currSelect.selectOption('USD');

    await page.locator('button:has-text("Save Changes")').click();
    await expect(page.locator('text=Settings saved successfully.')).toBeVisible();

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

  test('displays Dashboard with KPIs and Today Classes without weekly schedule', async ({ page }) => {
    await page.locator('aside button:has-text("Dashboard")').click();
    await expect(page.locator('h1:has-text("Dashboard")')).toHaveCount(0);
    await expect(page.locator('text=Welcome back')).toBeVisible();

    // Verify Weekly Class Schedule is absent from Dashboard
    await expect(page.locator('h3:has-text("Weekly Class Schedule")')).toHaveCount(0);

    // Verify KPIs and Class Schedule are visible
    await expect(page.locator('text=Active Students')).toBeVisible();
    await expect(page.locator('h3:has-text("Class Schedule")')).toBeVisible();

    // Verify Welcome Back avatar, edit button reveals on hover, and modal opens via portal without flickering
    await page.locator('div[class*="avatarContainer"]').hover();
    const editBtn = page.locator('button[aria-label="Edit profile picture"]');
    await expect(editBtn).toBeVisible();
    await editBtn.click();
    await expect(page.locator('#picModalTitle')).toBeVisible();
    // Verify modal backdrop is mounted directly under body
    await expect(page.locator('body > div[role="dialog"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#picModalTitle')).toHaveCount(0);
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

  test('manages attendance pending alert inline on dashboard with date, present, absent, reschedule', async ({ page }) => {
    await page.locator('aside button:has-text("Dashboard")').click();
    await expect(page.locator('text=Things That Need Attention')).toBeVisible();

    // Find attendance alert row for Aarav Sharma
    const alertRow = page.locator('div[class*="row"]').filter({ hasText: 'Aarav Sharma' }).filter({ hasText: 'Attendance not marked' });
    await expect(alertRow).toBeVisible();
    await expect(alertRow.getByText(/Class date:/)).toBeVisible();

    // Click Mark Attendance -> expands inline without navigation
    await alertRow.getByRole('button', { name: /Mark Attendance/ }).click();

    // Verify expanded status controls and mandatory notes input
    const notesInput = alertRow.locator('input[placeholder*="Enter attendance notes..."]');
    await expect(notesInput).toBeVisible();
    const presentBtn = alertRow.locator('button:has-text("Present")');
    const absentBtn = alertRow.locator('button:has-text("Absent")');
    const rescheduleBtn = alertRow.locator('button:has-text("Rescheduled")');
    await expect(presentBtn).toBeVisible();
    await expect(absentBtn).toBeVisible();
    await expect(rescheduleBtn).toBeVisible();

    // Verify mandatory notes validation: clicking Present without notes fails
    await presentBtn.click();
    await expect(alertRow.locator('text=Attendance notes are required.')).toBeVisible();

    // Test inline reschedule toggle
    await rescheduleBtn.click();
    await expect(alertRow.locator('input[type="date"]')).toBeVisible();
    await expect(alertRow.locator('input[type="time"]')).toBeVisible();

    // Click Back to return to status choices
    await alertRow.locator('button:has-text("Back")').click();
    await expect(notesInput).toBeVisible();

    // Fill valid attendance notes and click Present
    await notesInput.fill('Class conducted successfully as scheduled.');
    await presentBtn.click();

    // Verify resolved alert automatically disappears after data refresh
    await expect(page.locator('div[class*="row"]').filter({ hasText: 'Aarav Sharma' }).filter({ hasText: 'Attendance not marked' })).toHaveCount(0);
  });
});
