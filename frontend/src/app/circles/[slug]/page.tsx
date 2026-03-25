"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function CircleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [circle, setCircle] = useState<{ id: string; name: string; icon?: string; color?: string } | null>(null);
  const [taskCount, setTaskCount] = useState(0);

  useEffect(() => {
    api.get(`/api/circle-groups/circles/${slug}`).then(({ data }) => setCircle(data)).catch(() => {});
    api.get("/api/tasks").then(({ data }) => {
      const tasks = (data ?? []) as { lifeCircle?: { name: string } }[];
      setTaskCount(tasks.filter(t => t.lifeCircle?.name?.toLowerCase().replace(/\s+/g, "-") === slug).length);
    }).catch(() => {});
  }, [slug]);

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6" style={{ background: "var(--bg)" }}>
      <div className="text-6xl">{circle?.icon ?? "●"}</div>
      <h1 className="font-bold text-xl" style={{ color: circle?.color ?? "var(--text)" }}>{circle?.name ?? slug}</h1>
      {taskCount > 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>{taskCount} مهمة مرتبطة</p>}
      <div className="rounded-xl border px-6 py-4 text-center" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <p className="text-sm" style={{ color: "var(--muted)" }}>🚧 هذه الصفحة قيد البناء</p>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>ستتضمن: المهام، الأهداف، الملاحظات المرتبطة بهذا الدور</p>
      </div>
      <Link href="/circles" className="text-xs font-medium hover:underline" style={{ color: "#5E5495" }}>← العودة لأدوار الحياة</Link>
    </main>
  );
}
