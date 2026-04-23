import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Instrument_Serif } from "next/font/google";
import { JetBrains_Mono } from "next/font/google";
import { getSiteUrl, siteConfig } from "./brand";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.shareDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.shareDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${geist.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
    >
      <body className="h-full">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
