'use server'

export const handleLoginAction = async (formData: FormData) => {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  // (Optional) Validate credentials format
  if (!email.includes('@')) {
    return { error: 'Invalid email format.' }
  }

  // You can optionally log or validate against DB here
  return { success: true }
}
