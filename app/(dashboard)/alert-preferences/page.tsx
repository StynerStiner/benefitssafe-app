import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { getAlertPreferences } from "./actions";
import AlertPreferencesForm from "./alert-preferences-form";

// Server component: reads the signed-in user's stored preferences from
// the DB on every navigation, so the form always hydrates with the
// latest persisted values. The form itself is a client component that
// submits the server action in actions.ts.
export default async function AlertPreferencesPage() {
  const prefs = await getAlertPreferences();

  return (
    <>
      <DashboardBreadcrumb title="Notification Alert" text="Notification Alert" />
      <AlertPreferencesForm initialPrefs={prefs} />
    </>
  );
}
