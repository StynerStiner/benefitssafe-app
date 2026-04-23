export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const originalHost = url.hostname;

    const stableOnly = ['/api/webhooks/', '/api/jobs/', '/api/cron/', '/api/events/'];
    const forceStable = stableOnly.some(p => url.pathname.startsWith(p));

    let channel;
    if (forceStable) {
      channel = 'stable';
    } else {
      const cookies = request.headers.get('cookie') || '';
      const match = cookies.match(/bs_channel=(canary|stable)/);
      channel = match ? match[1] : (Math.random() < 0.1 ? 'canary' : 'stable');
    }

    const backend = channel === 'canary'
      ? 'canary.benefitssafe.com'
      : 'stable.benefitssafe.com';
    const backendUrl = `https://${backend}${url.pathname}${url.search}`;

    // Preserve original Host (app.benefitssafe.com) so NextAuth builds
    // callback URLs against the public host, not the backend origin.
    const headers = new Headers(request.headers);
    headers.set('Host', originalHost);
    headers.set('X-Forwarded-Host', originalHost);
    headers.set('X-Deploy-Channel', channel);

    const backendRequest = new Request(backendUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'manual',
    });

    const response = await fetch(backendRequest);

    const newResponse = new Response(response.body, response);
    const cookies = request.headers.get('cookie') || '';
    const hasChannelCookie = /bs_channel=(canary|stable)/.test(cookies);
    if (!hasChannelCookie && !forceStable) {
      newResponse.headers.append('Set-Cookie',
        `bs_channel=${channel}; Domain=.benefitssafe.com; Path=/; Secure; SameSite=Lax; Max-Age=86400`
      );
    }

    return newResponse;
  },
};
