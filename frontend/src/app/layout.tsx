import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Amiri } from "next/font/google";
import SidebarWrapper from "@/components/SidebarWrapper";
import ImpersonationBar from "@/components/ImpersonationBar";
import "./globals.css";

const mainFont = IBM_Plex_Sans_Arabic({
  variable: "--font-main",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const amiri = Amiri({
  variable: "--font-amiri",
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "مدار | نظام إدارة الحياة",
  description: "نظام مدار الذكي لإدارة الحياة والمهام والأهداف",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "مدار",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#5E5495" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        {/* Apply saved theme before first paint to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var s = JSON.parse(localStorage.getItem('madar_settings') || '{}');
            document.documentElement.setAttribute('data-theme', s.theme || 'light');
          } catch(e) {}
          // Register Service Worker
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(function() {});
          }
        ` }} />
      </head>
      <body className={`${mainFont.variable} ${amiri.variable} antialiased`}>
        <ImpersonationBar />
        <div
          className="flex h-screen overflow-hidden"
          style={{ fontFamily: "var(--font-main, 'IBM Plex Sans Arabic', sans-serif)" }}
        >
          <SidebarWrapper />
          {children}
        </div>
      </body>
    </html>
  );
}
