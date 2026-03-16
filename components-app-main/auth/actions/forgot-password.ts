'use server'

import { z } from 'zod'
import { forgotPasswordSchema } from '@/lib/zod'

export async function handleForgotPasswordAction(formData: FormData) {
  const email = formData.get('email')
  const parsed = forgotPasswordSchema.safeParse({ email })

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.flatten().fieldErrors,
    }
  }

  console.log(`Password reset email sent to ${parsed.data.email}`)

  return {
    success: true,
  }
}
