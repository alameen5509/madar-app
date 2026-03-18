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
    ],
    apple: "/favicon.svg",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Apply saved theme before first paint to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var s = JSON.parse(localStorage.getItem('madar_settings') || '{}');
            document.documentElement.setAttribute('data-theme', s.theme || 'light');
          } catch(e) {}
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
