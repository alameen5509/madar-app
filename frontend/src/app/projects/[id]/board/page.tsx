"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";

const Whiteboard = dynamic(() => import("@/components/Whiteboard"), { ssr: false });

export default function ProjectBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [name, setName] = useState("سبورة المشروع");

  useEffect(() => {
    api.get("/api/goals").then(({ data }) => {
      const goal = (data as { id: string; title: string }[]).find(g => g.id === id);
      if (goal) setName(goal.title);
    }).catch(() => {});
  }, [id]);

  return (
    <main className="flex-1 flex flex-col overflow-hidden" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b px-6 py-3 pr-14 md:pr-6"
        style={{ borderColor: "var(--card-border)" }}>
        <div className="flex items-center gap-1 text-[10px] mb-1">
          <Link href="/projects" className="hover:underline" style={{ color: "var(--muted)" }}>المشاريع</Link>
          <span style={{ color: "var(--muted)" }}>←</span>
          <span className="font-semibold" style={{ color: "#5E5495" }}>🎨 سبورة {name}</span>
        </div>
      </header>
      <Whiteboard entityType="project" entityId={id} entityName={name} />
    </main>
  );
}
