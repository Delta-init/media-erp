import type { Metadata, Viewport } from "next";
import { Figtree, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

import ThemeProvider from "@/providers/ThemeProvider";
import QueryProvider from "@/providers/QueryProvider";
import PWARegister from "@/components/PWARegister";
import { cn } from "@/lib/utils";

const figtreeHeading = Figtree({subsets:['latin'],variable:'--font-heading'});

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans', weight: ['400','500','600','700','800'] });


export const metadata: Metadata = {
  title: "mediaERP",
  description: "Marketing data platform — connect, sync, and analyse all your ad channels",
  applicationName: "mediaERP",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "mediaERP",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
  other: {
    // Next 16 emits only the modern `mobile-web-app-capable`. iOS 16.4+ honours
    // the manifest's `display: standalone`, but older iOS still needs this
    // legacy tag — without it, a home-screen launch opens in a browser tab.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", plusJakarta.variable, figtreeHeading.variable)} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider>
          <QueryProvider>
            {children}
          </QueryProvider>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
        <PWARegister />
      </body>
    </html>
  );
}
