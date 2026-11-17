import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: "standalone",
  // /support is the support link on receipts and in Stripe; help lives on Contact.
  async redirects() {
    return [{ source: "/support", destination: "/contact", permanent: false }];
  },
};

export default nextConfig;
