import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const dashboardLatency = new Trend('dashboard_latency');
const grantsLatency = new Trend('grants_latency');
const healthLatency = new Trend('health_latency');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '2m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 100 },  // Spike to 100 users
    { duration: '1m', target: 100 },   // Stay at 100 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

function login(email, password) {
  const csrfRes = http.get(`${BASE_URL}/api/auth/csrf`);
  let csrfToken = '';
  try {
    csrfToken = JSON.parse(csrfRes.body).csrfToken;
  } catch (e) {
    console.error('Failed to get CSRF token');
    return {};
  }

  const cookies = csrfRes.cookies;
  const jar = http.cookieJar();
  for (const name in cookies) {
    for (const c of cookies[name]) {
      jar.set(BASE_URL, name, c.value);
    }
  }

  const loginRes = http.post(
    `${BASE_URL}/api/auth/callback/credentials`,
    `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&csrfToken=${encodeURIComponent(csrfToken)}&json=true`,
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirects: 0,
    }
  );

  return loginRes.cookies;
}

export function setup() {
  const cookies = login('admin@benefitssafe.com', 'TestDev2024!');
  return { cookies };
}

export default function (data) {
  const params = { cookies: data.cookies };

  // 1. Health check (unauthenticated)
  const healthRes = http.get(`${BASE_URL}/api/health`);
  healthLatency.add(healthRes.timings.duration);
  check(healthRes, {
    'health: status 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  sleep(0.5);

  // 2. Dashboard (authenticated)
  const dashRes = http.get(`${BASE_URL}/api/dashboard`, params);
  dashboardLatency.add(dashRes.timings.duration);
  check(dashRes, {
    'dashboard: status 200 or 302': (r) => r.status === 200 || r.status === 302,
  }) || errorRate.add(1);
  sleep(0.5);

  // 3. Grants list
  const grantsRes = http.get(`${BASE_URL}/api/grants?limit=10`, params);
  grantsLatency.add(grantsRes.timings.duration);
  check(grantsRes, {
    'grants: status 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  sleep(0.5);

  // 4. Expenses list
  const expensesRes = http.get(`${BASE_URL}/api/expenses?limit=10`, params);
  check(expensesRes, {
    'expenses: status 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  sleep(0.5);

  // 5. Notifications
  const notifRes = http.get(`${BASE_URL}/api/notifications?limit=10`, params);
  check(notifRes, {
    'notifications: status 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  sleep(0.5);

  // 6. Audit logs
  const auditRes = http.get(`${BASE_URL}/api/audit-logs?limit=10`, params);
  check(auditRes, {
    'audit-logs: status 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  sleep(1);
}
