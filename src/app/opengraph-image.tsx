import { siteConfig } from "./brand";
import { createSocialCard } from "./social-card";

export const alt = `${siteConfig.name} preview`;

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return createSocialCard(size);
}
