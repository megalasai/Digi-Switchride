import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  async rewrites() {
    const api = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000";
    return [{ source: "/api-proxy/:path*", destination: `${api}/api/:path*` }];
  },
};

export default nextConfig;
