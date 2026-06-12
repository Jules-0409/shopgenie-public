import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  basePath: "/shopgenie",
  ...(isProd ? {
    output: "export" as const,
  } : {
    async redirects() {
      return [
        {
          source: "/",
          destination: "/shopgenie",
          basePath: false,
          permanent: false,
        },
      ];
    },
    async rewrites() {
      return [
        {
          source: "/api/:path*",
          destination: "http://localhost:8000/api/:path*",
        },
      ];
    },
  }),
};

export default nextConfig;
