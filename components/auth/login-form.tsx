'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useLoading } from '@/contexts/LoadingContext'
import { loginSchema } from '@/lib/zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail, RefreshCw, ShieldCheck } from 'lucide-react'
import { signIn, useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'
import { handleLoginAction } from './actions/login'
import SocialLogin from './social-login'

const LoginForm = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { loading, setLoading } = useLoading()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  // Plan param from URL or persisted from registration (survives email verification redirect)
  const urlPlan = searchParams.get('plan')
  const storedPlan = typeof window !== 'undefined'
    ? (() => { try { return localStorage.getItem('benefitssafe_selected_plan'); } catch { return null; } })()
    : null
  const planParam = urlPlan || storedPlan
  const { update: updateSession } = useSession()

  // Email verification state
  const [emailNotVerified, setEmailNotVerified] = useState(false)
  const [resendingVerification, setResendingVerification] = useState(false)

  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaUserId, setMfaUserId] = useState<string | null>(null)
  const [mfaToken, setMfaToken] = useState('')
  const [mfaVerifying, setMfaVerifying] = useState(false)

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    setLoading(true)
    setIsSubmitting(true)

    startTransition(async () => {
      try {
        if (!formRef.current) return

        const formData = new FormData(formRef.current)
        const res = await handleLoginAction(formData)

        if (res?.error) {
          if (res.error === 'EMAIL_NOT_VERIFIED') {
            setEmailNotVerified(true)
            setLoading(false)
            setIsSubmitting(false)
            return
          }
          toast.error(res.error)
          setLoading(false)
          setIsSubmitting(false)
          return
        }

        // Use redirect: false so we can check for MFA
        const signInResult = await signIn('credentials', {
          redirect: false,
          email: values.email,
          password: values.password,
        })

        if (signInResult?.error) {
          toast.error('Invalid email or password.')
          setLoading(false)
          setIsSubmitting(false)
        } else if (signInResult?.ok) {
          // Check session for MFA pending status
          const sessionRes = await fetch('/api/auth/session')
          const sessionData = await sessionRes.json()

          if (sessionData?.user?.mfaPending) {
            setMfaRequired(true)
            setMfaUserId(sessionData.user.id)
            setLoading(false)
            setIsSubmitting(false)
          } else {
            // Record login device fingerprint (fire-and-forget)
            fetch('/api/auth/record-login', { method: 'POST' }).catch(() => {})
            toast.success('Login successful!')
            // Hard redirect -- plan param goes to billing, otherwise dashboard
            const paidPlans = ['seed', 'core', 'network', 'enterprise']
            const redirectUrl = planParam && paidPlans.includes(planParam)
              ? `/settings/billing?plan=${planParam}`
              : '/dashboard'
            // Clear stored plan so it doesn't persist across sessions
            try { localStorage.removeItem('benefitssafe_selected_plan'); } catch {}
            window.location.href = redirectUrl
            return
          }
        }
      } catch {
        toast.error('Something went wrong. Please try again.')
        setLoading(false)
        setIsSubmitting(false)
      }
    })
  }

  const handleMfaVerify = async () => {
    if (!mfaToken.trim() || !mfaUserId) return

    setMfaVerifying(true)
    try {
      const res = await fetch('/api/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: mfaUserId, token: mfaToken.trim() }),
      })

      const data = await res.json()

      if (data.verified) {
        // Clear the mfaPending flag in the session
        await updateSession({ mfaPending: false })
        // Record login device fingerprint (fire-and-forget)
        fetch('/api/auth/record-login', { method: 'POST' }).catch(() => {})
        toast.success('Login successful!')
        const paidPlans = ['seed', 'core', 'network', 'enterprise']
        const mfaRedirect = planParam && paidPlans.includes(planParam)
          ? `/settings/billing?plan=${planParam}`
          : '/dashboard'
        try { localStorage.removeItem('benefitssafe_selected_plan'); } catch {}
        router.push(mfaRedirect)
      } else {
        toast.error(data.error || 'Invalid verification code.')
        setMfaToken('')
      }
    } catch {
      toast.error('Verification failed. Please try again.')
    } finally {
      setMfaVerifying(false)
    }
  }

  const handleResendVerification = async () => {
    const email = form.getValues('email')
    if (!email) {
      toast.error('Please enter your email address first.')
      return
    }

    setResendingVerification(true)
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (res.ok) {
        toast.success('Verification email sent! Please check your inbox.')
      } else {
        toast.error(data.error || 'Could not resend verification email.')
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setResendingVerification(false)
    }
  }

  // Email not verified step
  if (emailNotVerified) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <AlertCircle className="w-6 h-6 text-yellow-600" />
          <h4 className="font-semibold">Email Not Verified</h4>
        </div>
        <p className="text-neutral-500 dark:text-neutral-300 text-sm">
          Please verify your email address before signing in. Check your inbox for the verification link.
        </p>

        <Button
          type="button"
          onClick={handleResendVerification}
          className="w-full rounded-lg h-[52px] text-sm"
          disabled={resendingVerification}
        >
          {resendingVerification ? (
            <>
              <Loader2 className="animate-spin h-4.5 w-4.5 mr-2" />
              Sending...
            </>
          ) : (
            <>
              <RefreshCw className="h-4.5 w-4.5 mr-2" />
              Resend Verification Email
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setEmailNotVerified(false)
          }}
          className="w-full text-sm text-neutral-500 hover:text-neutral-700"
        >
          Back to login
        </Button>
      </div>
    )
  }

  // MFA verification step
  if (mfaRequired) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <h4 className="font-semibold">Two-Factor Authentication</h4>
        </div>
        <p className="text-neutral-500 dark:text-neutral-300 text-sm">
          Enter the 6-digit code from your authenticator app, or use a backup recovery code.
        </p>

        <div className="relative">
          <ShieldCheck className="absolute start-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-700 dark:text-neutral-200" />
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            value={mfaToken}
            onChange={(e) => setMfaToken(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleMfaVerify()
              }
            }}
            className="ps-13 pe-12 h-14 rounded-xl bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary !shadow-none !ring-0 text-center text-lg tracking-widest"
            maxLength={9}
            autoFocus
          />
        </div>

        <Button
          type="button"
          onClick={handleMfaVerify}
          className="w-full rounded-lg h-[52px] text-sm"
          disabled={mfaVerifying || !mfaToken.trim()}
        >
          {mfaVerifying ? (
            <>
              <Loader2 className="animate-spin h-4.5 w-4.5 mr-2" />
              Verifying...
            </>
          ) : (
            'Verify'
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setMfaRequired(false)
            setMfaUserId(null)
            setMfaToken('')
          }}
          className="w-full text-sm text-neutral-500 hover:text-neutral-700"
        >
          Back to login
        </Button>
      </div>
    )
  }

  return (
    <>
      <Form {...form}>
        <form
          ref={formRef}
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-5"
        >
          {/* Email Field */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute start-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-700 dark:text-neutral-200" />
                    <Input
                      {...field}
                      type="email"
                      placeholder="Email"
                      name="email"
                      className="ps-13 pe-12 h-14 rounded-xl bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary !shadow-none !ring-0"
                      disabled={loading}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Password Field */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute start-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-700 dark:text-neutral-200" />
                    <Input
                      {...field}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      name="password"
                      className="ps-13 pe-12 h-14 rounded-xl bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary dark:focus:border-primary focus-visible:border-primary !shadow-none !ring-0"
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 !p-0 bg-transparent hover:bg-transparent text-muted-foreground h-[unset]"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Remember Me & Forgot Password */}
          <div className="mt-2 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                className="border border-neutral-500 w-4.5 h-4.5"
              />
              <label htmlFor="remember" className="text-sm">
                Remember me
              </label>
            </div>
            <Link
              href="/auth/forgot-password"
              className="text-primary font-medium hover:underline text-sm"
            >
              Forgot Password?
            </Link>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full rounded-lg h-[52px] text-sm mt-2"
            disabled={loading || isPending}
          >
            {isSubmitting || isPending ? (
              <>
                <Loader2 className="animate-spin h-4.5 w-4.5 mr-2" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      </Form>

      {/* Divider */}
      <div className="mt-8 relative text-center before:absolute before:w-full before:h-px before:bg-neutral-300 dark:before:bg-slate-600 before:top-1/2 before:left-0">
        <span className="relative z-10 px-4 bg-white dark:bg-slate-900 text-base">
          Or sign in with
        </span>
      </div>

      {/* Social Login */}
      <SocialLogin />

      {/* Signup Prompt */}
      <div className="mt-8 text-center text-sm">
        <p>
          Don&apos;t have an account?{' '}
          <Link
            href="/auth/register"
            className="text-primary font-semibold hover:underline"
          >
            Sign Up
          </Link>
        </p>
      </div>
    </>
  )
}

export default LoginForm
