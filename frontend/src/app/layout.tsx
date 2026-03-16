import type { Metadata } from "next";
import { Cairo, Amiri } from "next/font/google";
import SidebarWrapper from "@/components/SidebarWrapper";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const amiri = Amiri({
  variable: "--font-amiri",
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "مدار | نظام إدارة الحياة",
  description: "نظام مدار الذكي لإدارة الحياة والمهام والأهداف",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.variable} ${amiri.variable} antialiased`}>
        <div
          className="flex h-screen overflow-hidden"
          style={{ fontFamily: "var(--font-cairo, Cairo, sans-serif)" }}
        >
          <SidebarWrapper />
          {children}
        </div>
      </body>
    </html>
  );
}
