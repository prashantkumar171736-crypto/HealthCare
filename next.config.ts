import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "*": [
      "./aws/**",
      "./awscliv2.zip",
      "./scratch/**",
      "./**/*.zip",
      "./**/*.tar.gz",
    ],
  },
  outputFileTracingIncludes: {
    "/api/admin/r2-stats": ["./node_modules/@aws/lambda-invoke-store/**/*"],
    "/api/admin/upload": ["./node_modules/@aws/lambda-invoke-store/**/*"],
  },
};

export default nextConfig;
