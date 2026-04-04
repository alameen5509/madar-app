"use client";
import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Phase = 1|2|3|4|5|6|7;
interface Project { id:string; title:string; clientName?:string; description?:string; currentPhase:number; status:string; priority?:string; dueDate?:string; completedPhases?: number[] }
interface Member { id:string; name:string; email?:string; role:string }
const PHASES: {n:Phase;label:string;icon:string}[] = [{n:1,label:"بناء الفكرة",icon:"📝"},{n:2,label:"الوثيقة العامة",icon:"📁"},{n:3,label:"المستخدمين",icon:"👤"},{n:4,label:"التأسيس",icon:"⚡"},{n:5,label:"الاستضافة",icon:"🔐"},{n:6,label:"التطوير",icon:"🚀"},{n:7,label:"العميل",icon:"💬"}];
const is = { background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" } as const;

export default function WebProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<Project|null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [phase, setPhase] = useState<Phase>(1);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [completedPhases, setCompletedPhases] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("wp_completed_" + id) ?? "[]")); } catch { return new Set(); }
  });

  function togglePhaseComplete(n: number) {
    setCompletedPhases(prev => {
      const s = new Set(prev);
      s.has(n) ? s.delete(n) : s.add(n);
      localStorage.setItem("wp_completed_" + id, JSON.stringify([...s]));
      return s;
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/web-projects/" + id);
      setProject(data.project); setMembers(data.members ?? []);
      setPhase(data.project?.currentPhase ?? 1);
    } catch {
      // Fallback: load from localStorage
      try {
        const all = JSON.parse(localStorage.getItem("madar_web_projects") ?? "[]");
        const p = all.find((x: Project) => x.id === id);
        if (p) { setProject(p); setPhase(p.currentPhase ?? 1); }
      } catch {}
    }
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // Auto-sync to cloud every 15 seconds via DevContext
  useEffect(() => {
    const LS_KEYS = ["wp_completed_","wp_p1doc_","wp_p1tasks_","wp_p3_","wp_p4_","wp_p5_","wp_p6_","wp_p7_"];
    const sync = () => {
      try {
        const allProjects = JSON.parse(localStorage.getItem("madar_web_projects") ?? "[]");
        if (allProjects.length === 0) return;
        const bundle: { projects: typeof allProjects; phases: Record<string, Record<string, string>> } = { projects: allProjects, phases: {} };
        for (const proj of allProjects) {
          bundle.phases[proj.id] = {};
          for (const k of LS_KEYS) { const v = localStorage.getItem(k + proj.id); if (v) bundle.phases[proj.id][k] = v; }
        }
        api.put("/api/dev-tickets/context", { content: "WP_DATA:" + JSON.stringify(bundle) }).catch(() => {});
      } catch {}
    };
    sync(); // Sync immediately on mount
    const timer = setInterval(sync, 15000);
    return () => clearInterval(timer);
  }, []);

  if (loading || !project) return <main className="flex-1 flex items-center justify-center" style={{ background: "var(--bg)" }}><p className="animate-pulse" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p></main>;

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 backdrop-blur border-b px-4 sm:px-6 py-3 pr-14 md:pr-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="flex items-center gap-1 text-[10px] mb-1"><Link href="/web-projects" className="hover:underline" style={{ color: "var(--muted)" }}>المواقع</Link><span style={{ color: "var(--muted)" }}>←</span><span className="font-semibold" style={{ color: "#2D6B9E" }}>{project.title}</span></div>
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>🌐 {project.title}</h2>
          {project.clientName && <span className="text-xs" style={{ color: "var(--muted)" }}>👤 {project.clientName}</span>}
          <button onClick={() => setShowEdit(!showEdit)} className="text-xs px-2.5 py-1.5 rounded-lg min-h-[36px]" style={{ color: "#5E5495", background: "#5E549510" }}>✏️</button>
          <button onClick={() => setShowMembers(!showMembers)} className="text-xs px-2.5 py-1.5 rounded-lg min-h-[36px]" style={{ color: "#2D6B9E", background: "#2D6B9E10" }}>👥 {members.length}</button>
        </div>
        {/* Phase tabs */}
        <div className="flex gap-1 mt-2 overflow-x-auto pb-0.5">
          {PHASES.map(p => (
            <button key={p.n} onClick={() => { setPhase(p.n); api.put("/api/web-projects/" + id, { currentPhase: p.n }).catch(() => {}); }}
              className="px-3 py-2 rounded-xl text-[10px] font-bold transition whitespace-nowrap min-h-[38px] flex items-center gap-1"
              style={{ background: phase === p.n ? "#2D6B9E" : completedPhases.has(p.n) ? "#3D8C5A" : "var(--bg)", color: phase === p.n ? "#fff" : completedPhases.has(p.n) ? "#fff" : "var(--muted)", border: `1px solid ${phase === p.n ? "#2D6B9E" : completedPhases.has(p.n) ? "#3D8C5A" : "var(--card-border)"}` }}>
              {completedPhases.has(p.n) ? "✓" : p.icon} {p.n}. {p.label}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 space-y-4 max-w-3xl mx-auto">
        {/* Edit project panel */}
        {showEdit && (<EditProjectPanel project={project} onSave={(updated) => {
          setProject(updated); setShowEdit(false);
          // Update in localStorage
          try {
            const all = JSON.parse(localStorage.getItem("madar_web_projects") ?? "[]");
            const idx = all.findIndex((x: Project) => x.id === id);
            if (idx >= 0) { all[idx] = { ...all[idx], ...updated }; localStorage.setItem("madar_web_projects", JSON.stringify(all)); }
          } catch {}
          api.put("/api/web-projects/" + id, updated).catch(() => {});
        }} onClose={() => setShowEdit(false)} />)}

        {/* Members panel */}
        {showMembers && <MembersPanel projectId={id} members={members} onUpdate={load} />}

        {phase === 1 && <Phase1 projectId={id} />}
        {phase === 2 && <Phase2 />}
        {phase === 3 && <Phase7 projectId={id} />}
        {phase === 4 && <Phase3 projectId={id} />}
        {phase === 5 && <Phase4 projectId={id} />}
        {phase === 6 && <Phase5 projectId={id} />}
        {phase === 7 && <Phase6 projectId={id} />}

        {/* Complete phase button */}
        {(() => {
          // Block completion of phase 3 (users) if no accounts
          const blocked = phase === 3 && (() => { try { return JSON.parse(localStorage.getItem("wp_p7_" + id) ?? "[]").length === 0; } catch { return true; } })();
          return (
            <div className="mt-6 flex flex-col sm:flex-row gap-2">
              {completedPhases.has(phase) ? (
                <button onClick={() => togglePhaseComplete(phase)} className="w-full py-3 min-h-[44px] rounded-xl text-sm font-bold transition" style={{ background: "#3D8C5A15", color: "#3D8C5A", border: "1px solid #3D8C5A30" }}>
                  ✅ مرحلة مكتملة — اضغط لإلغاء الإكمال
                </button>
              ) : blocked ? (
                <button disabled className="w-full py-3 min-h-[44px] rounded-xl text-sm font-bold opacity-40" style={{ background: "#6B7280", color: "#fff" }}>
                  ⚠️ أضف مستخدم أولاً لإكمال المرحلة
                </button>
              ) : (
                <button onClick={() => togglePhaseComplete(phase)} className="w-full py-3 min-h-[44px] rounded-xl text-sm font-bold text-white transition" style={{ background: "linear-gradient(135deg, #3D8C5A, #2D6B9E)" }}>
                  ✅ إكمال هذه المرحلة
                </button>
              )}
            </div>
          );
        })()}
      </div>
    </main>
  );
}

// ═══ Members Panel ═══
function MembersPanel({ projectId, members, onUpdate }: { projectId: string; members: Member[]; onUpdate: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [nm, setNm] = useState({ name: "", email: "", role: "employee" });

  async function add() {
    if (!nm.name.trim()) return;
    try {
      await api.post("/api/web-projects/" + projectId + "/members", { name: nm.name.trim(), email: nm.email.trim() || undefined, role: nm.role });
      setNm({ name: "", email: "", role: "employee" }); setShowAdd(false); onUpdate();
    } catch { alert("فشل الإضافة"); }
  }

  async function remove(mid: string) {
    if (!confirm("إزالة العضو؟")) return;
    try { await api.delete("/api/web-projects/" + projectId + "/members/" + mid); onUpdate(); } catch {}
  }

  const ROLES: Record<string, { label: string; color: string }> = { owner: { label: "مالك", color: "#D4AF37" }, employee: { label: "موظف", color: "#2D6B9E" } };

  return (
    <div className="rounded-2xl border p-5 space-y-3" style={{ background: "var(--card)", borderColor: "#2D6B9E30" }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold" style={{ color: "#2D6B9E" }}>👥 فريق العمل ({members.length})</p>
        <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 min-h-[40px] rounded-xl text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>+ عضو</button>
      </div>

      {showAdd && (
        <div className="space-y-3 p-3 rounded-xl" style={{ background: "var(--bg)", border: "1px solid var(--card-border)" }}>
          <input value={nm.name} onChange={e => setNm({...nm, name: e.target.value})} placeholder="اسم العضو *" className="w-full px-3 py-3 rounded-xl border text-sm focus:outline-none" style={is} />
          <input value={nm.email} onChange={e => setNm({...nm, email: e.target.value})} placeholder="الإيميل (اختياري)" type="email" className="w-full px-3 py-3 rounded-xl border text-sm focus:outline-none font-mono" dir="ltr" style={is} />
          <div>
            <p className="text-[10px] font-bold mb-1" style={{ color: "var(--muted)" }}>الصلاحية:</p>
            <div className="flex gap-2">
              {Object.entries(ROLES).map(([k, v]) => (
                <button key={k} onClick={() => setNm({...nm, role: k})} className="flex-1 py-2.5 rounded-xl text-xs font-bold min-h-[40px] transition"
                  style={{ background: nm.role === k ? v.color : "var(--card)", color: nm.role === k ? "#fff" : v.color, border: "1px solid " + (nm.role === k ? v.color : "var(--card-border)") }}>
                  {k === "owner" ? "👑" : "👤"} {v.label}
                </button>
              ))}
            </div>
            <p className="text-[9px] mt-1" style={{ color: "var(--muted)" }}>
              المالك: يرى كل شيء ويدير الأوامر · الموظف: يرى الأمر الحالي فقط وينفذه
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={add} disabled={!nm.name.trim()} className="flex-1 py-3 min-h-[44px] rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#2D6B9E" }}>إضافة</button>
            <button onClick={() => setShowAdd(false)} className="py-3 px-4 rounded-xl text-sm" style={{ color: "var(--muted)" }}>إلغاء</button>
          </div>
        </div>
      )}

      {members.length === 0 && !showAdd && (
        <p className="text-center text-xs py-4" style={{ color: "var(--muted)" }}>لا يوجد أعضاء — أضف موظفاً للعمل معك</p>
      )}

      {members.map(m => {
        const r = ROLES[m.role] ?? ROLES.employee;
        return (
          <div key={m.id} className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor: "var(--card-border)" }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0" style={{ background: r.color + "15" }}>
              {m.role === "owner" ? "👑" : "👤"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{m.name}</p>
              <div className="flex items-center gap-2">
                {m.email && <span className="text-[10px] font-mono" dir="ltr" style={{ color: "var(--muted)" }}>{m.email}</span>}
                <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: r.color + "15", color: r.color }}>{r.label}</span>
              </div>
            </div>
            <button onClick={() => remove(m.id)} className="text-sm px-2 py-1.5 rounded-lg hover:bg-red-50 min-h-[36px]" style={{ color: "#DC2626" }}>🗑️</button>
          </div>
        );
      })}
    </div>
  );
}

// ═══ Edit Project Panel ═══
const EDIT_PRIORITIES: Record<string,{label:string;color:string;icon:string}> = { urgent:{label:"عاجل",color:"#DC2626",icon:"🔴"}, high:{label:"مرتفع",color:"#F59E0B",icon:"🟡"}, medium:{label:"متوسط",color:"#3B82F6",icon:"🔵"}, low:{label:"منخفض",color:"#6B7280",icon:"⚪"} };

function EditProjectPanel({ project, onSave, onClose }: { project: Project; onSave: (p: Project) => void; onClose: () => void }) {
  const [title, setTitle] = useState(project.title);
  const [client, setClient] = useState(project.clientName ?? "");
  const [desc, setDesc] = useState(project.description ?? "");
  const [priority, setPriority] = useState(project.priority ?? "medium");
  const [dueDate, setDueDate] = useState(project.dueDate ?? "");
  const [status, setStatus] = useState(project.status);

  return (
    <div className="rounded-2xl border p-5 space-y-3" style={{ background: "var(--card)", borderColor: "#5E549530" }}>
      <p className="text-xs font-bold" style={{ color: "#5E5495" }}>✏️ تعديل بيانات الموقع</p>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="اسم الموقع" className="w-full px-3 py-3 rounded-xl border text-sm font-bold focus:outline-none" style={is} />
      <input value={client} onChange={e => setClient(e.target.value)} placeholder="اسم العميل" className="w-full px-3 py-3 rounded-xl border text-sm focus:outline-none" style={is} />
      <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="الوصف" rows={2} className="w-full px-3 py-2 rounded-xl border text-sm resize-none focus:outline-none" style={is} />
      <div>
        <label className="text-[10px] font-bold block mb-1" style={{ color: "var(--text)" }}>الأولوية</label>
        <div className="flex gap-1.5">
          {Object.entries(EDIT_PRIORITIES).map(([k, v]) => (
            <button key={k} type="button" onClick={() => setPriority(k)} className="flex-1 py-2.5 rounded-xl text-xs font-bold transition min-h-[40px]"
              style={{ background: priority === k ? v.color : "var(--bg)", color: priority === k ? "#fff" : v.color, border: `1px solid ${priority === k ? v.color : "var(--card-border)"}` }}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[10px] font-bold block mb-1" style={{ color: "var(--text)" }}>تاريخ التسليم</label>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-3 py-3 rounded-xl border text-sm focus:outline-none" style={is} />
      </div>
      <div>
        <label className="text-[10px] font-bold block mb-1" style={{ color: "var(--text)" }}>الحالة</label>
        <div className="flex gap-1.5">
          {(["active","onHold","completed"] as const).map(s => {
            const sm: Record<string,{l:string;c:string}> = { active:{l:"نشط",c:"#3D8C5A"}, onHold:{l:"معلّق",c:"#F59E0B"}, completed:{l:"مكتمل",c:"#5E5495"} };
            const v = sm[s]!;
            return <button key={s} onClick={() => setStatus(s)} className="flex-1 py-2.5 rounded-xl text-xs font-bold min-h-[40px]" style={{ background: status === s ? v.c : "var(--bg)", color: status === s ? "#fff" : v.c, border: `1px solid ${status === s ? v.c : "var(--card-border)"}` }}>{v.l}</button>;
          })}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave({ ...project, title: title.trim(), clientName: client.trim() || undefined, description: desc.trim() || undefined, priority, dueDate: dueDate || undefined, status })}
          disabled={!title.trim()} className="flex-1 py-3 min-h-[44px] rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#5E5495" }}>حفظ</button>
        <button onClick={onClose} className="py-3 px-6 min-h-[44px] rounded-xl text-sm" style={{ color: "var(--muted)" }}>إلغاء</button>
      </div>
    </div>
  );
}

// ═══ PHASE 1: Ideas ═══
function Phase1({ projectId }: { projectId: string }) {
  const lsDocKey = "wp_p1doc_" + projectId;
  const lsTasksKey = "wp_p1tasks_" + projectId;
  const [doc, setDoc] = useState(() => { try { return localStorage.getItem(lsDocKey) ?? ""; } catch { return ""; } });
  const [tasks, setTasks] = useState<{id:string;title:string;assignedTo?:string;status:string}[]>(() => { try { return JSON.parse(localStorage.getItem(lsTasksKey) ?? "[]"); } catch { return []; } });
  const [newTask, setNewTask] = useState(""); const [saving, setSaving] = useState(false);
  useEffect(() => { api.get("/api/web-projects/" + projectId + "/phase1/document").then(r => { if (r.data?.content) setDoc(r.data.content); }).catch(() => {}); api.get("/api/web-projects/" + projectId + "/phase1/tasks").then(r => { if (r.data?.length) { setTasks(r.data); localStorage.setItem(lsTasksKey, JSON.stringify(r.data)); } }).catch(() => {}); }, [projectId]);
  function saveTasks(t: {id:string;title:string;assignedTo?:string;status:string}[]) { setTasks(t); localStorage.setItem(lsTasksKey, JSON.stringify(t)); }
  async function saveDoc() { setSaving(true); localStorage.setItem(lsDocKey, doc); await api.put("/api/web-projects/" + projectId + "/phase1/document", { content: doc }).catch(() => {}); setSaving(false); }
  async function addTask() { if (!newTask.trim()) return; const nt = { id: "t_" + Date.now(), title: newTask.trim(), status: "pending" }; saveTasks([...tasks, nt]); setNewTask(""); api.post("/api/web-projects/" + projectId + "/phase1/tasks", { title: newTask }).catch(() => {}); }
  async function toggleTask(tid: string, cur: string) { saveTasks(tasks.map(t => t.id === tid ? { ...t, status: cur === "done" ? "pending" : "done" } : t)); api.patch("/api/web-projects/" + projectId + "/phase1/tasks/" + tid, { status: cur === "done" ? "pending" : "done" }).catch(() => {}); }
  async function delTask(tid: string) { saveTasks(tasks.filter(t => t.id !== tid)); api.delete("/api/web-projects/" + projectId + "/phase1/tasks/" + tid).catch(() => {}); }

  return (<div className="space-y-4">
    <div className="rounded-2xl border p-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
      <p className="text-xs font-bold mb-2" style={{ color: "var(--text)" }}>📝 وثيقة الأفكار</p>
      <textarea value={doc} onChange={e => setDoc(e.target.value)} rows={8} placeholder="اكتب أفكارك هنا..." className="w-full px-4 py-3 rounded-xl border text-sm resize-none focus:outline-none leading-relaxed" style={is} />
      <button onClick={saveDoc} disabled={saving} className="mt-2 px-6 py-2.5 min-h-[44px] rounded-xl text-sm font-bold text-white" style={{ background: "#2D6B9E" }}>{saving ? "جارٍ الحفظ..." : "حفظ"}</button>
    </div>
    <div className="rounded-2xl border p-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
      <p className="text-xs font-bold mb-2" style={{ color: "var(--text)" }}>✅ المهام</p>
      <div className="flex gap-2 mb-3">
        <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addTask(); }} placeholder="مهمة جديدة..." className="flex-1 px-3 py-3 min-h-[44px] rounded-xl border text-sm focus:outline-none" style={is} />
        <button onClick={addTask} disabled={!newTask.trim()} className="px-5 py-3 min-h-[44px] rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#2D6B9E" }}>+</button>
      </div>
      {tasks.map(t => (
        <div key={t.id} className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor: "var(--card-border)" }}>
          <button onClick={() => toggleTask(t.id, t.status)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${t.status === "done" ? "bg-[#3D8C5A] border-[#3D8C5A]" : "border-[#C9A84C]"}`}>{t.status === "done" && <span className="text-white text-[9px]">✓</span>}</button>
          <span className={`flex-1 text-sm ${t.status === "done" ? "line-through opacity-50" : ""}`} style={{ color: "var(--text)" }}>{t.title}</span>
          <button onClick={() => delTask(t.id)} className="text-sm px-2 py-1 rounded-lg hover:bg-red-50" style={{ color: "#DC2626" }}>✕</button>
        </div>
      ))}
    </div>
  </div>);
}

// ═══ PHASE 2: Documents ═══
function Phase2() {
  return (<div className="text-center py-12"><p className="text-3xl mb-3">📁</p><p className="font-bold" style={{ color: "var(--text)" }}>الوثيقة العامة</p><p className="text-xs mt-1" style={{ color: "var(--muted)" }}>قريباً — رفع ملفات PDF والعروض</p></div>);
}

// ═══ PHASE 3: Setup Commands ═══
function Phase3({ projectId }: { projectId: string }) {
  const lk = "wp_p3_" + projectId;
  const [cmds, setCmds] = useState<{id:string;title:string;command?:string;status:string;order:number}[]>(() => { try { return JSON.parse(localStorage.getItem(lk) ?? "[]"); } catch { return []; } });
  function save(c: typeof cmds) { setCmds(c); localStorage.setItem(lk, JSON.stringify(c)); }
  const [showNew, setShowNew] = useState(false); const [nc, setNc] = useState({ title: "", cmd: "" });
  useEffect(() => { api.get("/api/web-projects/" + projectId + "/phase3/commands").then(r => { if (r.data?.length) save(r.data); }).catch(() => {}); }, [projectId]);
  async function add() { if (!nc.title.trim()) return; const nc2 = { id: "c3_" + Date.now(), title: nc.title, command: nc.cmd || undefined, status: "pending", order: cmds.length + 1 }; save([...cmds, nc2]); setNc({ title: "", cmd: "" }); setShowNew(false); api.post("/api/web-projects/" + projectId + "/phase3/commands", { title: nc.title, command: nc.cmd || undefined }).catch(() => {}); }
  async function markDone(cid: string) { save(cmds.map(c => c.id === cid ? { ...c, status: "done" } : c)); api.patch("/api/web-projects/" + projectId + "/phase3/commands/" + cid + "/done").catch(() => {}); }
  const nextCmd = cmds.find(c => c.status === "pending");
  const [copied, setCopied] = useState<string|null>(null);

  return (<div className="space-y-4">
    <div className="flex items-center justify-between"><span className="text-xs font-bold" style={{ color: "var(--text)" }}>⚡ أوامر التأسيس ({cmds.length})</span><button onClick={() => setShowNew(true)} className="px-4 py-2.5 min-h-[40px] rounded-xl text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>+ أمر</button></div>
    {showNew && (<div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
      <input value={nc.title} onChange={e => setNc({...nc, title: e.target.value})} placeholder="عنوان الأمر *" className="w-full px-3 py-3 rounded-xl border text-sm focus:outline-none" style={is} />
      <textarea value={nc.cmd} onChange={e => setNc({...nc, cmd: e.target.value})} placeholder="الأمر الكامل..." rows={4} className="w-full px-3 py-2 rounded-xl border text-xs resize-none focus:outline-none font-mono" dir="ltr" style={is} />
      <div className="flex gap-2"><button onClick={add} disabled={!nc.title.trim()} className="flex-1 py-3 min-h-[44px] rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#2D6B9E" }}>إضافة</button><button onClick={() => setShowNew(false)} className="py-3 px-4 rounded-xl text-sm" style={{ color: "var(--muted)" }}>إلغاء</button></div>
    </div>)}
    {/* Employee view: next command */}
    {nextCmd && (<div className="rounded-2xl border-2 p-5" style={{ background: "#F59E0B08", borderColor: "#F59E0B40" }}>
      <p className="text-xs font-bold mb-1" style={{ color: "#F59E0B" }}>الأمر التالي للتنفيذ:</p>
      <p className="text-sm font-bold mb-2" style={{ color: "var(--text)" }}>{nextCmd.title}</p>
      {nextCmd.command && <pre className="text-xs p-3 rounded-xl mb-3 overflow-x-auto whitespace-pre-wrap" dir="ltr" style={{ background: "#1A1830", color: "#E2D5B0", fontFamily: "monospace" }}>{nextCmd.command}</pre>}
      <div className="flex gap-2">
        {nextCmd.command && <button onClick={() => { navigator.clipboard.writeText(nextCmd.command!); setCopied(nextCmd.id); setTimeout(() => setCopied(null), 2000); }} className="flex-1 py-3 min-h-[44px] rounded-xl text-sm font-bold" style={{ background: copied === nextCmd.id ? "#3D8C5A15" : "#D4AF3715", color: copied === nextCmd.id ? "#3D8C5A" : "#D4AF37" }}>{copied === nextCmd.id ? "✓ تم النسخ" : "📋 نسخ الأمر"}</button>}
        <button onClick={() => markDone(nextCmd.id)} className="flex-1 py-3 min-h-[44px] rounded-xl text-sm font-bold text-white" style={{ background: "#3D8C5A" }}>✅ تم التنفيذ</button>
      </div>
    </div>)}
    {/* All commands list */}
    {cmds.map((c, i) => (<div key={c.id} className="rounded-xl border p-3 flex items-center gap-3" style={{ background: "var(--card)", borderColor: "var(--card-border)", opacity: c.status === "done" ? 0.5 : 1 }}>
      <span className="text-sm font-bold w-6 text-center" style={{ color: "var(--muted)" }}>{i+1}</span>
      <span className={`text-sm flex-1 ${c.status === "done" ? "line-through" : ""}`} style={{ color: "var(--text)" }}>{c.title}</span>
      <span className="text-[10px] px-2 py-1 rounded-full font-bold" style={{ background: c.status === "done" ? "#3D8C5A15" : "#F59E0B15", color: c.status === "done" ? "#3D8C5A" : "#F59E0B" }}>{c.status === "done" ? "✅ تم" : "⏳"}</span>
    </div>))}
  </div>);
}

// ═══ PHASE 4: Credentials ═══
function Phase4({ projectId }: { projectId: string }) {
  const lk4 = "wp_p4_" + projectId;
  const [creds, setCreds] = useState<{id:string;type:string;label:string;value:string}[]>(() => { try { return JSON.parse(localStorage.getItem(lk4) ?? "[]"); } catch { return []; } });
  function saveCreds(c: typeof creds) { setCreds(c); localStorage.setItem(lk4, JSON.stringify(c)); }
  const [showNew, setShowNew] = useState(false); const [nc, setNc] = useState({ type: "hosting", label: "", value: "" });
  const [visible, setVisible] = useState<Set<string>>(new Set());
  useEffect(() => { api.get("/api/web-projects/" + projectId + "/phase4/credentials").then(r => { if (r.data?.length) saveCreds(r.data); }).catch(() => {}); }, [projectId]);
  async function add() { if (!nc.label.trim() || !nc.value.trim()) return; const n = { id: "cr_" + Date.now(), ...nc }; saveCreds([...creds, n]); setNc({ type: "hosting", label: "", value: "" }); setShowNew(false); api.post("/api/web-projects/" + projectId + "/phase4/credentials", nc).catch(() => {}); }
  async function del(cid: string) { if (!confirm("حذف؟")) return; saveCreds(creds.filter(c => c.id !== cid)); api.delete("/api/web-projects/" + projectId + "/phase4/credentials/" + cid).catch(() => {}); }
  const TYPES: Record<string,string> = { hosting: "🖥️ استضافة", domain: "🌐 دومين", database: "🗃️ قاعدة بيانات", other: "🔑 أخرى" };

  return (<div className="space-y-4">
    <div className="flex items-center justify-between"><span className="text-xs font-bold" style={{ color: "var(--text)" }}>🔐 البيانات السرية ({creds.length})</span><button onClick={() => setShowNew(true)} className="px-4 py-2.5 min-h-[40px] rounded-xl text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>+ بيان</button></div>
    {showNew && (<div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
      <select value={nc.type} onChange={e => setNc({...nc, type: e.target.value})} className="w-full px-3 py-3 rounded-xl border text-sm" style={is}>{Object.entries(TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select>
      <input value={nc.label} onChange={e => setNc({...nc, label: e.target.value})} placeholder="التسمية (مثل: كلمة مرور الاستضافة)" className="w-full px-3 py-3 rounded-xl border text-sm focus:outline-none" style={is} />
      <input value={nc.value} onChange={e => setNc({...nc, value: e.target.value})} placeholder="القيمة" className="w-full px-3 py-3 rounded-xl border text-sm focus:outline-none font-mono" dir="ltr" style={is} />
      <div className="flex gap-2"><button onClick={add} disabled={!nc.label.trim()} className="flex-1 py-3 min-h-[44px] rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#2D6B9E" }}>إضافة</button><button onClick={() => setShowNew(false)} className="py-3 px-4 rounded-xl text-sm" style={{ color: "var(--muted)" }}>إلغاء</button></div>
    </div>)}
    {creds.map(c => (<div key={c.id} className="rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
      <div className="flex items-center gap-2 mb-2"><span className="text-sm">{TYPES[c.type]?.split(" ")[0] ?? "🔑"}</span><span className="text-xs font-bold" style={{ color: "var(--text)" }}>{c.label}</span><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--bg)", color: "var(--muted)" }}>{TYPES[c.type]?.split(" ").slice(1).join(" ")}</span></div>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm font-mono" dir="ltr" style={{ color: "var(--text)" }}>{visible.has(c.id) ? c.value : "••••••••••"}</span>
        <button onClick={() => setVisible(prev => { const s = new Set(prev); s.has(c.id) ? s.delete(c.id) : s.add(c.id); return s; })} className="text-sm px-2 py-1.5 rounded-lg" style={{ color: "#5E5495" }}>{visible.has(c.id) ? "🙈" : "👁️"}</button>
        <button onClick={() => { navigator.clipboard.writeText(c.value); }} className="text-sm px-2 py-1.5 rounded-lg" style={{ color: "#D4AF37" }}>📋</button>
        <button onClick={() => del(c.id)} className="text-sm px-2 py-1.5 rounded-lg" style={{ color: "#DC2626" }}>🗑️</button>
      </div>
    </div>))}
  </div>);
}

// ═══ PHASE 5: Development ═══
function Phase5({ projectId }: { projectId: string }) {
  const lk5 = "wp_p5_" + projectId;
  const [cmds, setCmds] = useState<{id:string;title:string;command?:string;status:string;order:number;notes?:string}[]>(() => { try { return JSON.parse(localStorage.getItem(lk5) ?? "[]"); } catch { return []; } });
  function save5(c: typeof cmds) { setCmds(c); localStorage.setItem(lk5, JSON.stringify(c)); }
  const [showNew, setShowNew] = useState(false); const [nc, setNc] = useState({ title: "", cmd: "" });
  const [copied, setCopied] = useState<string|null>(null);
  useEffect(() => { api.get("/api/web-projects/" + projectId + "/phase5/commands").then(r => { if (r.data?.length) save5(r.data); }).catch(() => {}); }, [projectId]);
  async function add() { if (!nc.title.trim()) return; const n = { id: "c5_" + Date.now(), title: nc.title, command: nc.cmd || undefined, status: "pending", order: cmds.length + 1 }; save5([...cmds, n]); setNc({ title: "", cmd: "" }); setShowNew(false); api.post("/api/web-projects/" + projectId + "/phase5/commands", { title: nc.title, command: nc.cmd || undefined }).catch(() => {}); }
  async function employeeDone(cid: string) { save5(cmds.map(c => c.id === cid ? { ...c, status: "employeeDone" } : c)); api.patch("/api/web-projects/" + projectId + "/phase5/commands/" + cid + "/employee-done").catch(() => {}); }
  async function ownerApprove(cid: string) { save5(cmds.map(c => c.id === cid ? { ...c, status: "closed" } : c)); api.patch("/api/web-projects/" + projectId + "/phase5/commands/" + cid + "/owner-approve").catch(() => {}); }
  const ST: Record<string,{label:string;color:string;icon:string}> = { pending:{label:"لم يُنفَّذ",color:"#6B7280",icon:"⏳"}, employeeDone:{label:"بانتظار المراجعة",color:"#F59E0B",icon:"🔄"}, closed:{label:"مُغلق",color:"#3D8C5A",icon:"✅"} };

  return (<div className="space-y-4">
    <div className="flex items-center justify-between"><span className="text-xs font-bold" style={{ color: "var(--text)" }}>🚀 أوامر التطوير ({cmds.length})</span><button onClick={() => setShowNew(true)} className="px-4 py-2.5 min-h-[40px] rounded-xl text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>+ أمر</button></div>
    {showNew && (<div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
      <input value={nc.title} onChange={e => setNc({...nc, title: e.target.value})} placeholder="عنوان *" className="w-full px-3 py-3 rounded-xl border text-sm focus:outline-none" style={is} />
      <textarea value={nc.cmd} onChange={e => setNc({...nc, cmd: e.target.value})} placeholder="الأمر..." rows={5} className="w-full px-3 py-2 rounded-xl border text-xs resize-none focus:outline-none font-mono" dir="ltr" style={is} />
      <div className="flex gap-2"><button onClick={add} disabled={!nc.title.trim()} className="flex-1 py-3 min-h-[44px] rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#2D6B9E" }}>إضافة</button><button onClick={() => setShowNew(false)} className="py-3 px-4 rounded-xl text-sm" style={{ color: "var(--muted)" }}>إلغاء</button></div>
    </div>)}
    {cmds.map((c, i) => { const st = ST[c.status] ?? ST.pending; return (
      <div key={c.id} className="rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="flex items-center gap-2 mb-2"><span className="text-sm font-bold w-6 text-center" style={{ color: "var(--muted)" }}>{i+1}</span><span className="text-sm font-bold flex-1" style={{ color: "var(--text)" }}>{c.title}</span><span className="text-[10px] px-2 py-1 rounded-full font-bold" style={{ background: st.color+"15", color: st.color }}>{st.icon} {st.label}</span></div>
        {c.command && <pre className="text-xs p-3 rounded-xl mb-2 overflow-x-auto whitespace-pre-wrap" dir="ltr" style={{ background: "#1A1830", color: "#E2D5B0", fontFamily: "monospace" }}>{c.command}</pre>}
        <div className="flex gap-2 flex-wrap">
          {c.command && <button onClick={() => { navigator.clipboard.writeText(c.command!); setCopied(c.id); setTimeout(() => setCopied(null), 2000); }} className="px-3 py-2 min-h-[40px] rounded-xl text-[10px] font-bold" style={{ background: copied === c.id ? "#3D8C5A15" : "#D4AF3715", color: copied === c.id ? "#3D8C5A" : "#D4AF37" }}>{copied === c.id ? "✓ تم" : "📋 نسخ"}</button>}
          {c.status === "pending" && <button onClick={() => employeeDone(c.id)} className="px-4 py-2 min-h-[40px] rounded-xl text-[10px] font-bold text-white" style={{ background: "#F59E0B" }}>✅ تم التنفيذ</button>}
          {c.status === "employeeDone" && <button onClick={() => ownerApprove(c.id)} className="px-4 py-2 min-h-[40px] rounded-xl text-[10px] font-bold text-white" style={{ background: "#3D8C5A" }}>✅ إنجاز وإغلاق</button>}
        </div>
      </div>); })}
  </div>);
}

// ═══ PHASE 6: Client ═══
function Phase6({ projectId }: { projectId: string }) {
  const lk6 = "wp_p6_" + projectId;
  const [reqs, setReqs] = useState<{id:string;title:string;description?:string;status:string;clientNote?:string;ownerNote?:string;createdAt:string}[]>(() => { try { return JSON.parse(localStorage.getItem(lk6) ?? "[]"); } catch { return []; } });
  function save6(r: typeof reqs) { setReqs(r); localStorage.setItem(lk6, JSON.stringify(r)); }
  const [showNew, setShowNew] = useState(false); const [nr, setNr] = useState({ title: "", desc: "", note: "" });
  useEffect(() => { api.get("/api/web-projects/" + projectId + "/phase6/requests").then(r => { if (r.data?.length) save6(r.data); }).catch(() => {}); }, [projectId]);
  async function add() { if (!nr.title.trim()) return; const n = { id: "r6_" + Date.now(), title: nr.title, description: nr.desc || undefined, status: "new", clientNote: nr.note || undefined, createdAt: new Date().toISOString() }; save6([n, ...reqs]); setNr({ title: "", desc: "", note: "" }); setShowNew(false); api.post("/api/web-projects/" + projectId + "/phase6/requests", { title: nr.title, description: nr.desc || undefined, clientNote: nr.note || undefined }).catch(() => {}); }
  async function updateStatus(rid: string, status: string) { save6(reqs.map(r => r.id === rid ? { ...r, status } : r)); api.patch("/api/web-projects/" + projectId + "/phase6/requests/" + rid, { status }).catch(() => {}); }
  const ST: Record<string,{label:string;color:string}> = { new:{label:"جديد",color:"#3B82F6"}, inReview:{label:"قيد المراجعة",color:"#F59E0B"}, inProgress:{label:"جاري",color:"#5E5495"}, done:{label:"مكتمل",color:"#3D8C5A"} };

  return (<div className="space-y-4">
    <div className="flex items-center justify-between"><span className="text-xs font-bold" style={{ color: "var(--text)" }}>💬 طلبات العميل ({reqs.length})</span><button onClick={() => setShowNew(true)} className="px-4 py-2.5 min-h-[40px] rounded-xl text-xs font-bold text-white" style={{ background: "#2D6B9E" }}>+ طلب</button></div>
    {showNew && (<div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
      <input value={nr.title} onChange={e => setNr({...nr, title: e.target.value})} placeholder="عنوان الطلب *" className="w-full px-3 py-3 rounded-xl border text-sm focus:outline-none" style={is} />
      <textarea value={nr.desc} onChange={e => setNr({...nr, desc: e.target.value})} placeholder="الوصف" rows={3} className="w-full px-3 py-2 rounded-xl border text-sm resize-none focus:outline-none" style={is} />
      <div className="flex gap-2"><button onClick={add} disabled={!nr.title.trim()} className="flex-1 py-3 min-h-[44px] rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#2D6B9E" }}>إضافة</button><button onClick={() => setShowNew(false)} className="py-3 px-4 rounded-xl text-sm" style={{ color: "var(--muted)" }}>إلغاء</button></div>
    </div>)}
    {reqs.map(r => { const st = ST[r.status] ?? ST.new; return (
      <div key={r.id} className="rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="flex items-center gap-2 mb-2"><span className="text-sm font-bold flex-1" style={{ color: "var(--text)" }}>{r.title}</span><span className="text-[10px] px-2 py-1 rounded-full font-bold" style={{ background: st.color+"15", color: st.color }}>{st.label}</span></div>
        {r.description && <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>{r.description}</p>}
        <div className="flex gap-1.5 flex-wrap">
          {["new","inReview","inProgress","done"].map(s => <button key={s} onClick={() => updateStatus(r.id, s)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold min-h-[36px]" style={{ background: r.status === s ? (ST[s]?.color ?? "#6B7280") : "var(--bg)", color: r.status === s ? "#fff" : "var(--muted)", border: `1px solid ${r.status === s ? ST[s]?.color : "var(--card-border)"}` }}>{ST[s]?.label ?? s}</button>)}
        </div>
      </div>); })}
  </div>);
}

// ═══ PHASE 7: Users / Accounts ═══
function Phase7({ projectId }: { projectId: string }) {
  const lk7 = "wp_p7_" + projectId;
  interface UserAccount { id: string; label: string; email: string; password: string; phone?: string; notes?: string }
  const [accounts, setAccounts] = useState<UserAccount[]>(() => { try { return JSON.parse(localStorage.getItem(lk7) ?? "[]"); } catch { return []; } });
  const [showNew, setShowNew] = useState(false);
  const [na, setNa] = useState({ label: "", email: "", password: "", phone: "", notes: "" });
  const [visible, setVisible] = useState<Set<string>>(new Set());
  function save(a: UserAccount[]) { setAccounts(a); localStorage.setItem(lk7, JSON.stringify(a)); }
  function add() { if (!na.email.trim() || !na.password.trim()) return; save([...accounts, { id: "u_" + Date.now(), label: na.label.trim() || "مستخدم", email: na.email.trim(), password: na.password, phone: na.phone.trim() || undefined, notes: na.notes || undefined }]); setNa({ label: "", email: "", password: "", phone: "", notes: "" }); setShowNew(false); }
  function del(uid: string) { if (confirm("حذف؟")) save(accounts.filter(a => a.id !== uid)); }

  return (<div className="space-y-4">
    <div className="rounded-xl p-4" style={{ background: "#5E549508", border: "1px solid #5E549520" }}>
      <p className="text-xs font-bold mb-1" style={{ color: "#5E5495" }}>👤 حسابات الكمبيوتر للموقع</p>
      <p className="text-[10px]" style={{ color: "var(--text)" }}>سجّل بيانات المستخدم الذي تفتحه على الكمبيوتر لكل موقع — الإيميل والرقم السري ورقم الجوال</p>
    </div>

    {/* تنبيه: يجب إضافة مستخدم قبل الانتقال */}
    {accounts.length === 0 && (
      <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: "#DC262608", border: "1px solid #DC262620" }}>
        <span className="text-lg">⚠️</span>
        <p className="text-xs font-bold" style={{ color: "#DC2626" }}>يجب إضافة مستخدم واحد على الأقل قبل إكمال هذه المرحلة والانتقال للتالية</p>
      </div>
    )}

    <div className="flex items-center justify-between">
      <span className="text-xs font-bold" style={{ color: "var(--text)" }}>الحسابات ({accounts.length})</span>
      <button onClick={() => setShowNew(true)} className="px-4 py-2.5 min-h-[40px] rounded-xl text-xs font-bold text-white" style={{ background: "#5E5495" }}>+ حساب جديد</button>
    </div>

    {showNew && (<div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
      <input value={na.label} onChange={e => setNa({...na, label: e.target.value})} placeholder="التسمية (مثل: مستخدم ويندوز، حساب الموقع)" className="w-full px-3 py-3 rounded-xl border text-sm focus:outline-none" style={is} />
      <input value={na.email} onChange={e => setNa({...na, email: e.target.value})} placeholder="الإيميل *" type="email" className="w-full px-3 py-3 rounded-xl border text-sm focus:outline-none font-mono" dir="ltr" style={is} />
      <input value={na.password} onChange={e => setNa({...na, password: e.target.value})} placeholder="الرقم السري *" className="w-full px-3 py-3 rounded-xl border text-sm focus:outline-none font-mono" dir="ltr" style={is} />
      <input value={na.phone} onChange={e => setNa({...na, phone: e.target.value})} placeholder="رقم الجوال (اختياري)" type="tel" className="w-full px-3 py-3 rounded-xl border text-sm focus:outline-none font-mono" dir="ltr" style={is} />
      <input value={na.notes} onChange={e => setNa({...na, notes: e.target.value})} placeholder="ملاحظات (اختياري)" className="w-full px-3 py-3 rounded-xl border text-sm focus:outline-none" style={is} />
      <div className="flex gap-2">
        <button onClick={add} disabled={!na.email.trim() || !na.password.trim()} className="flex-1 py-3 min-h-[44px] rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#5E5495" }}>إضافة</button>
        <button onClick={() => setShowNew(false)} className="py-3 px-4 rounded-xl text-sm" style={{ color: "var(--muted)" }}>إلغاء</button>
      </div>
    </div>)}

    {accounts.map(a => (<div key={a.id} className="rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
      <div className="flex items-center gap-2 mb-2"><span className="text-lg">👤</span><span className="text-sm font-bold flex-1" style={{ color: "var(--text)" }}>{a.label}</span><button onClick={() => del(a.id)} className="text-sm px-2 py-1.5 rounded-lg hover:bg-red-50" style={{ color: "#DC2626" }}>🗑️</button></div>
      <div className="space-y-2">
        <div className="flex items-center gap-2"><span className="text-[10px] w-16 font-bold" style={{ color: "var(--muted)" }}>الإيميل:</span><span className="flex-1 text-sm font-mono" dir="ltr" style={{ color: "var(--text)" }}>{a.email}</span><button onClick={() => navigator.clipboard.writeText(a.email)} className="text-sm px-2 py-1 rounded-lg min-h-[36px]" style={{ color: "#D4AF37" }}>📋</button></div>
        <div className="flex items-center gap-2"><span className="text-[10px] w-16 font-bold" style={{ color: "var(--muted)" }}>السري:</span><span className="flex-1 text-sm font-mono" dir="ltr" style={{ color: "var(--text)" }}>{visible.has(a.id) ? a.password : "••••••••"}</span><button onClick={() => setVisible(prev => { const s = new Set(prev); s.has(a.id) ? s.delete(a.id) : s.add(a.id); return s; })} className="text-sm px-2 py-1 rounded-lg min-h-[36px]" style={{ color: "#5E5495" }}>{visible.has(a.id) ? "🙈" : "👁️"}</button><button onClick={() => navigator.clipboard.writeText(a.password)} className="text-sm px-2 py-1 rounded-lg min-h-[36px]" style={{ color: "#D4AF37" }}>📋</button></div>
        {a.phone && <div className="flex items-center gap-2"><span className="text-[10px] w-16 font-bold" style={{ color: "var(--muted)" }}>الجوال:</span><span className="flex-1 text-sm font-mono" dir="ltr" style={{ color: "var(--text)" }}>{a.phone}</span><a href={"tel:" + a.phone} className="text-sm px-2 py-1 rounded-lg min-h-[36px]" style={{ color: "#3D8C5A" }}>📞</a><button onClick={() => navigator.clipboard.writeText(a.phone!)} className="text-sm px-2 py-1 rounded-lg min-h-[36px]" style={{ color: "#D4AF37" }}>📋</button></div>}
        {a.notes && <p className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>📝 {a.notes}</p>}
      </div>
    </div>))}

    {accounts.length === 0 && !showNew && <div className="text-center py-8"><p className="text-3xl mb-2">👤</p><p className="text-sm" style={{ color: "var(--muted)" }}>أضف حساب المستخدم الأول للموقع</p><button onClick={() => setShowNew(true)} className="mt-3 px-6 py-3 min-h-[44px] rounded-xl text-sm font-bold text-white" style={{ background: "#5E5495" }}>+ إضافة حساب</button></div>}
  </div>);
}
