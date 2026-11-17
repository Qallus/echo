import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: "standalone",
  // Upgraded for a security advisory with `next upgrade --agent=security`.
  experimental: { agentUpgrade: "security" },
  // /support is the support link on receipts and in Stripe; help lives on Contact.
  async redirects() {
    return [{ source: "/support", destination: "/contact", permanent: false }];
  },
};

export default nextConfig;
