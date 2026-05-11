import type { NextConfig } from "next";

function parseAllowedDevOrigins() {
  const defaults = ["172.16.126.220"];
  const fromEnv =
    process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];

  return [...new Set([...defaults, ...fromEnv])];
}

const nextConfig: NextConfig = {
  allowedDevOrigins: parseAllowedDevOrigins(),
  serverExternalPackages: ["@lancedb/lancedb", "apache-arrow"],
};

export default nextConfig;
