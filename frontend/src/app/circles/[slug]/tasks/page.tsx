"use client";

import { use, useState, useEffect } from "react";
import RolePageShell, { useRoleData } from "@/components/RolePageShell";
import { api } from "@/lib/api";

interface TaskInfo { id: string; title: string; status: string; description?: string; dueDate?: string; userPriority?: number; }

export default function RoleTasksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { role, goals } = useRoleData(slug);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const color = role?.color ?? "#5E5495";

  useEffect(() => {
    if (!goals.length) { setLoading(false); return; }
    const taskIds = [...new Set(goals.flatMap(g => g.tasks ?? []))];
    if (!taskIds.length) { setLoading(false); return; }
    api.get("/api/tasks").then(({ data }) => {
      const all = (data ?? []) as TaskInfo[];
      setTasks(all.filter(t => taskIds.includes(t.id)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [goals]);

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    Todo: { label: "للتنفيذ", color: "#3B82F6" },
    InProgress: { label: "قيد التنفيذ", color: "#F59E0B" },
    Completed: { label: "مكتملة", color: "#3D8C5A" },
    Scheduled: { label: "مجدولة", color: "#8B5CF6" },
    Deferred: { label: "مؤجلة", color: "#6B7280" },
  };

  const pending = tasks.filter(t => t.status !== "Completed");
  const done = tasks.filter(t => t.status === "Completed");

  return (
    <RolePageShell slug={slug}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--text)" }}>المهام المرتبطة</p>
          <p className="text-[10px]" style={{ color: "var(--muted)" }}>{pending.length} نشطة · {done.length} مكتملة</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-3 rounded-full animate-spin mx-auto mb-2" style={{ borderColor: color, borderTopColor: "transparent" }} />
          <p className="text-xs" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>
        </div>
      ) : tasks.length > 0 ? (
        <div className="space-y-2">
          {[...pending, ...done].map(t => {
            const st = STATUS_LABELS[t.status] ?? { label: t.status, color: "#6B7280" };
            const isDone = t.status === "Completed";
            return (
              <div key={t.id} className={`rounded-xl p-4 border transition-all ${isDone ? "opacity-60" : ""}`}
                style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0`}
                    style={{ borderColor: isDone ? "#3D8C5A" : color, background: isDone ? "#3D8C5A" : "transparent" }}>
                    {isDone && <span className="text-white text-[9px]">✓</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${isDone ? "line-through" : "font-medium"}`} style={{ color: "var(--text)" }}>{t.title}</p>
                    {t.description && <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--muted)" }}>{t.description}</p>}
                  </div>
                  <span className="text-[9px] px-2 py-1 rounded-full font-semibold flex-shrink-0" style={{ background: st.color + "15", color: st.color }}>{st.label}</span>
                  {t.dueDate && <span className="text-[9px] flex-shrink-0" style={{ color: "var(--muted)" }}>{new Date(t.dueDate).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-3xl mb-3">✅</p>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>لا توجد مهام مرتبطة</p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>اربط مهام بأهدافك من صفحة كل هدف</p>
        </div>
      )}
    </RolePageShell>
  );
}
