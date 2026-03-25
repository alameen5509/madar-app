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
    </main>
  );
}
