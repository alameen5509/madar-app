"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Project { id:string; title:string; clientName?:string; description?:string; currentPhase:number; status:string; priority?:string; dueDate?:string; createdAt:string; updatedAt:string }

const PHASES = ["بناء الفكرة","الوثيقة العامة","المستخدمين","التأسيس","الاستضافة","التطوير","العميل"];
const PHASE_ICONS = ["📝","📁","👤","⚡","🔐","🚀","💬"];
const STATUS_MAP: Record<string,{label:string;color:string}> = { active:{label:"نشط",color:"#3D8C5A"}, completed:{label:"مكتمل",color:"#5E5495"}, onHold:{label:"معلّق",color:"#F59E0B"} };
const is = { background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" } as const;

export default function WebProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [isOwner, setIsOwner] = useState(true);
  const [np, setNp] = useState({ title: "", client: "", desc: "", priority: "medium", dueDate: "" });
  const [filter, setFilter] = useState<"all"|"active"|"completed"|"onHold">("all");
  const [syncStatus, setSyncStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setSyncStatus("");
    try {
      const { data } = await api.get("/api/web-projects");
      setProjects(data ?? []);
      // Check if any project is owned by this user (has ownerId matching)
      const works = await api.get("/api/works").then(r => r.data?.length ?? 0).catch(() => 0);
      setIsOwner(works > 0 || (data ?? []).some((p: Project & { ownerId?: string }) => p.ownerId));
      setSyncStatus("");
    } catch {
      setSyncStatus("⚠️ فشل التحميل");
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!np.title.trim()) return;
    try {
      await api.post("/api/web-projects", { title: np.title.trim(), clientName: np.client.trim() || undefined, description: np.desc.trim() || undefined, priority: np.priority, dueDate: np.dueDate || undefined });
      setNp({ title: "", client: "", desc: "", priority: "medium", dueDate: "" }); setShowNew(false);
      load();
    } catch { alert("فشل الإنشاء"); }
  }

  const PRIORITIES: Record<string,{label:string;color:string;icon:string}> = {
    urgent: { label: "عاجل", color: "#DC2626", icon: "🔴" },
    high: { label: "مرتفع", color: "#F59E0B", icon: "🟡" },
    medium: { label: "متوسط", color: "#3B82F6", icon: "🔵" },
    low: { label: "منخفض", color: "#6B7280", icon: "⚪" },
  };

  const priorityOrder: Record<string,number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const filtered = (filter === "all" ? projects : projects.filter(p => p.status === filter))
    .sort((a, b) => (priorityOrder[a.priority ?? "medium"] ?? 2) - (priorityOrder[b.priority ?? "medium"] ?? 2));

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur border-b px-4 sm:px-6 py-3 pr-14 md:pr-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>🌐 إدارة المواقع</h2>
        <p className="text-[10px]" style={{ color: "var(--muted)" }}>{projects.length} موقع</p>
        <div className="flex gap-1.5 mt-2">
          {(["all","active","completed","onHold"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className="px-3 py-2 rounded-xl text-xs font-bold transition min-h-[40px]"
              style={{ background: filter === f ? "#2D6B9E" : "var(--bg)", color: filter === f ? "#fff" : "var(--muted)", border: `1px solid ${filter === f ? "#2D6B9E" : "var(--card-border)"}` }}>
              {f === "all" ? "الكل" : STATUS_MAP[f]?.label ?? f}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 space-y-3 max-w-3xl mx-auto">
        {isOwner && <button onClick={() => setShowNew(!showNew)} className="w-full py-3 min-h-[44px] rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #2D6B9E, #D4AF37)" }}>+ موقع جديد</button>}
        {syncStatus && <p className="text-center text-[10px] py-1" style={{ color: "var(--muted)" }}>{syncStatus}</p>}

        {showNew && (
          <div className="rounded-2xl border p-5 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <input value={np.title} onChange={e => setNp({...np, title: e.target.value})} placeholder="اسم الموقع *" className="w-full px-4 py-3 rounded-xl border text-sm font-bold focus:outline-none" style={is} />
            <input value={np.client} onChange={e => setNp({...np, client: e.target.value})} placeholder="اسم العميل" className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none" style={is} />
            <textarea value={np.desc} onChange={e => setNp({...np, desc: e.target.value})} placeholder="وصف المشروع" rows={2} className="w-full px-4 py-2.5 rounded-xl border text-sm resize-none focus:outline-none" style={is} />
            <div>
              <label className="text-[10px] font-bold block mb-1" style={{ color: "var(--text)" }}>الأولوية</label>
              <div className="flex gap-1.5">
                {Object.entries(PRIORITIES).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => setNp({...np, priority: k})}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold transition min-h-[40px]"
                    style={{ background: np.priority === k ? v.color : "var(--bg)", color: np.priority === k ? "#fff" : v.color, border: `1px solid ${np.priority === k ? v.color : "var(--card-border)"}` }}>
                    {v.icon} {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold block mb-1" style={{ color: "var(--text)" }}>تاريخ التسليم (اختياري)</label>
              <input type="date" value={np.dueDate} onChange={e => setNp({...np, dueDate: e.target.value})} className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none" style={is} />
            </div>
            <div className="flex gap-2">
              <button onClick={create} disabled={!np.title.trim()} className="flex-1 py-3 min-h-[44px] rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#2D6B9E" }}>إنشاء</button>
              <button onClick={() => setShowNew(false)} className="py-3 px-6 min-h-[44px] rounded-xl text-sm" style={{ color: "var(--muted)" }}>إلغاء</button>
            </div>
          </div>
        )}

        {loading && <p className="text-center py-12 animate-pulse text-sm" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}

        {!loading && filtered.map(p => {
          const st = STATUS_MAP[p.status] ?? STATUS_MAP.active;
          const pr = PRIORITIES[p.priority ?? "medium"] ?? PRIORITIES.medium;
          let completedSet: number[] = [];
          try { completedSet = JSON.parse(localStorage.getItem("wp_completed_" + p.id) ?? "[]"); } catch {}
          const completedCount = completedSet.length;
          const phasePct = Math.round((completedCount / 7) * 100);
          const currentPhaseNum = [1,2,3,4,5,6,7].find(n => !completedSet.includes(n)) ?? 7;
          const currentPhaseName = PHASES[currentPhaseNum - 1] ?? "";
          const currentPhaseIcon = PHASE_ICONS[currentPhaseNum - 1] ?? "📝";
          // Counters from localStorage
          let p1Tasks = 0, p3Cmds = 0, p5Cmds = 0, p6Reqs = 0, p7Users = 0;
          try { p1Tasks = JSON.parse(localStorage.getItem("wp_p1tasks_" + p.id) ?? "[]").length; } catch {}
          try { p3Cmds = JSON.parse(localStorage.getItem("wp_p3_" + p.id) ?? "[]").length; } catch {}
          try { p5Cmds = JSON.parse(localStorage.getItem("wp_p5_" + p.id) ?? "[]").length; } catch {}
          try { p6Reqs = JSON.parse(localStorage.getItem("wp_p6_" + p.id) ?? "[]").length; } catch {}
          try { p7Users = JSON.parse(localStorage.getItem("wp_p7_" + p.id) ?? "[]").length; } catch {}
          const isOverdue = p.dueDate && new Date(p.dueDate) < new Date() && completedCount < 7;
          return (
            <div key={p.id} className="rounded-2xl border overflow-hidden transition-all hover:shadow-lg" style={{ background: "var(--card)", borderColor: isOverdue ? "#DC262640" : "var(--card-border)" }}>
              <Link href={"/web-projects/" + p.id} className="block p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: pr.color + "15" }}>🌐</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{p.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {p.clientName && <span className="text-[10px]" style={{ color: "var(--muted)" }}>👤 {p.clientName}</span>}
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: pr.color + "15", color: pr.color }}>{pr.icon} {pr.label}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#2D6B9E15", color: "#2D6B9E" }}>{currentPhaseIcon} {currentPhaseName}</span>
                      {p.dueDate && <span className="text-[10px] font-bold" style={{ color: isOverdue ? "#DC2626" : "var(--muted)" }}>{isOverdue ? "⚠️ " : "📅 "}{new Date(p.dueDate).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>}
                    </div>
                  </div>
                  <span className="text-2xl">{completedCount === 7 ? "✅" : currentPhaseIcon}</span>
                </div>
                {/* Counters */}
                <div className="flex gap-2 flex-wrap mb-2">
                  {p1Tasks > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "#2D6B9E10", color: "#2D6B9E" }}>📝 {p1Tasks} مهمة</span>}
                  {p7Users > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "#5E549510", color: "#5E5495" }}>👤 {p7Users} مستخدم</span>}
                  {p3Cmds > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "#F59E0B10", color: "#F59E0B" }}>⚡ {p3Cmds} أمر</span>}
                  {p5Cmds > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "#3D8C5A10", color: "#3D8C5A" }}>🚀 {p5Cmds} تطوير</span>}
                  {p6Reqs > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "#3B82F610", color: "#3B82F6" }}>💬 {p6Reqs} طلب</span>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#E5E7EB" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${phasePct}%`, background: completedCount === 7 ? "#3D8C5A" : "#2D6B9E" }} />
                  </div>
                  <span className="text-[10px] font-bold" style={{ color: "#2D6B9E" }}>{completedCount}/7</span>
                </div>
              </Link>
              {/* Actions: priority change + edit + delete (owner only) */}
              {isOwner && <div className="flex items-center gap-1.5 px-4 pb-3 -mt-1 flex-wrap">
                {Object.entries(PRIORITIES).map(([k, v]) => (
                  <button key={k} onClick={(e) => { e.stopPropagation(); setProjects(prev => prev.map(x => x.id === p.id ? { ...x, priority: k } : x)); api.put("/api/web-projects/" + p.id, { priority: k }).catch(() => {}); }}
                    className="text-[10px] px-2 py-1.5 rounded-lg font-bold min-h-[32px] transition"
                    style={{ background: p.priority === k ? v.color : "transparent", color: p.priority === k ? "#fff" : v.color, border: `1px solid ${p.priority === k ? v.color : v.color + "30"}` }}>
                    {v.icon}
                  </button>
                ))}
                <div className="flex-1" />
                <Link href={"/web-projects/" + p.id} className="text-[10px] px-3 py-1.5 rounded-lg font-bold min-h-[32px] flex items-center" style={{ color: "#5E5495", background: "#5E549510" }}>✏️ تعديل</Link>
                <button onClick={async (e) => {
                  e.stopPropagation();
                  if (!confirm("حذف \"" + p.title + "\"؟")) return;
                  try { await api.delete("/api/web-projects/" + p.id); } catch {}
                  setProjects(prev => prev.filter(x => x.id !== p.id));
                }} className="text-[10px] px-2 py-1.5 rounded-lg min-h-[32px] hover:bg-red-50" style={{ color: "#DC2626" }}>🗑️</button>
              </div>}
            </div>
          );
        })}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16"><p className="text-4xl mb-3">🌐</p><p className="font-bold" style={{ color: "var(--text)" }}>لا توجد مواقع</p></div>
        )}
      </div>
    </main>
  );
}
