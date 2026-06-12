import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // puppeteer-core and @sparticuz/chromium must stay external to the server bundle
  // so their native/binary resolution works inside the serverless function.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  // Next.js file tracing doesn't follow @sparticuz/chromium's runtime reads of its
  // brotli-packed binary + shared-library packs (chromium.br, al2023.tar.br, etc.),
  // which causes "libnss3.so: cannot open shared object file" at runtime. Force the
  // whole bin/ directory into the /api/check function bundle.
  outputFileTracingIncludes: {
    "/api/check": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
