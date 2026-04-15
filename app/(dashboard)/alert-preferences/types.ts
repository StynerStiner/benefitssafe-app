// Types + constants for the alert-preferences feature.
//
// Lives in a separate file (not actions.ts) because Next.js's "use server"
// directive requires that marked files only export async functions.
// Exporting a const or an object from a "use server" file is a build
// error: "A 'use server' file can only export async functions, found object."

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
