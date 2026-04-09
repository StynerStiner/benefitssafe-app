import { test, expect } from "@playwright/test";

test.describe("Free Signup Flow", () => {
  test("Community plan registration page loads with correct banner", async ({ page }) => {
    await page.goto("/auth/register?plan=community");

    // Verify the page loaded
    await page.waitForSelector('form', { timeout: 10000 });

    // Verify plan banner shows "Community - Free"
    const body = await page.textContent("body");
    expect(body).toContain("Community");

    // Verify all required form fields are present
    await expect(page.locator('input[placeholder*="Organization"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="First Name"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="Last Name"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="Email"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="Password"]').first()).toBeVisible();
    await expect(page.locator('input[placeholder*="Confirm Password"]')).toBeVisible();

    // Verify NO EIN field
    await expect(page.locator('input[placeholder*="EIN"]')).toHaveCount(0);
  });

  test("Registration form validates required fields", async ({ page }) => {
    await page.goto("/auth/register?plan=community");
    await page.waitForSelector('form', { timeout: 10000 });

    // Submit empty form
    await page.click('button[type="submit"]');

    // Should show validation errors (form doesn't submit, stays on page)
    await page.waitForTimeout(1000);
    expect(page.url()).toContain("/auth/register");
  });

  test("Registration form submits with valid data", async ({ page }) => {
    await page.goto("/auth/register?plan=community");
    await page.waitForSelector('form', { timeout: 10000 });

    const uniqueEmail = `test-e2e-${Date.now()}@testorg.com`;

    // Fill form
    await page.fill('input[placeholder*="Organization"]', "E2E Test Nonprofit");
    await page.fill('input[placeholder*="First Name"]', "Test");
    await page.fill('input[placeholder*="Last Name"]', "User");
    await page.fill('input[placeholder*="Email"]', uniqueEmail);
    await page.fill('input[placeholder*="Password"]', "TestPass1!");
    await page.fill('input[placeholder*="Confirm Password"]', "TestPass1!");

    // Accept terms
    const checkbox = page.locator('#createAccount');
    await checkbox.click();

    // Submit
    await page.click('button[type="submit"]');

    // Should either redirect to login or show success message
    await page.waitForTimeout(3000);
    const url = page.url();
    const body = await page.textContent("body");
    const success =
      url.includes("/auth/login") ||
      body?.includes("Account created") ||
      body?.includes("check your email");

    expect(success).toBe(true);
  });
});
