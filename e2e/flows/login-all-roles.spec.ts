import { test, expect } from "@playwright/test";
import { login } from "../helpers/auth";

const roles = [
  { email: "admin@benefitssafe.com", label: "nonprofit_admin", expectedUrl: "/dashboard" },
  { email: "founder@benefitssafe.com", label: "platform_admin", expectedUrl: "/customers" },
  { email: "staff@benefitssafe.com", label: "nonprofit_staff", expectedUrl: "/dashboard" },
  { email: "beneficiary@benefitssafe.com", label: "beneficiary", expectedUrl: "/my-dashboard" },
  { email: "vendor@benefitssafe.com", label: "vendor", expectedUrl: "/vendor-dashboard" },
  { email: "auditor@benefitssafe.com", label: "auditor", expectedUrl: "/audit-trail" },
  { email: "cpa@benefitssafe.com", label: "cpa", expectedUrl: "/reports" },
  { email: "attorney@benefitssafe.com", label: "attorney", expectedUrl: "/compliance" },
  { email: "grantofficer@benefitssafe.com", label: "grant_officer", expectedUrl: "/grants" },
  { email: "compliance@benefitssafe.com", label: "compliance_officer", expectedUrl: "/compliance" },
  { email: "support@benefitssafe.com", label: "support_agent", expectedUrl: "/support" },
  { email: "billing@benefitssafe.com", label: "billing_admin", expectedUrl: "/settings" },
];

for (const role of roles) {
  test(`${role.label} (${role.email}) logs in and reaches correct dashboard`, async ({ page }) => {
    await login(page, role.email);

    // Verify URL contains the expected path
    const url = page.url();
    expect(url).toContain(role.expectedUrl);

    // Verify no crash / 500 error page
    const body = await page.textContent("body");
    expect(body).not.toContain("Internal Server Error");
    expect(body).not.toContain("Application error");
  });
}
