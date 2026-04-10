"use client";

import { use, useState, useEffect } from "react";
import RolePageShell, { useRoleData } from "@/components/RolePageShell";
import { api } from "@/lib/api";

interface ProjectInfo { id: string; title: string; description?: string; status?: string; progressPercent?: number; }

export default function RoleProjectsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { role, goals } = useRoleData(slug);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const color = role?.color ?? "#5E5495";

  useEffect(() => {
    if (!goals.length) { setLoading(false); return; }
    const projectIds = [...new Set(goals.flatMap(g => g.projects ?? []))];
    if (!projectIds.length) { setLoading(false); return; }
    Promise.all(
      projectIds.map(id => api.get(`/api/projects/${id}`).then(r => r.data as ProjectInfo).catch(() => null))
    ).then(results => {
      setProjects(results.filter(Boolean) as ProjectInfo[]);
      setLoading(false);
    });
  }, [goals]);

  const STATUS_COLORS: Record<string, string> = {
    Active: "#3B82F6", Completed: "#3D8C5A", Paused: "#F59E0B", Planning: "#8B5CF6",
  };

  return (
    <RolePageShell slug={slug}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--text)" }}>المشاريع المرتبطة</p>
          <p className="text-[10px]" style={{ color: "var(--muted)" }}>{projects.length} مشروع</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-3 rounded-full animate-spin mx-auto mb-2" style={{ borderColor: color, borderTopColor: "transparent" }} />
          <p className="text-xs" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>
        </div>
      ) : projects.length > 0 ? (
        <div className="space-y-3">
          {projects.map(p => {
            const sc = STATUS_COLORS[p.status ?? ""] ?? "#6B7280";
            return (
              <div key={p.id} className="rounded-2xl p-5 border transition-all"
                style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">📋</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: "var(--text)" }}>{p.title}</p>
                    {p.description && <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--muted)" }}>{p.description}</p>}
                  </div>
                  {p.status && <span className="text-[9px] px-2 py-1 rounded-full font-semibold" style={{ background: sc + "15", color: sc }}>{p.status}</span>}
                  {p.progressPercent != null && <span className="text-sm font-black" style={{ color }}>{p.progressPercent}%</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>لا توجد مشاريع مرتبطة</p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>اربط مشاريع بأهدافك من صفحة كل هدف</p>
        </div>
      )}
    </RolePageShell>
  );
}
