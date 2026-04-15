import { redirect } from "next/navigation";

// Dead WowDash template route. Original file was a hardcoded mock email
// thread with no DB integration and unwired action buttons. Redirect to
// the real notifications list so anyone with a cached bookmark lands on
// something that works.
export default function NotificationDetailPage() {
  redirect("/notifications");
}
