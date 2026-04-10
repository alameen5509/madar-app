"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Role {
  id: string; title: string; organization?: string; pulseStatus: string;
  pulseNote?: string; lastReviewDate?: string; nextReviewDate?: string;
  color: string; icon: string; workId?: string; isAuto?: boolean;
  autoSource?: string; notesCount?: number; pendingDevCount?: number;
}
interface Work {
  id: string; name: string; type: string; status: string;
  sector?: string; role?: string; employer?: string;
  jobs?: { id: string; title: string; status: string }[];
}

const PULSE: Record<string, { label: string; color: string; bg: string }> = {
  green: { label: "مستقر", color: "#3D8C5A", bg: "#3D8C5A15" },
  yellow: { label: "يحتاج متابعة", color: "#F59E0B", bg: "#F59E0B15" },
  red: { label: "حرج", color: "#DC2626", bg: "#DC262615" },
  blue: { label: "بناء", color: "#3B82F6", bg: "#3B82F615" },
};

type Tab = "works" | "roles" | "manual";
interface Circle { id: string; name: string; icon?: string; color?: string; slug?: string; groupId?: string }

interface SessionItem { id: string; name: string; icon: string; color: string; roleId?: string; pulse: string; pulseNote?: string; notes: { id: string; content: string; createdAt: string }[]; devReqs: { id: string; title: string; status: string }[]; duration?: number }

// ═══ Work Session (with timer) ═══
function WorkSession({ items, onClose, onUpdate }: { items: SessionItem[]; onClose: () => void; onUpdate: () => void }) {
  const [phase, setPhase] = useState<"setup" | "running" | "done">("setup");
  const [durations, setDurations] = useState<Record<string, number>>(() => {
    const saved: Record<string, number> = {};
    try { Object.assign(saved, JSON.parse(localStorage.getItem("madar_session_durations") ?? "{}")); } catch {}
    for (const it of items) if (!saved[it.id]) saved[it.id] = it.duration ?? 10;
    return saved;
  });
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [paused, setPaused] = useState(false);
  const [newNote, setNewNote] = useState("");

  const totalMins = items.reduce((s, it) => s + (durations[it.id] ?? 10), 0);

  function saveDurations(d: Record<string, number>) {
    setDurations(d);
    localStorage.setItem("madar_session_durations", JSON.stringify(d));
  }

  function startSession() {
    saveDurations(durations);
    setIdx(0);
    setRemaining((durations[items[0]?.id] ?? 10) * 60);
    setPhase("running");
  }

  // Timer
  useEffect(() => {
    if (phase !== "running" || paused) return;
    if (remaining <= 0) return;
    const t = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [phase, paused, remaining]);

  function nextItem() {
    if (idx < items.length - 1) {
      const ni = idx + 1;
      setIdx(ni);
      setRemaining((durations[items[ni]?.id] ?? 10) * 60);
      setNewNote("");
    } else {
      setPhase("done");
      onUpdate();
    }
  }

  async function addNote() {
    const item = items[idx];
    if (!newNote.trim() || !item?.roleId) return;
    try { await api.post(`/api/war-room/roles/${item.roleId}/notes`, { content: newNote }); setNewNote(""); } catch {}
  }

  const fmtTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  const item = items[idx];
  const pct = item ? Math.max(0, 100 - (remaining / ((durations[item.id] ?? 10) * 60)) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden shadow-2xl" dir="rtl" style={{ background: "var(--card, #fff)", maxHeight: "90vh" }}>

        {/* ═══ Setup phase ═══ */}
        {phase === "setup" && (
          <div className="p-5 overflow-y-auto" style={{ maxHeight: "90vh" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-black text-base" style={{ color: "var(--text)" }}>⚙️ إعداد جلسة الأعمال</p>
                <p className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>{items.length} عنصر · إجمالي {totalMins} دقيقة ({Math.floor(totalMins / 60) > 0 ? `${Math.floor(totalMins / 60)} ساعة و ${totalMins % 60} دقيقة` : `${totalMins} دقيقة`})</p>
              </div>
              <button onClick={onClose} className="text-lg" style={{ color: "var(--muted)" }}>✕</button>
            </div>

            <div className="space-y-2 mb-4">
              {items.map(it => {
                const ip = PULSE[it.pulse] ?? PULSE.green;
                return (
                  <div key={it.id} className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: "var(--bg)", borderColor: "var(--card-border)" }}>
                    <span className="text-lg">{it.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: "var(--text)" }}>{it.name}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: ip.bg, color: ip.color }}>{ip.label}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => saveDurations({ ...durations, [it.id]: Math.max(1, (durations[it.id] ?? 10) - 5) })}
                        className="w-7 h-7 rounded-lg text-xs font-bold" style={{ background: "var(--card)", color: "var(--muted)", border: "1px solid var(--card-border)" }}>−</button>
                      <span className="text-sm font-black w-10 text-center" style={{ color: "#5E5495" }}>{durations[it.id] ?? 10}</span>
                      <button onClick={() => saveDurations({ ...durations, [it.id]: (durations[it.id] ?? 10) + 5 })}
                        className="w-7 h-7 rounded-lg text-xs font-bold" style={{ background: "var(--card)", color: "var(--muted)", border: "1px solid var(--card-border)" }}>+</button>
                      <span className="text-[9px]" style={{ color: "var(--muted)" }}>د</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl p-4 mb-4 text-center" style={{ background: "#5E549508", border: "1px solid #5E549520" }}>
              <p className="text-2xl font-black" style={{ color: "#5E5495" }}>⏱ {totalMins} دقيقة</p>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>الوقت المقدّر للجلسة الكاملة</p>
            </div>

            <button onClick={startSession} className="w-full py-3 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #5E5495, #D4AF37)" }}>
              ابدأ الجلسة ({totalMins} دقيقة) →
            </button>
          </div>
        )}

        {/* ═══ Running phase ═══ */}
        {phase === "running" && item && (() => {
          const ip = PULSE[item.pulse] ?? PULSE.green;
          return (
            <div className="p-5 overflow-y-auto" style={{ maxHeight: "90vh" }}>
              {/* Progress */}
              <div className="flex gap-0.5 mb-3">
                {items.map((_, i) => <div key={i} className="flex-1 h-1.5 rounded-full" style={{ background: i < idx ? "#3D8C5A" : i === idx ? "#D4AF37" : "#E5E7EB" }} />)}
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: item.color + "15" }}>{item.icon}</div>
                <div className="flex-1">
                  <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{item.name}</p>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: ip.bg, color: ip.color }}>{ip.label}</span>
                </div>
                <span className="text-[10px]" style={{ color: "var(--muted)" }}>{idx + 1}/{items.length}</span>
                <button onClick={onClose} className="text-lg" style={{ color: "var(--muted)" }}>✕</button>
              </div>

              {/* Timer */}
              <div className="rounded-2xl p-5 text-center mb-4" style={{ background: remaining === 0 ? "#DC262610" : "#5E549508", border: `2px solid ${remaining === 0 ? "#DC262640" : "#5E549520"}` }}>
                <p className={`text-4xl font-black font-mono ${remaining === 0 ? "text-red-500 animate-pulse" : ""}`} style={remaining > 0 ? { color: "#5E5495" } : {}}>
                  {fmtTime(remaining)}
                </p>
                <div className="h-2 rounded-full overflow-hidden mt-3 mb-2" style={{ background: "#E5E7EB" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: remaining === 0 ? "#DC2626" : "linear-gradient(90deg, #5E5495, #D4AF37)" }} />
                </div>
                <div className="flex justify-center gap-3 mt-2">
                  <button onClick={() => setPaused(!paused)} className="text-xs px-4 py-2 rounded-lg font-bold" style={{ background: "var(--bg)", color: "var(--muted)", border: "1px solid var(--card-border)" }}>
                    {paused ? "▶ استمرار" : "⏸ إيقاف مؤقت"}
                  </button>
                  <button onClick={() => setRemaining(r => r + 300)} className="text-xs px-4 py-2 rounded-lg font-bold" style={{ background: "var(--bg)", color: "#D4AF37", border: "1px solid #D4AF3730" }}>
                    +5 دقائق
                  </button>
                </div>
                {remaining === 0 && <p className="text-xs font-bold mt-2" style={{ color: "#DC2626" }}>⏰ انتهى الوقت!</p>}
              </div>

              {/* Notes & dev reqs */}
              {item.notes.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold mb-1" style={{ color: "var(--muted)" }}>📝 ملاحظات</p>
                  {item.notes.slice(0, 3).map(n => <p key={n.id} className="text-[10px] px-2 py-1 rounded-lg mb-0.5" style={{ background: "var(--bg)", color: "var(--text)" }}>{n.content}</p>)}
                </div>
              )}
              {item.devReqs.filter(d => d.status !== "done").length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold mb-1" style={{ color: "#D4AF37" }}>🔧 معلقة</p>
                  {item.devReqs.filter(d => d.status !== "done").map(d => <p key={d.id} className="text-[10px] px-2 py-1 rounded-lg mb-0.5" style={{ background: "#D4AF3708", color: "#D4AF37" }}>• {d.title}</p>)}
                </div>
              )}

              {item.roleId && (
                <div className="flex gap-2 mb-3">
                  <input value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addNote(); }}
                    placeholder="ملاحظة..." className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none"
                    style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }} />
                  <button onClick={addNote} disabled={!newNote.trim()} className="px-3 py-2 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#5E5495" }}>+</button>
                </div>
              )}

              <button onClick={nextItem} className="w-full py-3 rounded-xl text-sm font-bold text-white"
                style={{ background: "linear-gradient(135deg, #5E5495, #D4AF37)" }}>
                {idx < items.length - 1 ? "التالي →" : "إنهاء الجلسة ✓"}
              </button>
            </div>
          );
        })()}

        {/* ═══ Done phase ═══ */}
        {phase === "done" && (
          <div className="p-8 text-center">
            <p className="text-5xl mb-4">✅</p>
            <p className="font-black text-lg mb-2" style={{ color: "var(--text)" }}>اكتملت الجلسة</p>
            <p className="text-xs mb-6" style={{ color: "var(--muted)" }}>راجعت {items.length} عنصر</p>
            <button onClick={onClose} className="px-8 py-3 rounded-xl text-sm font-bold text-white" style={{ background: "#3D8C5A" }}>إغلاق</button>
          </div>
        )}
      </div>
    </div>
  );
}

function LeadershipSession({ items, onClose, onUpdate }: { items: SessionItem[]; onClose: () => void; onUpdate: () => void }) {
  const [idx, setIdx] = useState(0);
  const [review, setReview] = useState({ status: "green", note: "", accomplishments: "" });
  const [saving, setSaving] = useState(false);
  const [newNote, setNewNote] = useState("");

  const item = items[idx];
  if (!item) return null;
  const p = PULSE[item.pulse] ?? PULSE.green;

  useEffect(() => { setReview({ status: item.pulse || "green", note: "", accomplishments: "" }); setNewNote(""); }, [idx, item.pulse]);

  async function saveReview() {
    if (!item.roleId) { next(); return; }
    setSaving(true);
    try {
      await api.patch(`/api/war-room/roles/${item.roleId}/pulse`, {
        status: review.status,
        note: [review.note, review.accomplishments ? `الإنجازات: ${review.accomplishments}` : ""].filter(Boolean).join(" | ") || undefined,
      });
      if (review.note || review.accomplishments) {
        await api.post(`/api/war-room/roles/${item.roleId}/notes`, {
          content: `📊 مراجعة: ${PULSE[review.status]?.label ?? review.status}${review.note ? ` — ${review.note}` : ""}${review.accomplishments ? ` | الإنجازات: ${review.accomplishments}` : ""}`,
        });
      }
    } catch {}
    setSaving(false);
    next();
  }

  async function addSessionNote() {
    if (!newNote.trim() || !item.roleId) return;
    try { await api.post(`/api/war-room/roles/${item.roleId}/notes`, { content: newNote }); setNewNote(""); } catch {}
  }

  function next() { if (idx < items.length - 1) setIdx(idx + 1); else { onUpdate(); onClose(); } }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden shadow-2xl" dir="rtl" style={{ background: "var(--card, #fff)", maxHeight: "90vh" }}>
        {/* Progress */}
        <div className="flex gap-0.5 p-3">
          {items.map((_, i) => <div key={i} className="flex-1 h-1.5 rounded-full transition-all" style={{ background: i < idx ? "#3D8C5A" : i === idx ? "#D4AF37" : "#E5E7EB" }} />)}
        </div>

        <div className="px-5 pb-5 overflow-y-auto" style={{ maxHeight: "calc(90vh - 60px)" }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0" style={{ background: item.color + "15" }}>{item.icon}</div>
            <div className="flex-1">
              <p className="font-black text-base" style={{ color: "var(--text)" }}>{item.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: p.bg, color: p.color }}>{p.label}</span>
                <span className="text-[10px]" style={{ color: "var(--muted)" }}>{idx + 1} من {items.length}</span>
              </div>
            </div>
            <button onClick={onClose} className="text-lg" style={{ color: "var(--muted)" }}>✕</button>
          </div>

          {item.pulseNote && <p className="text-[10px] px-3 py-2 rounded-lg mb-3" style={{ background: p.bg, color: p.color }}>💬 {item.pulseNote}</p>}

          {/* Current notes */}
          {item.notes.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-bold mb-1" style={{ color: "var(--muted)" }}>📝 آخر الملاحظات</p>
              <div className="space-y-1">
                {item.notes.slice(0, 3).map(n => (
                  <p key={n.id} className="text-[10px] px-2 py-1.5 rounded-lg" style={{ background: "var(--bg)", color: "var(--text)" }}>{n.content}</p>
                ))}
              </div>
            </div>
          )}

          {/* Pending dev reqs */}
          {item.devReqs.filter(d => d.status !== "done").length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-bold mb-1" style={{ color: "#D4AF37" }}>🔧 طلبات تطوير معلقة</p>
              {item.devReqs.filter(d => d.status !== "done").map(d => (
                <p key={d.id} className="text-[10px] px-2 py-1.5 rounded-lg mb-1" style={{ background: "#D4AF3708", color: "#D4AF37" }}>• {d.title}</p>
              ))}
            </div>
          )}

          {/* Quick note */}
          {item.roleId && (
            <div className="flex gap-2 mb-4">
              <input value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addSessionNote(); }}
                placeholder="ملاحظة سريعة..." className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none"
                style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }} />
              <button onClick={addSessionNote} disabled={!newNote.trim()} className="px-3 py-2 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#5E5495" }}>+</button>
            </div>
          )}

          {/* Review */}
          <div className="p-3 rounded-xl space-y-2" style={{ background: "var(--bg)", border: "1px solid #5E549520" }}>
            <p className="text-xs font-bold" style={{ color: "var(--text)" }}>تحديث النبض</p>
            <div className="flex gap-1.5">
              {(["green", "yellow", "red", "blue"] as const).map(s => (
                <button key={s} onClick={() => setReview({ ...review, status: s })}
                  className="flex-1 py-2 rounded-lg text-[10px] font-bold transition"
                  style={{ background: review.status === s ? PULSE[s].color : "var(--card)", color: review.status === s ? "#fff" : PULSE[s].color, border: `1px solid ${PULSE[s].color}40` }}>
                  {PULSE[s].label}
                </button>
              ))}
            </div>
            <input value={review.accomplishments} onChange={e => setReview({ ...review, accomplishments: e.target.value })}
              placeholder="ما تم إنجازه؟" className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none"
              style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--text)" }} />
            <input value={review.note} onChange={e => setReview({ ...review, note: e.target.value })}
              placeholder="تحديات أو ملاحظات..." className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none"
              style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--text)" }} />
          </div>

          {/* Navigation */}
          <div className="flex gap-2 mt-4">
            <button onClick={saveReview} disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${PULSE[review.status].color}, #5E5495)` }}>
              {saving ? "جارٍ الحفظ..." : idx < items.length - 1 ? "حفظ والتالي →" : "حفظ وإنهاء ✓"}
            </button>
            {idx < items.length - 1 && (
              <button onClick={next} className="px-4 py-3 rounded-xl text-sm font-medium" style={{ color: "var(--muted)" }}>تخطي →</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WarRoomIndexPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("works");
  const [showAddManual, setShowAddManual] = useState(false);
  const [newManual, setNewManual] = useState({ title: "", org: "" });
  const [pulseFilter, setPulseFilter] = useState<"all" | "red" | "yellow" | "green" | "blue">("all");
  const [sessionItems, setSessionItems] = useState<SessionItem[] | null>(null);
  const [workSessionItems, setWorkSessionItems] = useState<SessionItem[] | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(localStorage.getItem("madar_warroom_hidden") ?? "[]")); } catch { return new Set(); }
  });
  const [showHidden, setShowHidden] = useState(false);

  function toggleHide(id: string) {
    setHiddenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem("madar_warroom_hidden", JSON.stringify([...next]));
      return next;
    });
  }

  async function deleteManualRole(id: string, title: string) {
    if (!confirm(`حذف غرفة القيادة "${title}"؟ سيتم حذف جميع الملاحظات وطلبات التطوير المرتبطة.`)) return;
    try { await api.delete(`/api/war-room/roles/${id}`); load(); } catch { alert("فشل الحذف"); }
  }

  async function startSession(mode: "review" | "work" = "review") {
    // Build session items from visible work items + manual roles
    const items: SessionItem[] = [];
    for (const wi of workItems.filter(i => !hiddenIds.has(i.id))) {
      const notes = wi.role ? await api.get(`/api/war-room/roles/${wi.role.id}/notes`).then(r => r.data ?? []).catch(() => []) : [];
      const devReqs = wi.role ? await api.get(`/api/war-room/roles/${wi.role.id}/dev-requests`).then(r => r.data ?? []).catch(() => []) : [];
      items.push({ id: wi.id, name: wi.name, icon: wi.icon, color: wi.color, roleId: wi.role?.id, pulse: wi.role?.pulseStatus ?? "green", pulseNote: wi.role?.pulseNote, notes, devReqs });
    }
    for (const ri of roleItems.filter(i => !hiddenIds.has(i.id))) {
      const notes = ri.role ? await api.get(`/api/war-room/roles/${ri.role.id}/notes`).then(r => r.data ?? []).catch(() => []) : [];
      const devReqs = ri.role ? await api.get(`/api/war-room/roles/${ri.role.id}/dev-requests`).then(r => r.data ?? []).catch(() => []) : [];
      items.push({ id: ri.id, name: ri.name, icon: ri.icon, color: ri.color, roleId: ri.role?.id, pulse: ri.role?.pulseStatus ?? "green", pulseNote: ri.role?.pulseNote, notes, devReqs });
    }
    for (const r of manualRoles) {
      const notes = await api.get(`/api/war-room/roles/${r.id}/notes`).then(res => res.data ?? []).catch(() => []);
      const devReqs = await api.get(`/api/war-room/roles/${r.id}/dev-requests`).then(res => res.data ?? []).catch(() => []);
      items.push({ id: r.id, name: r.title, icon: r.icon || "🎯", color: r.color || "#5E5495", roleId: r.id, pulse: r.pulseStatus, pulseNote: r.pulseNote, notes, devReqs });
    }
    // Sort: red first, then yellow, then blue (building), then green
    const order = { red: 0, yellow: 1, blue: 2, green: 3 };
    items.sort((a, b) => (order[a.pulse as keyof typeof order] ?? 2) - (order[b.pulse as keyof typeof order] ?? 2));
    if (mode === "work") setWorkSessionItems(items);
    else setSessionItems(items);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, w, cg] = await Promise.all([
        api.get("/api/war-room/roles").then(r => r.data ?? []).catch(() => []),
        api.get("/api/works").then(r => r.data ?? []).catch(() => []),
        api.get("/api/circle-groups").then(r => r.data ?? []).catch(() => []),
      ]);
      setRoles(Array.isArray(r) ? r : []);
      setWorks(Array.isArray(w) ? w : []);
      const allCircles: Circle[] = (Array.isArray(cg) ? cg : []).flatMap((g: { circles?: Circle[] }) => g.circles ?? []);
      setCircles(allCircles);
    } catch {}
    setLoading(false);
  }, []);

  async function addManualRole() {
    if (!newManual.title.trim()) return;
    try {
      await api.post("/api/war-room/roles", { title: newManual.title, organization: newManual.org || undefined, reviewFrequency: "weekly", color: "#5E5495", icon: "🎯" });
      setNewManual({ title: "", org: "" }); setShowAddManual(false); load();
    } catch { alert("فشل الإضافة"); }
  }

  useEffect(() => { load(); }, [load]);

  const getPulse = (s?: string) => s === "red" || s === "yellow" || s === "green" || s === "blue" ? s : "green";
  const pulseOrder: Record<string, number> = { red: 0, yellow: 1, blue: 2, green: 3 };

  // Work-linked items
  const workItems: { id: string; name: string; type: string; icon: string; color: string; role?: Role; href: string }[] = [];
  for (const w of works) {
    const role = roles.find(r => r.workId === w.id && !r.isAuto && !r.id.startsWith("auto-"))
      ?? roles.find(r => r.workId === w.id && !r.autoSource?.includes("job"));
    workItems.push({ id: w.id, name: w.name, type: w.type === "job" ? "وظيفة" : "رجل أعمال", icon: w.type === "job" ? "💼" : "🏢", color: w.type === "job" ? "#2D6B9E" : "#D4AF37", role, href: "/works/" + w.id });
    if (w.jobs) {
      for (const j of w.jobs) {
        const jRole = roles.find(r => r.workId === j.id && !r.isAuto && !r.id.startsWith("auto-"))
          ?? roles.find(r => r.workId === j.id);
        workItems.push({ id: j.id, name: j.title + " — " + w.name, type: "وظيفة فرعية", icon: "👔", color: "#5E5495", role: jRole, href: "/works/" + w.id + "/jobs/" + j.id });
      }
    }
  }

  // Role-linked items (from circles/UserCircles)
  const workIdSet = new Set(works.flatMap(w => [w.id, ...(w.jobs?.map(j => j.id) ?? [])]));
  const roleItems: { id: string; name: string; type: string; icon: string; color: string; role?: Role; href: string }[] = [];
  for (const c of circles) {
    const role = roles.find(r => r.workId === c.id && !r.isAuto && !r.id.startsWith("auto-"))
      ?? roles.find(r => r.workId === c.id);
    roleItems.push({ id: c.id, name: c.name, type: "دور حياتي", icon: c.icon ?? "◎", color: c.color ?? "#5E5495", role, href: "/circles/" + c.id });
  }
  roleItems.sort((a, b) => (pulseOrder[getPulse(a.role?.pulseStatus)] ?? 3) - (pulseOrder[getPulse(b.role?.pulseStatus)] ?? 3));

  // Manual roles (not linked to any work or circle)
  const circleIdSet = new Set(circles.map(c => c.id));
  const manualRoles = roles.filter(r => !r.isAuto && !r.id.startsWith("auto-") && (!r.workId || (!workIdSet.has(r.workId) && !circleIdSet.has(r.workId))));

  // Sort all items by pulse: red → yellow → blue → green
  workItems.sort((a, b) => (pulseOrder[getPulse(a.role?.pulseStatus)] ?? 3) - (pulseOrder[getPulse(b.role?.pulseStatus)] ?? 3));
  manualRoles.sort((a, b) => (pulseOrder[getPulse(a.pulseStatus)] ?? 3) - (pulseOrder[getPulse(b.pulseStatus)] ?? 3));

  const allItems = [...workItems, ...roleItems];
  // Pulse counts — exclude hidden items
  const visibleWorkItems = allItems.filter(i => !hiddenIds.has(i.id));
  const visibleManual = manualRoles;
  const countPulse = (p: string) => visibleWorkItems.filter(i => getPulse(i.role?.pulseStatus) === p).length + visibleManual.filter(r => getPulse(r.pulseStatus) === p).length;
  const redCount = countPulse("red");
  const yellowCount = countPulse("yellow");
  const greenCount = countPulse("green");
  const blueCount = countPulse("blue");

  function renderCard(item: { id: string; name: string; type: string; icon: string; color: string; role?: Role; href: string }, idx: number) {
    const pulse = PULSE[item.role?.pulseStatus ?? "green"] ?? PULSE.green;
    const hasRole = !!item.role && !item.role.isAuto;
    const dueReview = item.role?.nextReviewDate && new Date(item.role.nextReviewDate) <= new Date();
    const isHidden = hiddenIds.has(item.id);
    if (isHidden && !showHidden) return null;
    const itemPulse = getPulse(item.role?.pulseStatus);
    if (pulseFilter !== "all" && itemPulse !== pulseFilter) return null;
    return (
      <div key={idx} className={`rounded-2xl border overflow-hidden transition-all ${isHidden ? "opacity-50" : ""}`} style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <Link href={item.href} className="block">
          <div className="p-4" style={{ borderRight: `4px solid ${item.color}` }}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{item.name}</p>
                  <span className="text-[10px] px-2 py-1 rounded-full font-bold" style={{ background: pulse.bg, color: pulse.color }}>{pulse.label}</span>
                  {dueReview && <span className="text-[10px] px-2 py-1 rounded-full font-bold animate-pulse" style={{ background: "#F59E0B15", color: "#F59E0B" }}>📋 مراجعة</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${item.color}15`, color: item.color }}>{item.type}</span>
                  {item.role?.lastReviewDate && <span className="text-[10px]" style={{ color: "var(--muted)" }}>آخر مراجعة: {new Date(item.role.lastReviewDate).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>}
                  {(item.role?.notesCount ?? 0) > 0 && <span className="text-[10px]" style={{ color: "#5E5495" }}>📝 {item.role?.notesCount}</span>}
                  {(item.role?.pendingDevCount ?? 0) > 0 && <span className="text-[10px]" style={{ color: "#D4AF37" }}>🔧 {item.role?.pendingDevCount}</span>}
                </div>
              </div>
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                {hasRole ? <div className="w-3 h-3 rounded-full" style={{ background: pulse.color }} /> : <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--bg)", color: "var(--muted)" }}>جديد</span>}
                <span className="text-xs" style={{ color: "#5E5495" }}>فتح ←</span>
              </div>
            </div>
            {item.role?.pulseNote && <p className="text-[10px] mt-2 px-3 py-1.5 rounded-lg" style={{ background: pulse.bg, color: pulse.color }}>💬 {item.role.pulseNote}</p>}
          </div>
        </Link>
        <div className="px-4 pb-3 flex justify-end">
          <button onClick={() => toggleHide(item.id)} className="text-[10px] px-3 py-1.5 rounded-lg transition hover:bg-gray-100" style={{ color: "var(--muted)" }}>
            {isHidden ? "👁 إظهار" : "🙈 إخفاء"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur border-b px-4 sm:px-6 py-3 pr-14 md:pr-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>🎖️ غرفة القيادة</h2>
          <div className="flex gap-2">
            <button onClick={startSession}
              className="px-3 py-2 rounded-xl text-[10px] font-bold text-white transition hover:opacity-90"
              style={{ background: "#5E5495" }}>
              📊 مراجعة
            </button>
            <button onClick={() => startSession("work")}
              className="px-3 py-2 rounded-xl text-[10px] font-bold text-white transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #D4AF37, #5E5495)" }}>
              ⏱ جلسة أعمال
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs" style={{ color: "var(--muted)" }}>{workItems.length + roleItems.length + manualRoles.length} غرفة</span>
          {redCount > 0 && <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: "#DC262615", color: "#DC2626" }}>🔴 {redCount} حرج</span>}
          {yellowCount > 0 && <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: "#F59E0B15", color: "#F59E0B" }}>🟡 {yellowCount} متابعة</span>}
          {greenCount > 0 && <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>🟢 {greenCount} مستقر</span>}
          {blueCount > 0 && <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: "#3B82F615", color: "#3B82F6" }}>🔵 {blueCount} بناء</span>}
          {hiddenIds.size > 0 && (
            <button onClick={() => setShowHidden(!showHidden)} className="text-xs font-bold px-2 py-1 rounded-full transition"
              style={{ background: showHidden ? "#5E549515" : "var(--bg)", color: showHidden ? "#5E5495" : "var(--muted)", border: `1px solid ${showHidden ? "#5E549530" : "var(--card-border)"}` }}>
              {showHidden ? `🙈 إخفاء المخفية (${hiddenIds.size})` : `👁 عرض المخفية (${hiddenIds.size})`}
            </button>
          )}
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={() => setTab("works")} className="px-4 py-2.5 rounded-xl text-xs font-bold transition min-h-[40px]"
            style={{ background: tab === "works" ? "#2D6B9E" : "var(--bg)", color: tab === "works" ? "#fff" : "var(--muted)", border: `1px solid ${tab === "works" ? "#2D6B9E" : "var(--card-border)"}` }}>
            💼 الأعمال والوظائف ({workItems.length})
          </button>
          <button onClick={() => setTab("roles")} className="px-4 py-2.5 rounded-xl text-xs font-bold transition min-h-[40px]"
            style={{ background: tab === "roles" ? "#C9A84C" : "var(--bg)", color: tab === "roles" ? "#fff" : "var(--muted)", border: `1px solid ${tab === "roles" ? "#C9A84C" : "var(--card-border)"}` }}>
            ◎ الأدوار ({roleItems.length})
          </button>
          <button onClick={() => setTab("manual")} className="px-4 py-2.5 rounded-xl text-xs font-bold transition min-h-[40px]"
            style={{ background: tab === "manual" ? "#5E5495" : "var(--bg)", color: tab === "manual" ? "#fff" : "var(--muted)", border: `1px solid ${tab === "manual" ? "#5E5495" : "var(--card-border)"}` }}>
            🎯 يدوية ({manualRoles.length})
          </button>
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {([
            { key: "all", label: "الكل", color: "#5E5495" },
            { key: "red", label: "🔴 حرج", color: "#DC2626" },
            { key: "yellow", label: "🟡 متابعة", color: "#F59E0B" },
            { key: "green", label: "🟢 مستقر", color: "#3D8C5A" },
            { key: "blue", label: "🔵 بناء", color: "#3B82F6" },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setPulseFilter(f.key)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition"
              style={{ background: pulseFilter === f.key ? f.color + "20" : "var(--bg)", color: pulseFilter === f.key ? f.color : "var(--muted)", border: `1px solid ${pulseFilter === f.key ? f.color + "40" : "var(--card-border)"}` }}>
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 space-y-3 max-w-3xl mx-auto">
        {loading && <p className="text-center py-12 animate-pulse text-sm" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}

        {/* Works tab */}
        {!loading && tab === "works" && (<>
          {workItems.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">💼</p>
              <p className="font-bold" style={{ color: "var(--text)" }}>لا توجد أعمال</p>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>أضف أعمال من صفحة "الأعمال"</p>
              <Link href="/works" className="inline-block mt-4 px-6 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #2D6B9E, #D4AF37)" }}>الذهاب للأعمال</Link>
            </div>
          ) : (<>
            {workItems.map((item, idx) => renderCard(item, idx))}
            {hiddenIds.size > 0 && (
              <button onClick={() => setShowHidden(!showHidden)} className="w-full py-2 rounded-xl text-[10px] font-medium transition hover:bg-gray-100" style={{ color: "var(--muted)" }}>
                {showHidden ? "🙈 إخفاء المخفية" : `👁 عرض المخفية (${[...hiddenIds].filter(id => workItems.some(i => i.id === id)).length})`}
              </button>
            )}
          </>)}
        </>)}

        {/* Roles tab */}
        {!loading && tab === "roles" && (<>
          {roleItems.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">◎</p>
              <p className="font-bold" style={{ color: "var(--text)" }}>لا توجد أدوار حياتية</p>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>أضف أدوار من صفحة "أدوار الحياة"</p>
              <Link href="/circles" className="inline-block mt-4 px-6 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #C9A84C, #5E5495)" }}>الذهاب للأدوار</Link>
            </div>
          ) : (<>
            {roleItems.map((item, idx) => renderCard(item, idx))}
          </>)}
        </>)}

        {/* Manual tab */}
        {!loading && tab === "manual" && (<>
          {/* Add manual role button */}
          {!showAddManual ? (
            <button onClick={() => setShowAddManual(true)}
              className="w-full py-3 rounded-xl text-sm font-bold transition border-2 border-dashed hover:bg-[#5E5495]/5"
              style={{ borderColor: "#5E549540", color: "#5E5495" }}>
              + إضافة غرفة قيادة يدوية
            </button>
          ) : (
            <div className="rounded-xl border p-4 space-y-2" style={{ background: "var(--card)", borderColor: "#5E549530" }}>
              <input value={newManual.title} onChange={e => setNewManual({ ...newManual, title: e.target.value })}
                placeholder="عنوان الغرفة *" className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }} autoFocus
                onKeyDown={e => { if (e.key === "Enter") addManualRole(); }} />
              <input value={newManual.org} onChange={e => setNewManual({ ...newManual, org: e.target.value })}
                placeholder="المؤسسة / الجهة (اختياري)" className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none"
                style={{ background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" }} />
              <div className="flex gap-2">
                <button onClick={addManualRole} disabled={!newManual.title.trim()} className="px-5 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-40" style={{ background: "#5E5495" }}>إضافة</button>
                <button onClick={() => { setShowAddManual(false); setNewManual({ title: "", org: "" }); }} className="px-3 py-2 rounded-lg text-xs" style={{ color: "var(--muted)" }}>إلغاء</button>
              </div>
            </div>
          )}

          {manualRoles.length === 0 && !showAddManual ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🎯</p>
              <p className="font-bold" style={{ color: "var(--text)" }}>لا توجد غرف قيادة يدوية</p>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>أضف غرفة قيادة يدوية من الزر أعلاه</p>
            </div>
          ) : manualRoles.filter(r => pulseFilter === "all" || getPulse(r.pulseStatus) === pulseFilter).map((r, idx) => {
            const pulse = PULSE[r.pulseStatus] ?? PULSE.green;
            return (
              <div key={idx} className="rounded-2xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <div className="p-4" style={{ borderRight: `4px solid ${r.color || "#5E5495"}` }}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{r.icon || "🎯"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{r.title}</p>
                        <span className="text-[10px] px-2 py-1 rounded-full font-bold" style={{ background: pulse.bg, color: pulse.color }}>{pulse.label}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {r.organization && <span className="text-[10px]" style={{ color: "var(--muted)" }}>{r.organization}</span>}
                        {r.lastReviewDate && <span className="text-[10px]" style={{ color: "var(--muted)" }}>آخر مراجعة: {new Date(r.lastReviewDate).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>}
                        {(r.notesCount ?? 0) > 0 && <span className="text-[10px]" style={{ color: "#5E5495" }}>📝 {r.notesCount}</span>}
                        {(r.pendingDevCount ?? 0) > 0 && <span className="text-[10px]" style={{ color: "#D4AF37" }}>🔧 {r.pendingDevCount}</span>}
                      </div>
                    </div>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: pulse.color }} />
                  </div>
                  {r.pulseNote && <p className="text-[10px] mt-2 px-3 py-1.5 rounded-lg" style={{ background: pulse.bg, color: pulse.color }}>💬 {r.pulseNote}</p>}
                  <div className="flex justify-end mt-2">
                    <button onClick={() => deleteManualRole(r.id, r.title)}
                      className="text-[10px] px-3 py-1.5 rounded-lg transition hover:bg-red-50"
                      style={{ color: "#ef4444", border: "1px solid #ef444430" }}>
                      🗑️ حذف
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </>)}
      </div>

      {sessionItems && (
        <LeadershipSession items={sessionItems} onClose={() => setSessionItems(null)} onUpdate={load} />
      )}
      {workSessionItems && (
        <WorkSession items={workSessionItems} onClose={() => setWorkSessionItems(null)} onUpdate={load} />
      )}
    </main>
  );
}
