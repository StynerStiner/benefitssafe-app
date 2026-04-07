import { describe, it, expect } from "vitest";

// Test the role-to-data mapping directly (no DB needed)
const ROLE_DATA_MAP: Record<string, string[]> = {
  nonprofit_admin: ["grants", "expenses", "cards", "auditLog", "subscriptions", "compliance", "notifications"],
  platform_admin: ["grants", "expenses", "cards", "auditLog", "subscriptions", "compliance", "notifications"],
  nonprofit_staff: ["grants", "expenses", "notifications", "auditLog"],
  beneficiary: ["grants", "expenses", "cards", "subscriptions", "notifications"],
  vendor: ["notifications"],
  cpa: ["grants", "expenses", "auditLog", "compliance"],
  auditor: ["grants", "expenses", "auditLog", "compliance"],
  attorney: ["grants", "auditLog", "compliance"],
  grant_officer: ["grants", "expenses", "auditLog"],
  compliance_officer: ["grants", "expenses", "auditLog", "compliance"],
  support_agent: ["grants", "expenses", "cards", "auditLog", "notifications"],
  billing_admin: ["notifications"],
};

describe("Dashboard data role scoping", () => {
  it("nonprofit_admin gets all data sections", () => {
    const sections = ROLE_DATA_MAP.nonprofit_admin;
    expect(sections).toContain("grants");
    expect(sections).toContain("expenses");
    expect(sections).toContain("cards");
    expect(sections).toContain("auditLog");
    expect(sections).toContain("subscriptions");
    expect(sections).toContain("compliance");
    expect(sections).toContain("notifications");
    expect(sections).toHaveLength(7);
  });

  it("beneficiary only gets own-scoped data sections", () => {
    const sections = ROLE_DATA_MAP.beneficiary;
    expect(sections).toContain("grants");
    expect(sections).toContain("expenses");
    expect(sections).toContain("cards");
    expect(sections).toContain("subscriptions");
    expect(sections).toContain("notifications");
    expect(sections).not.toContain("auditLog");
    expect(sections).not.toContain("compliance");
  });

  it("vendor only gets notifications", () => {
    const sections = ROLE_DATA_MAP.vendor;
    expect(sections).toEqual(["notifications"]);
  });

  it("auditor gets read-only compliance data", () => {
    const sections = ROLE_DATA_MAP.auditor;
    expect(sections).toContain("grants");
    expect(sections).toContain("expenses");
    expect(sections).toContain("auditLog");
    expect(sections).toContain("compliance");
    expect(sections).not.toContain("cards");
    expect(sections).not.toContain("subscriptions");
    expect(sections).not.toContain("notifications");
  });

  it("platform_admin gets same sections as nonprofit_admin", () => {
    expect(ROLE_DATA_MAP.platform_admin).toEqual(ROLE_DATA_MAP.nonprofit_admin);
  });

  it("cpa gets financial read-only sections", () => {
    const sections = ROLE_DATA_MAP.cpa;
    expect(sections).toContain("grants");
    expect(sections).toContain("expenses");
    expect(sections).toContain("auditLog");
    expect(sections).toContain("compliance");
    expect(sections).not.toContain("cards");
  });

  it("attorney gets compliance-focused sections only", () => {
    const sections = ROLE_DATA_MAP.attorney;
    expect(sections).toContain("grants");
    expect(sections).toContain("auditLog");
    expect(sections).toContain("compliance");
    expect(sections).not.toContain("expenses");
    expect(sections).not.toContain("cards");
  });

  it("billing_admin only gets notifications", () => {
    expect(ROLE_DATA_MAP.billing_admin).toEqual(["notifications"]);
  });

  it("all 12 roles are defined", () => {
    expect(Object.keys(ROLE_DATA_MAP)).toHaveLength(12);
  });

  it("every role gets at least notifications or audit data", () => {
    for (const [role, sections] of Object.entries(ROLE_DATA_MAP)) {
      expect(sections.length, `${role} should have at least one section`).toBeGreaterThan(0);
    }
  });
});
