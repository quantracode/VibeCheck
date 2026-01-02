import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@vibecheck/schema", "@vibecheck/policy"],
};

export default nextConfig;
