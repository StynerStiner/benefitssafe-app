// @ts-nocheck
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY not set — Stripe features will be unavailable");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_REMOVED_PLACEHOLDER", {
  apiVersion: "2024-04-10",
});
