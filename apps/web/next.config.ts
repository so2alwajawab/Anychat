import type { NextConfig } from "next";

const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:4000";
const isStandalone = process.env.STANDALONE === "1" || process.platform === "linux";

const nextConfig: NextConfig = {
  output: isStandalone ? "standalone" : undefined,
  rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiTarget}/api/:path*` },
      { source: "/healthz", destination: `${apiTarget}/healthz` },
      { source: "/readyz", destination: `${apiTarget}/readyz` },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
