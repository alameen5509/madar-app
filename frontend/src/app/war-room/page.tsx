"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

interface Role { id:string; title:string; organization?:string; sector?:string; description?:string; pulseStatus:string; pulseNote?:string; nextReviewDate?:string; lastReviewDate?:string; reviewFrequency:string; color:string; icon:string; priority:number; notesCount?:number; pendingDevCount?:number; }
interface Note { id:string; content:string; convertedTaskId?:string; createdAt:string; }
interface DevReq { id:string; title:string; description?:string; status:string; nextReviewDate?:string; createdAt:string; }

const PULSE: Record<string,{label:string;color:string;bg:string}> = {
  green: { label: "مستقر", color: "#3D8C5A", bg: "#3D8C5A15" },
  yellow: { label: "يحتاج متابعة", color: "#F59E0B", bg: "#F59E0B15" },
  red: { label: "حرج", color: "#DC2626", bg: "#DC262615" },
};

export default function WarRoomPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [nr, setNr] = useState({ title: "", org: "", sector: "", desc: "", freq: "weekly", color: "#5E5495", icon: "🎯" });
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [devReqs, setDevReqs] = useState<DevReq[]>([]);
  const [newNote, setNewNote] = useState("");
  const [newDev, setNewDev] = useState({ title: "", desc: "" });
  const [showNewDev, setShowNewDev] = useState(false);
  const [pulseRole, setPulseRole] = useState<string | null>(null);
  const [pulseForm, setPulseForm] = useState({ status: "green", note: "" });
  const [detailTab, setDetailTab] = useState<"notes" | "dev">("notes");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get("/api/war-room/roles"); setRoles(data ?? []); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function createRole() {
    if (!nr.title.trim()) return;
    try {
      await api.post("/api/war-room/roles", { title: nr.title, organization: nr.org || undefined, sector: nr.sector || undefined, description: nr.desc || undefined, reviewFrequency: nr.freq, color: nr.color, icon: nr.icon });
      setNr({ title: "", org: "", sector: "", desc: "", freq: "weekly", color: "#5E5495", icon: "🎯" }); setShowNew(false); fetchData();
    } catch {}
  }

  async function loadRoleDetails(id: string) {
    if (expandedRole === id) { setExpandedRole(null); return; }
    setExpandedRole(id); setDetailTab("notes");
    try {
      const [n, d] = await Promise.all([
        api.get(`/api/war-room/roles/${id}/notes`).then(r => r.data ?? []),
        api.get(`/api/war-room/roles/${id}/dev-requests`).then(r => r.data ?? []),
      ]);
      setNotes(n); setDevReqs(d);
    } catch {}
  }

  async function addNote(roleId: string, convertToTask = false) {
    if (!newNote.trim()) return;
    try {
      await api.post(`/api/war-room/roles/${roleId}/notes`, { content: newNote, convertToTask });
      setNewNote(""); loadRoleDetails(roleId); loadRoleDetails(roleId);
    } catch {}
  }

  async function addDevReq(roleId: string) {
    if (!newDev.title.trim()) return;
    try {
      await api.post(`/api/war-room/roles/${roleId}/dev-requests`, { title: newDev.title, description: newDev.desc || undefined });
      setNewDev({ title: "", desc: "" }); setShowNewDev(false); loadRoleDetails(roleId); loadRoleDetails(roleId);
    } catch {}
  }

  async function updatePulse(roleId: string) {
    try {
      await api.patch(`/api/war-room/roles/${roleId}/pulse`, { status: pulseForm.status, note: pulseForm.note || undefined });
      setPulseRole(null); fetchData();
    } catch {}
  }

  const is = { background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" } as const;
  const redCount = roles.filter(r => r.pulseStatus === "red").length;
  const yellowCount = roles.filter(r => r.pulseStatus === "yellow").length;

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur border-b px-4 sm:px-6 py-3 pr-14 md:pr-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>🎖️ غرفة القيادة</h2>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs" style={{ color: "var(--muted)" }}>{roles.length} منصب</span>
          {redCount > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full animate-pulse" style={{ background: "#DC262615", color: "#DC2626" }}>🔴 {redCount} حرج</span>}
          {yellowCount > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#F59E0B15", color: "#F59E0B" }}>🟡 {yellowCount} متابعة</span>}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 space-y-4 max-w-3xl mx-auto">
        {loading && <p className="text-center py-8 animate-pulse text-sm" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}

        {!loading && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold" style={{ color: "var(--text)" }}>المناصب القيادية</span>
              <button onClick={() => setShowNew(true)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: "linear-gradient(135deg, #5E5495, #D4AF37)" }}>+ منصب جديد</button>
            </div>

            {showNew && (
              <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <input value={nr.title} onChange={e => setNr({...nr, title: e.target.value})} placeholder="المنصب *" className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={is} />
                <div className="flex gap-2">
                  <input value={nr.org} onChange={e => setNr({...nr, org: e.target.value})} placeholder="الجهة" className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none" style={is} />
                  <input value={nr.sector} onChange={e => setNr({...nr, sector: e.target.value})} placeholder="القطاع" className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none" style={is} />
                </div>
                <textarea value={nr.desc} onChange={e => setNr({...nr, desc: e.target.value})} placeholder="وصف المنصب" rows={2} className="w-full px-3 py-2 rounded-lg border text-xs resize-none focus:outline-none" style={is} />
                <div className="flex gap-2">
                  <select value={nr.freq} onChange={e => setNr({...nr, freq: e.target.value})} className="flex-1 px-2 py-1.5 rounded-lg border text-xs" style={is}>
                    <option value="daily">مراجعة يومية</option><option value="weekly">أسبوعية</option><option value="monthly">شهرية</option>
                  </select>
                  <input value={nr.icon} onChange={e => setNr({...nr, icon: e.target.value})} className="w-12 px-2 py-1.5 rounded-lg border text-center text-sm" style={is} />
                  <input type="color" value={nr.color} onChange={e => setNr({...nr, color: e.target.value})} className="w-10 h-9 rounded-lg border cursor-pointer" />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowNew(false)} className="px-3 py-1.5 rounded-lg text-[10px]" style={{ color: "var(--muted)" }}>إلغاء</button>
                  <button onClick={createRole} disabled={!nr.title.trim()} className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#5E5495" }}>إضافة</button>
                </div>
              </div>
            )}

            {/* Roles list */}
            {roles.map(role => {
              const pulse = PULSE[role.pulseStatus] ?? PULSE.green;
              const isExp = expandedRole === role.id;
              const dueReview = role.nextReviewDate && new Date(role.nextReviewDate) <= new Date();
              return (
                <div key={role.id} className="rounded-2xl border overflow-hidden" style={{ background: "var(--card)", borderColor: `${role.color}40` }}>
                  {/* Role header */}
                  <div className="px-4 py-3 cursor-pointer" onClick={() => loadRoleDetails(role.id)} style={{ borderRight: `4px solid ${role.color}` }}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{role.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm truncate" style={{ color: "var(--text)" }}>{role.title}</p>
                          <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: pulse.bg, color: pulse.color }}>{pulse.label}</span>
                          {dueReview && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold animate-pulse" style={{ background: "#F59E0B15", color: "#F59E0B" }}>مراجعة مستحقة</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {role.organization && <span className="text-[9px]" style={{ color: "var(--muted)" }}>{role.organization}</span>}
                          {role.sector && <span className="text-[9px]" style={{ color: "var(--muted)" }}>· {role.sector}</span>}
                          {(role.notesCount ?? 0) > 0 && <span className="text-[9px]" style={{ color: "#5E5495" }}>📝 {role.notesCount}</span>}
                          {(role.pendingDevCount ?? 0) > 0 && <span className="text-[9px]" style={{ color: "#D4AF37" }}>🔧 {role.pendingDevCount}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setPulseRole(pulseRole === role.id ? null : role.id); setPulseForm({ status: role.pulseStatus, note: "" }); }}
                          className="text-[9px] px-2 py-1 rounded-lg font-semibold" style={{ background: pulse.bg, color: pulse.color }}>نبض</button>
                        <button onClick={async (e) => { e.stopPropagation(); if (confirm("حذف؟")) { try { await api.delete(`/api/war-room/roles/${role.id}`); fetchData(); } catch {} } }}
                          className="text-[9px] px-1.5 py-1 rounded-lg" style={{ color: "#DC2626" }}>🗑️</button>
                      </div>
                    </div>

                    {/* Pulse update form */}
                    {pulseRole === role.id && (
                      <div className="mt-2 p-2 rounded-lg space-y-2" style={{ background: "var(--bg)" }} onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1.5">
                          {(["green","yellow","red"] as const).map(s => (
                            <button key={s} onClick={() => setPulseForm({...pulseForm, status: s})}
                              className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition"
                              style={{ background: pulseForm.status === s ? PULSE[s].color : "var(--card)", color: pulseForm.status === s ? "#fff" : PULSE[s].color, border: `1px solid ${PULSE[s].color}40` }}>
                              {PULSE[s].label}
                            </button>
                          ))}
                        </div>
                        <input value={pulseForm.note} onChange={e => setPulseForm({...pulseForm, note: e.target.value})} placeholder="ملاحظة سريعة..." className="w-full px-2 py-1.5 rounded-lg border text-[10px]" style={is} />
                        <button onClick={() => updatePulse(role.id)} className="w-full py-1.5 rounded-lg text-[10px] font-bold text-white" style={{ background: PULSE[pulseForm.status].color }}>تحديث النبض</button>
                      </div>
                    )}
                  </div>

                  {/* Expanded details */}
                  {isExp && (
                    <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: "var(--card-border)" }}>
                      {role.pulseNote && <p className="text-[10px] p-2 rounded-lg" style={{ background: pulse.bg, color: pulse.color }}>💬 {role.pulseNote}</p>}

                      {/* Tabs */}
                      <div className="flex gap-1.5">
                        <button onClick={() => setDetailTab("notes")} className="px-3 py-1 rounded-lg text-[10px] font-semibold" style={{ background: detailTab === "notes" ? "#5E5495" : "var(--bg)", color: detailTab === "notes" ? "#fff" : "var(--muted)" }}>📝 ملاحظات</button>
                        <button onClick={() => setDetailTab("dev")} className="px-3 py-1 rounded-lg text-[10px] font-semibold" style={{ background: detailTab === "dev" ? "#D4AF37" : "var(--bg)", color: detailTab === "dev" ? "#fff" : "var(--muted)" }}>🔧 طلبات تطوير</button>
                      </div>

                      {/* Notes tab */}
                      {detailTab === "notes" && (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addNote(role.id); }}
                              placeholder="اكتب ملاحظة..." className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none" style={is} />
                            <button onClick={() => addNote(role.id)} disabled={!newNote.trim()} className="px-3 py-2 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#5E5495" }}>إضافة</button>
                            <button onClick={() => addNote(role.id, true)} disabled={!newNote.trim()} className="px-2 py-2 rounded-lg text-[10px] font-bold disabled:opacity-40" style={{ background: "#D4AF3715", color: "#D4AF37" }} title="إضافة كمهمة">📋+</button>
                          </div>
                          {notes.map(n => (
                            <div key={n.id} className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: "var(--bg)" }}>
                              <span className="flex-1" style={{ color: "var(--text)" }}>{n.content}</span>
                              <span className="text-[8px] flex-shrink-0" style={{ color: "var(--muted)" }}>{new Date(n.createdAt).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>
                              {n.convertedTaskId && <span className="text-[8px] px-1 rounded" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>📋</span>}
                            </div>
                          ))}
                          {notes.length === 0 && <p className="text-center text-[10px] py-2" style={{ color: "var(--muted)" }}>لا توجد ملاحظات</p>}
                        </div>
                      )}

                      {/* Dev requests tab */}
                      {detailTab === "dev" && (
                        <div className="space-y-2">
                          {!showNewDev ? (
                            <button onClick={() => setShowNewDev(true)} className="text-[10px] px-3 py-1.5 rounded-lg font-bold" style={{ background: "#D4AF3715", color: "#D4AF37" }}>+ طلب تطوير</button>
                          ) : (
                            <div className="space-y-2 p-2 rounded-lg" style={{ background: "#D4AF3706" }}>
                              <input value={newDev.title} onChange={e => setNewDev({...newDev, title: e.target.value})} placeholder="عنوان الطلب *" className="w-full px-2 py-1.5 rounded-lg border text-[10px]" style={is} />
                              <textarea value={newDev.desc} onChange={e => setNewDev({...newDev, desc: e.target.value})} placeholder="تفاصيل..." rows={2} className="w-full px-2 py-1.5 rounded-lg border text-[10px] resize-none" style={is} />
                              <div className="flex gap-2">
                                <button onClick={() => addDevReq(role.id)} disabled={!newDev.title.trim()} className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#D4AF37" }}>إضافة</button>
                                <button onClick={() => setShowNewDev(false)} className="text-[10px]" style={{ color: "var(--muted)" }}>إلغاء</button>
                              </div>
                            </div>
                          )}
                          {devReqs.map(d => {
                            const stColor = d.status === "done" ? "#3D8C5A" : d.status === "inReview" ? "#F59E0B" : "#3B82F6";
                            const stLabel = d.status === "done" ? "مكتمل" : d.status === "inReview" ? "قيد المراجعة" : "جديد";
                            return (
                              <div key={d.id} className="px-3 py-2 rounded-lg" style={{ background: "var(--bg)" }}>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium flex-1" style={{ color: "var(--text)" }}>{d.title}</span>
                                  <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${stColor}15`, color: stColor }}>{stLabel}</span>
                                  {d.status !== "done" && (
                                    <button onClick={async () => { try { await api.patch(`/api/war-room/dev-requests/${d.id}/status`, { status: "done" }); loadRoleDetails(role.id); } catch {} }}
                                      className="text-[8px] px-1.5 py-0.5 rounded-lg" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>✓ تم</button>
                                  )}
                                </div>
                                {d.description && <p className="text-[9px] mt-1" style={{ color: "var(--muted)" }}>{d.description}</p>}
                              </div>
                            );
                          })}
                          {devReqs.length === 0 && <p className="text-center text-[10px] py-2" style={{ color: "var(--muted)" }}>لا توجد طلبات</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {roles.length === 0 && <div className="text-center py-12"><p className="text-3xl mb-2">🎖️</p><p className="text-sm" style={{ color: "var(--muted)" }}>أضف مناصبك القيادية لمتابعتها</p></div>}
          </>
        )}
      </div>
    </main>
  );
}
