"use client";

import { use } from "react";
import dynamic from "next/dynamic";
import RolePageShell, { useRoleData } from "@/components/RolePageShell";

const MindMap = dynamic(() => import("@/components/MindMap"), { ssr: false });

export default function RoleMindMapPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { role } = useRoleData(slug);

  return (
    <RolePageShell slug={slug}>
      {role?.id && (
        <MindMap entityType="roleMindmap" entityId={role.id} entityName={role?.name ?? "خريطة الدور"} />
      )}
    </RolePageShell>
  );
}
