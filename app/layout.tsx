import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Chef AI — Production Scaler",
  description: "Scale dining-hall recipes to today's covers, the way a chef would.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
