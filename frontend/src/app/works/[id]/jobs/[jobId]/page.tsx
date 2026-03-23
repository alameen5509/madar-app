"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function WorkJobPage({ params }: { params: Promise<{ id: string; jobId: string }> }) {
  const { id: workId, jobId } = use(params);
  const [work, setWork] = useState<{ name: string; type: string } | null>(null);
  const [job, setJob] = useState<{ id: string; title: string; description?: string; salary: number; status: string } | null>(null);

  useEffect(() => {
    api.get(`/api/works/${workId}`).then(({ data }) => {
      setWork({ name: data.name, type: data.type });
      const j = data.jobs?.find((j: { id: string }) => j.id === jobId);
      if (j) setJob(j);
    }).catch(() => {});
  }, [workId, jobId]);

  if (!work || !job) return (
    <main className="flex-1 flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <p className="animate-pulse" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>
    </main>
  );

  const NAV = [
    { href: `/jobs/${jobId}`, label: "نظرة عامة", icon: "🏠" },
    { href: `/jobs/${jobId}/dimensions`, label: "الجوانب والأهداف", icon: "📁" },
    { href: `/jobs/${jobId}/team`, label: "الفريق", icon: "👥" },
    { href: `/jobs/${jobId}/kpis`, label: "KPIs", icon: "📊" },
    { href: `/jobs/${jobId}/achievements`, label: "الإنجازات", icon: "🏆" },
    { href: `/jobs/${jobId}/skills`, label: "المهارات", icon: "💡" },
    { href: `/jobs/${jobId}/meetings`, label: "الاجتماعات", icon: "📅" },
    { href: `/jobs/${jobId}/lessons`, label: "الدروس", icon: "📝" },
  ];

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b px-6 py-4 pr-14 md:pr-6" style={{ borderColor: "var(--card-border)" }}>
        <div className="flex items-center gap-1 text-[10px] mb-2 flex-wrap">
          <Link href="/works" className="hover:underline" style={{ color: "var(--muted)" }}>الأعمال</Link>
          <span style={{ color: "var(--muted)" }}>←</span>
          <Link href={`/works/${workId}`} className="hover:underline" style={{ color: "var(--muted)" }}>{work.name}</Link>
          <span style={{ color: "var(--muted)" }}>←</span>
          <span className="font-semibold" style={{ color: "#2D6B9E" }}>{job.title}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ background: "#2D6B9E15" }}>💼</div>
          <div className="flex-1">
            <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>{job.title}</h2>
            <p className="text-[10px]" style={{ color: "var(--muted)" }}>
              تحت {work.name} · {job.salary > 0 ? `${job.salary.toLocaleString()} ريال` : ""}
            </p>
          </div>
        </div>
        <nav className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5">
          {NAV.map(n => (
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
