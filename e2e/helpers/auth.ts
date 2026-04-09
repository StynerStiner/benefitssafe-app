import { type Page, expect } from "@playwright/test";

/**
 * Login helper for E2E tests.
 * Handles NextAuth CSRF token flow automatically.
 */
export async function login(
  page: Page,
  email: string,
  password: string = "TestDev2024!",
) {
  await page.goto("/auth/login");

  // Wait for the login form to be visible
  await page.waitForSelector('input[type="email"], input[name="email"]', {
    timeout: 10000,
  });

  // Fill credentials
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);

  // Submit
  await page.click('button[type="submit"]');

  // Wait for redirect to any dashboard route
  await page.waitForURL(
    /\/(dashboard|platform|my-dashboard|vendor-dashboard|audit-trail|reports|compliance|grants|support|settings|customers|billing)/,
    { timeout: 15000 },
  );
}

/**
 * Verify user is on a specific dashboard and it loaded without errors.
 */
export async function verifyDashboardLoaded(page: Page) {
  // No error toasts or error pages
  const errorToast = page.locator('[data-testid="error-toast"], .Toastify__toast--error');
  await expect(errorToast).toHaveCount(0);

  // Page should not show 500/404 error
  const body = await page.textContent("body");
  expect(body).not.toContain("Internal Server Error");
  expect(body).not.toContain("Application error");
}
