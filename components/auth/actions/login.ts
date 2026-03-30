'use server'

import { prisma } from '@/lib/db'

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

  // Check email verification status before attempting sign-in
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { emailVerified: true, passwordHash: true },
  })

  // Only check verification if user exists and has a password (credentials user).
  // Do not reveal whether the account exists -- let NextAuth handle invalid creds.
  if (user && user.passwordHash && !user.emailVerified) {
    return { error: 'EMAIL_NOT_VERIFIED' }
  }

  return { success: true }
}
