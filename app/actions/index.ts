"use server"

import { signIn, signOut } from "@/auth";

export async function doSocialLogin (formData:FormData) {
    const action = formData.get('action');
    await signIn(action as string, { redirectTo: '/dashboard' });
}

export async function doLogout () {
    await signOut();
}
