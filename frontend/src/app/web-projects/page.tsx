"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Project { id:string; title:string; clientName?:string; description?:string; currentPhase:number; status:string; createdAt:string; updatedAt:string }

const PHASES = ["بناء الفكرة","الوثيقة العامة","المستخدمين","التأسيس","الاستضافة","التطوير","العميل"];
const PHASE_ICONS = ["📝","📁","👤","⚡","🔐","🚀","💬"];
const STATUS_MAP: Record<string,{label:string;color:string}> = { active:{label:"نشط",color:"#3D8C5A"}, completed:{label:"مكتمل",color:"#5E5495"}, onHold:{label:"معلّق",color:"#F59E0B"} };
const is = { background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" } as const;

export default function WebProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [np, setNp] = useState({ title: "", client: "", desc: "" });
  const [filter, setFilter] = useState<"all"|"active"|"completed"|"onHold">("all");

  const LS_KEY = "madar_web_projects";
  function lsGet(): Project[] { try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); } catch { return []; } }
  function lsSave(p: Project[]) { localStorage.setItem(LS_KEY, JSON.stringify(p)); }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/web-projects");
      if (data && data.length >= 0) { setProjects(data); lsSave(data); }
      else { setProjects(lsGet()); }
    } catch { setProjects(lsGet()); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!np.title.trim()) return;
    const newP: Project = { id: "wp_" + Date.now(), title: np.title.trim(), clientName: np.client.trim() || undefined, description: np.desc.trim() || undefined, currentPhase: 1, status: "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    try {
      const { data } = await api.post("/api/web-projects", { title: np.title, clientName: np.client || undefined, description: np.desc || undefined });
      if (data?.id) newP.id = data.id;
    } catch {}
    const updated = [newP, ...projects];
    setProjects(updated); lsSave(updated);
    setNp({ title: "", client: "", desc: "" }); setShowNew(false);
  }

  const filtered = filter === "all" ? projects : projects.filter(p => p.status === filter);

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
        <button onClick={() => setShowNew(!showNew)} className="w-full py-3 min-h-[44px] rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #2D6B9E, #D4AF37)" }}>+ موقع جديد</button>

        {showNew && (
          <div className="rounded-2xl border p-5 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <input value={np.title} onChange={e => setNp({...np, title: e.target.value})} placeholder="اسم الموقع *" className="w-full px-4 py-3 rounded-xl border text-sm font-bold focus:outline-none" style={is} />
            <input value={np.client} onChange={e => setNp({...np, client: e.target.value})} placeholder="اسم العميل" className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none" style={is} />
            <textarea value={np.desc} onChange={e => setNp({...np, desc: e.target.value})} placeholder="وصف المشروع" rows={2} className="w-full px-4 py-2.5 rounded-xl border text-sm resize-none focus:outline-none" style={is} />
            <div className="flex gap-2">
              <button onClick={create} disabled={!np.title.trim()} className="flex-1 py-3 min-h-[44px] rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#2D6B9E" }}>إنشاء</button>
              <button onClick={() => setShowNew(false)} className="py-3 px-6 min-h-[44px] rounded-xl text-sm" style={{ color: "var(--muted)" }}>إلغاء</button>
            </div>
          </div>
        )}

        {loading && <p className="text-center py-12 animate-pulse text-sm" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}

        {!loading && filtered.map(p => {
          const st = STATUS_MAP[p.status] ?? STATUS_MAP.active;
          let completedCount = 0;
          try { completedCount = JSON.parse(localStorage.getItem("wp_completed_" + p.id) ?? "[]").length; } catch {}
          const phasePct = Math.round((completedCount / 7) * 100);
          return (
            <Link key={p.id} href={"/web-projects/" + p.id} className="block rounded-2xl border overflow-hidden transition-all hover:shadow-lg hover:border-[#2D6B9E]" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: "#2D6B9E15" }}>🌐</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{p.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.clientName && <span className="text-[10px]" style={{ color: "var(--muted)" }}>👤 {p.clientName}</span>}
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: st.color + "15", color: st.color }}>{st.label}</span>
                    </div>
                  </div>
                  <span className="text-2xl">{PHASE_ICONS[p.currentPhase - 1] ?? "📝"}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#E5E7EB" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${phasePct}%`, background: "#2D6B9E" }} />
                  </div>
                  <span className="text-[10px] font-bold" style={{ color: "#2D6B9E" }}>{completedCount}/7 مراحل</span>
                </div>
                <p className="text-[10px]" style={{ color: "var(--muted)" }}>{PHASE_ICONS[p.currentPhase - 1]} {PHASES[p.currentPhase - 1]}</p>
              </div>
            </Link>
          );
        })}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16"><p className="text-4xl mb-3">🌐</p><p className="font-bold" style={{ color: "var(--text)" }}>لا توجد مواقع</p></div>
        )}
      </div>
    </main>
  );
}
