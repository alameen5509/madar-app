"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { EightPointedStar, SidebarPattern } from "@/components/IslamicPattern";

/* ─── Badge counts helper ─────────────────────────────────────────────── */

interface BadgeCounts {
  tasks: number;    // مهام غير مكتملة
  inbox: number;    // رسائل واردة
  habits: number;   // عادات لم تكتمل اليوم
  dues: number;     // مستحقات تنتظر تأكيد
}

function loadBadgeCounts(): BadgeCounts {
  if (typeof window === "undefined") return { tasks: 0, inbox: 0, habits: 0, dues: 0 };

  // Habits
  let habitsCount = 0;
  try {
    const habits = JSON.parse(localStorage.getItem("madar_habits") ?? "[]");
    const lastDate = localStorage.getItem("madar_habits_date");
    const today = new Date().toDateString();
    habitsCount = habits.filter((h: { isIdea: boolean; todayDone: boolean }) =>
      !h.isIdea && !(lastDate === today && h.todayDone)
    ).length;
  } catch {}

  // Dues
  let duesCount = 0;
  try {
    const dues = JSON.parse(localStorage.getItem("mfin_dues") ?? "[]");
    const now = new Date();
    const todayDay = now.getDate();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    duesCount = dues.filter((d: { isActive: boolean; dueDay: number; frequency: string; dueMonth?: number; lastConfirmedDate?: string }) => {
      if (!d.isActive) return false;
      if (d.frequency === "yearly" && d.dueMonth !== now.getMonth() + 1) return false;
      return !d.lastConfirmedDate?.startsWith(monthStr) && todayDay >= d.dueDay;
    }).length;
  } catch {}

  return { tasks: 0, inbox: 0, habits: habitsCount, dues: duesCount };
}

/* ─── Nav items ───────────────────────────────────────────────────────── */

const NAV_ITEMS = [
  { icon: "◻", label: "أعمال اليوم",        href: "/tasks",     badgeKey: "tasks" as const },
  { icon: "◎", label: "أدوار الحياة",       href: "/circles",   badgeKey: null },
  { icon: "◈", label: "الوظائف",            href: "/jobs",      badgeKey: null },
  { icon: "▣", label: "المشاريع",           href: "/projects",  badgeKey: null },
  { icon: "↻", label: "العادات",            href: "/habits",    badgeKey: "habits" as const },
  { icon: "☽", label: "ختمة",              href: "/quran",     badgeKey: null },
  { icon: "✦", label: "صندوق الوارد",      href: "/inbox",     badgeKey: "inbox" as const },
  { icon: "◑", label: "الإحصائيات",         href: "/energy",    badgeKey: null },
  { icon: "◇", label: "الإدارة المالية",    href: "/finance",   badgeKey: "dues" as const },
  { icon: "🔑", label: "الحسابات",           href: "/accounts",  badgeKey: null },
  { icon: "👥", label: "المستخدمون",        href: "/users",     badgeKey: null },
  { icon: "◆", label: "الذكاء الاصطناعي",  href: "/ai",        badgeKey: null },
  { icon: "⌚", label: "ربط الساعة",         href: "/watch-login", badgeKey: null },
  { icon: "◉", label: "الإعدادات",          href: "/settings",  badgeKey: null },
];

/* ─── Component ───────────────────────────────────────────────────────── */

export default function Sidebar() {
  const pathname = usePathname();
  const [badges, setBadges] = useState<BadgeCounts>({ tasks: 0, inbox: 0, habits: 0, dues: 0 });
  const [apiTasks, setApiTasks] = useState(0);
  const [apiInbox, setApiInbox] = useState(0);

  const refresh = useCallback(() => {
    setBadges(loadBadgeCounts());
  }, []);

  // Load local badges
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  // Load API badges (tasks + inbox)
  useEffect(() => {
    import("@/lib/api").then(({ api }) => {
      api.get("/api/tasks").then((r) => {
        const all = r.data as { status: string }[];
        setApiTasks(all.filter((t) => t.status !== "Completed" && t.status !== "Cancelled").length);
        setApiInbox(all.filter((t) => t.status === "Inbox").length);
      }).catch(() => {});
    });
  }, [pathname]);

  const counts: BadgeCounts = { ...badges, tasks: apiTasks, inbox: apiInbox };

  // Listen for storage changes (cross-tab sync)
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [refresh]);

  // Listen for custom "madar-update" event (same-tab sync for task completion etc.)
  useEffect(() => {
    const handler = () => { refresh(); };
    window.addEventListener("madar-update", handler);
    return () => window.removeEventListener("madar-update", handler);
  }, [refresh]);

  return (
    <aside className="pattern-zellige relative w-64 flex-shrink-0 flex flex-col overflow-hidden">
      <SidebarPattern />

      {/* Logo */}
      <div className="relative z-10 px-6 pt-8 pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #B8960C, #D4AF37)" }}
          >
            <EightPointedStar size={22} color="#1A1A2E" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl leading-none tracking-wide">مدار</h1>
            <p className="text-white/40 text-[10px] mt-0.5">نظام إدارة الحياة</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href === "/dashboard" && pathname === "/");
          const count = item.badgeKey ? counts[item.badgeKey] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all ${
                active
                  ? "nav-active text-[#D4AF37] font-semibold"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {count > 0 && (
                <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full text-[10px] font-bold px-1.5"
                  style={{ background: "#D4AF37", color: "#1A1A2E" }}>
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="relative z-10 px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{ background: "linear-gradient(135deg, #3D3468, #D4AF37)" }}>
            م
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">محمد الأمين</p>
            <p className="text-white/30 text-xs truncate">مشرف النظام</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
