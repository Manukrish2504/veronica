import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright-core", "unpdf", "@anthropic-ai/sdk"],
};

export default nextConfig;
