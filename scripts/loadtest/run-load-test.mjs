#!/usr/bin/env node
// BSRS Ch 8 P5 — zero-dep load-test runner.
//
// Targets the top-5 user-facing GET endpoints (dashboard, grants,
// beneficiaries, notifications, expenses) with configurable
// concurrency. Zero external dependencies — Node 22 built-in fetch +
// performance.now() only. The legacy scripts/load-test*.js k6 files
// remain for operators who want k6's advanced throttling; this script
// is the portable, CI-friendly alternative.
//
// Run:
//   node scripts/loadtest/run-load-test.mjs --smoke     (1 req/ep,   dry run)
//   node scripts/loadtest/run-load-test.mjs --baseline  (10 × 60s,   baseline run)
//   node scripts/loadtest/run-load-test.mjs --stress    (50 × 300s,  stress run)
//
// Env:
//   BASE_URL     default http://localhost:3000
//   AUTH_COOKIE  NextAuth session-token cookie value (optional; 401s
//                are emitted as JSON lines either way)
//
// Output:
//   stdout — one JSON line per request, e.g.
//     {"endpoint":"/api/grants","method":"GET","status":200,
//      "latencyMs":45.21,"timestamp":"2026-04-19T..."}
//   stderr — summary table after the run, e.g.
//     baseline test complete (60s, 10 concurrent)
//       endpoint                | count  | p50     | p95     | p99     | error%
//       /api/grants             |  1230  |  45.2ms | 120.1ms | 380.5ms | 0.1%
//
// Pipe stdout to a file for jq analysis:
//   node scripts/loadtest/run-load-test.mjs --baseline > results.jsonl
//   jq -s 'group_by(.endpoint) | ...' results.jsonl
//
// Exit 0 on completion, 1 on CLI or internal error, 2 on SIGINT
// (partial summary still emitted on SIGINT).

import { performance } from 'node:perf_hooks';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const AUTH_COOKIE = process.env.AUTH_COOKIE || '';
const MODE = process.argv[2] || '--smoke';

const MODES = {
  '--smoke': { concurrency: 1, durationMs: 0, label: 'smoke' },
  '--baseline': { concurrency: 10, durationMs: 60_000, label: 'baseline' },
  '--stress': { concurrency: 50, durationMs: 300_000, label: 'stress' },
};

const cfg = MODES[MODE];
if (!cfg) {
  console.error(`unknown mode: ${MODE}`);
  console.error(`valid modes: ${Object.keys(MODES).join(', ')}`);
  process.exit(1);
}

// BSRS Ch 8 P5 FM-1 — production-URL guard. 10-second countdown so
// Ctrl+C can abort before any traffic lands on a real customer.
if (/benefitssafe\.com/.test(BASE_URL)) {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('!!! WARNING: BASE_URL points at benefitssafe.com !!!');
  console.error('Production load testing requires operator approval,');
  console.error('off-peak scheduling, and must NOT use --stress mode.');
  console.error('Proceeding in 10 seconds. Ctrl+C now to abort.');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await new Promise((r) => setTimeout(r, 10_000));
}

const ENDPOINTS = [
  { method: 'GET', path: '/api/dashboard' },
  { method: 'GET', path: '/api/grants' },
  { method: 'GET', path: '/api/beneficiaries' },
  { method: 'GET', path: '/api/notifications' },
  { method: 'GET', path: '/api/expenses' },
];

const results = [];

async function oneRequest(ep) {
  const start = performance.now();
  const headers = {};
  if (AUTH_COOKIE) headers['Cookie'] = AUTH_COOKIE;
  let status = 0;
  let errorKind = null;
  try {
    const res = await fetch(`${BASE_URL}${ep.path}`, {
      method: ep.method,
      headers,
    });
    status = res.status;
    // Drain body so the connection returns to the pool cleanly.
    await res.arrayBuffer();
  } catch (err) {
    errorKind = err?.cause?.code || err?.code || err?.name || 'unknown';
  }
  const latencyMs = Math.round((performance.now() - start) * 100) / 100;
  const record = {
    endpoint: ep.path,
    method: ep.method,
    status,
    latencyMs,
    timestamp: new Date().toISOString(),
    ...(errorKind ? { errorKind } : {}),
  };
  results.push(record);
  process.stdout.write(JSON.stringify(record) + '\n');
}

async function worker(stopAt, workerIdx) {
  let i = workerIdx;
  while (Date.now() < stopAt) {
    await oneRequest(ENDPOINTS[i % ENDPOINTS.length]);
    i++;
  }
}

async function runSmoke() {
  for (const ep of ENDPOINTS) {
    await oneRequest(ep);
  }
}

async function runTimed(concurrency, durationMs) {
  const stopAt = Date.now() + durationMs;
  const workers = [];
  for (let i = 0; i < concurrency; i++) workers.push(worker(stopAt, i));
  await Promise.all(workers);
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

function emitSummary() {
  const byEp = new Map();
  for (const r of results) {
    if (!byEp.has(r.endpoint)) byEp.set(r.endpoint, []);
    byEp.get(r.endpoint).push(r);
  }
  const lines = [];
  lines.push('');
  lines.push(
    `${cfg.label} test complete (${cfg.durationMs / 1000}s, ` +
      `${cfg.concurrency} concurrent, BASE_URL=${BASE_URL})`,
  );
  lines.push('');
  const header =
    '  ' +
    'endpoint'.padEnd(26) +
    '| count  | p50      | p95      | p99      | error%';
  lines.push(header);
  lines.push('  ' + '-'.repeat(header.length - 2));
  for (const [ep, rs] of byEp) {
    const latencies = rs.map((r) => r.latencyMs);
    const errors = rs.filter((r) => r.status === 0 || r.status >= 500).length;
    const errPct = ((errors / rs.length) * 100).toFixed(1);
    lines.push(
      '  ' +
        ep.padEnd(26) +
        `| ${String(rs.length).padStart(6)} | ` +
        `${percentile(latencies, 0.5).toFixed(1).padStart(6)}ms | ` +
        `${percentile(latencies, 0.95).toFixed(1).padStart(6)}ms | ` +
        `${percentile(latencies, 0.99).toFixed(1).padStart(6)}ms | ` +
        `${errPct.padStart(4)}%`,
    );
  }
  lines.push('');
  process.stderr.write(lines.join('\n') + '\n');
}

process.on('SIGINT', () => {
  emitSummary();
  process.exit(2);
});

try {
  if (cfg.label === 'smoke') {
    await runSmoke();
  } else {
    await runTimed(cfg.concurrency, cfg.durationMs);
  }
  emitSummary();
  process.exit(0);
} catch (err) {
  console.error('internal error:', err);
  process.exit(1);
}
