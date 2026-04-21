/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { brand, getLogoDataUrl, siteConfig } from "./brand";

type SocialCardOptions = {
  width: number;
  height: number;
};

export async function createSocialCard({
  width,
  height,
}: SocialCardOptions) {
  const logoSrc = await getLogoDataUrl();
  const compact = width < 1100;
  const titleFontSize = compact ? 64 : 72;
  const bodyFontSize = compact ? 30 : 32;
  const badgeFontSize = compact ? 20 : 22;
  const badgePaddingX = compact ? 20 : 24;
  const badgePaddingY = compact ? 10 : 12;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: compact ? 32 : 40,
          background: brand.background,
          color: brand.foreground,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: compact ? 44 : 56,
            borderRadius: 36,
            border: `1px solid ${brand.border}`,
            background: `linear-gradient(180deg, ${brand.surface} 0%, ${brand.surfaceMuted} 100%)`,
            boxShadow: "0 24px 80px rgba(72, 86, 98, 0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: compact ? 104 : 116,
                height: compact ? 104 : 116,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 28,
                background: brand.accentMuted,
              }}
            >
              <img
                src={logoSrc}
                alt={siteConfig.name}
                width={compact ? 88 : 96}
                height={compact ? 88 : 96}
              />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginLeft: 24,
              }}
            >
              <div
                style={{
                  fontSize: compact ? 26 : 28,
                  fontWeight: 700,
                  letterSpacing: "0.28em",
                  textTransform: "uppercase",
                  color: brand.accent,
                }}
              >
                {siteConfig.name}
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: titleFontSize,
                  fontWeight: 700,
                  lineHeight: 1.05,
                  maxWidth: compact ? 860 : 920,
                }}
              >
                Rubric-aware written submission grading with isolated runs.
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: bodyFontSize,
              lineHeight: 1.35,
              color: brand.copyMuted,
              maxWidth: compact ? 920 : 980,
            }}
          >
            {siteConfig.shareDescription}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {[
              "Assignment context",
              "Isolated grading calls",
              "Teacher review workflow",
            ].map((label, index) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: `${badgePaddingY}px ${badgePaddingX}px`,
                  marginRight: index === 2 ? 0 : 16,
                  borderRadius: 999,
                  border: `1px solid ${brand.border}`,
                  background: index === 1 ? brand.accentMuted : brand.surface,
                  color: index === 1 ? brand.ink : brand.foreground,
                  fontSize: badgeFontSize,
                  fontWeight: 600,
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
    },
  );
}
