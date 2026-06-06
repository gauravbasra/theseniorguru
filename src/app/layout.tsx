import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://theseniorguru.com"),
  title: "TheSeniorGuru | Helping Seniors Live Independently, Safely, and Connected",
  description:
    "TheSeniorGuru is a mobile-first platform connecting seniors, families, communities, caregivers, and service providers in one simple experience.",
  keywords: [
    "TheSeniorGuru",
    "senior support app",
    "senior services app",
    "senior companionship app",
    "senior transportation help",
    "family caregiver app",
    "senior living technology",
    "senior community app"
  ],
  alternates: {
    canonical: "/"
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "TheSeniorGuru",
    description:
      "A calm mobile-first platform for senior support, trusted services, community connection, companionship, and daily-life help.",
    url: "https://theseniorguru.com",
    siteName: "TheSeniorGuru",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TheSeniorGuru mobile-first senior support platform preview"
      }
    ],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "TheSeniorGuru",
    description:
      "A calm mobile-first platform for senior support, trusted services, community connection, companionship, and daily-life help.",
    images: [
      {
        url: "/og-image.png",
        alt: "TheSeniorGuru mobile-first senior support platform preview"
      }
    ]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
