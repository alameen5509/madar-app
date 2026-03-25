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

const SITE_URL = "https://madar-web-ten.vercel.app";
const SITE_DESC = "نظام مدار الذكي لإدارة الحياة والمهام والأهداف — تنظيم حياتك بمنهج إسلامي عصري";

export const metadata: Metadata = {
  title: "مدار | نظام إدارة الحياة",
  description: SITE_DESC,
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/", languages: { ar: "/" } },
  openGraph: {
    title: "مدار — نظام إدارة الحياة الذكي",
    description: SITE_DESC,
    url: SITE_URL,
    siteName: "مدار",
    locale: "ar_SA",
    type: "website",
    images: [{ url: "/icons/icon-512x512.png", width: 512, height: 512, alt: "شعار مدار" }],
  },
  twitter: {
    card: "summary",
    title: "مدار — نظام إدارة الحياة الذكي",
    description: SITE_DESC,
    images: ["/icons/icon-512x512.png"],
  },
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
  other: { "mobile-web-app-capable": "yes" },
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
          } catch(e) { console.warn('Theme init error:', e); }
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(function(err) { console.warn('SW registration failed:', err); });
          }
        ` }} />
      </head>
      <body className={`${mainFont.variable} ${amiri.variable} antialiased`}>
        {/* Skip to content — accessibility */}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:right-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#5E5495] focus:text-white focus:text-sm focus:font-bold">
          تخطي إلى المحتوى
        </a>
        <ImpersonationBar />
        <div
          className="flex h-screen overflow-hidden"
          style={{ fontFamily: "var(--font-main, 'IBM Plex Sans Arabic', sans-serif)" }}
        >
          <SidebarWrapper />
          <div id="main-content" className="flex-1 flex flex-col overflow-hidden" role="main">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
