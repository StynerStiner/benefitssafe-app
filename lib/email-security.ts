import { z } from "zod";

const emailSchema = z.string().email().max(254);

// Domains that should NEVER receive BenefitsSafe system emails
// (prevents email injection / header injection attacks)
const BLOCKED_DOMAINS = [
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "throwaway.email",
  "yopmail.com",
  "sharklasers.com",
  "guerrillamailblock.com",
  "grr.la",
  "discard.email",
  "trashmail.com",
];

export function validateRecipientEmail(
  email: string
): { valid: boolean; reason?: string } {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return { valid: false, reason: "Invalid email format" };
  }

  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) {
    return { valid: false, reason: "Missing email domain" };
  }

  if (BLOCKED_DOMAINS.includes(domain)) {
    return { valid: false, reason: "Disposable email addresses are not allowed" };
  }

  // Check for email header injection (newlines in email)
  if (
    email.includes("\n") ||
    email.includes("\r") ||
    email.includes("%0a") ||
    email.includes("%0d")
  ) {
    return { valid: false, reason: "Invalid characters in email" };
  }

  return { valid: true };
}

export function sanitizeEmailForLog(email: string): string {
  // Mask email for audit logs: j***@domain.com
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***";
  return `${local[0]}***@${domain}`;
}

export function buildSecureLink(path: string): string {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3001";
  // Never allow user input to control the base URL
  const url = new URL(path, baseUrl);
  // Force HTTPS in production
  if (process.env.NODE_ENV === "production") {
    url.protocol = "https:";
  }
  return url.toString();
}
