import { test, expect } from "@playwright/test";

test.describe("Pricing Page Buttons", () => {
  // This test requires the marketing site running on port 3000
  // Skip if not available
  test.beforeEach(async ({ request }) => {
    try {
      const res = await request.get("http://localhost:3000/pricing");
      if (res.status() !== 200) test.skip();
    } catch {
      test.skip();
    }
  });

  test("Community button links to register with plan=community", async ({ page }) => {
    await page.goto("http://localhost:3000/pricing");
    await page.waitForLoadState("networkidle");

    const communityLink = page.locator('a[href*="plan=community"]');
    const count = await communityLink.count();
    expect(count).toBeGreaterThan(0);

    const href = await communityLink.first().getAttribute("href");
    expect(href).toContain("register?plan=community");
  });

  test("Seed button links to checkout-direct with plan=seed", async ({ page }) => {
    await page.goto("http://localhost:3000/pricing");
    await page.waitForLoadState("networkidle");

    const seedLink = page.locator('a[href*="plan=seed"]');
    const count = await seedLink.count();
    expect(count).toBeGreaterThan(0);

    const href = await seedLink.first().getAttribute("href");
    expect(href).toContain("checkout-direct?plan=seed");
  });

  test("Core button links to checkout-direct with plan=core", async ({ page }) => {
    await page.goto("http://localhost:3000/pricing");
    await page.waitForLoadState("networkidle");

    const coreLink = page.locator('a[href*="plan=core"]');
    const count = await coreLink.count();
    expect(count).toBeGreaterThan(0);

    const href = await coreLink.first().getAttribute("href");
    expect(href).toContain("checkout-direct?plan=core");
  });

  test("Network button links to checkout-direct with plan=network", async ({ page }) => {
    await page.goto("http://localhost:3000/pricing");
    await page.waitForLoadState("networkidle");

    const networkLink = page.locator('a[href*="plan=network"]');
    const count = await networkLink.count();
    expect(count).toBeGreaterThan(0);

    const href = await networkLink.first().getAttribute("href");
    expect(href).toContain("checkout-direct?plan=network");
  });
});
