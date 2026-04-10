"use client";
import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";

const Whiteboard = dynamic(() => import("@/components/Whiteboard"), { ssr: false });

interface Note { id: string; content: string; convertedTaskId?: string; createdAt: string }
interface DevReq { id: string; title: string; description?: string; status: string; createdAt: string }

const PULSE: Record<string, { label: string; color: string; bg: string }> = {
  green: { label: "مستقر", color: "#3D8C5A", bg: "#3D8C5A15" },
  yellow: { label: "يحتاج متابعة", color: "#F59E0B", bg: "#F59E0B15" },
  red: { label: "حرج", color: "#DC2626", bg: "#DC262615" },
  blue: { label: "بناء", color: "#3B82F6", bg: "#3B82F615" },
};
const is = { background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" } as const;

export default function LeadershipSection({ workId, workName, workColor = "#5E5495", workIcon = "🎖️" }: { workId: string; workName: string; workColor?: string; workIcon?: string }) {
  const [roleId, setRoleId] = useState<string | null>(null);
  const [pulse, setPulse] = useState("green");
  const [pulseNote, setPulseNote] = useState<string | null>(null);
  const [lastReview, setLastReview] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [devReqs, setDevReqs] = useState<DevReq[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<"notes" | "dev" | "board">("notes");
  const [newNote, setNewNote] = useState("");
  const [showNewDev, setShowNewDev] = useState(false);
  const [newDev, setNewDev] = useState({ title: "", desc: "" });

  const [showReview, setShowReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({ status: "green", note: "", accomplishments: "" });

  // Find or create the leadership role for this work
  const findOrCreateRole = useCallback(async (): Promise<string | null> => {
    try {
      const { data } = await api.get("/api/war-room/roles");
      const roles = Array.isArray(data) ? data : [];
      // Find a real (non-auto) role linked to this work
      const real = roles.find((r: { workId?: string; isAuto?: boolean; id: string }) => r.workId === workId && !r.isAuto && !r.id.startsWith("auto-"));
      if (real) {
        setPulse(real.pulseStatus ?? "green");
        setPulseNote(real.pulseNote ?? null);
        setLastReview(real.lastReviewDate ?? null);
        return real.id;
      }
      // No real role — create one (promotes auto role to real)
      const { data: created } = await api.post("/api/war-room/roles", {
        title: workName, workId, reviewFrequency: "weekly", color: workColor, icon: workIcon,
      });
      return created.id;
    } catch { return null; }
  }, [workId, workName, workColor, workIcon]);

  const loadDetails = useCallback(async (rid: string) => {
    try {
      const [n, d] = await Promise.all([
        api.get(`/api/war-room/roles/${rid}/notes`).then(r => r.data ?? []),
        api.get(`/api/war-room/roles/${rid}/dev-requests`).then(r => r.data ?? []),
      ]);
      setNotes(n);
      setDevReqs(d);
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const rid = await findOrCreateRole();
      if (cancelled) return;
      if (rid) { setRoleId(rid); await loadDetails(rid); }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [findOrCreateRole, loadDetails]);

  async function addNote(convertToTask = false) {
    if (!newNote.trim() || !roleId) return;
    try {
      await api.post(`/api/war-room/roles/${roleId}/notes`, { content: newNote, convertToTask });
      setNewNote("");
      loadDetails(roleId);
    } catch {}
  }

  async function deleteNote(id: string) {
    try { await api.delete(`/api/war-room/notes/${id}`); if (roleId) loadDetails(roleId); } catch {}
  }

  async function addDevReq() {
    if (!newDev.title.trim() || !roleId) return;
    try {
      await api.post(`/api/war-room/roles/${roleId}/dev-requests`, { title: newDev.title, description: newDev.desc || undefined });
      setNewDev({ title: "", desc: "" });
      setShowNewDev(false);
      loadDetails(roleId);
    } catch {}
  }

  async function toggleDevDone(id: string) {
    try { await api.patch(`/api/war-room/dev-requests/${id}/status`, { status: "done" }); if (roleId) loadDetails(roleId); } catch {}
  }

  async function deleteDevReq(id: string) {
    if (!confirm("حذف؟")) return;
    try { await api.delete(`/api/war-room/dev-requests/${id}`); if (roleId) loadDetails(roleId); } catch {}
  }

  async function submitReview() {
    if (!roleId) return;
    try {
      await api.patch(`/api/war-room/roles/${roleId}/pulse`, {
        status: reviewForm.status,
        note: [reviewForm.note, reviewForm.accomplishments ? `الإنجازات: ${reviewForm.accomplishments}` : ""].filter(Boolean).join(" | ") || undefined,
      });
      if (reviewForm.note || reviewForm.accomplishments) {
        await api.post(`/api/war-room/roles/${roleId}/notes`, {
          content: `📊 مراجعة: ${PULSE[reviewForm.status]?.label ?? reviewForm.status}${reviewForm.note ? ` — ${reviewForm.note}` : ""}${reviewForm.accomplishments ? ` | الإنجازات: ${reviewForm.accomplishments}` : ""}`,
        });
      }
      setPulse(reviewForm.status);
      setShowReview(false);
      setReviewForm({ status: "green", note: "", accomplishments: "" });
      loadDetails(roleId);
    } catch {}
  }

  if (loading) return <p className="text-center py-4 text-xs animate-pulse" style={{ color: "var(--muted)" }}>تحميل القيادة...</p>;

  const p = PULSE[pulse] ?? PULSE.green;

  return (
    <div className="space-y-3">
      {/* Header + Pulse */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">🎖️</span>
          <span className="text-xs font-bold" style={{ color: "var(--text)" }}>القيادة</span>
          <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: p.bg, color: p.color }}>{p.label}</span>
          {lastReview && <span className="text-[8px]" style={{ color: "var(--muted)" }}>آخر مراجعة: {new Date(lastReview).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>}
        </div>
        <button onClick={() => { setShowReview(!showReview); setReviewForm({ status: pulse, note: "", accomplishments: "" }); }}
          className="text-[9px] px-2.5 py-1.5 rounded-lg font-bold" style={{ background: "#5E549515", color: "#5E5495" }}>
          📋 مراجعة
        </button>
      </div>

      {pulseNote && <p className="text-[10px] px-3 py-2 rounded-lg" style={{ background: p.bg, color: p.color }}>💬 {pulseNote}</p>}

      {/* Review form */}
      {showReview && (
        <div className="p-3 rounded-xl space-y-2" style={{ background: "var(--bg)", border: "1px solid #5E549520" }}>
          <div className="flex gap-1.5">
            {(["green", "yellow", "red", "blue"] as const).map(s => (
              <button key={s} onClick={() => setReviewForm({ ...reviewForm, status: s })}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition"
                style={{ background: reviewForm.status === s ? PULSE[s].color : "var(--card)", color: reviewForm.status === s ? "#fff" : PULSE[s].color, border: `1px solid ${PULSE[s].color}40` }}>
                {PULSE[s].label}
              </button>
            ))}
          </div>
          <input value={reviewForm.accomplishments} onChange={e => setReviewForm({ ...reviewForm, accomplishments: e.target.value })}
            placeholder="ما تم إنجازه؟" className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none" style={is} />
          <input value={reviewForm.note} onChange={e => setReviewForm({ ...reviewForm, note: e.target.value })}
            placeholder="ملاحظات أو تحديات..." className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none" style={is} />
          <div className="flex gap-2">
            <button onClick={submitReview} className="flex-1 py-2 rounded-lg text-[10px] font-bold text-white" style={{ background: PULSE[reviewForm.status].color }}>حفظ المراجعة</button>
            <button onClick={() => setShowReview(false)} className="px-3 py-2 rounded-lg text-[10px]" style={{ color: "var(--muted)" }}>إلغاء</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5">
        <button onClick={() => setTab("notes")} className="px-3 py-2 rounded-lg text-xs font-semibold min-h-[40px]"
          style={{ background: tab === "notes" ? "#5E5495" : "var(--bg)", color: tab === "notes" ? "#fff" : "var(--muted)" }}>
          📝 ملاحظات ({notes.length})
        </button>
        <button onClick={() => setTab("dev")} className="px-3 py-2 rounded-lg text-xs font-semibold min-h-[40px]"
          style={{ background: tab === "dev" ? "#D4AF37" : "var(--bg)", color: tab === "dev" ? "#fff" : "var(--muted)" }}>
          🔧 تطوير ({devReqs.length})
        </button>
        <button onClick={() => setTab("board")} className="px-3 py-2 rounded-lg text-xs font-semibold min-h-[40px]"
          style={{ background: tab === "board" ? "#2D6B9E" : "var(--bg)", color: tab === "board" ? "#fff" : "var(--muted)" }}>
          🎨 السبورة
        </button>
      </div>

      {/* Notes */}
      {tab === "notes" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addNote(); }}
              placeholder="ملاحظة..." className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none" style={is} />
            <button onClick={() => addNote()} disabled={!newNote.trim()} className="px-3 py-2 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#5E5495" }}>+</button>
            <button onClick={() => addNote(true)} disabled={!newNote.trim()} className="px-2 py-2 rounded-lg text-[10px] font-bold disabled:opacity-40" style={{ background: "#D4AF3715", color: "#D4AF37" }} title="حفظ كمهمة">📋</button>
          </div>
          {notes.map(n => (
            <div key={n.id} className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs group" style={{ background: "var(--bg)" }}>
              <span className="flex-1" style={{ color: "var(--text)" }}>{n.content}</span>
              <span className="text-[8px] flex-shrink-0" style={{ color: "var(--muted)" }}>{new Date(n.createdAt).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>
              {n.convertedTaskId && <span className="text-[10px] px-2 py-1 rounded-lg" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>📋</span>}
              <button onClick={() => deleteNote(n.id)} className="text-[8px] opacity-0 group-hover:opacity-100 transition" style={{ color: "#DC2626" }}>✕</button>
            </div>
          ))}
          {notes.length === 0 && <p className="text-center text-[10px] py-2" style={{ color: "var(--muted)" }}>لا توجد ملاحظات</p>}
        </div>
      )}

      {/* Dev Requests */}
      {tab === "dev" && (
        <div className="space-y-2">
          {!showNewDev ? (
            <button onClick={() => setShowNewDev(true)} className="text-[10px] px-3 py-1.5 rounded-lg font-bold" style={{ background: "#D4AF3715", color: "#D4AF37" }}>+ طلب تطوير</button>
          ) : (
            <div className="space-y-2 p-2 rounded-lg" style={{ background: "#D4AF3706" }}>
              <input value={newDev.title} onChange={e => setNewDev({ ...newDev, title: e.target.value })} placeholder="عنوان *" className="w-full px-2 py-1.5 rounded-lg border text-[10px]" style={is} />
              <textarea value={newDev.desc} onChange={e => setNewDev({ ...newDev, desc: e.target.value })} placeholder="تفاصيل..." rows={2} className="w-full px-2 py-1.5 rounded-lg border text-[10px] resize-none" style={is} />
              <div className="flex gap-2">
                <button onClick={addDevReq} disabled={!newDev.title.trim()} className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#D4AF37" }}>إضافة</button>
                <button onClick={() => setShowNewDev(false)} className="text-[10px]" style={{ color: "var(--muted)" }}>إلغاء</button>
              </div>
            </div>
          )}
          {devReqs.map(d => {
            const sc = d.status === "done" ? "#3D8C5A" : d.status === "inReview" ? "#F59E0B" : "#3B82F6";
            const sl = d.status === "done" ? "مكتمل" : d.status === "inReview" ? "قيد المراجعة" : "جديد";
            return (
              <div key={d.id} className="px-3 py-2 rounded-lg" style={{ background: "var(--bg)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium flex-1" style={{ color: "var(--text)" }}>{d.title}</span>
                  <span className="text-[10px] px-2 py-1 rounded-full font-bold" style={{ background: `${sc}15`, color: sc }}>{sl}</span>
                  {d.status !== "done" && (
                    <button onClick={() => toggleDevDone(d.id)} className="text-[10px] px-2 py-1.5 rounded-lg" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>✓</button>
                  )}
                  <button onClick={() => deleteDevReq(d.id)} className="text-[10px] px-2 py-1 rounded-lg" style={{ color: "#DC2626" }}>🗑️</button>
                </div>
                {d.description && <p className="text-[9px] mt-1" style={{ color: "var(--muted)" }}>{d.description}</p>}
              </div>
            );
          })}
          {devReqs.length === 0 && <p className="text-center text-[10px] py-2" style={{ color: "var(--muted)" }}>لا توجد طلبات</p>}
        </div>
      )}

      {/* Whiteboard */}
      {tab === "board" && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--card-border)", height: 500 }}>
          <Whiteboard entityType="job" entityId={workId} entityName={workName + " — سبورة القيادة"} />
        </div>
      )}
    </div>
  );
}
