import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Self-hosted: next/font downloads Inter once at build time and serves it from
// this domain, so a visitor's browser never contacts Google (a Munich court
// fined a site for exactly that leak: LG München I, 3 O 17493/20).
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Digital Chef AI · Production scaler",
  description: "Scale dining-hall recipes to today's covers, the way a chef would.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
