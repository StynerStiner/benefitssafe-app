#!/usr/bin/env node
// BSRS Ch 8 P5 — Aurora latency chaos toggle.
//
// Writes /tmp/bs-chaos-aurora.json with a per-query latency budget.
// App-side instrumentation (P5b — NOT shipped in this P5 foundations
// commit) reads the file on each Prisma operation and setTimeout()s
// the configured latency. Without P5b this script is a prerequisite
// validator — see docs/runbooks/quarterly-game-day.md §Scenario A
// for manual injection alternatives (AWS RDS Actions → Stop,
// iptables DROP on port 5432, tc qdisc for packet delay).
//
// Run:
//   CHAOS_ENABLED=true CHAOS_AURORA_LATENCY_MS=200 \
//     node scripts/chaos/aurora-slow.mjs --on
//   node scripts/chaos/aurora-slow.mjs --off
//
// Exit 0 on success, 1 on missing CHAOS_ENABLED or CLI error,
// 2 on filesystem error.

import { writeFileSync, unlinkSync, existsSync } from 'node:fs';

// BSRS Ch 8 P5 FM-2 — hard gate. Chaos scripts must never fire
// accidentally. CHAOS_ENABLED=true is a required, explicit opt-in
// that an operator sets per shell session during a game day.
if (process.env.CHAOS_ENABLED !== 'true') {
  console.error('[chaos] CHAOS_ENABLED=true is required. Refusing to run.');
  console.error('[chaos] This is a safety gate — set CHAOS_ENABLED=true');
  console.error('[chaos] in your shell only during a game day or local');
  console.error('[chaos] development, never in a production shell.');
  process.exit(1);
}

const FLAG = '/tmp/bs-chaos-aurora.json';
const action = process.argv[2] || '--on';

if (action === '--on') {
  const latencyMs = parseInt(process.env.CHAOS_AURORA_LATENCY_MS || '200', 10);
  if (!Number.isFinite(latencyMs) || latencyMs < 0) {
    console.error('[chaos] CHAOS_AURORA_LATENCY_MS must be a non-negative integer');
    process.exit(1);
  }
  try {
    writeFileSync(
      FLAG,
      JSON.stringify({ latencyMs, since: new Date().toISOString() }),
    );
  } catch (err) {
    console.error(`[chaos] failed to write ${FLAG}:`, err.message);
    process.exit(2);
  }
  console.log(`[chaos] Aurora latency ${latencyMs}ms armed via ${FLAG}.`);
  console.log('[chaos] App-side middleware (P5b) reads this file on each');
  console.log('[chaos] Prisma call. Without P5b, use the manual alternatives');
  console.log('[chaos] in docs/runbooks/quarterly-game-day.md §Scenario A.');
  console.log(`[chaos] To stop: CHAOS_ENABLED=true node ${process.argv[1]} --off`);
} else if (action === '--off') {
  if (existsSync(FLAG)) {
    try {
      unlinkSync(FLAG);
    } catch (err) {
      console.error(`[chaos] failed to remove ${FLAG}:`, err.message);
      process.exit(2);
    }
    console.log('[chaos] Aurora latency chaos cleared.');
  } else {
    console.log(`[chaos] ${FLAG} not present — nothing to clear.`);
  }
} else {
  console.error(`[chaos] unknown action: ${action}`);
  console.error('[chaos] valid: --on, --off');
  process.exit(1);
}
