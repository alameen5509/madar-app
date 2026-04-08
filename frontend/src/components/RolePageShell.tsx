"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { calcRoleProgress, type RoleDim, type RoleGoalData } from "@/components/RoleTree";

export interface RoleInfo {
  id: string; name: string; icon?: string; color?: string; slug?: string;
  groupId?: string;
}

const NAV = [
  { key: "",              label: "نظرة عامة",       icon: "🏠" },
  { key: "/dimensions",   label: "الجوانب والأهداف", icon: "📁" },
  { key: "/board",        label: "السبورة",          icon: "🎨" },
  { key: "/mindmap",      label: "خريطة ذهنية",      icon: "🧠" },
];

export function useRoleData(slugOrId: string) {
  const [role, setRole] = useState<RoleInfo | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [roleError, setRoleError] = useState("");
  const [dims, setDims] = useState<RoleDim[]>([]);
  const [goals, setGoals] = useState<RoleGoalData[]>([]);

  const loadRole = useCallback(async () => {
    setRoleLoading(true);
    setRoleError("");

    type RawCircle = { id?: string; Id?: string; name?: string; Name?: string;
      icon?: string; Icon?: string; color?: string; Color?: string;
      slug?: string; Slug?: string; groupId?: string; GroupId?: string };

    const norm = (c: RawCircle): RoleInfo => ({
      id: (c.id ?? c.Id ?? "").toString(),
      name: (c.name ?? c.Name ?? "") as string,
      icon: (c.icon ?? c.Icon) as string | undefined,
      color: (c.color ?? c.Color) as string | undefined,
      slug: (c.slug ?? c.Slug) as string | undefined,
      groupId: (c.groupId ?? c.GroupId) as string | undefined,
    });

    // Fetch all groups once and match locally — case-insensitive on id/slug.
    // Works regardless of whether the legacy circle has a Slug column value,
    // and doesn't depend on the backend's per-slug lookup endpoint.
    try {
      const { data } = await api.get("/api/circle-groups");
      type Group = { circles?: RawCircle[]; Circles?: RawCircle[] };
      const groups = (data ?? []) as Group[];
      const all: RawCircle[] = groups.flatMap(g => g.circles ?? g.Circles ?? []);
      const key = slugOrId.toLowerCase();
      const match = all.find(c => {
        const n = norm(c);
        return n.id.toLowerCase() === key || (n.slug ?? "").toLowerCase() === key;
      });
      if (match) {
        setRole(norm(match));
      } else {
        console.warn("[RolePageShell] role not found", { slugOrId, groupCount: groups.length, circleCount: all.length, sampleIds: all.slice(0, 3).map(c => norm(c).id), sampleSlugs: all.slice(0, 3).map(c => norm(c).slug) });
        setRoleError("لم يتم العثور على هذا الدور");
      }
    } catch (err) {
      console.error("[RolePageShell] failed to load circles", err);
      setRoleError("فشل تحميل الدور");
    }
    setRoleLoading(false);
  }, [slugOrId]);

  const loadTree = useCallback(async (roleId: string) => {
    try {
      const [d, g] = await Promise.all([
        api.get(`/api/role-dimensions/${roleId}`).catch(() => ({ data: [] })),
        api.get(`/api/role-goals/${roleId}`).catch(() => ({ data: [] })),
      ]);
      setDims((d.data ?? []) as RoleDim[]);
      setGoals((g.data ?? []) as RoleGoalData[]);
    } catch {
      setDims([]); setGoals([]);
    }
  }, []);

  useEffect(() => { loadRole(); }, [loadRole]);
  useEffect(() => { if (role?.id) loadTree(role.id); }, [role?.id, loadTree]);

  const refresh = useCallback(() => { if (role?.id) loadTree(role.id); }, [role?.id, loadTree]);

  const calcProgress = role && dims.length > 0 ? calcRoleProgress(role.id, dims, goals) : 0;

  return { role, roleLoading, roleError, dims, goals, calcProgress, refresh, refreshRole: loadRole };
}

export function useRoleMeta(roleId: string) {
  const [meta, setMetaState] = useState<{
    vision?: string;
    mission?: string;
  }>({});

  useEffect(() => {
    if (!roleId) return;
    api.get("/api/users/me/preferences").then(({ data }) => {
      if (data?.roleMeta?.[roleId]) setMetaState(data.roleMeta[roleId]);
    }).catch(() => {});
  }, [roleId]);

  function setMeta(updated: typeof meta) {
    setMetaState(updated);
    api.get("/api/users/me/preferences").then(({ data }) => {
      const all = data?.roleMeta ?? {};
      all[roleId] = updated;
      api.put("/api/users/me/preferences", { ...data, roleMeta: all }).catch(() => {});
    }).catch(() => {});
  }

  return { meta, setMeta };
}

export default function RolePageShell({ slug, children }: { slug: string; children: React.ReactNode }) {
  const { role, roleLoading, roleError, calcProgress } = useRoleData(slug);
  const pathname = usePathname();

  if (roleLoading) return (
    <main className="flex-1 flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-[#5E5495] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>
      </div>
    </main>
  );

  if (roleError || !role) return (
    <main className="flex-1 flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-4xl">◎</p>
        <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{roleError || "تعذّر تحميل هذا الدور"}</p>
        <Link href="/circles" className="text-xs hover:underline" style={{ color: "#5E5495" }}>← العودة لأدوار الحياة</Link>
      </div>
    </main>
  );

  const name = role?.name ?? "الدور";
  const color = role?.color ?? "#5E5495";
  const base = `/circles/${slug}`;
  const activeNav = NAV.find(n => n.key && pathname === base + n.key);

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b px-6 py-4 pr-14 md:pr-6" style={{ borderColor: "var(--card-border)" }}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-[10px] mb-2">
          <Link href="/circles" className="hover:underline" style={{ color: "var(--muted)" }}>أدوار الحياة</Link>
          <span style={{ color: "var(--muted)" }}>←</span>
          {activeNav ? (
            <>
              <Link href={base} className="hover:underline" style={{ color: "var(--muted)" }}>{name}</Link>
              <span style={{ color: "var(--muted)" }}>←</span>
              <span className="font-semibold" style={{ color }}>{activeNav.icon} {activeNav.label}</span>
            </>
          ) : (
            <span className="font-semibold" style={{ color }}>{name}</span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: color + "15" }}>{role?.icon ?? "◎"}</div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>{name}</h2>
            <p className="text-[10px]" style={{ color: "var(--muted)" }}>دور حياتي</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-20 h-2 rounded-full overflow-hidden" style={{ background: color + "20" }}>
              <div className="h-full rounded-full" style={{ width: `${calcProgress}%`, background: color }} />
            </div>
            <span className="text-sm font-black" style={{ color }}>{calcProgress}%</span>
          </div>
        </div>

        <nav className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5 -mb-0.5">
          {NAV.map(n => {
            const href = `/circles/${slug}${n.key}`;
            const active = pathname === href;
            return (
              <Link key={n.key} href={href}
                className="px-3 py-2.5 rounded-lg text-xs font-semibold transition whitespace-nowrap flex-shrink-0 min-h-[40px] flex items-center"
                style={{ background: active ? color : "transparent", color: active ? "#fff" : "#6B7280" }}>
                {n.icon} {n.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="px-6 py-5">
        {children}
      </div>
    </main>
  );
}
