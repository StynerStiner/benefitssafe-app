"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

// Shape persisted on User.alertPreferences. Kept intentionally open so
// the UI can add channels or per-event toggles later without another
// migration. Current channels: mail, sms, push.
export interface AlertPreferences {
  mail: { enabled: boolean; message: string };
  sms: { enabled: boolean; message: string };
  push: { enabled: boolean; message: string };
}

export const DEFAULT_ALERT_PREFERENCES: AlertPreferences = {
  mail: { enabled: true, message: "" },
  sms: { enabled: false, message: "" },
  push: { enabled: false, message: "" },
};

function coerceChannel(
  enabledRaw: FormDataEntryValue | null,
  messageRaw: FormDataEntryValue | null,
): { enabled: boolean; message: string } {
  // A checkbox that's unchecked is simply absent from FormData; an "on"
  // value (or anything truthy) means the user toggled it.
  const enabled = enabledRaw !== null && enabledRaw !== "";
  const message = typeof messageRaw === "string" ? messageRaw.slice(0, 2000) : "";
  return { enabled, message };
}

export async function handleNotificationForm(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Not signed in" };
  }

  const prefs: AlertPreferences = {
    mail: coerceChannel(formData.get("mail_switch"), formData.get("mail_message")),
    sms: coerceChannel(formData.get("sms_switch"), formData.get("sms_message")),
    push: coerceChannel(formData.get("push_switch"), formData.get("push_message")),
  };

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      // Prisma Json field: pass the object directly — no JSON.stringify.
      data: { alertPreferences: prefs as unknown as object },
    });

    // Write to the audit log (non-blocking; failure here is a logging issue,
    // not a user-visible failure).
    prisma.auditLog
      .create({
        data: {
          userId: session.user.id,
          organizationId: session.user.organizationId,
          action: "update",
          entityType: "user_alert_preferences",
          entityId: session.user.id,
          newValue: prefs as unknown as object,
        },
      })
      .catch(() => {});
  } catch (err) {
    console.error("[alert-preferences] persist failed:", err);
    return { ok: false, error: "Failed to save. Please try again." };
  }

  // Revalidate so a subsequent GET re-reads the updated row from the DB.
  revalidatePath("/alert-preferences");
  return { ok: true };
}

/**
 * Read the current preferences for the signed-in user, filling in any
 * missing channels with defaults so the form always has a complete shape.
 */
export async function getAlertPreferences(): Promise<AlertPreferences> {
  const session = await auth();
  if (!session?.user?.id) return DEFAULT_ALERT_PREFERENCES;

  try {
    const row = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { alertPreferences: true },
    });

    const stored = (row?.alertPreferences ?? {}) as Partial<AlertPreferences>;
    return {
      mail: { ...DEFAULT_ALERT_PREFERENCES.mail, ...(stored.mail ?? {}) },
      sms: { ...DEFAULT_ALERT_PREFERENCES.sms, ...(stored.sms ?? {}) },
      push: { ...DEFAULT_ALERT_PREFERENCES.push, ...(stored.push ?? {}) },
    };
  } catch (err) {
    console.error("[alert-preferences] read failed:", err);
    return DEFAULT_ALERT_PREFERENCES;
  }
}
