"use client";

import { use } from "react";
import dynamic from "next/dynamic";
import RolePageShell, { useRoleData } from "@/components/RolePageShell";

const Whiteboard = dynamic(() => import("@/components/Whiteboard"), { ssr: false });

export default function RoleBoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { role } = useRoleData(slug);

  return (
    <RolePageShell slug={slug}>
      {role?.id && (
        <Whiteboard entityType="role" entityId={role.id} entityName={role?.name ?? "سبورة الدور"} />
      )}
    </RolePageShell>
  );
}
