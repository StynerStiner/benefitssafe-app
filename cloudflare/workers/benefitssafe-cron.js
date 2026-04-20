export default {
  async scheduled(event, env, ctx) {
    const routes = [
      { path: '/api/cron/revoke-expired-grants', schedule: '0 * * * *' },
      { path: '/api/cron/sentinel', schedule: '0 6 * * *' },
      { path: '/api/cron/compliance', schedule: '0 12 * * *' },
      { path: '/api/cron/reports', schedule: '0 7 * * 1' },
      { path: '/api/cron/reconcile-orphan-stripe-cards', schedule: '0 3 * * *' },
    ];
    const url = `https://benefitssafe.com${event.cron === '0 * * * *'
      ? '/api/cron/revoke-expired-grants'
      : routes.find(r => r.schedule === event.cron)?.path || '/api/cron/revoke-expired-grants'}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.CRON_SECRET}`,
        'User-Agent': 'BenefitsSafe-Cloudflare-Cron/1.0',
      },
    });
    console.log(`[cron] ${url} → ${resp.status}`);
  },
};
