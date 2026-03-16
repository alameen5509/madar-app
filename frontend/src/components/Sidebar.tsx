"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EightPointedStar, SidebarPattern } from "@/components/IslamicPattern";

const NAV_ITEMS = [
  { icon: "⊙", label: "لوحة التحكم",       href: "/" },
  { icon: "◎", label: "دوائر الحياة",      href: "/circles" },
  { icon: "◈", label: "الأهداف",            href: "/goals" },
  { icon: "◻", label: "المهام",              href: "/tasks" },
  { icon: "✦", label: "صندوق الوارد",      href: "/inbox" },
  { icon: "◑", label: "الطاقة",             href: "/energy" },
  { icon: "☽", label: "ورد القرآن",         href: "/quran" },
  { icon: "◆", label: "الذكاء الاصطناعي",  href: "/ai" },
  { icon: "◉", label: "الإعدادات",          href: "/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="pattern-zellige relative w-64 flex-shrink-0 flex flex-col overflow-y-auto">
      <SidebarPattern />

      {/* Logo */}
      <div className="relative z-10 px-6 pt-8 pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #C9A84C, #E8C96A)" }}
          >
            <EightPointedStar size={22} color="#2A2542" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl leading-none">مدار</h1>
            <p className="text-white/50 text-xs mt-0.5">نظام إدارة الحياة</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all ${
                active
                  ? "nav-active text-[#C9A84C] font-semibold"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="relative z-10 px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#5E5495] to-[#C9A84C] flex items-center justify-center text-white font-bold text-sm">
            م
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">محمد العمري</p>
            <p className="text-white/40 text-xs truncate">مشرف النظام</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
