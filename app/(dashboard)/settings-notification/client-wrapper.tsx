"use client";

import dynamic from "next/dynamic";

const FirebaseSettingsForm = dynamic(() => import("./firebase-form"), {
    ssr: false,
});

export default function ClientFirebaseWrapper() {
    return <FirebaseSettingsForm />
}
