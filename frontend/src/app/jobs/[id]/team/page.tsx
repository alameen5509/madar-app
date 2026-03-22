"use client";
import { use, useState } from "react";
import JobPageShell, { useJobMeta } from "@/components/JobPageShell";

type TeamMember = { name: string; role: string; position?: string; notes?: string; lastContact?: string; partnerType?: string; sharePercent?: string; status?: string; skills?: string; company?: string; projects?: string };

const SECTIONS = [
  { role: "مدير",  icon: "👔", color: "#2D6B9E", label: "المدراء" },
  { role: "شريك",  icon: "🤝", color: "#D4AF37", label: "الشركاء" },
  { role: "موظف",  icon: "👤", color: "#3D8C5A", label: "الفريق / الموظفون" },
  { role: "عميل",  icon: "🏢", color: "#5E5495", label: "العملاء" },
];

export default function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { meta, setMeta } = useJobMeta(id);
  const [openSec, setOpenSec] = useState<string>("مدير");
  const [addRole, setAddRole] = useState<string | null>(null);

  // Form fields
  const [fName, setFName] = useState("");
  const [fPosition, setFPosition] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [fLastContact, setFLastContact] = useState("");
  const [fPartnerType, setFPartnerType] = useState("");
  const [fSharePercent, setFSharePercent] = useState("");
  const [fStatus, setFStatus] = useState("نشط");
  const [fSkills, setFSkills] = useState("");
  const [fCompany, setFCompany] = useState("");
  const [fProjects, setFProjects] = useState("");

  function resetForm() {
    setFName(""); setFPosition(""); setFNotes(""); setFLastContact("");
    setFPartnerType(""); setFSharePercent(""); setFStatus("نشط");
    setFSkills(""); setFCompany(""); setFProjects(""); setAddRole(null);
  }

  function addMember(role: string) {
    if (!fName.trim()) return;
    const member: TeamMember = { name: fName.trim(), role };
    if (role === "مدير") {
      member.position = fPosition; member.lastContact = fLastContact; member.notes = fNotes;
    } else if (role === "شريك") {
      member.partnerType = fPartnerType; member.sharePercent = fSharePercent; member.status = fStatus; member.notes = fNotes;
    } else if (role === "موظف") {
      member.position = fPosition; member.skills = fSkills; member.notes = fNotes;
    } else if (role === "عميل") {
      member.company = fCompany; member.projects = fProjects; member.notes = fNotes;
    }
    setMeta({ ...meta, team: [...meta.team, member] });
    resetForm();
  }

  function removeMember(idx: number) {
    const t = [...meta.team]; t.splice(idx, 1); setMeta({ ...meta, team: t });
  }

  return (
    <JobPageShell jobId={id}>
      <div className="space-y-3">
        {SECTIONS.map(sec => {
          const members = meta.team.map((m, i) => ({ ...m, _idx: i })).filter(m => m.role === sec.role);
          const isOpen = openSec === sec.role;

          return (
            <div key={sec.role} className="rounded-2xl border overflow-hidden" style={{ borderColor: isOpen ? sec.color + "40" : "var(--card-border)", background: "var(--card)" }}>
              {/* Accordion header */}
              <button onClick={() => setOpenSec(isOpen ? "" : sec.role)}
                className="w-full flex items-center gap-3 px-5 py-4 transition-all hover:bg-gray-50">
                <span className="text-xl">{sec.icon}</span>
                <span className="text-sm font-bold flex-1 text-right" style={{ color: "var(--text)" }}>{sec.label}</span>
                <span className="min-w-[24px] h-6 flex items-center justify-center rounded-full text-[10px] font-bold px-2"
                  style={{ background: sec.color + "15", color: sec.color }}>{members.length}</span>
                <span className="text-[10px]" style={{ color: "var(--muted)" }}>{isOpen ? "▲" : "▼"}</span>
              </button>

              {/* Accordion body */}
              {isOpen && (
                <div className="px-5 pb-5 space-y-3 border-t" style={{ borderColor: "var(--card-border)" }}>
                  {/* Members list */}
                  {members.map(m => (
                    <div key={m._idx} className="rounded-xl p-4 border" style={{ borderColor: "var(--card-border)", background: "var(--bg)" }}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                          style={{ background: sec.color }}>{m.name[0]}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{m.name}</p>

                          {/* Manager details */}
                          {sec.role === "مدير" && (
                            <div className="space-y-0.5 mt-1">
                              {m.position && <p className="text-[10px]" style={{ color: "var(--muted)" }}>المنصب: <b style={{ color: "var(--text)" }}>{m.position}</b></p>}
                              {m.lastContact && <p className="text-[10px]" style={{ color: "var(--muted)" }}>آخر تواصل: <b style={{ color: "var(--text)" }}>{m.lastContact}</b></p>}
                              {m.notes && <p className="text-[10px]" style={{ color: "var(--muted)" }}>{m.notes}</p>}
                            </div>
                          )}

                          {/* Partner details */}
                          {sec.role === "شريك" && (
                            <div className="space-y-0.5 mt-1">
                              {m.partnerType && <p className="text-[10px]" style={{ color: "var(--muted)" }}>نوع الشراكة: <b style={{ color: "var(--text)" }}>{m.partnerType}</b></p>}
                              {m.sharePercent && <p className="text-[10px]" style={{ color: "var(--muted)" }}>النسبة: <b style={{ color: sec.color }}>{m.sharePercent}%</b></p>}
                              {m.status && <p className="text-[10px]"><span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold" style={{ background: m.status === "نشط" ? "#3D8C5A15" : "#6B728015", color: m.status === "نشط" ? "#3D8C5A" : "#6B7280" }}>{m.status}</span></p>}
                              {m.notes && <p className="text-[10px]" style={{ color: "var(--muted)" }}>{m.notes}</p>}
                            </div>
                          )}

                          {/* Employee details */}
                          {sec.role === "موظف" && (
                            <div className="space-y-0.5 mt-1">
                              {m.position && <p className="text-[10px]" style={{ color: "var(--muted)" }}>المنصب: <b style={{ color: "var(--text)" }}>{m.position}</b></p>}
                              {m.skills && <p className="text-[10px]" style={{ color: "var(--muted)" }}>المهارات: <b style={{ color: "var(--text)" }}>{m.skills}</b></p>}
                              {m.notes && <p className="text-[10px]" style={{ color: "var(--muted)" }}>ملاحظات الأداء: {m.notes}</p>}
                            </div>
                          )}

                          {/* Client details */}
                          {sec.role === "عميل" && (
                            <div className="space-y-0.5 mt-1">
                              {m.company && <p className="text-[10px]" style={{ color: "var(--muted)" }}>الجهة: <b style={{ color: "var(--text)" }}>{m.company}</b></p>}
                              {m.projects && <p className="text-[10px]" style={{ color: "var(--muted)" }}>المشاريع: <b style={{ color: "var(--text)" }}>{m.projects}</b></p>}
                              {m.notes && <p className="text-[10px]" style={{ color: "var(--muted)" }}>{m.notes}</p>}
                            </div>
                          )}
                        </div>
                        <button onClick={() => removeMember(m._idx)}
                          className="text-red-300 hover:text-red-500 text-xs transition flex-shrink-0">✕</button>
                      </div>
                    </div>
                  ))}

                  {members.length === 0 && addRole !== sec.role && (
                    <p className="text-center text-xs py-4" style={{ color: "var(--muted)" }}>لا يوجد {sec.label.toLowerCase()}</p>
                  )}

                  {/* Add form */}
                  {addRole === sec.role ? (
                    <div className="rounded-xl p-4 border-2 space-y-2 fade-up" style={{ borderColor: sec.color + "40", background: "var(--bg)" }}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold" style={{ color: sec.color }}>إضافة {sec.role}</p>
                        <div className="flex gap-2">
                          <button onClick={resetForm} className="px-3 py-1 rounded-lg text-[10px] text-[#6B7280] bg-gray-100">إلغاء</button>
                          <button onClick={() => addMember(sec.role)} className="px-3 py-1 rounded-lg text-[10px] font-bold text-white" style={{ background: sec.color }}>إضافة</button>
                        </div>
                      </div>
                      <input value={fName} onChange={e => setFName(e.target.value)} placeholder="الاسم *"
                        className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", color: "var(--text)", background: "var(--card)" }} autoFocus />

                      {sec.role === "مدير" && (
                        <>
                          <input value={fPosition} onChange={e => setFPosition(e.target.value)} placeholder="المنصب"
                            className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", color: "var(--text)", background: "var(--card)" }} />
                          <input type="date" value={fLastContact} onChange={e => setFLastContact(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", color: "var(--text)", background: "var(--card)" }} />
                          <input value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="ملاحظات"
                            className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", color: "var(--text)", background: "var(--card)" }} />
                        </>
                      )}

                      {sec.role === "شريك" && (
                        <>
                          <input value={fPartnerType} onChange={e => setFPartnerType(e.target.value)} placeholder="طبيعة الشراكة (مثال: شريك تأسيس، شريك تنفيذ)"
                            className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", color: "var(--text)", background: "var(--card)" }} />
                          <div className="flex gap-2">
                            <input type="number" value={fSharePercent} onChange={e => setFSharePercent(e.target.value)} placeholder="النسبة %"
                              className="w-24 px-3 py-2 rounded-lg border text-xs text-center focus:outline-none" style={{ borderColor: "var(--card-border)", color: "var(--text)", background: "var(--card)" }} />
                            <div className="flex gap-1">
                              {["نشط", "متوقف", "سابق"].map(s => (
                                <button key={s} onClick={() => setFStatus(s)} className="px-2.5 py-2 rounded-lg text-[10px] font-semibold"
                                  style={{ background: fStatus === s ? sec.color : "#F3F4F6", color: fStatus === s ? "#fff" : "#6B7280" }}>{s}</button>
                              ))}
                            </div>
                          </div>
                          <input value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="ملاحظات"
                            className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", color: "var(--text)", background: "var(--card)" }} />
                        </>
                      )}

                      {sec.role === "موظف" && (
                        <>
                          <input value={fPosition} onChange={e => setFPosition(e.target.value)} placeholder="المنصب"
                            className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", color: "var(--text)", background: "var(--card)" }} />
                          <input value={fSkills} onChange={e => setFSkills(e.target.value)} placeholder="المهارات (مثال: تصميم، برمجة، تسويق)"
                            className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", color: "var(--text)", background: "var(--card)" }} />
                          <input value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="ملاحظات الأداء"
                            className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", color: "var(--text)", background: "var(--card)" }} />
                        </>
                      )}

                      {sec.role === "عميل" && (
                        <>
                          <input value={fCompany} onChange={e => setFCompany(e.target.value)} placeholder="الجهة / الشركة"
                            className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", color: "var(--text)", background: "var(--card)" }} />
                          <input value={fProjects} onChange={e => setFProjects(e.target.value)} placeholder="المشاريع المشتركة"
                            className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", color: "var(--text)", background: "var(--card)" }} />
                          <input value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="ملاحظات"
                            className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "var(--card-border)", color: "var(--text)", background: "var(--card)" }} />
                        </>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => { resetForm(); setAddRole(sec.role); }}
                      className="w-full py-2.5 rounded-xl text-xs font-semibold transition border border-dashed hover:border-solid"
                      style={{ borderColor: sec.color + "40", color: sec.color }}>
                      + إضافة {sec.role}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </JobPageShell>
  );
}
