export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const stableOnly = ['/api/webhooks/', '/api/jobs/', '/api/cron/', '/api/events/'];
    if (stableOnly.some(p => url.pathname.startsWith(p))) {
      return fetch(`https://stable.benefitssafe.com${url.pathname}${url.search}`, request);
    }
    const cookies = request.headers.get('cookie') || '';
    const match = cookies.match(/bs_channel=(canary|stable)/);
    let channel = match ? match[1] : null;
    if (!channel) {
      channel = Math.random() < 0.1 ? 'canary' : 'stable';
    }
    const origin = channel === 'canary'
      ? `https://canary.benefitssafe.com`
      : `https://stable.benefitssafe.com`;
    const response = await fetch(`${origin}${url.pathname}${url.search}`, request);
    const newResponse = new Response(response.body, response);
    if (!match) {
      newResponse.headers.append('Set-Cookie',
        `bs_channel=${channel}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`
      );
    }
    return newResponse;
  },
};
