"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { GeometricDivider } from "@/components/IslamicPattern";
import { api } from "@/lib/api";

/* ─── Types ──────────────────────────────────────────────────────────── */

interface UserCircle {
  id: string; groupId: string; name: string; color?: string;
  icon?: string; slug?: string; priority: number;
}

interface CircleGroup {
  id: string; name: string; color?: string; icon?: string;
  priority: number; circles: UserCircle[];
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function CirclesPage() {
  const [groups, setGroups] = useState<CircleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [addingCircleGroupId, setAddingCircleGroupId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/circle-groups");
      setGroups(data ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur border-b px-4 sm:px-6 py-3 pr-14 xl:pr-6"
        style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>◎ أدوار الحياة</h2>
            <p className="text-xs" style={{ color: "var(--muted)" }}>{groups.length} مجموعة · {groups.reduce((s, g) => s + g.circles.length, 0)} دائرة</p>
          </div>
          <button onClick={() => setShowAddGroup(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white"
            style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}>
            + مجموعة
          </button>
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 space-y-3">
        {loading && <p className="text-center py-12 animate-pulse" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}

        {!loading && groups.map(g => (
          <GroupAccordion key={g.id} group={g} onRefresh={fetchData}
            addingCircle={addingCircleGroupId === g.id}
            onToggleAddCircle={() => setAddingCircleGroupId(addingCircleGroupId === g.id ? null : g.id)} />
        ))}

        {!loading && groups.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">◎</p>
            <p className="font-bold" style={{ color: "var(--text)" }}>ابدأ ببناء دوائر حياتك</p>
            <p className="text-xs mt-1 mb-4" style={{ color: "var(--muted)" }}>أضف مجموعة ثم أضف الدوائر داخلها</p>
            <button onClick={() => setShowAddGroup(true)}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}>
              + أضف أول مجموعة
            </button>
          </div>
        )}

        <GeometricDivider />
      </div>

      {showAddGroup && <AddGroupModal onClose={() => setShowAddGroup(false)} onSaved={fetchData} />}
    </main>
  );
}

/* ─── Group Accordion ────────────────────────────────────────────────── */

function GroupAccordion({ group, onRefresh, addingCircle, onToggleAddCircle }: {
  group: CircleGroup; onRefresh: () => void;
  addingCircle: boolean; onToggleAddCircle: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [editColor, setEditColor] = useState(group.color ?? "#5E5495");
  const [editIcon, setEditIcon] = useState(group.icon ?? "◎");
  const [newCircleName, setNewCircleName] = useState("");
  const [newCircleIcon, setNewCircleIcon] = useState("●");
  const color = group.color ?? "#5E5495";

  async function saveGroup() {
    await api.put(`/api/circle-groups/${group.id}`, { name: editName, color: editColor, icon: editIcon }).catch(() => {});
    setEditing(false); onRefresh();
  }

  async function deleteGroup() {
    if (!confirm(`حذف مجموعة "${group.name}" وجميع دوائرها؟`)) return;
    await api.delete(`/api/circle-groups/${group.id}`).catch(() => {});
    onRefresh();
  }

  async function addCircle() {
    if (!newCircleName.trim()) return;
    await api.post(`/api/circle-groups/${group.id}/circles`, {
      name: newCircleName.trim(), icon: newCircleIcon || "●",
      slug: newCircleName.trim().toLowerCase().replace(/\s+/g, "-"),
    }).catch(() => {});
    setNewCircleName(""); setNewCircleIcon("●");
    onToggleAddCircle(); onRefresh();
  }

  async function deleteCircle(circleId: string, name: string) {
    if (!confirm(`حذف "${name}"؟`)) return;
    await api.delete(`/api/circle-groups/circles/${circleId}`).catch(() => {});
    onRefresh();
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: `${color}40` }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: `${color}08` }}>
        <button onClick={() => setOpen(!open)}
          className={`text-xs transition-transform ${open ? "rotate-180" : ""}`} style={{ color }}>▼</button>
        <span className="text-lg">{group.icon ?? "◎"}</span>
        <span className="font-bold text-sm flex-1" style={{ color }}>{group.name}</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${color}15`, color }}>
          {group.circles.length}
        </span>
        <button onClick={onToggleAddCircle} className="text-xs px-2 py-1 rounded-lg transition hover:opacity-80"
          style={{ color, background: `${color}10` }}>+</button>
        <button onClick={() => setEditing(!editing)} className="text-xs px-1.5 py-1 rounded-lg" style={{ color: "var(--muted)" }}>⋯</button>
      </div>

      {/* Edit group */}
      {editing && (
        <div className="px-4 py-3 border-t space-y-2" style={{ borderColor: `${color}20`, background: `${color}04` }}>
          <div className="flex gap-2">
            <input value={editIcon} onChange={e => setEditIcon(e.target.value)}
              className="w-12 px-2 py-1.5 rounded-lg border text-center text-sm focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <input value={editName} onChange={e => setEditName(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg border text-sm focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} className="w-10 h-8 rounded cursor-pointer" />
          </div>
          <div className="flex gap-2">
            <button onClick={saveGroup} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: color }}>حفظ</button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: "var(--muted)" }}>إلغاء</button>
            <div className="flex-1" />
            <button onClick={deleteGroup} className="px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-50">🗑 حذف</button>
          </div>
        </div>
      )}

      {/* Add circle */}
      {addingCircle && (
        <div className="px-4 py-3 border-t flex items-center gap-2" style={{ borderColor: `${color}20`, background: `${color}04` }}>
          <input value={newCircleIcon} onChange={e => setNewCircleIcon(e.target.value)}
            className="w-10 px-1 py-1.5 rounded-lg border text-center text-sm focus:outline-none"
            style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
          <input value={newCircleName} onChange={e => setNewCircleName(e.target.value)}
            placeholder="اسم الدائرة..." autoFocus
            onKeyDown={e => { if (e.key === "Enter") addCircle(); if (e.key === "Escape") onToggleAddCircle(); }}
            className="flex-1 px-3 py-1.5 rounded-lg border text-sm focus:outline-none"
            style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
          <button onClick={addCircle} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: color }}>إضافة</button>
          <button onClick={onToggleAddCircle} className="text-xs" style={{ color: "var(--muted)" }}>✕</button>
        </div>
      )}

      {/* Circles list */}
      {open && group.circles.length > 0 && (
        <div className="border-t" style={{ borderColor: `${color}15` }}>
          {group.circles.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-5 py-3 border-b last:border-0 hover:bg-black/[0.02] transition"
              style={{ borderColor: `${color}08` }}>
              <span className="text-base">{c.icon ?? "●"}</span>
              <Link href={`/circles/${c.slug ?? c.id}`} className="flex-1 text-sm font-medium hover:underline" style={{ color: "var(--text)" }}>
                {c.name}
              </Link>
              <button onClick={() => deleteCircle(c.id, c.name)}
                className="text-[10px] opacity-0 group-hover:opacity-100 hover:text-red-500 transition" style={{ color: "var(--muted)" }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {open && group.circles.length === 0 && !addingCircle && (
        <div className="border-t py-6 text-center" style={{ borderColor: `${color}15` }}>
          <p className="text-xs" style={{ color: "var(--muted)" }}>لا توجد دوائر — اضغط + لإضافة</p>
        </div>
      )}
    </div>
  );
}

/* ─── Add Group Modal ────────────────────────────────────────────────── */

function AddGroupModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#5E5495");
  const [icon, setIcon] = useState("◎");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.post("/api/circle-groups", { name: name.trim(), color, icon });
      onSaved(); onClose();
    } catch { alert("فشل الحفظ"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-sm"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        <div className="px-6 pt-6 pb-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
          <h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>مجموعة جديدة</h3>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "var(--bg)", color: "var(--muted)" }}>إلغاء</button>
            <button onClick={save} disabled={saving || !name.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40"
              style={{ background: "#5E5495" }}>
              {saving ? "..." : "إنشاء"}
            </button>
          </div>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="flex gap-2">
            <input value={icon} onChange={e => setIcon(e.target.value)} placeholder="◎"
              className="w-14 px-2 py-2.5 rounded-xl border text-center text-lg focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: دائرة الأساس" autoFocus
              className="flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: "var(--text)" }}>اللون:</span>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-8 rounded cursor-pointer" />
            <div className="w-6 h-6 rounded-full" style={{ background: color }} />
          </div>
        </div>
      </div>
    </div>
  );
}
