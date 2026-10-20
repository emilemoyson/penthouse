import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // receipt photos go through a server action; the panel shrinks them first, this leaves headroom
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
