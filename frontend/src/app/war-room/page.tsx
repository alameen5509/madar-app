"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

type Tab = "roles" | "reviews" | "devreqs";
interface Role { id:string; title:string; organization?:string; sector?:string; description?:string; pulseStatus:string; pulseNote?:string; nextReviewDate?:string; lastReviewDate?:string; reviewFrequency:string; color:string; icon:string; priority:number; notesCount?:number; pendingDevCount?:number; workId?:string; isAuto?:boolean; autoSource?:string; }
interface Note { id:string; roleId?:string; content:string; convertedTaskId?:string; createdAt:string; }
interface DevReq { id:string; roleId?:string; title:string; description?:string; status:string; createdAt:string; }
interface WorkItem { id:string; name:string; type:string; title?:string; employer?:string; sector?:string; role?:string; status?:string; jobs?:{id:string;title:string;status:string;description?:string}[] }

const PULSE: Record<string,{label:string;color:string;bg:string}> = {
  green: { label: "مستقر", color: "#3D8C5A", bg: "#3D8C5A15" },
  yellow: { label: "يحتاج متابعة", color: "#F59E0B", bg: "#F59E0B15" },
  red: { label: "حرج", color: "#DC2626", bg: "#DC262615" },
};
const is = { background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" } as const;

export default function WarRoomPage() {
  const [tab, setTab] = useState<Tab>("roles");
  const [roles, setRoles] = useState<Role[]>([]);
  const [allNotes, setAllNotes] = useState<(Note & {roleTitle?:string;roleIcon?:string})[]>([]);
  const [allDevReqs, setAllDevReqs] = useState<(DevReq & {roleTitle?:string;roleIcon?:string})[]>([]);
  const [loading, setLoading] = useState(true);

  // New role form
  const [showNew, setShowNew] = useState(false);
  const [nr, setNr] = useState({ title: "", org: "", sector: "", desc: "", freq: "weekly", color: "#5E5495", icon: "🎯", workId: "", circleId: "" });

  // Role detail
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [devReqs, setDevReqs] = useState<DevReq[]>([]);
  const [newNote, setNewNote] = useState("");
  const [newDev, setNewDev] = useState({ title: "", desc: "" });
  const [showNewDev, setShowNewDev] = useState(false);
  const [detailTab, setDetailTab] = useState<"notes" | "dev">("notes");

  // Review form
  const [reviewRole, setReviewRole] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState({ status: "green", note: "", accomplishments: "" });

  // Works & Circles for linking
  const [works, setWorks] = useState<WorkItem[]>([]);
  const [circles, setCircles] = useState<{id:string;name:string}[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [r, w, c] = await Promise.all([
        api.get("/api/war-room/roles").then(r => r.data ?? []).catch(() => []),
        api.get("/api/works").then(r => r.data ?? []).catch(() => []),
        api.get("/api/circle-groups").then(r => (r.data ?? []).map((x: {id:string;name:string}) => ({ id: x.id, name: x.name }))).catch(() => []),
      ]);

      const existingRoles = Array.isArray(r) ? r as Role[] : [];
      const allWorks = Array.isArray(w) ? w as WorkItem[] : [];
      const allCircles = Array.isArray(c) ? c as {id:string;name:string}[] : [];

      // تحويل كل الأعمال والوظائف إلى مناصب تلقائية
      const autoRoles: Role[] = [];

      // 1) الأعمال
      for (const work of allWorks) {
        autoRoles.push({
          id: `auto-work-${work.id}`,
          title: work.name || "عمل بدون اسم",
          organization: work.type === "job" ? (work.employer || "") : (work.sector || ""),
          sector: work.sector,
          description: work.type === "job" ? (work.title || "") : (work.role || ""),
          pulseStatus: (work.status === "active" || !work.status) ? "green" : "yellow",
          reviewFrequency: "weekly",
          color: work.type === "job" ? "#2D6B9E" : "#5E5495",
          icon: work.type === "job" ? "💼" : "🏢",
          priority: 0,
          workId: work.id,
          isAuto: true,
          autoSource: "work",
        });
        if (Array.isArray(work.jobs)) {
          for (const job of work.jobs) {
            autoRoles.push({
              id: `auto-job-${job.id}`,
              title: `${job.title || "وظيفة"} — ${work.name}`,
              organization: work.sector || work.name,
              sector: work.sector,
              description: job.description,
              pulseStatus: (job.status === "active" || !job.status) ? "green" : "yellow",
              reviewFrequency: "weekly",
              color: "#D4AF37",
              icon: "👔",
              priority: 1,
              workId: work.id,
              isAuto: true,
              autoSource: "job",
            });
          }
        }
      }

      // 2) أدوار الحياة
      for (const circle of allCircles) {
        autoRoles.push({
          id: `auto-circle-${circle.id}`,
          title: circle.name,
          pulseStatus: "green",
          reviewFrequency: "weekly",
          color: "#8B5CF6",
          icon: "◎",
          priority: 2,
          isAuto: true,
          autoSource: "circle",
        });
      }

      // حذف التلقائية المكررة مع المناصب اليدوية
      const manualIds = new Set(existingRoles.map(role => role.workId).filter(Boolean));
      const uniqueAuto = autoRoles.filter(a => {
        if (a.autoSource === "work" && manualIds.has(a.workId)) return false;
        return true;
      });

      setRoles([...existingRoles, ...uniqueAuto]);
      setWorks(allWorks);
      setCircles(allCircles);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isAutoRole = (id: string) => id.startsWith("auto-") || roles.find(r => r.id === id)?.isAuto === true;

  // تحويل منصب تلقائي إلى حقيقي في قاعدة البيانات
  async function promoteAutoRole(role: Role): Promise<string | null> {
    try {
      const { data } = await api.post("/api/war-room/roles", {
        title: role.title,
        organization: role.organization || undefined,
        sector: role.sector || undefined,
        description: role.description || undefined,
        reviewFrequency: role.reviewFrequency,
        color: role.color,
        icon: role.icon,
        workId: role.workId || undefined,
      });
      await fetchData();
      return data.id;
    } catch { return null; }
  }

  // Load all notes/devreqs across all roles for the tabs
  async function loadAllReviews() {
    const allN: (Note & {roleTitle?:string;roleIcon?:string})[] = [];
    const allD: (DevReq & {roleTitle?:string;roleIcon?:string})[] = [];
    for (const role of roles) {
      if (isAutoRole(role.id)) continue; // تجاوز المناصب التلقائية
      try {
        const [n, d] = await Promise.all([
          api.get(`/api/war-room/roles/${role.id}/notes`).then(r => r.data ?? []),
          api.get(`/api/war-room/roles/${role.id}/dev-requests`).then(r => r.data ?? []),
        ]);
        allN.push(...(n as Note[]).map((x: Note) => ({ ...x, roleTitle: role.title, roleIcon: role.icon })));
        allD.push(...(d as DevReq[]).map((x: DevReq) => ({ ...x, roleTitle: role.title, roleIcon: role.icon })));
      } catch {}
    }
    setAllNotes(allN.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setAllDevReqs(allD.sort((a, b) => { const so: Record<string,number> = { new: 0, inReview: 1, done: 2 }; return (so[a.status] ?? 9) - (so[b.status] ?? 9); }));
  }

  useEffect(() => { if ((tab === "reviews" || tab === "devreqs") && roles.length > 0) loadAllReviews(); }, [tab, roles.length]);

  const [formError, setFormError] = useState("");
  async function createRole() {
    if (!nr.title.trim()) return;
    setFormError("");
    try {
      await api.post("/api/war-room/roles", { title: nr.title, organization: nr.org || undefined, sector: nr.sector || undefined, description: nr.desc || undefined, reviewFrequency: nr.freq, color: nr.color, icon: nr.icon, workId: nr.workId || undefined });
      setNr({ title: "", org: "", sector: "", desc: "", freq: "weekly", color: "#5E5495", icon: "🎯", workId: "", circleId: "" }); setShowNew(false); fetchData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string }; status?: number } })?.response?.data?.error
        ?? `خطأ ${(e as { response?: { status?: number } })?.response?.status ?? "غير معروف"}`;
      setFormError(msg);
      console.error("Create role error:", e);
    }
  }

  async function loadRoleDetails(id: string) {
    if (expandedRole === id) { setExpandedRole(null); return; }

    // إذا كان منصباً تلقائياً، أنشئه في قاعدة البيانات أولاً
    let realId = id;
    if (isAutoRole(id)) {
      const role = roles.find(r => r.id === id);
      if (!role) return;
      const newId = await promoteAutoRole(role);
      if (!newId) return;
      realId = newId;
    }

    setExpandedRole(realId); setDetailTab("notes");
    try {
      const [n, d] = await Promise.all([
        api.get(`/api/war-room/roles/${realId}/notes`).then(r => r.data ?? []),
        api.get(`/api/war-room/roles/${realId}/dev-requests`).then(r => r.data ?? []),
      ]);
      setNotes(n); setDevReqs(d);
    } catch {}
  }

  async function addNote(roleId: string, convertToTask = false) {
    if (!newNote.trim()) return;
    try { await api.post(`/api/war-room/roles/${roleId}/notes`, { content: newNote, convertToTask }); setNewNote(""); loadRoleDetails(roleId); } catch {}
  }

  async function addDevReq(roleId: string) {
    if (!newDev.title.trim()) return;
    try { await api.post(`/api/war-room/roles/${roleId}/dev-requests`, { title: newDev.title, description: newDev.desc || undefined }); setNewDev({ title: "", desc: "" }); setShowNewDev(false); loadRoleDetails(roleId); } catch {}
  }

  async function submitReview(roleId: string) {
    try {
      await api.patch(`/api/war-room/roles/${roleId}/pulse`, { status: reviewForm.status, note: [reviewForm.note, reviewForm.accomplishments ? `الإنجازات: ${reviewForm.accomplishments}` : ""].filter(Boolean).join(" | ") || undefined });
      // Save review note
      if (reviewForm.note || reviewForm.accomplishments) {
        await api.post(`/api/war-room/roles/${roleId}/notes`, { content: `📊 مراجعة: ${PULSE[reviewForm.status]?.label ?? reviewForm.status}${reviewForm.note ? ` — ${reviewForm.note}` : ""}${reviewForm.accomplishments ? ` | الإنجازات: ${reviewForm.accomplishments}` : ""}` });
      }
      setReviewRole(null); setReviewForm({ status: "green", note: "", accomplishments: "" }); fetchData();
    } catch {}
  }

  const redCount = roles.filter(r => r.pulseStatus === "red").length;
  const yellowCount = roles.filter(r => r.pulseStatus === "yellow").length;
  const dueReviewCount = roles.filter(r => r.nextReviewDate && new Date(r.nextReviewDate) <= new Date()).length;

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur border-b px-4 sm:px-6 py-3 pr-14 md:pr-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>🎖️ غرفة القيادة</h2>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs" style={{ color: "var(--muted)" }}>{roles.length} منصب</span>
          {dueReviewCount > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full animate-pulse" style={{ background: "#F59E0B15", color: "#F59E0B" }}>📋 {dueReviewCount} مراجعة مستحقة</span>}
          {redCount > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#DC262615", color: "#DC2626" }}>🔴 {redCount} حرج</span>}
          {yellowCount > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#F59E0B15", color: "#F59E0B" }}>🟡 {yellowCount}</span>}
        </div>
        <div className="flex gap-1.5 mt-2">
          {([["roles","المناصب","🎖️"],["reviews","المراجعات","📋"],["devreqs","طلبات التطوير","🔧"]] as [Tab,string,string][]).map(([k,l,ic]) => (
            <button key={k} onClick={() => setTab(k)} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition whitespace-nowrap"
              style={{ background: tab === k ? "#5E5495" : "var(--bg)", color: tab === k ? "#fff" : "var(--muted)", border: `1px solid ${tab === k ? "#5E5495" : "var(--card-border)"}` }}>
              {ic} {l}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 space-y-4 max-w-3xl mx-auto">
        {loading && <p className="text-center py-8 animate-pulse text-sm" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}

        {/* ═══ ROLES TAB ═══ */}
        {!loading && tab === "roles" && (<>
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
              {/* ربط بعمل أو دور */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[9px] font-bold mb-0.5 block" style={{ color: "var(--muted)" }}>💼 ربط بعمل</label>
                  <select value={nr.workId} onChange={e => setNr({...nr, workId: e.target.value})} className="w-full px-2 py-1.5 rounded-lg border text-xs" style={is}>
                    <option value="">بدون ربط</option>
                    {works.map(w => <option key={w.id} value={w.id}>{w.type === "job" ? "💼" : "🏢"} {w.name}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[9px] font-bold mb-0.5 block" style={{ color: "var(--muted)" }}>◎ ربط بدور</label>
                  <select value={nr.circleId} onChange={e => setNr({...nr, circleId: e.target.value})} className="w-full px-2 py-1.5 rounded-lg border text-xs" style={is}>
                    <option value="">بدون ربط</option>
                    {circles.map(c => <option key={c.id} value={c.id}>◎ {c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <select value={nr.freq} onChange={e => setNr({...nr, freq: e.target.value})} className="flex-1 px-2 py-1.5 rounded-lg border text-xs" style={is}><option value="daily">يومية</option><option value="weekly">أسبوعية</option><option value="monthly">شهرية</option></select>
                <input value={nr.icon} onChange={e => setNr({...nr, icon: e.target.value})} className="w-12 px-2 py-1.5 rounded-lg border text-center text-sm" style={is} />
                <input type="color" value={nr.color} onChange={e => setNr({...nr, color: e.target.value})} className="w-10 h-9 rounded-lg border cursor-pointer" />
              </div>
              {formError && <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "#DC262610", color: "#DC2626" }}>{formError}</p>}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowNew(false)} className="px-3 py-1.5 rounded-lg text-[10px]" style={{ color: "var(--muted)" }}>إلغاء</button>
                <button onClick={createRole} disabled={!nr.title.trim()} className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#5E5495" }}>إضافة</button>
              </div>
            </div>
          )}

          {roles.map(role => {
            const pulse = PULSE[role.pulseStatus] ?? PULSE.green;
            const isExp = expandedRole === role.id;
            const dueReview = role.nextReviewDate && new Date(role.nextReviewDate) <= new Date();
            const isReviewing = reviewRole === role.id;

            return (
              <div key={role.id} className="rounded-2xl border overflow-hidden" style={{ background: "var(--card)", borderColor: `${role.color}40` }}>
                <div className="px-4 py-3 cursor-pointer" onClick={() => loadRoleDetails(role.id)} style={{ borderRight: `4px solid ${role.color}` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{role.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm truncate" style={{ color: "var(--text)" }}>{role.title}</p>
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: pulse.bg, color: pulse.color }}>{pulse.label}</span>
                        {(role.isAuto || isAutoRole(role.id)) && <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: `${role.color}12`, color: role.color }}>{role.autoSource === "job" ? "👔 وظيفة" : role.autoSource === "circle" ? "◎ دور حياة" : "💼 من الأعمال"}</span>}
                        {dueReview && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold animate-pulse" style={{ background: "#F59E0B15", color: "#F59E0B" }}>مراجعة مستحقة</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {role.organization && <span className="text-[9px]" style={{ color: "var(--muted)" }}>{role.organization}</span>}
                        {(() => { const w = works.find(x => x.id === role.workId); return w ? <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: "#2D6B9E15", color: "#2D6B9E" }}>{w.type === "job" ? "💼" : "🏢"} {w.name}</span> : null; })()}
                        {(role.notesCount ?? 0) > 0 && <span className="text-[9px]" style={{ color: "#5E5495" }}>📝 {role.notesCount}</span>}
                        {(role.pendingDevCount ?? 0) > 0 && <span className="text-[9px]" style={{ color: "#D4AF37" }}>🔧 {role.pendingDevCount}</span>}
                        {role.lastReviewDate && <span className="text-[9px]" style={{ color: "var(--muted)" }}>مراجعة: {new Date(role.lastReviewDate).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={async () => {
                        if (isReviewing) { setReviewRole(null); return; }
                        let rid = role.id;
                        if (isAutoRole(rid)) { const newId = await promoteAutoRole(role); if (!newId) return; rid = newId; }
                        setReviewRole(rid); setReviewForm({ status: role.pulseStatus, note: "", accomplishments: "" });
                      }}
                        className="text-[9px] px-2.5 py-1.5 rounded-lg font-bold transition" style={{ background: dueReview ? "#F59E0B" : "#5E549515", color: dueReview ? "#fff" : "#5E5495" }}>
                        📋 مراجعة
                      </button>
                      {!isAutoRole(role.id) && <button onClick={async () => { if (confirm("حذف؟")) { try { await api.delete(`/api/war-room/roles/${role.id}`); fetchData(); } catch {} } }}
                        className="text-[9px] px-1.5 py-1 rounded-lg" style={{ color: "#DC2626" }}>🗑️</button>}
                    </div>
                  </div>

                  {/* Review form — inline */}
                  {isReviewing && (
                    <div className="mt-3 p-3 rounded-xl space-y-2" style={{ background: "var(--bg)", border: "1px solid #5E549520" }} onClick={e => e.stopPropagation()}>
                      <p className="text-[10px] font-bold" style={{ color: "#5E5495" }}>📋 مراجعة {role.title}</p>
                      <div className="flex gap-1.5">
                        {(["green","yellow","red"] as const).map(s => (
                          <button key={s} onClick={() => setReviewForm({...reviewForm, status: s})}
                            className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition"
                            style={{ background: reviewForm.status === s ? PULSE[s].color : "var(--card)", color: reviewForm.status === s ? "#fff" : PULSE[s].color, border: `1px solid ${PULSE[s].color}40` }}>
                            {PULSE[s].label}
                          </button>
                        ))}
                      </div>
                      <input value={reviewForm.accomplishments} onChange={e => setReviewForm({...reviewForm, accomplishments: e.target.value})}
                        placeholder="ما تم إنجازه منذ آخر مراجعة؟" className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none" style={is} />
                      <input value={reviewForm.note} onChange={e => setReviewForm({...reviewForm, note: e.target.value})}
                        placeholder="ملاحظات أو تحديات..." className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none" style={is} />
                      <div className="flex gap-2">
                        <button onClick={() => submitReview(role.id)} className="flex-1 py-2 rounded-lg text-[10px] font-bold text-white" style={{ background: PULSE[reviewForm.status].color }}>حفظ المراجعة</button>
                        <button onClick={() => setReviewRole(null)} className="px-3 py-2 rounded-lg text-[10px]" style={{ color: "var(--muted)" }}>إلغاء</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Expanded: notes + dev requests */}
                {isExp && !isReviewing && (
                  <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: "var(--card-border)" }}>
                    {role.pulseNote && <p className="text-[10px] p-2 rounded-lg" style={{ background: pulse.bg, color: pulse.color }}>💬 {role.pulseNote}</p>}
                    <div className="flex gap-1.5">
                      <button onClick={() => setDetailTab("notes")} className="px-3 py-1 rounded-lg text-[10px] font-semibold" style={{ background: detailTab === "notes" ? "#5E5495" : "var(--bg)", color: detailTab === "notes" ? "#fff" : "var(--muted)" }}>📝 ملاحظات</button>
                      <button onClick={() => setDetailTab("dev")} className="px-3 py-1 rounded-lg text-[10px] font-semibold" style={{ background: detailTab === "dev" ? "#D4AF37" : "var(--bg)", color: detailTab === "dev" ? "#fff" : "var(--muted)" }}>🔧 تطوير</button>
                    </div>

                    {detailTab === "notes" && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addNote(role.id); }}
                            placeholder="ملاحظة..." className="flex-1 px-3 py-2 rounded-lg border text-xs focus:outline-none" style={is} />
                          <button onClick={() => addNote(role.id)} disabled={!newNote.trim()} className="px-3 py-2 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#5E5495" }}>+</button>
                          <button onClick={() => addNote(role.id, true)} disabled={!newNote.trim()} className="px-2 py-2 rounded-lg text-[10px] font-bold disabled:opacity-40" style={{ background: "#D4AF3715", color: "#D4AF37" }} title="كمهمة">📋</button>
                        </div>
                        {notes.map(n => (
                          <div key={n.id} className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs group" style={{ background: "var(--bg)" }}>
                            <span className="flex-1" style={{ color: "var(--text)" }}>{n.content}</span>
                            <span className="text-[8px] flex-shrink-0" style={{ color: "var(--muted)" }}>{new Date(n.createdAt).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>
                            {n.convertedTaskId && <span className="text-[8px] px-1 rounded" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>📋</span>}
                            <button onClick={async () => { try { await api.delete(`/api/war-room/notes/${n.id}`); loadRoleDetails(role.id); } catch {} }}
                              className="text-[8px] opacity-0 group-hover:opacity-100 transition" style={{ color: "#DC2626" }}>✕</button>
                          </div>
                        ))}
                        {notes.length === 0 && <p className="text-center text-[10px] py-2" style={{ color: "var(--muted)" }}>لا توجد ملاحظات</p>}
                      </div>
                    )}

                    {detailTab === "dev" && (
                      <div className="space-y-2">
                        {!showNewDev ? (
                          <button onClick={() => setShowNewDev(true)} className="text-[10px] px-3 py-1.5 rounded-lg font-bold" style={{ background: "#D4AF3715", color: "#D4AF37" }}>+ طلب تطوير</button>
                        ) : (
                          <div className="space-y-2 p-2 rounded-lg" style={{ background: "#D4AF3706" }}>
                            <input value={newDev.title} onChange={e => setNewDev({...newDev, title: e.target.value})} placeholder="عنوان *" className="w-full px-2 py-1.5 rounded-lg border text-[10px]" style={is} />
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
                                    className="text-[8px] px-1.5 py-0.5 rounded-lg" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>✓</button>
                                )}
                                <button onClick={async () => { if (confirm("حذف؟")) { try { await api.delete(`/api/war-room/dev-requests/${d.id}`); loadRoleDetails(role.id); } catch {} } }}
                                  className="text-[8px] px-1 rounded" style={{ color: "#DC2626" }}>🗑️</button>
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
          {roles.length === 0 && <div className="text-center py-12"><p className="text-3xl mb-2">🎖️</p><p className="text-sm" style={{ color: "var(--muted)" }}>أضف مناصبك القيادية أو أضف أعمالاً من صفحة الأعمال</p><p className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>أعمال محمّلة: {works.length}</p></div>}
        </>)}

        {/* ═══ REVIEWS TAB — كل المراجعات ═══ */}
        {!loading && tab === "reviews" && (<>
          <span className="text-xs font-bold" style={{ color: "var(--text)" }}>📋 سجل المراجعات والملاحظات</span>
          <p className="text-[10px]" style={{ color: "var(--muted)" }}>جميع الملاحظات من كل المناصب — مرتبة بالأحدث</p>
          {allNotes.length === 0 && <p className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>لا توجد ملاحظات بعد</p>}
          <div className="space-y-2">
            {allNotes.map(n => (
              <div key={n.id} className="rounded-xl border px-3 py-2.5" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{n.roleIcon}</span>
                  <span className="text-[10px] font-bold" style={{ color: "#5E5495" }}>{n.roleTitle}</span>
                  <span className="text-[8px]" style={{ color: "var(--muted)" }}>{new Date(n.createdAt).toLocaleDateString("ar-SA", { weekday: "short", month: "short", day: "numeric" })}</span>
                  {n.convertedTaskId && <span className="text-[8px] px-1 rounded" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>📋 مهمة</span>}
                </div>
                <p className="text-xs" style={{ color: "var(--text)" }}>{n.content}</p>
              </div>
            ))}
          </div>
        </>)}

        {/* ═══ DEV REQUESTS TAB — كل طلبات التطوير ═══ */}
        {!loading && tab === "devreqs" && (<>
          <span className="text-xs font-bold" style={{ color: "var(--text)" }}>🔧 طلبات التطوير من كل المناصب</span>
          {allDevReqs.length === 0 && <p className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>لا توجد طلبات تطوير</p>}
          <div className="space-y-2">
            {allDevReqs.map(d => {
              const stColor = d.status === "done" ? "#3D8C5A" : d.status === "inReview" ? "#F59E0B" : "#3B82F6";
              const stLabel = d.status === "done" ? "مكتمل" : d.status === "inReview" ? "قيد المراجعة" : "جديد";
              return (
                <div key={d.id} className="rounded-xl border px-3 py-2.5" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{d.roleIcon}</span>
                    <span className="text-[10px] font-bold" style={{ color: "#D4AF37" }}>{d.roleTitle}</span>
                    <span className="text-xs font-medium flex-1" style={{ color: "var(--text)" }}>{d.title}</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${stColor}15`, color: stColor }}>{stLabel}</span>
                    {d.status !== "done" && (
                      <button onClick={async () => { try { await api.patch(`/api/war-room/dev-requests/${d.id}/status`, { status: "done" }); loadAllReviews(); } catch {} }}
                        className="text-[8px] px-1.5 py-0.5 rounded-lg" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>✓ تم</button>
                    )}
                  </div>
                  {d.description && <p className="text-[9px] mt-1" style={{ color: "var(--muted)" }}>{d.description}</p>}
                  <span className="text-[8px]" style={{ color: "var(--muted)" }}>{new Date(d.createdAt).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>
                </div>
              );
            })}
          </div>
        </>)}
      </div>
    </main>
  );
}
