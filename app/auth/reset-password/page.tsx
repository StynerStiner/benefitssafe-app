"use client";

import ResetPasswordComponent from "@/components/auth/reset-password-component";
import LogoIcon from "@/public/assets/images/benefitssafe-logo-icon.png";
import AuthImage from "@/public/assets/images/auth/forgot-pass-img.png";
import Image from "next/image";
import { Suspense } from "react";

const ResetPasswordPage = () => {
  return (
    <section className="bg-white dark:bg-slate-900 flex flex-wrap min-h-screen">
      {/* Left Image */}
      <div className="lg:w-1/2 hidden lg:block">
        <div className="flex items-center justify-center h-screen flex-col">
          <Image
            src={AuthImage}
            alt="Auth Illustration"
            className="object-cover w-full h-full"
          />
        </div>
      </div>

      {/* Right Form */}
      <div className="lg:w-1/2 w-full py-8 px-6 flex flex-col justify-center">
        <div className="lg:max-w-[464px] w-full mx-auto">
          {/* Logo and heading */}
          <div>
            <div className="mb-6 flex items-center gap-3">
              <Image
                src={LogoIcon}
                alt="BenefitsSafe"
                width={48}
                height={48}
                priority
                className="object-contain"
              />
              <div>
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-white leading-none">
                  BenefitsSafe
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Protecting Health, Security, and Growth.
                </p>
              </div>
            </div>

            <h4 className="font-semibold mb-3">Set a new password</h4>
            <p className="mb-8 text-neutral-500 dark:text-neutral-300 text-base">
              Choose a strong password. We&apos;ll sign you out of every device
              so you can log back in with the new password.
            </p>
          </div>

          <Suspense fallback={<div className="text-sm text-neutral-500">Loading…</div>}>
            <ResetPasswordComponent />
          </Suspense>
        </div>
      </div>
    </section>
  );
};

export default ResetPasswordPage;
