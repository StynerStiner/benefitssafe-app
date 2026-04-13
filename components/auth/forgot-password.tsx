'use client'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useLoading } from '@/contexts/LoadingContext'
import { forgotPasswordSchema } from '@/lib/zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Loader2, Mail } from 'lucide-react'
import Link from 'next/link'
import { useRef, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'
import { handleForgotPasswordAction } from './actions/forgot-password'

const ForgotPasswordComponent = () => {
  const { loading, setLoading } = useLoading()
  const [isPending, startTransition] = useTransition()
  const [submitted, setSubmitted] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  })

  const onSubmit = (_values: z.infer<typeof forgotPasswordSchema>) => {
    setLoading(true)

    startTransition(async () => {
      try {
        if (!formRef.current) return

        const formData = new FormData(formRef.current)
        const result = await handleForgotPasswordAction(formData)

        if (result?.success) {
          // Always show the same success state regardless of whether the
          // email is actually registered — avoids leaking account existence.
          setSubmitted(true)
        } else {
          toast.error('Please enter a valid email')
        }
      } catch (error) {
        console.error('Forgot password error:', error)
        toast.error('Something went wrong. Please try again.')
      } finally {
        setTimeout(() => setLoading(false), 1000)
      }
    })
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-5">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <p className="text-sm font-semibold text-green-700 dark:text-green-300">
            Check your inbox
          </p>
        </div>
        <p className="text-sm text-green-600 dark:text-green-400 mb-4">
          If an account with that email exists, we&apos;ve sent you a password
          reset link. The link expires in 60 minutes.
        </p>
        <div className="text-sm">
          <p>
            Remembered it?{' '}
            <Link href="/auth/login" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
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

          <Button
            type="submit"
            className="w-full rounded-lg h-[52px] text-sm mt-2"
            disabled={loading || isPending}
          >
            {loading || isPending ? (
              <>
                <Loader2 className="animate-spin h-4.5 w-4.5 mr-2" />
                Sending...
              </>
            ) : (
              'Send Recovery Email'
            )}
          </Button>
        </form>
      </Form>

      <div className="mt-8 text-center text-sm">
        <p>
          Forget it. Send me back to{' '}
          <Link
            href="/auth/login"
            className="text-primary font-semibold hover:underline"
          >
            Sign In
          </Link>
        </p>
      </div>
    </>
  )
}

export default ForgotPasswordComponent
