import { ImageResponse } from "next/og";
import { brand, getLogoDataUrl, siteConfig } from "./brand";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default async function AppleIcon() {
  const logoSrc = await getLogoDataUrl();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: brand.background,
        }}
      >
        <div
          style={{
            width: 152,
            height: 152,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 40,
            background: `linear-gradient(180deg, ${brand.surface} 0%, ${brand.surfaceMuted} 100%)`,
            boxShadow: "0 16px 40px rgba(72, 86, 98, 0.14)",
          }}
        >
          <img src={logoSrc} alt={siteConfig.name} width={116} height={116} />
        </div>
      </div>
    ),
    size,
  );
}
