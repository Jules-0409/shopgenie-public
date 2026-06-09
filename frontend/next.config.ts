import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  basePath: "/shopgenie",
  ...(isProd ? { output: "export" as const } : {}),
  async rewrites() {
    if (isProd) return [];
    return [
      {
        source: "/shopgenie/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
