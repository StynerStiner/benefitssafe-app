#!/usr/bin/env node
// BSRS Ch 8 P5 — Stripe circuit-breaker chaos toggle.
//
// Writes /tmp/bs-chaos-stripe.json flagging the Stripe circuit as
// "forced open." App-side instrumentation (P5b — NOT shipped in
// this P5 foundations commit) in lib/stripe-circuit.ts would check
// for this flag at the top of each outbound Stripe call and treat
// the circuit as open. Without P5b this script is a prerequisite
// validator — see docs/runbooks/quarterly-game-day.md §Scenario B
// for manual alternatives (corrupt STRIPE_SECRET_KEY, block
// api.stripe.com via /etc/hosts, etc.).
//
// Run:
//   CHAOS_ENABLED=true node scripts/chaos/stripe-down.mjs --on
//   CHAOS_ENABLED=true node scripts/chaos/stripe-down.mjs --off
//
// Exit 0 on success, 1 on missing CHAOS_ENABLED or CLI error,
// 2 on filesystem error.

import { writeFileSync, unlinkSync, existsSync } from 'node:fs';

// BSRS Ch 8 P5 FM-2 — hard gate. See aurora-slow.mjs for rationale.
if (process.env.CHAOS_ENABLED !== 'true') {
  console.error('[chaos] CHAOS_ENABLED=true is required. Refusing to run.');
  console.error('[chaos] This is a safety gate — set CHAOS_ENABLED=true');
  console.error('[chaos] in your shell only during a game day or local');
  console.error('[chaos] development, never in a production shell.');
  process.exit(1);
}

const FLAG = '/tmp/bs-chaos-stripe.json';
const action = process.argv[2] || '--on';

if (action === '--on') {
  try {
    writeFileSync(
      FLAG,
      JSON.stringify({ circuitOpen: true, since: new Date().toISOString() }),
    );
  } catch (err) {
    console.error(`[chaos] failed to write ${FLAG}:`, err.message);
    process.exit(2);
  }
  console.log(`[chaos] Stripe circuit forced OPEN via ${FLAG}.`);
  console.log('[chaos] App-side integration (P5b) in lib/stripe-circuit.ts');
  console.log('[chaos] reads this file at the top of each outbound call.');
  console.log('[chaos] Without P5b, use the manual alternatives in');
  console.log('[chaos] docs/runbooks/quarterly-game-day.md §Scenario B.');
  console.log(`[chaos] To stop: CHAOS_ENABLED=true node ${process.argv[1]} --off`);
} else if (action === '--off') {
  if (existsSync(FLAG)) {
    try {
      unlinkSync(FLAG);
    } catch (err) {
      console.error(`[chaos] failed to remove ${FLAG}:`, err.message);
      process.exit(2);
    }
    console.log('[chaos] Stripe circuit chaos cleared.');
  } else {
    console.log(`[chaos] ${FLAG} not present — nothing to clear.`);
  }
} else {
  console.error(`[chaos] unknown action: ${action}`);
  console.error('[chaos] valid: --on, --off');
  process.exit(1);
}
