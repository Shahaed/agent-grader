import os from "node:os";

import type { NextConfig } from "next";

function normalizeOrigin(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

const envAllowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

const localIpv4Origins = Object.values(os.networkInterfaces())
  .flat()
  .reduce<string[]>((origins, network) => {
    if (network && network.family === "IPv4" && !network.internal) {
      origins.push(network.address);
    }

    return origins;
  }, []);

const allowedDevOrigins = [...new Set([...envAllowedDevOrigins, ...localIpv4Origins])];

const nextConfig: NextConfig = {
  allowedDevOrigins,
};

export default nextConfig;
