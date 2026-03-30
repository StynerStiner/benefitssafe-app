"use client";

import CreatePasswordComponent from "@/components/auth/create-password-component";
import LogoIcon from "@/public/assets/images/logo-icon.png";
import AuthImage from "@/public/assets/images/auth/forgot-pass-img.png";
import { StaticImg } from "@/types/static-image";
import type { Metadata } from "next";
import Image from "next/image";

const metadata: Metadata = {
  title: "Create Password & Account Security | BenefitsSafe Admin Dashboard",
  description:
    "Set up and manage secure passwords for your account in the BenefitsSafe Admin Dashboard built with Next.js and Tailwind CSS.",
};

const forgotPassImage: StaticImg = {
  image: AuthImage,
};

const CreatePassword = () => {
  return (
    <section className="bg-white dark:bg-slate-900 flex flex-wrap min-h-screen">
      {/* Left Image */}
      <div className="lg:w-1/2 hidden lg:block">
        <div className="flex items-center justify-center h-screen flex-col">
          <Image
            src={forgotPassImage.image}
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
            <div className="mb-6 flex items-center gap-4">
              <Image
                src={LogoIcon}
                alt="BenefitsSafe"
                width={64}
                height={64}
                priority
                className="object-contain"
              />
              <div>
                <h2 className="text-3xl font-bold text-neutral-900 dark:text-white leading-tight">BenefitsSafe</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Protecting Health, Security, and Growth.</p>
              </div>
            </div>

            <h4 className="font-semibold mb-3">Create New Password</h4>
            <p className="mb-8 text-neutral-500 dark:text-neutral-300 text-lg">
              Enter your password to unlock the screen!
            </p>
          </div>

          {/* Form */}
          <CreatePasswordComponent />
        </div>
      </div>
    </section>
  );
};

export default CreatePassword;
