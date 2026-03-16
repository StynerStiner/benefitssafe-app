'use server';

import { redirect } from "next/navigation";
import { createPasswordSchema } from "@/lib/zod";

export async function handleResetPassword(formData: FormData) {
  const values = {
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    acceptTerms: formData.get("acceptTerms") === "on",
  };

  const result = createPasswordSchema.safeParse(values);

  if (!result.success) {
    throw new Error("Validation failed.");
  }

  console.log("Password reset values:", result.data);

  redirect("/auth/login");
}
