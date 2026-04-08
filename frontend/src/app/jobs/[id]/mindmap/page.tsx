"use client";

import { use } from "react";
import dynamic from "next/dynamic";
import JobPageShell, { useJobData } from "@/components/JobPageShell";

const MindMap = dynamic(() => import("@/components/MindMap"), { ssr: false });

export default function JobMindMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { job } = useJobData(id);

  return (
    <JobPageShell jobId={id}>
      <MindMap entityType="jobMindmap" entityId={id} entityName={job?.name ?? "خريطة الوظيفة"} />
    </JobPageShell>
  );
}
