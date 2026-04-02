"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Role {
  id: string; title: string; organization?: string; pulseStatus: string;
  pulseNote?: string; lastReviewDate?: string; nextReviewDate?: string;
  color: string; icon: string; workId?: string; isAuto?: boolean;
  autoSource?: string; notesCount?: number; pendingDevCount?: number;
}
interface Work {
  id: string; name: string; type: string; status: string;
  sector?: string; role?: string; employer?: string;
  jobs?: { id: string; title: string; status: string }[];
}

const PULSE: Record<string, { label: string; color: string; bg: string }> = {
  green: { label: "مستقر", color: "#3D8C5A", bg: "#3D8C5A15" },
  yellow: { label: "يحتاج متابعة", color: "#F59E0B", bg: "#F59E0B15" },
  red: { label: "حرج", color: "#DC2626", bg: "#DC262615" },
};

export default function WarRoomIndexPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, w] = await Promise.all([
        api.get("/api/war-room/roles").then(r => r.data ?? []).catch(() => []),
        api.get("/api/works").then(r => r.data ?? []).catch(() => []),
      ]);
      setRoles(Array.isArray(r) ? r : []);
      setWorks(Array.isArray(w) ? w : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Build list: each work + its jobs, with their leadership role info
  const items: { workId: string; workName: string; workType: string; icon: string; color: string; role?: Role; href: string }[] = [];

  for (const w of works) {
    const role = roles.find(r => r.workId === w.id && !r.autoSource?.includes("job"));
    items.push({
      workId: w.id,
      workName: w.name,
      workType: w.type === "job" ? "وظيفة" : "رجل أعمال",
      icon: w.type === "job" ? "💼" : "🏢",
      color: w.type === "job" ? "#2D6B9E" : "#D4AF37",
      role,
      href: "/works/" + w.id,
    });
    if (w.jobs) {
      for (const j of w.jobs) {
        const jRole = roles.find(r => r.workId === j.id || (r.title?.includes(j.title) && r.workId === w.id));
        items.push({
          workId: j.id,
          workName: j.title + " — " + w.name,
          workType: "وظيفة فرعية",
          icon: "👔",
          color: "#5E5495",
          role: jRole,
          href: "/works/" + w.id + "/jobs/" + j.id,
        });
      }
    }
  }

  const redCount = items.filter(i => i.role?.pulseStatus === "red").length;
  const yellowCount = items.filter(i => i.role?.pulseStatus === "yellow").length;
  const totalDevReqs = items.reduce((s, i) => s + (i.role?.pendingDevCount ?? 0), 0);

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur border-b px-4 sm:px-6 py-3 pr-14 md:pr-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>🎖️ غرفة القيادة</h2>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs" style={{ color: "var(--muted)" }}>{items.length} عمل/وظيفة</span>
          {redCount > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#DC262615", color: "#DC2626" }}>🔴 {redCount} حرج</span>}
          {yellowCount > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#F59E0B15", color: "#F59E0B" }}>🟡 {yellowCount} متابعة</span>}
          {totalDevReqs > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#5E549515", color: "#5E5495" }}>🔧 {totalDevReqs} طلب تطوير</span>}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 space-y-3 max-w-3xl mx-auto">
        {loading && <p className="text-center py-12 animate-pulse text-sm" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}

        {!loading && items.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🎖️</p>
            <p className="font-bold" style={{ color: "var(--text)" }}>لا توجد أعمال</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>أضف أعمال من صفحة "الأعمال" لتظهر غرف القيادة</p>
            <Link href="/works" className="inline-block mt-4 px-6 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #2D6B9E, #D4AF37)" }}>
              الذهاب للأعمال
            </Link>
          </div>
        )}

        {!loading && items.map((item, idx) => {
          const pulse = PULSE[item.role?.pulseStatus ?? "green"] ?? PULSE.green;
          const hasRole = !!item.role && !item.role.isAuto;
          const dueReview = item.role?.nextReviewDate && new Date(item.role.nextReviewDate) <= new Date();

          return (
            <Link key={idx} href={item.href}
              className="block rounded-2xl border overflow-hidden transition-all hover:shadow-lg hover:border-[#5E5495]"
              style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <div className="p-4" style={{ borderRight: `4px solid ${item.color}` }}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{item.workName}</p>
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: pulse.bg, color: pulse.color }}>{pulse.label}</span>
                      {dueReview && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold animate-pulse" style={{ background: "#F59E0B15", color: "#F59E0B" }}>📋 مراجعة</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${item.color}15`, color: item.color }}>{item.workType}</span>
                      {item.role?.lastReviewDate && <span className="text-[9px]" style={{ color: "var(--muted)" }}>آخر مراجعة: {new Date(item.role.lastReviewDate).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>}
                      {(item.role?.notesCount ?? 0) > 0 && <span className="text-[9px]" style={{ color: "#5E5495" }}>📝 {item.role?.notesCount}</span>}
                      {(item.role?.pendingDevCount ?? 0) > 0 && <span className="text-[9px]" style={{ color: "#D4AF37" }}>🔧 {item.role?.pendingDevCount}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    {hasRole ? (
                      <div className="w-3 h-3 rounded-full" style={{ background: pulse.color }} />
                    ) : (
                      <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "var(--bg)", color: "var(--muted)" }}>جديد</span>
                    )}
                    <span className="text-xs" style={{ color: "#5E5495" }}>فتح ←</span>
                  </div>
                </div>
                {item.role?.pulseNote && (
                  <p className="text-[10px] mt-2 px-3 py-1.5 rounded-lg" style={{ background: pulse.bg, color: pulse.color }}>💬 {item.role.pulseNote}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
