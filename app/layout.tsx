import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Chef AI — Production Scaler",
  description: "Scale dining-hall recipes to today's covers, the way a chef would.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/* TEMPORARY (design pick): apply the look chosen with <ThemePicker /> before first paint. */
const LOOK_SCRIPT =
  '(function(){try{var m=document.cookie.match(/(?:^|;\\s*)chefai-theme=(whites|night|paper)\\b/);' +
  'if(m)document.documentElement.setAttribute("data-theme",m[1]);}catch(e){}})();';

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: LOOK_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
