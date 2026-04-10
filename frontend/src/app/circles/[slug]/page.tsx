"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import RolePageShell, { useRoleData, useRoleMeta } from "@/components/RolePageShell";
import { calcDimProgress } from "@/components/RoleTree";

const LeadershipSection = dynamic(() => import("@/components/LeadershipSection"), { ssr: false });

export default function RoleOverview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { role, dims, goals, calcProgress } = useRoleData(slug);
  const { meta, setMeta } = useRoleMeta(role?.id ?? "");

  const rootDims = dims.filter(d => !d.parentDimensionId);
  const color = role?.color ?? "#5E5495";

  const [editVM, setEditVM] = useState(false);
  const [vision, setVision] = useState("");
  const [mission, setMission] = useState("");

  useEffect(() => {
    setVision(meta.vision ?? "");
    setMission(meta.mission ?? "");
  }, [meta]);

  function saveVM() {
    setMeta({ vision, mission });
    setEditVM(false);
  }

  const SECTIONS = [
    { key: "dimensions", label: "الجوانب والأهداف", icon: "📁", stat: `${dims.length} جانب · ${goals.length} هدف` },
    { key: "mindmap",    label: "الخريطة الذهنية",  icon: "🧠", stat: "تفرّع الأفكار" },
    { key: "board",      label: "السبورة",          icon: "🎨", stat: "ارسم أفكارك" },
  ];

  return (
    <RolePageShell slug={slug}>
      {/* ═══ Identity ═══ */}
      <div className="rounded-2xl p-5 mb-4 border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0" style={{ background: color + "12" }}>
            {role?.icon ?? "◎"}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-lg mb-0.5" style={{ color: "var(--text)" }}>{role?.name}</h1>
            <p className="text-xs font-medium mb-1" style={{ color }}>دور حياتي</p>
            <div className="flex items-center gap-2">
              <span className="text-[9px]" style={{ color: "var(--muted)" }}>{goals.length} هدف · {dims.length} جانب</span>
            </div>
          </div>
        </div>

        {/* Vision & Mission */}
        {editVM ? (
          <div className="mt-4 space-y-2">
            <textarea value={vision} onChange={e => setVision(e.target.value)} placeholder="الرؤية — ما الصورة الكبرى لهذا الدور؟" rows={2}
              className="w-full px-3 py-2 rounded-lg border text-xs resize-none focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <textarea value={mission} onChange={e => setMission(e.target.value)} placeholder="الرسالة — كيف تحقق الرؤية يومياً؟" rows={2}
              className="w-full px-3 py-2 rounded-lg border text-xs resize-none focus:outline-none" style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <div className="flex gap-2">
              <button onClick={saveVM} className="px-4 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: color }}>حفظ</button>
              <button onClick={() => setEditVM(false)} className="px-3 py-1.5 rounded-lg text-xs text-[#6B7280] bg-gray-100">إلغاء</button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-1.5">
            {vision && (
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: color + "15", color }}>الرؤية</span>
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
              {vision || mission ? "✏️ تعديل الرؤية والرسالة" : "+ أضف الرؤية والرسالة"}
            </button>
          </div>
        )}
      </div>

      {/* ═══ Progress ═══ */}
      <div className="rounded-2xl p-5 mb-4 border" style={{ background: color + "08", borderColor: color + "20" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold" style={{ color }}>التقدم الكلي</p>
          <span className="text-2xl font-black" style={{ color }}>{calcProgress}%</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden mb-4" style={{ background: color + "20" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${calcProgress}%`, background: `linear-gradient(90deg, ${color}, #D4AF37)` }} />
        </div>
        {rootDims.length > 0 && (
          <div className="space-y-2">
            {rootDims.map(d => {
              const dp = calcDimProgress(d.id, dims, goals);
              return (
                <div key={d.id} className="flex items-center gap-3">
                  <span className="text-sm">{d.icon || "📁"}</span>
                  <span className="text-[11px] font-medium flex-1" style={{ color: "var(--text)" }}>{d.name}</span>
                  <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: `${d.color || color}20` }}>
                    <div className="h-full rounded-full" style={{ width: `${dp}%`, background: d.color || color }} />
                  </div>
                  <span className="text-[10px] font-bold w-8 text-left" style={{ color: d.color || color }}>{dp}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ Section Cards Grid ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {SECTIONS.map(s => (
          <Link key={s.key} href={`/circles/${slug}/${s.key}`}
            className="group rounded-2xl p-5 border transition-all hover:shadow-lg hover:-translate-y-0.5"
            style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <span className="text-3xl block mb-3">{s.icon}</span>
            <p className="text-sm font-bold mb-1" style={{ color: "var(--text)" }}>{s.label}</p>
            <p className="text-[10px]" style={{ color: "var(--muted)" }}>{s.stat}</p>
            <p className="text-[10px] mt-2 font-semibold group-hover:translate-x-[-4px] transition-transform" style={{ color }}>فتح ←</p>
          </Link>
        ))}
      </div>

      {/* ═══ Leadership Section ═══ */}
      {role?.id && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>🎖️ القيادة</p>
            <Link href="/war-room" className="text-[10px] hover:underline" style={{ color }}>صفحة القيادة المستقلة ←</Link>
          </div>
          <LeadershipSection workId={role.id} workName={role.name} workColor={color} workIcon={role.icon ?? "◎"} />
        </div>
      )}
    </RolePageShell>
  );
}
