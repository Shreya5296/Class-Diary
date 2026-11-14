import { test, expect } from '@playwright/test';
import { loginAsAdmin, navigateTo } from './helpers/authHelper';
import { generateSyntheticTestId, generateSyntheticStudent } from './helpers/testNamespace';

test.describe('E2E — Primary Meeting Link and Student Management Workflow', () => {
  test.beforeEach(async ({ page }) => {
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip(true, 'ADMIN_AUTH_KEY not available in environment; skipping live backend workflow');
    }
  });

  test('configures student primary meeting link, verifying persistence across refresh', async ({ page }) => {
    const testId = generateSyntheticTestId('NL');
    const student = generateSyntheticStudent(testId);

    // 1. Create a student for this workflow
    await navigateTo(page, 'Students');
    await page.locator('button:has-text("+ Add Student")').click();
    await page.getByLabel(/Student Name|Full Name/i).fill(student.full_name);
    await page.getByLabel('Student Email').fill(student.email);
    await page.getByLabel('Parent Name').fill(student.parent_name);
    await page.getByLabel('Parent Phone').fill(student.parent_phone);
    await page.locator('button:has-text("Create Student")').click();
    await expect(page.locator('text=Loading students…')).toBeHidden({ timeout: 60000 });
    await expect(page.locator(`text=${student.full_name}`)).toBeVisible({ timeout: 45000 });

    // 2. Open Student Details -> Edit Student
    await page.locator('table').locator(`text=${student.full_name}`).first().click();
    await page.locator('button:has-text("Edit Student")').click();
    await expect(page.getByLabel('Primary Meeting Link')).toBeVisible({ timeout: 15000 });

    // 3. Set Primary Meeting Link
    await page.getByLabel('Primary Meeting Link').fill('https://meet.google.com/test-room-123');
    await page.locator('button:has-text("Save Changes")').click();
    await expect(page.locator('button:has-text("Save Changes")')).toBeHidden({ timeout: 35000 });

    // 4. Verify Meeting Link in expanded details is rendered
    await page.locator('table').locator(`text=${student.full_name}`).first().click();
    await expect(page.locator('text=meet.google.com/test-room-123').first()).toBeVisible({ timeout: 35000 });

    // 5. Refresh persistence check
    await page.reload();
    await navigateTo(page, 'Students');
    await page.locator(`text=${student.full_name}`).first().click();
    await expect(page.locator('text=meet.google.com/test-room-123').first()).toBeVisible({ timeout: 35000 });
  });
});
