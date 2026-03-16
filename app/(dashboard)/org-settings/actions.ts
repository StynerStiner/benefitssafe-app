'use server'

export async function saveProfileAction(formData: FormData) {
  const name = formData.get("name");
  const email = formData.get("email");
  const number = formData.get("number");
  const website = formData.get("website");
  const country = formData.get("country");
  const city = formData.get("city");
  const state = formData.get("state");
}
