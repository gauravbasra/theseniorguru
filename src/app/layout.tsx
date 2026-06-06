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
  openGraph: {
    title: "TheSeniorGuru",
    description:
      "A calm mobile-first platform for senior support, trusted services, community connection, companionship, and daily-life help.",
    url: "https://theseniorguru.com",
    siteName: "TheSeniorGuru",
    images: [
      {
        url: "/assets/app-screens/today.png",
        width: 863,
        height: 1822,
        alt: "TheSeniorGuru mobile daily support app screen"
      }
    ],
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
