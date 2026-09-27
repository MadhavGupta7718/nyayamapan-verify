import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Next.js injects inline bootstrap scripts, so script-src keeps 'unsafe-inline' until nonce-based
// rendering is adopted; dev additionally needs 'unsafe-eval' for React Refresh.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.public.blob.vercel-storage.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  devIndicators: false,
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
    optimizePackageImports: ["lucide-react", "@radix-ui/react-dropdown-menu", "@radix-ui/react-dialog", "date-fns"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "blob.vercel-storage.com" },
    ],
  },
  redirects: async () => [
    { source: "/:locale(en|hi)/schedule", destination: "/:locale/scheduling", permanent: true },
    { source: "/:locale(en|hi)/field", destination: "/:locale/verification", permanent: true },
    { source: "/:locale(en|hi)/apply", destination: "/:locale/applications/new", permanent: true },
    { source: "/:locale(en|hi)/search", destination: "/:locale/dashboard", permanent: false },
  ],
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
      ],
    },
    { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, max-age=0, must-revalidate" }] },
  ],
};

export default withNextIntl(nextConfig);
