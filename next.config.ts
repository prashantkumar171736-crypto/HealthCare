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
};

export default nextConfig;
