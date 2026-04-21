"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Project { id:string; title:string; clientName?:string; description?:string; currentPhase:number; status:string; priority?:string; dueDate?:string; projectType?:string; createdAt:string; updatedAt:string }

const PHASES = ["التحضير","التأسيس","الاستضافة","التطوير","العميل"];
const PHASE_ICONS = ["📋","⚡","🔐","🚀","💬"];
const STATUS_MAP: Record<string,{label:string;color:string}> = { active:{label:"نشط",color:"#3D8C5A"}, completed:{label:"مكتمل",color:"#5E5495"}, onHold:{label:"معلّق",color:"#F59E0B"} };
const is = { background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" } as const;

export default function WebProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [isOwner, setIsOwner] = useState(true);
  const [np, setNp] = useState({ title: "", client: "", desc: "", priority: "medium", dueDate: "", type: "private" as "public"|"private" });
  const [filter, setFilter] = useState<"all"|"1"|"2"|"3"|"4"|"5">("all");
  const [typeTab, setTypeTab] = useState<"all"|"public"|"private">("all");
  const [syncStatus, setSyncStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setSyncStatus("");
    try {
      const { data } = await api.get("/api/web-projects");
      // Merge projectType from localStorage
      const withTypes = (data ?? []).map((p: Project) => ({ ...p, projectType: p.projectType || localStorage.getItem("wp_type_" + p.id) || "private" }));
      setProjects(withTypes);
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
      const { data } = await api.post("/api/web-projects", { title: np.title.trim(), clientName: np.client.trim() || undefined, description: np.desc.trim() || undefined, priority: np.priority, dueDate: np.dueDate || undefined });
      // Save type locally
      if (data?.id) { try { localStorage.setItem("wp_type_" + data.id, np.type); } catch {} }
      setNp({ title: "", client: "", desc: "", priority: "medium", dueDate: "", type: "private" }); setShowNew(false);
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
  const filtered = projects
    .filter(p => typeTab === "all" || (p.projectType ?? "private") === typeTab)
    .filter(p => {
      if (filter === "all") return true;
      let completedSet: number[] = [];
      try { completedSet = JSON.parse(localStorage.getItem("wp_completed_" + p.id) ?? "[]"); } catch {}
      const currentPhaseNum = [1,2,3,4,5].find(n => !completedSet.includes(n)) ?? 5;
      return String(currentPhaseNum) === filter;
    })
    .sort((a, b) => (priorityOrder[a.priority ?? "medium"] ?? 2) - (priorityOrder[b.priority ?? "medium"] ?? 2));

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur border-b px-4 sm:px-6 py-3 pr-14 md:pr-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>🌐 إدارة المواقع</h2>
        <p className="text-[10px]" style={{ color: "var(--muted)" }}>{projects.length} موقع</p>
        {/* Type tabs */}
        <div className="flex gap-2 mt-2">
          {([["all","الكل","#2D6B9E"],["public","🌍 عامة","#5E5495"],["private","🔒 خاصة","#D4AF37"]] as const).map(([k, l, c]) => (
            <button key={k} onClick={() => setTypeTab(k)} className="flex-1 py-2.5 rounded-xl text-xs font-bold transition min-h-[40px]"
              style={{ background: typeTab === k ? c : "var(--bg)", color: typeTab === k ? "#fff" : c, border: `1px solid ${typeTab === k ? c : "var(--card-border)"}` }}>
              {l} ({(typeTab === "all" ? projects : projects.filter(p => (p.projectType ?? "private") === k)).length})
            </button>
          ))}
        </div>
        {/* Phase filters */}
        <div className="flex gap-1.5 mt-1.5 overflow-x-auto pb-0.5">
          <button onClick={() => setFilter("all")} className="px-3 py-2 rounded-xl text-xs font-bold transition min-h-[40px] whitespace-nowrap"
            style={{ background: filter === "all" ? "#2D6B9E" : "var(--bg)", color: filter === "all" ? "#fff" : "var(--muted)", border: `1px solid ${filter === "all" ? "#2D6B9E" : "var(--card-border)"}` }}>
            الكل
          </button>
          {PHASES.map((p, i) => (
            <button key={i} onClick={() => setFilter(String(i + 1) as typeof filter)} className="px-3 py-2 rounded-xl text-xs font-bold transition min-h-[40px] whitespace-nowrap"
              style={{ background: filter === String(i + 1) ? "#2D6B9E" : "var(--bg)", color: filter === String(i + 1) ? "#fff" : "var(--muted)", border: `1px solid ${filter === String(i + 1) ? "#2D6B9E" : "var(--card-border)"}` }}>
              {PHASE_ICONS[i]} {p}
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
            <div>
              <label className="text-[10px] font-bold block mb-1" style={{ color: "var(--text)" }}>نوع المنصة</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setNp({...np, type: "public"})} className="flex-1 py-2.5 rounded-xl text-xs font-bold min-h-[40px] transition"
                  style={{ background: np.type === "public" ? "#5E5495" : "var(--bg)", color: np.type === "public" ? "#fff" : "#5E5495", border: `1px solid ${np.type === "public" ? "#5E5495" : "var(--card-border)"}` }}>
                  🌍 عامة
                </button>
                <button type="button" onClick={() => setNp({...np, type: "private"})} className="flex-1 py-2.5 rounded-xl text-xs font-bold min-h-[40px] transition"
                  style={{ background: np.type === "private" ? "#D4AF37" : "var(--bg)", color: np.type === "private" ? "#fff" : "#D4AF37", border: `1px solid ${np.type === "private" ? "#D4AF37" : "var(--card-border)"}` }}>
                  🔒 خاصة (عميل)
                </button>
              </div>
            </div>
            <input value={np.client} onChange={e => setNp({...np, client: e.target.value})} placeholder={np.type === "private" ? "اسم العميل *" : "اسم العميل (اختياري)"} className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none" style={is} />
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
          const completedCount = completedSet.filter(n => n >= 1 && n <= 5).length;
          const phasePct = Math.round((completedCount / 5) * 100);
          const currentPhaseNum = [1,2,3,4,5].find(n => !completedSet.includes(n)) ?? 5;
          const currentPhaseName = PHASES[currentPhaseNum - 1] ?? "";
          const currentPhaseIcon = PHASE_ICONS[currentPhaseNum - 1] ?? "📋";
          // Counters now stored in API — shown in detail page
          const p1Tasks = 0, p3Cmds = 0, p5Cmds = 0, p6Reqs = 0, p7Users = 0;
          let siteUrl = "";
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
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: (p.projectType ?? "private") === "public" ? "#5E549515" : "#D4AF3715", color: (p.projectType ?? "private") === "public" ? "#5E5495" : "#D4AF37" }}>{(p.projectType ?? "private") === "public" ? "🌍 عامة" : "🔒 خاصة"}</span>
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
                  <span className="text-[10px] font-bold" style={{ color: "#2D6B9E" }}>{completedCount}/5</span>
                </div>
              </Link>
              {/* Visit site button */}
              {siteUrl && (
                <a href={siteUrl} target="_blank" onClick={e => e.stopPropagation()}
                  className="flex items-center gap-2 mx-4 mb-2 py-2.5 px-4 rounded-xl text-xs font-bold transition hover:opacity-90 min-h-[40px]"
                  style={{ background: "linear-gradient(135deg, #2D6B9E, #3D8C5A)", color: "#fff" }}>
                  🌐 زيارة الموقع <span className="font-mono text-[10px] flex-1 truncate opacity-80" dir="ltr">{siteUrl.replace("https://","").replace("http://","")}</span> ←
                </a>
              )}
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
                  try { await api.delete("/api/web-projects/" + p.id); setProjects(prev => prev.filter(x => x.id !== p.id)); } catch { alert("فشل حذف الموقع"); }
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
