"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { EightPointedStar, SidebarPattern } from "@/components/IslamicPattern";

/* ─── Badge counts ─────────────────────────────────────────────── */

interface BadgeCounts { tasks: number; inbox: number; habits: number; dues: number; focus: number; }

function loadBadgeCounts(): BadgeCounts {
  if (typeof window === "undefined") return { tasks: 0, inbox: 0, habits: 0, dues: 0, focus: 0 };
  let habitsCount = 0;
  try {
    const habits = JSON.parse(localStorage.getItem("kv_habits") ?? localStorage.getItem("madar_habits") ?? "[]");
    habitsCount = habits.filter((h: { isIdea: boolean; todayDone: boolean }) =>
      !h.isIdea && !h.todayDone).length;
  } catch {}
  const duesCount = 0;
  return { tasks: 0, inbox: 0, habits: habitsCount, dues: duesCount, focus: 0 };
}

/* ─── Nav items ───────────────────────────────────────────────── */

const NAV_GROUPS = [
  { group: null, items: [
    { icon: "↻", label: "عبادات وعادات",      href: "/habits",      badgeKey: "habits" as const, fixed: true },
    { icon: "🎖️", label: "غرفة القيادة",       href: "/war-room",    badgeKey: null, fixed: true },
    { icon: "🌐", label: "إدارة المواقع",      href: "/web-projects", badgeKey: null, fixed: true },
    { icon: "🎯", label: "التركيز",            href: "/focus",       badgeKey: "focus" as const, fixed: true },
    { icon: "📜", label: "التاريخ",            href: "/history",     badgeKey: null, fixed: true },
    { icon: "◇", label: "الإدارة المالية",    href: "/finance",     badgeKey: "dues" as const, fixed: true },
  ]},
  { group: "التخطيط", items: [
    { icon: "◻", label: "أعمال اليوم",        href: "/tasks",       badgeKey: "tasks" as const, fixed: false },
    { icon: "▣", label: "المشاريع",           href: "/projects",    badgeKey: null, fixed: false },
    { icon: "◈", label: "الأعمال",            href: "/works",       badgeKey: null, fixed: false },
    { icon: "📅", label: "الاجتماعات",         href: "/meetings",    badgeKey: null, fixed: false },
    { icon: "✦", label: "صندوق الوارد",      href: "/inbox",       badgeKey: "inbox" as const, fixed: false },
  ]},
  { group: "الحياة", items: [
    { icon: "◎", label: "أدوار الحياة",       href: "/circles",     badgeKey: null, fixed: false },
    { icon: "📵", label: "إدمان الجوال",      href: "/phone-addiction", badgeKey: null, fixed: false },
  ]},
  { group: "الإدارة", items: [
    { icon: "🍽️", label: "التغذية",            href: "/nutrition",   badgeKey: null, fixed: false },
  ]},
  { group: "المعرفة", items: [
    { icon: "◑", label: "الإحصائيات",         href: "/energy",      badgeKey: null, fixed: false },
  ]},
  { group: "النظام", items: [
    { icon: "🛠️", label: "طلبات التطوير",     href: "/dev-tickets", badgeKey: null, fixed: false },
    { icon: "👥", label: "المستخدمون",        href: "/users",       badgeKey: null, fixed: false },
    { icon: "◉", label: "الإعدادات",          href: "/settings",    badgeKey: null, fixed: true },
  ]},
];

type BadgeKey = "tasks" | "habits" | "inbox" | "dues" | "focus" | null;
type NavItem = { icon: string; label: string; href: string; badgeKey: BadgeKey; fixed: boolean };
const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap(g => g.items as NavItem[]);

const DEFAULT_ORDER = NAV_ITEMS.map(i => i.href);

/* ─── Component ───────────────────────────────────────────────── */

export default function Sidebar() {
  const pathname = usePathname();
  const [badges, setBadges] = useState<BadgeCounts>({ tasks: 0, inbox: 0, habits: 0, dues: 0, focus: 0 });
  const [apiTasks, setApiTasks] = useState(0);
  const [apiInbox, setApiInbox] = useState(0);
  const [apiFocus, setApiFocus] = useState(0);

  // ترتيب القائمة
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const refresh = useCallback(() => { setBadges(loadBadgeCounts()); }, []);

  useEffect(() => { refresh(); const id = setInterval(refresh, 10_000); return () => clearInterval(id); }, [refresh]);

  useEffect(() => {
    import("@/lib/api").then(({ api }) => {
      api.get("/api/tasks").then((r) => {
        const all = r.data as { status: string; dueDate?: string }[];
        const pending = all.filter((t) => t.status !== "Completed" && t.status !== "Cancelled" && t.status !== "Inbox");
        // Focus: exclude hour-postponed tasks
        const nowTime = new Date();
        const focusTasks = pending.filter(t => {
          if (t.dueDate) {
            const due = new Date(t.dueDate);
            const h = due.getHours(), m = due.getMinutes();
            if ((h !== 0 || m !== 0) && due > nowTime) return false;
          }
          return true;
        });
        setApiTasks(pending.length);
        setApiFocus(focusTasks.length);
        setApiInbox(all.filter((t) => t.status === "Inbox").length);
      }).catch(() => {});
    });
  }, [pathname]);

  // تحميل الترتيب من API
  useEffect(() => {
    import("@/lib/api").then(({ api }) => {
      api.get("/api/users/me/preferences").then(({ data }) => {
        if (data?.navOrder) setOrder(data.navOrder);
        if (data?.navHidden) setHidden(new Set(data.navHidden));
      }).catch(() => {});
    });
  }, []);

  const counts: BadgeCounts = { ...badges, tasks: apiTasks, inbox: apiInbox, focus: apiFocus };

  useEffect(() => { const h = () => refresh(); window.addEventListener("storage", h); return () => window.removeEventListener("storage", h); }, [refresh]);
  useEffect(() => { const h = () => refresh(); window.addEventListener("madar-update", h); return () => window.removeEventListener("madar-update", h); }, [refresh]);

  function saveOrder() {
    import("@/lib/api").then(({ api }) => {
      const settings = JSON.parse(localStorage.getItem("madar_settings") ?? "{}");
      api.put("/api/users/me/preferences", { ...settings, navOrder: order, navHidden: Array.from(hidden) }).catch(() => {});
    });
    setEditMode(false);
  }

  function resetOrder() {
    setOrder(DEFAULT_ORDER);
    setHidden(new Set());
  }

  // العناصر المرتبة
  const sortedItems = order
    .map(href => NAV_ITEMS.find(i => i.href === href))
    .filter((i): i is (typeof NAV_ITEMS)[0] => !!i);
  // إضافة أي عناصر جديدة غير موجودة في الترتيب
  NAV_ITEMS.forEach(i => { if (!sortedItems.find(s => s.href === i.href)) sortedItems.push(i); });

  return (
    <aside className="pattern-zellige relative w-full max-w-64 flex-shrink-0 flex flex-col overflow-hidden h-full">
      <SidebarPattern />

      {/* Logo */}
      <div className="relative z-10 px-6 pt-8 pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #B8960C, #D4AF37)" }}>
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
        {sortedItems.map((item, idx) => {
          if (!editMode && hidden.has(item.href)) return null;
          // Group header
          const itemGroup = NAV_GROUPS.find(g => g.items.some(i => i.href === item.href));
          const isFirstInGroup = itemGroup?.items[0]?.href === item.href;
          const groupLabel = isFirstInGroup && itemGroup?.group && !editMode ? (
            <p key={`grp-${itemGroup.group}`} className="text-[9px] font-bold px-4 pt-3 pb-1" style={{ color: "rgba(255,255,255,0.25)" }}>{itemGroup.group}</p>
          ) : null;
          const active = pathname === item.href;
          const count = item.badgeKey ? counts[item.badgeKey] : 0;

          if (editMode) {
            return (
              <div key={item.href} draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIdx === null || dragIdx === idx) return;
                  const newOrder = [...order];
                  const [moved] = newOrder.splice(dragIdx, 1);
                  newOrder.splice(idx, 0, moved);
                  setOrder(newOrder);
                  setDragIdx(null);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-grab active:cursor-grabbing transition"
                style={{ background: dragIdx === idx ? "rgba(212,175,55,0.15)" : "transparent", opacity: hidden.has(item.href) ? 0.4 : 1 }}>
                <div className="flex flex-col">
                  <button onClick={() => { if (idx === 0) return; const n = [...order]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; setOrder(n); }}
                    disabled={idx === 0} className="text-white/40 text-[10px] leading-none hover:text-[#D4AF37] disabled:opacity-20">▲</button>
                  <button onClick={() => { if (idx >= sortedItems.length - 1) return; const n = [...order]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; setOrder(n); }}
                    disabled={idx >= sortedItems.length - 1} className="text-white/40 text-[10px] leading-none hover:text-[#D4AF37] disabled:opacity-20">▼</button>
                </div>
                <span className="text-base">{item.icon}</span>
                <span className="text-white/70 text-xs flex-1">{item.label}</span>
                {!item.fixed && (
                  <button onClick={() => setHidden(prev => { const n = new Set(prev); n.has(item.href) ? n.delete(item.href) : n.add(item.href); return n; })}
                    className="text-[9px] px-1.5 py-0.5 rounded"
                    style={{ background: hidden.has(item.href) ? "#DC262620" : "#3D8C5A20", color: hidden.has(item.href) ? "#DC2626" : "#3D8C5A" }}>
                    {hidden.has(item.href) ? "مخفي" : "👁"}
                  </button>
                )}
              </div>
            );
          }

          return (
            <div key={item.href}>
              {groupLabel}
              <Link href={item.href}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all ${
                  active ? "nav-active text-[#D4AF37] font-semibold" : "text-white/50 hover:text-white/80 hover:bg-white/5"
                }`}>
                <span className="text-base">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {count > 0 && item.badgeKey === "focus" ? (<>
                  <span className="min-w-[18px] h-5 flex items-center justify-center rounded-full text-[10px] font-bold px-1"
                    style={{ background: "#3D8C5A", color: "#fff" }}>
                    {count > 99 ? "99+" : count}
                  </span>
                  {counts.tasks > count && (
                    <span className="min-w-[18px] h-5 flex items-center justify-center rounded-full text-[10px] font-bold px-1"
                      style={{ background: "#9CA3AF30", color: "#9CA3AF" }}>
                      {counts.tasks}
                    </span>
                  )}
                </>) : count > 0 ? (
                  <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full text-[10px] font-bold px-1.5"
                    style={{ background: "#D4AF37", color: "#1A1A2E" }}>
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* تخصيص + User */}
      <div className="relative z-10 px-4 py-3 border-t border-white/10 space-y-2">
        {editMode ? (
          <div className="flex gap-2">
            <button onClick={saveOrder} className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-white" style={{ background: "#D4AF37" }}>حفظ</button>
            <button onClick={resetOrder} className="flex-1 py-1.5 rounded-lg text-[10px] text-white/50 bg-white/5">افتراضي</button>
            <button onClick={() => setEditMode(false)} className="flex-1 py-1.5 rounded-lg text-[10px] text-white/50 bg-white/5">إلغاء</button>
          </div>
        ) : (
          <button onClick={() => setEditMode(true)} className="w-full py-1.5 rounded-lg text-[10px] text-white/30 hover:text-white/50 transition">
            ⚙ تخصيص القائمة
          </button>
        )}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{ background: "linear-gradient(135deg, #3D3468, #D4AF37)" }}>م</div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">محمد الأمين</p>
            <p className="text-white/30 text-xs truncate">مشرف النظام</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
