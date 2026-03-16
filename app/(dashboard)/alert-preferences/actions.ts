"use server";

export async function handleNotificationForm(formData: FormData) {
  const message = formData.get("message");
  const status = formData.get("status");
  // Save to database, send to API, etc.
}
