import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Senior Guru",
  description: "A transparent senior services community, directory, and growth platform."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

