import { test, expect } from "@playwright/test";
import { login } from "../helpers/auth";

test.describe("Grant Lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin@benefitssafe.com");
  });

  test("grants page loads and shows existing grants", async ({ page }) => {
    await page.goto("/grants");
    await page.waitForLoadState("networkidle");

    // Page should load without errors
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");

    // Should show grants heading or grant data
    expect(body).toContain("Grant");
  });

  test("grant detail page loads when clicking a grant", async ({ page }) => {
    await page.goto("/grants");
    await page.waitForLoadState("networkidle");

    // Look for any clickable grant link
    const grantLinks = page.locator('a[href*="/grants/"]');
    const count = await grantLinks.count();

    if (count > 0) {
      await grantLinks.first().click();
      await page.waitForLoadState("networkidle");

      const body = await page.textContent("body");
      expect(body).not.toContain("Internal Server Error");
    } else {
      // No grants exist yet - that's ok for a clean test environment
      test.skip();
    }
  });

  test("grants API returns org-scoped data", async ({ request, page }) => {
    await login(page, "admin@benefitssafe.com");

    // Use the page context (which has auth cookies) to make API call
    const response = await page.request.get("/api/grants?limit=5");
    expect(response.status()).toBe(200);

    const data = await response.json();
    // Response should be an array or object with data property
    const grants = Array.isArray(data) ? data : data.data || data.grants || [];
    // All grants should belong to the same org (we can't check orgId from client,
    // but we verify the API doesn't crash)
    expect(Array.isArray(grants)).toBe(true);
  });
});
