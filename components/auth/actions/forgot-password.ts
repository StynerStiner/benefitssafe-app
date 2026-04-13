'use server'

import { forgotPasswordSchema } from '@/lib/zod'

// Server action that hits the /api/auth/forgot-password route. The API
// always returns 200 with a generic message regardless of whether the
// email is registered — we mirror that here so the UI can never leak
// account existence.
export async function handleForgotPasswordAction(formData: FormData) {
  const email = formData.get('email')
  const parsed = forgotPasswordSchema.safeParse({ email })

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001'
    await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: parsed.data.email }),
      cache: 'no-store',
    })
  } catch (err) {
    console.error('[forgot-password action] fetch failed:', err)
    // Still return success — we don't want transient network errors to
    // become an account-enumeration oracle.
  }

  return { success: true }
}
