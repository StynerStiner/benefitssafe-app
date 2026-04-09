/**
 * API Response Time Benchmark
 *
 * Usage: npx tsx scripts/benchmark-api.ts
 *
 * Hits key API endpoints and measures response times.
 * Requires the dev server running on localhost:3001.
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";

const endpoints = [
  { name: "Health", url: "/api/health", auth: false },
  { name: "Grants", url: "/api/grants?limit=10", auth: true },
  { name: "Expenses", url: "/api/expenses?limit=10", auth: true },
  { name: "Notifications", url: "/api/notifications?limit=10", auth: true },
  { name: "Audit Logs", url: "/api/audit-logs?limit=10", auth: true },
  { name: "Beneficiaries", url: "/api/beneficiaries?limit=10", auth: true },
  { name: "Vendors", url: "/api/vendors?limit=10", auth: true },
  { name: "Virtual Cards", url: "/api/virtual-cards?limit=10", auth: true },
  { name: "Billing Status", url: "/api/billing/status", auth: true },
];

const ITERATIONS = 10;

interface Result {
  name: string;
  min: number;
  max: number;
  avg: number;
  p95: number;
  p99: number;
  status: number;
  flag: string;
}

async function getSessionCookie(): Promise<string> {
  console.log("Authenticating...");
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const cookies = csrfRes.headers.get("set-cookie") || "";

  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies,
    },
    body: new URLSearchParams({
      csrfToken,
      email: "admin@benefitssafe.com",
      password: "TestDev2024!",
    }),
    redirect: "manual",
  });

  const setCookie = loginRes.headers.get("set-cookie") || "";
  if (!setCookie) {
    console.error("Login failed. Make sure dev server is running and test account exists.");
    process.exit(1);
  }
  return setCookie;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function benchmark(endpoint: { name: string; url: string; auth: boolean }, cookie: string): Promise<Result> {
  const times: number[] = [];
  let lastStatus = 0;

  for (let i = 0; i < ITERATIONS; i++) {
    const headers: Record<string, string> = {};
    if (endpoint.auth) headers.Cookie = cookie;

    const start = performance.now();
    try {
      const res = await fetch(`${BASE_URL}${endpoint.url}`, { headers });
      lastStatus = res.status;
      await res.text(); // consume body
    } catch {
      lastStatus = 0;
    }
    const elapsed = performance.now() - start;
    times.push(elapsed);
  }

  times.sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);

  return {
    name: endpoint.name,
    min: Math.round(times[0]),
    max: Math.round(times[times.length - 1]),
    avg: Math.round(sum / times.length),
    p95: Math.round(percentile(times, 95)),
    p99: Math.round(percentile(times, 99)),
    status: lastStatus,
    flag: percentile(times, 95) > 1000 ? "SLOW" : "OK",
  };
}

async function main() {
  const cookie = await getSessionCookie();
  console.log("Authenticated. Running benchmark...\n");

  const results: Result[] = [];
  for (const ep of endpoints) {
    process.stdout.write(`  ${ep.name}...`);
    const r = await benchmark(ep, cookie);
    results.push(r);
    console.log(` ${r.avg}ms avg (${r.flag})`);
  }

  console.log("\n=== API BENCHMARK RESULTS ===\n");
  console.log(
    "Endpoint".padEnd(20) +
    "Status".padEnd(8) +
    "Min".padEnd(8) +
    "Avg".padEnd(8) +
    "P95".padEnd(8) +
    "P99".padEnd(8) +
    "Max".padEnd(8) +
    "Flag"
  );
  console.log("-".repeat(76));

  for (const r of results) {
    console.log(
      r.name.padEnd(20) +
      String(r.status).padEnd(8) +
      `${r.min}ms`.padEnd(8) +
      `${r.avg}ms`.padEnd(8) +
      `${r.p95}ms`.padEnd(8) +
      `${r.p99}ms`.padEnd(8) +
      `${r.max}ms`.padEnd(8) +
      r.flag
    );
  }

  const slow = results.filter((r) => r.flag === "SLOW");
  if (slow.length > 0) {
    console.log(`\nWARNING: ${slow.length} endpoint(s) exceed 1s P95 target:`);
    for (const s of slow) {
      console.log(`  - ${s.name}: P95=${s.p95}ms`);
    }
  } else {
    console.log("\nAll endpoints within P95 < 1s target.");
  }
}

main().catch(console.error);
