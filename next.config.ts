import { withSentryConfig } from "@sentry/nextjs";
import { withBetterStackNextConfig } from "@logtail/next";
import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
  {
    key: "Content-Security-Policy",
    value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline' https://js.stripe.com; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://api.stripe.com https://checkout.stripe.com https://*.upstash.io https://*.sentry.io https://*.betterstackdata.com; frame-src https://js.stripe.com https://hooks.stripe.com; frame-ancestors 'none';",
  },
];

const nextConfig: NextConfig = {
  // Remove X-Powered-By header (ZAP: "Server Leaks Information via X-Powered-By")
  poweredByHeader: false,
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
  },
  serverExternalPackages: ['apexcharts'],
  experimental: {
    reactCompiler: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        pathname: '/**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/dashboard",
        permanent: true,
      },
    ];
  },
  async headers() {
    const corsHeaders = [
      {
        key: "Access-Control-Allow-Origin",
        value: process.env.NODE_ENV === "production"
          ? "https://benefitssafe.com"
          : "http://localhost:3001",
      },
      {
        key: "Access-Control-Allow-Methods",
        value: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      },
      {
        key: "Access-Control-Allow-Headers",
        value: "Content-Type, Authorization, X-Requested-With",
      },
      {
        key: "Access-Control-Allow-Credentials",
        value: "true",
      },
    ];

    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Apply CORS headers to API routes
        source: "/api/(.*)",
        headers: corsHeaders,
      },
    ];
  },
};

export default withSentryConfig(withBetterStackNextConfig(nextConfig), {
  // Suppress source map upload warnings when SENTRY_AUTH_TOKEN is not set
  silent: !process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps for better stack traces in production
  widenClientFileUpload: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,
});
