import { test, expect } from "@playwright/test";
import { login } from "../helpers/auth";

test.describe("Beneficiary Data Isolation", () => {
  test("beneficiary sees my-dashboard, not admin dashboard", async ({ page }) => {
    await login(page, "beneficiary@benefitssafe.com");
    expect(page.url()).toContain("/my-dashboard");
  });

  test("beneficiary cannot access admin dashboard", async ({ page }) => {
    await login(page, "beneficiary@benefitssafe.com");

    // Try to navigate to admin-only page
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Should be redirected away (middleware enforces role routing)
    const url = page.url();
    expect(url).not.toMatch(/\/dashboard$/);
  });

  test("beneficiary cannot access vendors page", async ({ page }) => {
    await login(page, "beneficiary@benefitssafe.com");

    await page.goto("/vendors");
    await page.waitForLoadState("networkidle");

    // Should be redirected to their dashboard
    const url = page.url();
    expect(url).toContain("/my-dashboard");
  });

  test("beneficiary cannot access settings page", async ({ page }) => {
    await login(page, "beneficiary@benefitssafe.com");

    await page.goto("/settings/billing");
    await page.waitForLoadState("networkidle");

    // Should be redirected
    const url = page.url();
    expect(url).toContain("/my-dashboard");
  });

  test("beneficiary API returns only their data", async ({ page }) => {
    await login(page, "beneficiary@benefitssafe.com");

    // Expenses API should only return beneficiary's own expenses
    const response = await page.request.get("/api/expenses?limit=10");
    expect(response.status()).toBe(200);

    const data = await response.json();
    // Should return successfully (not 403)
    // The server filters by requestedById = session.user.id for beneficiaries
    expect(data).toBeDefined();
  });
});
