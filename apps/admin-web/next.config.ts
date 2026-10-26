import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false };
    return config;
  },
  async rewrites() {
    const api = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000";
    return [{ source: "/api-proxy/:path*", destination: `${api}/api/:path*` }];
  },
};

export default nextConfig;
