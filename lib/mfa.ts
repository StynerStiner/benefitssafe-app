import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from "otplib";
import crypto from "crypto";

const APP_NAME = "BenefitsSafe";

// Create a single TOTP instance with plugins configured
const totp = new TOTP({
  crypto: new NobleCryptoPlugin(),
  base32: new ScureBase32Plugin(),
});

/**
 * Generates a new TOTP secret and the corresponding otpauth URL
 * for use with authenticator apps (Google Authenticator, Authy, etc.)
 */
export function generateMfaSecret(email: string): {
  secret: string;
  otpauthUrl: string;
} {
  const secret = totp.generateSecret();
  const otpauthUrl = totp.toURI({ secret, issuer: APP_NAME, label: email });
  return { secret, otpauthUrl };
}

/**
 * Verifies a TOTP token against the stored secret.
 * Uses epochTolerance of 30 seconds for clock drift tolerance (1 period).
 */
export async function verifyMfaToken(
  secret: string,
  token: string,
): Promise<boolean> {
  try {
    const result = await totp.verify(token, { secret, epochTolerance: 30 });
    return result.valid;
  } catch {
    return false;
  }
}

/**
 * Generates 10 random backup/recovery codes.
 * Each code is 8 hex characters (4 bytes), formatted as XXXX-XXXX.
 * Returns both the plain codes (shown to user once) and hashed versions (stored in DB).
 */
export function generateBackupCodes(): {
  plainCodes: string[];
  hashedCodes: string[];
} {
  const plainCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < 10; i++) {
    const raw = crypto.randomBytes(4).toString("hex").toUpperCase();
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    plainCodes.push(formatted);
    hashedCodes.push(hashBackupCode(formatted));
  }

  return { plainCodes, hashedCodes };
}

/**
 * Hashes a backup code for secure storage using SHA-256.
 */
export function hashBackupCode(code: string): string {
  return crypto
    .createHash("sha256")
    .update(code.replace("-", "").toUpperCase())
    .digest("hex");
}

/**
 * Verifies a backup code against the stored hashed codes.
 * Returns the index of the matched code (for removal) or -1 if not found.
 */
export function verifyBackupCode(
  code: string,
  hashedCodes: string[],
): number {
  const hashed = hashBackupCode(code);
  return hashedCodes.indexOf(hashed);
}
