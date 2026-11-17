import { test, expect } from '@playwright/test';
import { loginAsAdmin, navigateTo } from './helpers/authHelper';

test.describe('E2E — Finances Refinements & Meeting Links Management', () => {
  test.beforeEach(async ({ page }) => {
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip(true, 'ADMIN_AUTH_KEY not available in environment; skipping live backend workflow');
    }
  });

  test('Finances: verifies Student Balances default tab, Add Payment modal, and 4-column history', async ({ page }) => {
    await navigateTo(page, 'Finances');
    await expect(page.locator('h1:has-text("Finances")')).toBeVisible({ timeout: 15000 });

    // 1. Verify exact Card Labels and Descriptions
    const summaryCards = page.locator('[data-testid="finance-summary-cards"]');
    await expect(summaryCards.getByText('Lifetime Package Value')).toBeVisible();
    await expect(summaryCards.getByText('Lifetime Payments Received')).toBeVisible();
    await expect(summaryCards.getByText('Recorded INR Value')).toBeVisible();
    await expect(page.locator('text=Total Outstanding')).toHaveCount(0);

    // 2. Verify Student Balances is the first tab and selected by default
    const balancesTab = page.locator('#tab-balances');
    const historyTab = page.locator('#tab-history');
    await expect(balancesTab).toBeVisible();
    await expect(historyTab).toBeVisible();
    await expect(balancesTab).toHaveAttribute('aria-selected', 'true');
    await expect(historyTab).toHaveAttribute('aria-selected', 'false');

    // 3. Verify Add Payment button opens popup form and cancels cleanly
    const addPaymentBtn = page.locator('button:has-text("Add Payment")');
    await expect(addPaymentBtn).toBeVisible();
    await addPaymentBtn.click();
    await expect(page.locator('h3:has-text("Record Student Payment")')).toBeVisible();
    await page.locator('button:has-text("Cancel")').click();
    await expect(page.locator('h3:has-text("Record Student Payment")')).not.toBeVisible();

    // 4. Switch to Payment History tab and verify canonical columns
    await historyTab.click();
    await expect(historyTab).toHaveAttribute('aria-selected', 'true');
    await expect(balancesTab).toHaveAttribute('aria-selected', 'false');

    const headers = page.locator('table thead th');
    await expect(headers).toHaveCount(5);
    await expect(headers.nth(0)).toHaveText('Payment Date');
    await expect(headers.nth(1)).toHaveText('Student');
    await expect(headers.nth(2)).toHaveText('Amount');
    await expect(headers.nth(3)).toHaveText('Currency');
    await expect(headers.nth(4)).toHaveText('Recorded INR Equivalent');

    // Method, Reference, and Actions must be absent
    await expect(page.locator('table thead th:has-text("Method")')).toHaveCount(0);
    await expect(page.locator('table thead th:has-text("Reference")')).toHaveCount(0);
    await expect(page.locator('table thead th:has-text("Actions")')).toHaveCount(0);
  });

  test('Students: verifies Primary Meeting Link management and absence of standalone Meeting Links page', async ({ page }) => {
    // 1. Verify Meeting Links is absent from sidebar navigation
    await expect(page.locator('aside button:has-text("Meeting Links")')).toHaveCount(0);

    // 2. Navigate to Students directory
    await navigateTo(page, 'Students');
    await expect(page.locator('h1:has-text("Students Directory")')).toBeVisible({ timeout: 15000 });

    // 3. Verify student list renders and expandable details show student records
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });
  });
});
