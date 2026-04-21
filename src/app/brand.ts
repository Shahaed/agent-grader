import { readFile } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_SITE_URL = "http://localhost:3000";

export const brand = {
  background: "#fcfaf6",
  backgroundMuted: "#efe7da",
  foreground: "#0f172a",
  ink: "#485662",
  accent: "#f4a91b",
  accentMuted: "#e6e1d8",
  border: "#e7dccd",
  surface: "#ffffff",
  surfaceMuted: "#f6f1e8",
  copyMuted: "#475569",
} as const;

export const siteConfig = {
  name: "Agent Grader",
  description:
    "Rubric-aware written submission grading prototype built on Next.js and the OpenAI Responses API.",
  shareDescription:
    "Persistent assignment context, prompt-based segmentation, isolated grading runs, and rubric-aware review workflows for instructors.",
  logoPath: "/AgentGrader.svg",
  faviconPath: "/favicon.ico",
} as const;

function toAbsoluteUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? trimmed
    : `https://${trimmed}`;
}

export function getSiteUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    DEFAULT_SITE_URL,
  ];

  for (const candidate of candidates) {
    const absoluteUrl = toAbsoluteUrl(candidate);

    if (!absoluteUrl) {
      continue;
    }

    try {
      return new URL(absoluteUrl);
    } catch {
      continue;
    }
  }

  return new URL(DEFAULT_SITE_URL);
}

export async function getLogoDataUrl() {
  const svg = await readFile(
    join(process.cwd(), "public", "AgentGrader.svg"),
    "utf8",
  );

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
