import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // puppeteer-core and @sparticuz/chromium must stay external to the server bundle
  // so their native/binary resolution works inside the serverless function.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
};

export default nextConfig;
