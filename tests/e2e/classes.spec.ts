import { test, expect } from '@playwright/test';
import { loginAsAdmin, navigateTo } from './helpers/authHelper';
import { generateSyntheticTestId } from './helpers/testNamespace';

test.describe('E2E — Classes and Attendance Workflow', () => {
  test.beforeEach(async ({ page }) => {
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip(true, 'ADMIN_AUTH_KEY not available in environment; skipping live backend workflow');
    }
  });

  test('schedules class session and records attendance', async ({ page }) => {
    const testId = generateSyntheticTestId('CLS');
    const topic = `Mathematics Tutorial ${testId}`;

    await navigateTo(page, 'Classes');
    await expect(page.locator('button:has-text("+ Schedule Class")')).toBeVisible({ timeout: 15000 });

    // Open schedule form
    await page.locator('button:has-text("+ Schedule Class")').click();
    await page.waitForFunction(() => {
      const select = document.querySelector('form select') as HTMLSelectElement | null;
      return select && select.options.length > 0 && select.value !== '';
    }, { timeout: 25000 });
    const randomDay = 10 + Math.floor(Math.random() * 18);
    const randomHour = 10 + Math.floor(Math.random() * 8);
    const scheduleDate = `2028-08-${randomDay < 10 ? '0' + randomDay : randomDay}`;
    const scheduleTime = `${randomHour < 10 ? '0' + randomHour : randomHour}:00`;
    await page.getByLabel('Class Date').fill(scheduleDate);
    await page.getByLabel('Class Start Time').fill(scheduleTime);
    await page.getByLabel('Session Notes').fill(topic);

    // Submit form
    await page.locator('button:has-text("Schedule Class")').click();

    // Verify session row appears in schedule table
    const classRow = page.locator('tbody tr').filter({ has: page.locator(`[title*="${testId}"]`) });
    await expect(classRow).toBeVisible({ timeout: 25000 });

    // Mark attendance as ATTENDED if available
    const attendedBtn = classRow.locator('button:has-text("Attended")');
    if (await attendedBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await attendedBtn.click();
      // Verify attendance tone / status
      await expect(classRow.locator('text=ATTENDED')).toBeVisible({ timeout: 25000 });
    }
  });
});
