"use client";

import { use } from "react";
import dynamic from "next/dynamic";
import JobPageShell, { useJobData } from "@/components/JobPageShell";

const Whiteboard = dynamic(() => import("@/components/Whiteboard"), { ssr: false });

export default function JobBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { job } = useJobData(id);

  return (
    <JobPageShell jobId={id}>
      <Whiteboard entityType="job" entityId={id} entityName={job?.name ?? "سبورة الوظيفة"} />
    </JobPageShell>
  );
}
