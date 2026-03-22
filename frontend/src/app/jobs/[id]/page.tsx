"use client";

import { use, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import JobPageShell, { useJobData, useJobMeta } from "@/components/JobPageShell";
import { calcDimProgress } from "@/components/JobTree";

export default function JobOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { job, dims, goals, calcProgress } = useJobData(id);
  const { meta } = useJobMeta(id);
  const rootDims = dims.filter(d => !d.parentDimensionId);

  // Editable vision/mission
  const [editVM, setEditVM] = useState(false);
  const [vision, setVision] = useState("");
  const [mission, setMission] = useState("");
  const [org, setOrg] = useState("");

  // Load vision/mission from preferences
  useState(() => {
    api.get("/api/users/me/preferences").then(({ data }) => {
      const jv = data?.jobVision?.[id];
      if (jv) { setVision(jv.vision ?? ""); setMission(jv.mission ?? ""); setOrg(jv.org ?? ""); }
    }).catch(() => {});
  });

  async function saveVM() {
    try {
      const { data } = await api.get("/api/users/me/preferences");
      const all = data?.jobVision ?? {};
      all[id] = { vision, mission, org };
      await api.put("/api/users/me/preferences", { ...data, jobVision: all });
    } catch {}
    setEditVM(false);
  }

  const SECTIONS = [
    { key: "dimensions",   label: "الجوانب والأهداف", icon: "📁", stat: `${dims.length} جانب · ${goals.length} هدف` },
    { key: "team",         label: "الفريق والعلاقات", icon: "👥", stat: `${meta.team.length} شخص` },
    { key: "kpis",         label: "مؤشرات الأداء",   icon: "📊", stat: `${meta.kpis.length} مؤشر` },
    { key: "achievements", label: "الإنجازات",       icon: "🏆", stat: `${meta.achievements.length} إنجاز` },
    { key: "skills",       label: "المهارات",        icon: "💡", stat: `${meta.skills.length} مهارة` },
    { key: "meetings",     label: "الاجتماعات",      icon: "📅", stat: `${meta.meetings.length} اجتماع` },
    { key: "lessons",      label: "الدروس المستفادة", icon: "📝", stat: `${meta.lessons.length} درس` },
  ];

  return (
    <JobPageShell jobId={id}>
      {/* ═══ Identity — name, org, status ═══ */}
      <div className="rounded-2xl p-5 mb-4 border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0" style={{ background: "#2D6B9E12" }}>💼</div>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-lg mb-0.5" style={{ color: "var(--text)" }}>{job?.name}</h1>
            {org && <p className="text-xs font-medium mb-1" style={{ color: "#2D6B9E" }}>{org}</p>}
            <div className="flex items-center gap-2">
              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                style={{ background: job?.isActive ? "#3D8C5A15" : "#6B728015", color: job?.isActive ? "#3D8C5A" : "#6B7280" }}>
                {job?.isActive ? "نشطة" : "متوقفة"}
              </span>
              <span className="text-[9px]" style={{ color: "var(--muted)" }}>{job?.goalCount} هدف · {job?.taskCount} مهمة</span>
            </div>
          </div>
        </div>

        {/* Vision & Mission */}
        {editVM ? (
          <div className="mt-4 space-y-2">
            <input value={org} onChange={e => setOrg(e.target.value)} placeholder="الجهة (مثال: شركة مدار)"
              className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <textarea value={vision} onChange={e => setVision(e.target.value)} placeholder="الرؤية — ما الصورة الكبرى التي تسعى لها؟" rows={2}
              className="w-full px-3 py-2 rounded-lg border text-xs resize-none focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <textarea value={mission} onChange={e => setMission(e.target.value)} placeholder="الرسالة — كيف تحقق الرؤية يومياً؟" rows={2}
              className="w-full px-3 py-2 rounded-lg border text-xs resize-none focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <div className="flex gap-2">
              <button onClick={saveVM} className="px-4 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>حفظ</button>
              <button onClick={() => setEditVM(false)} className="px-3 py-1.5 rounded-lg text-xs text-[#6B7280] bg-gray-100">إلغاء</button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-1.5">
            {vision && (
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#2D6B9E15", color: "#2D6B9E" }}>الرؤية</span>
                <p className="text-xs" style={{ color: "var(--text)" }}>{vision}</p>
              </div>
            )}
            {mission && (
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#D4AF3715", color: "#D4AF37" }}>الرسالة</span>
                <p className="text-xs" style={{ color: "var(--text)" }}>{mission}</p>
              </div>
            )}
            <button onClick={() => setEditVM(true)} className="text-[10px] hover:underline" style={{ color: "var(--muted)" }}>
              {vision || mission ? "✏️ تعديل الرؤية والرسالة" : "+ أضف الرؤية والرسالة والجهة"}
            </button>
          </div>
        )}
      </div>

      {/* ═══ Progress ═══ */}
      <div className="rounded-2xl p-5 mb-4 border" style={{ background: "#2D6B9E08", borderColor: "#2D6B9E20" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold" style={{ color: "#2D6B9E" }}>التقدم الكلي</p>
          <span className="text-2xl font-black" style={{ color: "#2D6B9E" }}>{calcProgress}%</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden mb-4" style={{ background: "#2D6B9E20" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${calcProgress}%`, background: "linear-gradient(90deg, #2D6B9E, #D4AF37)" }} />
        </div>
        {rootDims.length > 0 && (
          <div className="space-y-2">
            {rootDims.map(d => {
              const dp = calcDimProgress(d.id, dims, goals);
              return (
                <div key={d.id} className="flex items-center gap-3">
                  <span className="text-sm">{d.icon || "📁"}</span>
                  <span className="text-[11px] font-medium flex-1" style={{ color: "var(--text)" }}>{d.name}</span>
                  <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: `${d.color || "#2D6B9E"}20` }}>
                    <div className="h-full rounded-full" style={{ width: `${dp}%`, background: d.color || "#2D6B9E" }} />
                  </div>
                  <span className="text-[10px] font-bold w-8 text-left" style={{ color: d.color || "#2D6B9E" }}>{dp}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ Section Cards Grid ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {SECTIONS.map(s => (
          <Link key={s.key} href={`/jobs/${id}/${s.key}`}
            className="group rounded-2xl p-5 border transition-all hover:shadow-lg hover:border-[#2D6B9E] hover:-translate-y-0.5"
            style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <span className="text-3xl block mb-3">{s.icon}</span>
            <p className="text-sm font-bold mb-1" style={{ color: "var(--text)" }}>{s.label}</p>
            <p className="text-[10px]" style={{ color: "var(--muted)" }}>{s.stat}</p>
            <p className="text-[10px] mt-2 font-semibold group-hover:translate-x-[-4px] transition-transform" style={{ color: "#2D6B9E" }}>فتح ←</p>
          </Link>
        ))}
      </div>
    </JobPageShell>
  );
}
