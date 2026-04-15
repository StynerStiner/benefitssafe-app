import { redirect } from "next/navigation";

// Dead WowDash template route — the original was a Firebase-based
// notification settings stub that never persisted anything. Redirect
// to the real preferences page so anyone with a stale link or a
// cached bookmark lands on something that works.
export default function SettingsNotificationPage() {
  redirect("/alert-preferences");
}
