import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@vibecheck/schema",
    "@vibecheck/policy",
    "@react-pdf/renderer",
    "@react-pdf/layout",
    "@react-pdf/pdfkit",
    "@react-pdf/primitives",
  ],
  // Enable static export for the viewer package
  output: "export",
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
