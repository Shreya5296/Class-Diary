import { test, expect } from '@playwright/test';
import { loginAsAdmin, navigateTo } from './helpers/authHelper';

test.describe('E2E — Multi-Tab Payment Concurrency & Reactive Sync', () => {
  test.beforeEach(async ({ page }) => {
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip(true, 'ADMIN_AUTH_KEY not available in environment; skipping live backend workflow');
    }
  });

  test('synchronizes pending payment state across two browser tabs reactively', async ({ page: tab1, context }) => {
    // 1. Tab 1 navigates to Finances
    await navigateTo(tab1, 'Finances');
    await expect(tab1.getByText('Loading financial records…')).toHaveCount(0, { timeout: 35000 });
    await expect(tab1.locator('h1:has-text("Finances")')).toBeVisible({ timeout: 35000 });

    // 2. Tab 2 opens Finances
    const tab2 = await context.newPage();
    await loginAsAdmin(tab2);
    await navigateTo(tab2, 'Finances');
    await expect(tab2.getByText('Loading financial records…')).toHaveCount(0, { timeout: 35000 });
    await expect(tab2.locator('h1:has-text("Finances")')).toBeVisible({ timeout: 35000 });

    // Both tabs initially have no pending banner
    await expect(tab1.locator('text=unverified payment attempt in progress')).toHaveCount(0);
    await expect(tab2.locator('text=unverified payment attempt in progress')).toHaveCount(0);

    // 3. Tab 1 records an ambiguous pending payment in localStorage
    await tab1.evaluate(() => {
      const pending = {
        idempotency_key: 'e2e_tab_sync_key_1',
        student_id: 'STU_E2E_TAB',
        student_name: 'Multi Tab Student',
        amount: 2500,
        currency: 'INR',
        in_inr: 2500,
        payment_date: '2026-11-15',
        dispatched_at: Date.now(),
        persistence_class: 'AMBIGUOUS_OUTCOME',
      };
      const map = { [pending.idempotency_key]: pending };
      localStorage.setItem('pd_pending_payments_v1', JSON.stringify(map));
      window.dispatchEvent(new Event('pd_pending_payments_change'));
    });

    // Tab 1 updates immediately
    await expect(tab1.locator('text=You have 1 unverified payment attempt in progress.')).toBeVisible({ timeout: 5000 });

    // 4. Tab 2 receives the cross-tab storage event and shows banner without page refresh
    await tab2.evaluate(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'pd_pending_payments_v1',
        newValue: localStorage.getItem('pd_pending_payments_v1'),
      }));
    });
    await expect(tab2.locator('text=You have 1 unverified payment attempt in progress.')).toBeVisible({ timeout: 5000 });

    // 5. Tab 2 opens the modal to review
    await tab2.locator('button:has-text("Review & Resolve Now →")').click();
    await expect(tab2.locator('h3:has-text("Record Student Payment")')).toBeVisible();
    await expect(tab2.locator('text=Ambiguous Payment Status (Network Timeout)')).toBeVisible();

    // 6. Tab 2 acknowledges and dismisses local tracking
    const checkbox = tab2.locator('input[type="checkbox"]');
    await checkbox.check();
    const dismissBtn = tab2.locator('button:has-text("Dismiss Local Alert (Tracking Only)")');
    await expect(dismissBtn).toBeEnabled();
    await dismissBtn.click();

    // Modal closes or clears pending notice in Tab 2
    await expect(tab2.locator('text=Ambiguous Payment Status (Network Timeout)')).toHaveCount(0);

    // 7. Tab 1 receives the removal storage event and clears the banner
    await tab1.evaluate(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'pd_pending_payments_v1',
        newValue: localStorage.getItem('pd_pending_payments_v1'),
      }));
    });
    await expect(tab1.locator('text=unverified payment attempt in progress')).toHaveCount(0);

    await tab2.close();
  });
});
