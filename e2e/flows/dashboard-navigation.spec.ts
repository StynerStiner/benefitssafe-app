import { test, expect } from "@playwright/test";
import { login } from "../helpers/auth";

test.describe("Dashboard Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin@benefitssafe.com");
  });

  test("dashboard page loads without errors", async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
  });

  test("navigating to grants page works", async ({ page }) => {
    await page.goto("/grants");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
    expect(body).not.toContain("Application error");
  });

  test("navigating to expenses page works", async ({ page }) => {
    await page.goto("/expenses");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
  });

  test("navigating to virtual cards page works", async ({ page }) => {
    await page.goto("/virtual-cards");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
  });

  test("navigating to beneficiaries page works", async ({ page }) => {
    await page.goto("/beneficiaries");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
  });

  test("navigating to vendors page works", async ({ page }) => {
    await page.goto("/vendors");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
  });

  test("navigating to audit trail works", async ({ page }) => {
    await page.goto("/audit-trail");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
  });

  test("navigating to settings works", async ({ page }) => {
    await page.goto("/settings/billing");
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
  });
});
