"use client";

import ValidateForm from "@/app/(dashboard)/form-validation/validate-form";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import type { Metadata } from "next";
import { Suspense } from "react";

const metadata: Metadata = {
    title: "Form Validation & Input Handling | BenefitsSafe Admin Dashboard",
    description:
        "Implement robust form validation and input handling techniques in the BenefitsSafe Admin Dashboard built with Next.js and Tailwind CSS.",
};

const FormValidation = () => {
    return (
        <>
            <DashboardBreadcrumb title="Form Validation" text="Form Validation" />

            <Suspense fallback={<LoadingSkeleton />}>
                <ValidateForm />
            </Suspense>

        </>
    );
};

export default FormValidation;
