'use server';

export async function handleProfileUpdate(formData: FormData) {
  const name = formData.get('name');
  const email = formData.get('email');
  const phone = formData.get('number');
  const department = formData.get('department');
  const designation = formData.get('designation');
  const language = formData.get('language');
  const description = formData.get('desc');
}
