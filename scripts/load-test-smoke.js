import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    errors: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

function login(email, password) {
  const csrfRes = http.get(`${BASE_URL}/api/auth/csrf`);
  let csrfToken = '';
  try {
    csrfToken = JSON.parse(csrfRes.body).csrfToken;
  } catch (e) {
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

  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, { 'health: 200': (r) => r.status === 200 }) || errorRate.add(1);
  sleep(0.5);

  const grantsRes = http.get(`${BASE_URL}/api/grants?limit=10`, params);
  check(grantsRes, { 'grants: 200': (r) => r.status === 200 }) || errorRate.add(1);
  sleep(0.5);

  const expensesRes = http.get(`${BASE_URL}/api/expenses?limit=10`, params);
  check(expensesRes, { 'expenses: 200': (r) => r.status === 200 }) || errorRate.add(1);
  sleep(1);
}
