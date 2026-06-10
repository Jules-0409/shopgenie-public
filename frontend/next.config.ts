import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  basePath: "/shopgenie",
  ...(isProd ? { output: "export" as const } : {}),
  async rewrites() {
    if (isProd) return [];
    return [
      {
        // basePath 会自动加在 source 前面，这里写 /api 实际匹配 /shopgenie/api
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
