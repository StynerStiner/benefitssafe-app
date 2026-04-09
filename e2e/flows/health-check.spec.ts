import { test, expect } from "@playwright/test";

test.describe("Health Check", () => {
  test("GET /api/health returns 200 without authentication", async ({
    request,
  }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
  });

  test("health check responds within 5 seconds", async ({ request }) => {
    const start = Date.now();
    const response = await request.get("/api/health");
    const elapsed = Date.now() - start;

    expect(response.status()).toBe(200);
    expect(elapsed).toBeLessThan(5000);
  });
});
