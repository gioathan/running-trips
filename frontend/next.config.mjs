import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isProd = process.env.NODE_ENV === "production";

// Which outside origins the pages may load from. Anything not listed is
// blocked by the browser, which limits what an injected script could do.
// - Stripe: card form (script + iframes) and its API.
// (Google sign-in is a full-page redirect — it loads nothing on our pages.)
// - R2: admin image uploads PUT straight to the bucket's S3 endpoint.
// 'unsafe-inline' is needed for Next's own inline bootstrap scripts (a
// nonce-based policy would force every page to render dynamically twice
// over); 'unsafe-eval' only for the dev server's hot reload.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://js.stripe.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.stripe.com https://*.r2.cloudflarestorage.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" }, // the site is never meant to be framed (clickjacking)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, // reset/verify links carry tokens in the URL
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    // Only hosts we publish images to. Each entry is a host the optimizer
    // will fetch from on a visitor's request, so keep it to our own media
    // domain (set NEXT_PUBLIC_MEDIA_HOSTNAME to the R2 custom domain or the
    // bucket's own pub-….r2.dev host).
    remotePatterns: [
      {
        protocol: "https",
        hostname: process.env.NEXT_PUBLIC_MEDIA_HOSTNAME || "media.example.com",
      },
      // Placeholder images used by the dev seeder (backend/app/seed.py),
      // which only runs in local dev.
      ...(isProd && !process.env.ALLOW_SEED_IMAGES
        ? []
        : [
            { protocol: "https", hostname: "picsum.photos" },
            { protocol: "https", hostname: "fastly.picsum.photos" },
          ]),
    ],
    formats: ["image/avif", "image/webp"],
    // Uploaded images get a unique name and never change, but R2 sends no
    // cache headers — without this each one would be re-optimized every
    // 60 seconds (the default), which is slow and billed per transformation.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Logo and icon files: not content-hashed, so a day in the browser
        // (they used to be re-requested on every page view).
        source: "/:dir(brand|icons)/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
