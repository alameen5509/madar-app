"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { calcJobProgress, type JobDim, type JobGoalData } from "@/components/JobTree";

export interface JobInfo {
  id: string; name: string; description?: string; isActive: boolean;
  taskCount: number; goalCount: number; progressPercent: number;
}

const NAV = [
  { key: "",              label: "نظرة عامة",      icon: "🏠" },
  { key: "/dimensions",   label: "الجوانب والأهداف", icon: "📁" },
  { key: "/team",         label: "الفريق",          icon: "👥" },
  { key: "/kpis",         label: "مؤشرات الأداء",   icon: "📊" },
  { key: "/achievements", label: "الإنجازات",       icon: "🏆" },
  { key: "/skills",       label: "المهارات",        icon: "💡" },
  { key: "/meetings",     label: "الاجتماعات",      icon: "📅" },
  { key: "/lessons",      label: "الدروس المستفادة", icon: "📝" },
];

export function useJobData(jobId: string) {
  const [job, setJob] = useState<JobInfo | null>(null);
  const [jobLoading, setJobLoading] = useState(true);
  const [jobError, setJobError] = useState("");
  const [dims, setDims] = useState<JobDim[]>([]);
  const [goals, setGoals] = useState<JobGoalData[]>([]);

  const loadJob = useCallback(async () => {
    setJobLoading(true);
    setJobError("");
    let found = false;

    // Try /api/works/{id}
    try {
      const res = await api.get(`/api/works/${jobId}`);
      const raw = res.data?.data ?? res.data; // handle both wrapped and unwrapped responses
      if (raw && raw.id) {
        setJob({
          id: raw.id,
          name: raw.name ?? "بدون اسم",
          description: raw.title ?? raw.sector ?? undefined,
          isActive: (raw.status ?? "active") === "active",
          taskCount: 0,
          goalCount: 0,
          progressPercent: 0,
        });
        found = true;
      }
    } catch { /* will try circles next */ }

    // Fallback: try circles (legacy)
    if (!found) {
      try {
        const res = await api.get("/api/circles");
        const circles = (res.data ?? []) as JobInfo[];
        const match = circles.find(c => c.id === jobId);
        if (match) {
          setJob(match);
          found = true;
        }
      } catch { /* ignored */ }
    }

    if (!found) {
      setJobError("لم يتم العثور على بيانات هذا العمل");
    }
    setJobLoading(false);
  }, [jobId]);

  const loadTree = useCallback(async () => {
    try {
      const [d, g] = await Promise.all([
        api.get(`/api/job-dimensions/${jobId}`).catch(() => ({ data: [] })),
        api.get(`/api/job-goals/${jobId}`).catch(() => ({ data: [] })),
      ]);
      setDims((d.data ?? []) as JobDim[]);
      setGoals((g.data ?? []) as JobGoalData[]);
    } catch {
      setDims([]);
      setGoals([]);
    }
  }, [jobId]);

  useEffect(() => { loadJob(); loadTree(); }, [loadJob, loadTree]);

  const calcProgress = dims.length > 0 ? calcJobProgress(jobId, dims, goals) : (job?.progressPercent ?? 0);

  return { job, jobLoading, jobError, dims, goals, calcProgress, refresh: loadTree, refreshJob: loadJob };
}

export function useJobMeta(jobId: string) {
  const [meta, setMetaState] = useState<{
    team: { name: string; role: string; position?: string; notes?: string; lastContact?: string; partnerType?: string; sharePercent?: string; status?: string; skills?: string; company?: string; projects?: string }[];
    kpis: { title: string; description?: string; target: string; current: string; period?: string; history?: { date: string; value: string }[] }[];
    achievements: { title: string; date: string; description?: string; type?: string }[];
    skills: (string | { name: string; level: number; target: number; plan?: string; fromJob?: boolean })[];
    meetings: { title: string; date: string; notes: string; attendees?: string; actionItems?: { text: string; done: boolean }[] }[];
    lessons: (string | { title: string; content?: string; date?: string; category?: string })[];
  }>({ team: [], kpis: [], achievements: [], skills: [], meetings: [], lessons: [] });

  useEffect(() => {
    api.get("/api/users/me/preferences").then(({ data }) => {
      if (data?.jobMeta?.[jobId]) setMetaState(data.jobMeta[jobId]);
    }).catch(() => {});
  }, [jobId]);

  function setMeta(updated: typeof meta) {
    setMetaState(updated);
    api.get("/api/users/me/preferences").then(({ data }) => {
      const all = data?.jobMeta ?? {};
      all[jobId] = updated;
      api.put("/api/users/me/preferences", { ...data, jobMeta: all }).catch(() => {});
    }).catch(() => {});
  }

  return { meta, setMeta };
}

export default function JobPageShell({ jobId, children }: { jobId: string; children: React.ReactNode }) {
  const { job, jobLoading, jobError, calcProgress } = useJobData(jobId);
  const pathname = usePathname();

  if (jobLoading) return (
    <main className="flex-1 flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-[#2D6B9E] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>
      </div>
    </main>
  );

  const name = job?.name ?? "العمل";
  const base = `/jobs/${jobId}`;
  const activeNav = NAV.find(n => n.key && pathname === base + n.key);

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b px-6 py-4 pr-14 md:pr-6" style={{ borderColor: "var(--card-border)" }}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-[10px] mb-2">
          <Link href="/works" className="hover:underline" style={{ color: "var(--muted)" }}>الأعمال</Link>
          <span style={{ color: "var(--muted)" }}>←</span>
          {activeNav ? (
            <>
              <Link href={base} className="hover:underline" style={{ color: "var(--muted)" }}>{name}</Link>
              <span style={{ color: "var(--muted)" }}>←</span>
              <span className="font-semibold" style={{ color: "#2D6B9E" }}>{activeNav.icon} {activeNav.label}</span>
            </>
          ) : (
            <span className="font-semibold" style={{ color: "#2D6B9E" }}>{name}</span>
          )}
        </div>

        {/* Job info */}
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: "#2D6B9E15" }}>💼</div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>{name}</h2>
            {job && (
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>
                {job.description ? `${job.description} · ` : ""}{job.isActive ? "نشطة" : "متوقفة"}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-20 h-2 rounded-full overflow-hidden" style={{ background: "#2D6B9E20" }}>
              <div className="h-full rounded-full" style={{ width: `${calcProgress}%`, background: "#2D6B9E" }} />
            </div>
            <span className="text-sm font-black" style={{ color: "#2D6B9E" }}>{calcProgress}%</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5 -mb-0.5">
          {NAV.map(n => {
            const href = `/jobs/${jobId}${n.key}`;
            const active = pathname === href;
            return (
              <Link key={n.key} href={href}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition whitespace-nowrap flex-shrink-0"
                style={{ background: active ? "#2D6B9E" : "transparent", color: active ? "#fff" : "#6B7280" }}>
                {n.icon} {n.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Content */}
      <div className="px-6 py-5">
        {children}
      </div>
    </main>
  );
}
