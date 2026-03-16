"use server";

import { registerSchema } from "@/lib/zod";

export async function registerUser(formData: FormData): Promise<
  | { success: true }
  | { error: string }
> {
  try {
    const username = formData.get("username")?.toString() ?? "";
    const email = formData.get("email")?.toString() ?? "";
    const password = formData.get("password")?.toString() ?? "";
    const acceptTerms = formData.get("acceptTerms") === "on";

    const result = registerSchema.safeParse({
      username,
      email,
      password,
      acceptTerms,
    });

    if (!result.success) {
      const errorMessages = result.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      return { error: `Validation error: ${errorMessages}` };
    }

    await new Promise((res) => setTimeout(res, 1000));

    return { success: true };
  } catch (error) {
    console.error("Register error:", error);
    return { error: "Something went wrong during registration." };
  }
}

