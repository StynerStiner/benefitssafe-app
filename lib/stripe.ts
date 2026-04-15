// @ts-nocheck
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY not set — Stripe features will be unavailable");
}

// DDIA Ch8 Distributed Systems audit — explicit client config.
//
// Stripe-node defaults: timeout=80s, maxNetworkRetries=0. That timeout
// exceeds Vercel's 10-60s function budget and the zero retries means a
// single TCP reset against Stripe's edge bubbles as a 5xx to the user.
// Neither default is safe for fintech operations.
//
//   timeout: 8000        — below Vercel's 10s free-tier limit; leaves
//                          headroom for retries + our own DB writes.
//   maxNetworkRetries: 2 — retries transient network errors only
//                          (connection reset, DNS, 500s from Stripe).
//                          Stripe-node applies exponential backoff
//                          internally and respects Idempotency-Key so
//                          our deterministic keys (added in Ch7) make
//                          retries safe on money-moving calls.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_REMOVED_PLACEHOLDER", {
  apiVersion: "2024-04-10",
  timeout: 8000,
  maxNetworkRetries: 2,
});
