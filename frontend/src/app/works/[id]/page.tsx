"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { GeometricDivider } from "@/components/IslamicPattern";

interface WorkData {
  id: string; type: string; name: string; title?: string; employer?: string;
  salary: number; startDate?: string; endDate?: string; status: string;
  sector?: string; role?: string; ownershipPercentage?: number;
  jobs: { id: string; title: string; description?: string; salary: number; status: string; startDate?: string }[];
}

export default function WorkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [work, setWork] = useState<WorkData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [showAddJob, setShowAddJob] = useState(false);
  const [jTitle, setJTitle] = useState(""); const [jDesc, setJDesc] = useState(""); const [jSalary, setJSalary] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const res = await api.get(`/api/works/${id}`);
      const raw = res.data;
      // Handle both wrapped {succeeded, data: {...}} and direct {...} responses
      const work = raw?.succeeded !== undefined ? raw.data : raw;
      if (!work || !work.id) {
        setLoadError(`لم يتم العثور على العمل (id=${id})`);
        return;
      }
      setWork(work);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setLoadError(status === 404 ? `العمل غير موجود (id=${id})` : `خطأ في تحميل العمل (${status ?? "network"})`);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function addJob() {
    if (!jTitle.trim()) return;
    await api.post(`/api/works/${id}/jobs`, { title: jTitle.trim(), description: jDesc.trim() || undefined, salary: Number(jSalary) || 0 }).catch(() => {});
    setJTitle(""); setJDesc(""); setJSalary(""); setShowAddJob(false); load();
  }

  if (loadError) return (
    <main className="flex-1 flex flex-col items-center justify-center gap-3" style={{ background: "var(--bg)" }}>
      <p style={{ color: "var(--muted)" }}>{loadError}</p>
      <button onClick={load} className="text-sm font-medium hover:underline" style={{ color: "#C9A84C" }}>إعادة المحاولة</button>
    </main>
  );

  if (!work) return (
    <main className="flex-1 flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <p className="animate-pulse" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>
    </main>
  );

  // وظيفة مباشرة → redirect to job page (use same job features via /jobs/:circleId)
  if (work.type === "job") {
    return (
      <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b px-6 py-4 pr-14 md:pr-6" style={{ borderColor: "var(--card-border)" }}>
          <div className="flex items-center gap-1 text-[10px] mb-2">
            <Link href="/works" className="hover:underline" style={{ color: "var(--muted)" }}>الأعمال</Link>
            <span style={{ color: "var(--muted)" }}>←</span>
            <span className="font-semibold" style={{ color: "#2D6B9E" }}>{work.name}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ background: "#2D6B9E15" }}>💼</div>
            <div className="flex-1">
              <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>{work.name}</h2>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>
                {work.title && `${work.title} · `}{work.employer && `${work.employer} · `}{work.salary > 0 && `${work.salary.toLocaleString()} ريال`}
              </p>
            </div>
            <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: work.status === "active" ? "#3D8C5A15" : "#6B728015", color: work.status === "active" ? "#3D8C5A" : "#6B7280" }}>
              {work.status === "active" ? "نشط" : "منتهي"}
            </span>
          </div>
          {/* Nav to job sub-pages using work.id as job ID */}
          <nav className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5">
            {[
              { href: `/jobs/${id}`, label: "نظرة عامة", icon: "🏠" },
              { href: `/jobs/${id}/dimensions`, label: "الجوانب والأهداف", icon: "📁" },
              { href: `/jobs/${id}/team`, label: "الفريق", icon: "👥" },
              { href: `/jobs/${id}/kpis`, label: "KPIs", icon: "📊" },
              { href: `/jobs/${id}/achievements`, label: "الإنجازات", icon: "🏆" },
              { href: `/jobs/${id}/skills`, label: "المهارات", icon: "💡" },
              { href: `/jobs/${id}/meetings`, label: "الاجتماعات", icon: "📅" },
              { href: `/jobs/${id}/lessons`, label: "الدروس", icon: "📝" },
              { href: `/jobs/${id}/board`, label: "السبورة", icon: "🎨" },
            ].map(n => (
              <Link key={n.href} href={n.href}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition whitespace-nowrap"
                style={{ background: "#F3F4F6", color: "#6B7280" }}>
                {n.icon} {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <div className="px-6 py-5">
          <p className="text-xs text-center" style={{ color: "var(--muted)" }}>اختر قسماً من الأعلى للدخول</p>
        </div>
      </main>
    );
  }

  // رجل أعمال → show jobs list
  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b px-6 py-4 pr-14 md:pr-6" style={{ borderColor: "var(--card-border)" }}>
        <div className="flex items-center gap-1 text-[10px] mb-2">
          <Link href="/works" className="hover:underline" style={{ color: "var(--muted)" }}>الأعمال</Link>
          <span style={{ color: "var(--muted)" }}>←</span>
          <span className="font-semibold" style={{ color: "#D4AF37" }}>{work.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ background: "#D4AF3715" }}>🏢</div>
          <div className="flex-1">
            <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>{work.name}</h2>
            <p className="text-[10px]" style={{ color: "var(--muted)" }}>
              {work.sector && `${work.sector} · `}{work.role && `${work.role} · `}{work.ownershipPercentage ? `${work.ownershipPercentage}% ملكية` : ""}
            </p>
          </div>
          <button onClick={() => setShowAddJob(!showAddJob)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white"
            style={{ background: "#D4AF37" }}>+ وظيفة</button>
        </div>
      </header>

      <div className="px-6 py-5 space-y-4">
        {/* Add job form */}
        {showAddJob && (
          <div className="rounded-2xl p-5 border-2 space-y-3 fade-up" style={{ background: "var(--card)", borderColor: "#D4AF3740" }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold" style={{ color: "#D4AF37" }}>وظيفة جديدة</p>
              <div className="flex gap-2">
                <button onClick={() => setShowAddJob(false)} className="px-3 py-1 rounded-lg text-[10px] text-[#6B7280] bg-gray-100">إلغاء</button>
                <button onClick={addJob} className="px-3 py-1 rounded-lg text-[10px] font-bold text-white" style={{ background: "#D4AF37" }}>إضافة</button>
              </div>
            </div>
            <input value={jTitle} onChange={e => setJTitle(e.target.value)} placeholder="المسمى الوظيفي *" autoFocus
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <input value={jDesc} onChange={e => setJDesc(e.target.value)} placeholder="وصف (اختياري)"
              className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <input type="number" value={jSalary} onChange={e => setJSalary(e.target.value)} placeholder="الراتب (اختياري)"
              className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
          </div>
        )}

        {/* Jobs list */}
        <GeometricDivider label={`وظائف ${work.name} (${work.jobs.length})`} />
        {work.jobs.length === 0 && !showAddJob && (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">💼</p>
            <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>لا توجد وظائف</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>أضف أول وظيفة تحت هذا العمل</p>
          </div>
        )}
        {work.jobs.map(j => (
          <Link key={j.id} href={`/works/${id}/jobs/${j.id}`}
            className="group block rounded-2xl p-5 border transition-all hover:shadow-lg hover:border-[#2D6B9E]"
            style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: "#2D6B9E15" }}>💼</div>
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{j.title}</p>
                <p className="text-[10px]" style={{ color: "var(--muted)" }}>
                  {j.salary > 0 && `${j.salary.toLocaleString()} ريال · `}
                  {j.status === "active" ? "نشطة" : "منتهية"}
                </p>
              </div>
              <span className="text-xs group-hover:translate-x-[-4px] transition-transform" style={{ color: "#2D6B9E" }}>←</span>
            </div>
          </Link>
        ))}
      </div>
      {/* ═══ طلبات العمل ═══ */}
      <WorkRequests workId={id} />
    </main>
  );
}

/* ═══ WORK REQUESTS COMPONENT ═══ */
function WorkRequests({ workId }: { workId: string }) {
  const [reqs, setReqs] = useState<{id:string;title:string;description?:string;status:string;priority:string;notes?:string;createdAt:string;convertedProjectId?:string}[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [nr, setNr] = useState({ title: "", desc: "", priority: "Medium", notes: "" });
  const [showConvert, setShowConvert] = useState<string | null>(null);
  const [conv, setConv] = useState({ projTitle: "", projDesc: "", tasks: "" });
  const is = { background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" } as const;

  const load = useCallback(async () => {
    try { const { data } = await api.get(`/api/works/${workId}/requests`); setReqs(data ?? []); } catch {}
  }, [workId]);
  useEffect(() => { load(); }, [load]);

  const priColor: Record<string,string> = { Urgent: "#DC2626", High: "#F59E0B", Medium: "#3B82F6", Low: "#6B7280" };
  const priLabel: Record<string,string> = { Urgent: "عاجل", High: "مرتفع", Medium: "متوسط", Low: "منخفض" };
  const stLabel: Record<string,string> = { Pending: "قيد الانتظار", InProgress: "جاري", Completed: "مكتمل", Cancelled: "ملغي" };
  const stColor: Record<string,string> = { Pending: "#F59E0B", InProgress: "#3B82F6", Completed: "#3D8C5A", Cancelled: "#6B7280" };

  async function create() {
    if (!nr.title.trim()) return;
    try { await api.post(`/api/works/${workId}/requests`, { title: nr.title, description: nr.desc || undefined, priority: nr.priority, notes: nr.notes || undefined }); setNr({ title: "", desc: "", priority: "Medium", notes: "" }); setShowNew(false); load(); } catch {}
  }

  async function convert(reqId: string) {
    try {
      await api.post(`/api/works/${workId}/requests/${reqId}/convert`, { projectTitle: conv.projTitle || undefined, taskTitles: conv.tasks ? conv.tasks.split("\n").filter(Boolean) : undefined });
      setShowConvert(null); setConv({ projTitle: "", projDesc: "", tasks: "" }); load();
    } catch {}
  }

  const pending = reqs.filter(r => r.status === "Pending" || r.status === "InProgress");
  const done = reqs.filter(r => r.status === "Completed" || r.status === "Cancelled");

  return (
    <div className="mt-4">
      <GeometricDivider label="طلبات العمل" />
      <div className="flex items-center justify-between mt-3 mb-2">
        <span className="text-xs font-bold" style={{ color: "var(--text)" }}>الطلبات ({reqs.length})</span>
        <button onClick={() => setShowNew(true)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: "#D4AF37" }}>+ طلب جديد</button>
      </div>

      {showNew && (
        <div className="rounded-xl border p-4 mb-3 space-y-2" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <input value={nr.title} onChange={e => setNr({...nr, title: e.target.value})} placeholder="عنوان الطلب *" className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={is} />
          <textarea value={nr.desc} onChange={e => setNr({...nr, desc: e.target.value})} placeholder="وصف..." rows={2} className="w-full px-3 py-2 rounded-lg border text-xs resize-none focus:outline-none" style={is} />
          <div className="flex gap-2">
            <select value={nr.priority} onChange={e => setNr({...nr, priority: e.target.value})} className="px-2 py-1.5 rounded-lg border text-xs" style={is}>
              <option value="Low">منخفض</option><option value="Medium">متوسط</option><option value="High">مرتفع</option><option value="Urgent">عاجل</option>
            </select>
            <div className="flex-1" />
            <button onClick={() => setShowNew(false)} className="px-3 py-1.5 rounded-lg text-[10px]" style={{ color: "var(--muted)" }}>إلغاء</button>
            <button onClick={create} disabled={!nr.title.trim()} className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#D4AF37" }}>إضافة</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {pending.map(r => (
          <div key={r.id} className="rounded-xl border p-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{r.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${stColor[r.status]}15`, color: stColor[r.status] }}>{stLabel[r.status]}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${priColor[r.priority]}15`, color: priColor[r.priority] }}>{priLabel[r.priority]}</span>
                  <span className="text-[9px]" style={{ color: "var(--muted)" }}>{new Date(r.createdAt).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => { setShowConvert(showConvert === r.id ? null : r.id); setConv({ projTitle: r.title, projDesc: r.description ?? "", tasks: "" }); }}
                  className="text-[9px] px-2 py-1 rounded-lg font-bold" style={{ background: "#5E549515", color: "#5E5495" }}>تحويل لمشروع</button>
                <button onClick={async () => { try { await api.patch(`/api/works/${workId}/requests/${r.id}`, { status: "Completed" }); load(); } catch {} }}
                  className="text-[9px] px-2 py-1 rounded-lg font-bold" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>✓</button>
                <button onClick={async () => { if (confirm("حذف؟")) { try { await api.delete(`/api/works/${workId}/requests/${r.id}`); load(); } catch {} } }}
                  className="text-[9px] px-1 rounded" style={{ color: "#DC2626" }}>🗑️</button>
              </div>
            </div>
            {r.description && <p className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>{r.description}</p>}

            {showConvert === r.id && (
              <div className="mt-2 p-2 rounded-lg space-y-2" style={{ background: "#5E549508", border: "1px solid #5E549520" }}>
                <p className="text-[10px] font-bold" style={{ color: "#5E5495" }}>تحويل لمشروع:</p>
                <input value={conv.projTitle} onChange={e => setConv({...conv, projTitle: e.target.value})} placeholder="اسم المشروع" className="w-full px-2 py-1.5 rounded-lg border text-[10px]" style={is} />
                <textarea value={conv.tasks} onChange={e => setConv({...conv, tasks: e.target.value})} placeholder="المهام (سطر لكل مهمة)" rows={3} className="w-full px-2 py-1.5 rounded-lg border text-[10px] resize-none" style={is} />
                <div className="flex gap-2">
                  <button onClick={() => convert(r.id)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white" style={{ background: "#5E5495" }}>تحويل</button>
                  <button onClick={() => setShowConvert(null)} className="text-[10px]" style={{ color: "var(--muted)" }}>إلغاء</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {done.length > 0 && (
        <details className="mt-3">
          <summary className="text-[10px] cursor-pointer" style={{ color: "var(--muted)" }}>مكتملة ({done.length})</summary>
          <div className="space-y-1 mt-1">{done.map(r => (
            <div key={r.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg opacity-50" style={{ background: "var(--card)" }}>
              <span className="text-xs line-through flex-1" style={{ color: "var(--text)" }}>{r.title}</span>
              {r.convertedProjectId && <span className="text-[8px] px-1 rounded" style={{ background: "#5E549515", color: "#5E5495" }}>→ مشروع</span>}
            </div>
          ))}</div>
        </details>
      )}

      {reqs.length === 0 && !showNew && <p className="text-center py-4 text-xs" style={{ color: "var(--muted)" }}>لا توجد طلبات</p>}
    </div>
  );
}
