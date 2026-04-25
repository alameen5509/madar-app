"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  type Meeting,
  getMeetings,
  getMeetingsUpcoming,
  createMeeting,
  completeMeeting,
  deleteMeeting,
  cancelMeeting,
} from "@/lib/api";

type Tab = "upcoming" | "all" | "past";

const TYPE_MAP: Record<string, { label: string; icon: string }> = {
  remote: { label: "عن بُعد", icon: "💻" },
  inperson: { label: "حضوري", icon: "🏢" },
  hybrid: { label: "مختلط", icon: "🔄" },
};
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  scheduled: { label: "مجدولة", color: "#3B82F6" },
  inprogress: { label: "جارية", color: "#F59E0B" },
  completed: { label: "مكتملة", color: "#3D8C5A" },
  cancelled: { label: "ملغاة", color: "#DC2626" },
  postponed: { label: "مؤجلة", color: "#8B5CF6" },
};
const is = { background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" } as const;

export default function MeetingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [nm, setNm] = useState({
    title: "", desc: "", type: "remote", platform: "", location: "", link: "",
    start: "", end: "", notes: "", recurrence: "none", isPrivate: false,
    attendees: [{ name: "", role: "attendee" }] as { name: string; role: string }[],
    agenda: [{ title: "", dur: "10" }] as { title: string; dur: string }[],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let list: Meeting[];
      if (tab === "upcoming") {
        list = await getMeetingsUpcoming();
      } else {
        list = await getMeetings();
        if (tab === "past") list = list.filter(m => m.status === "completed" || m.status === "cancelled");
      }
      setMeetings(list);
    } catch (e: any) { console.error(e); }
    setLoading(false);
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function create() {
    if (!nm.title.trim() || !nm.start) return;
    try {
      await createMeeting({
        title: nm.title,
        description: nm.desc || undefined,
        meetingType: nm.type,
        platform: nm.platform || undefined,
        location: nm.location || undefined,
        meetingLink: nm.link || undefined,
        startTime: nm.start,
        endTime: nm.end || undefined,
        notes: nm.notes || undefined,
        recurrence: nm.recurrence !== "none" ? nm.recurrence : undefined,
        isPrivate: nm.isPrivate,
        attendees: nm.attendees.filter(a => a.name.trim()).map(a => ({ name: a.name, role: a.role })),
        agenda: nm.agenda.filter(a => a.title.trim()).map(a => ({ title: a.title, duration: parseInt(a.dur) || 10 })),
      });
      setNm({
        title: "", desc: "", type: "remote", platform: "", location: "", link: "",
        start: "", end: "", notes: "", recurrence: "none", isPrivate: false,
        attendees: [{ name: "", role: "attendee" }], agenda: [{ title: "", dur: "10" }],
      });
      setShowNew(false);
      fetchData();
    } catch { alert("حدث خطأ"); }
  }

  function getDuration(m: Meeting): string {
    if (!m.endTime) return "";
    const diff = new Date(m.endTime).getTime() - new Date(m.startTime).getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 60) return `${mins}د`;
    const h = Math.floor(mins / 60);
    const r = mins % 60;
    return r > 0 ? `${h}س ${r}د` : `${h}س`;
  }

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur border-b px-4 sm:px-6 py-3 pr-14 md:pr-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg" style={{ color: "var(--text)" }}>📅 الاجتماعات</h2>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{meetings.length} اجتماع</span>
          </div>
          <button onClick={() => setShowNew(true)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white"
            style={{ background: "linear-gradient(135deg,#5E5495,#D4AF37)" }}>+ اجتماع جديد</button>
        </div>
        <div className="flex gap-1.5 mt-2">
          {([["upcoming", "القادمة", "📅"], ["all", "الكل", "📋"], ["past", "السابقة", "✅"]] as [Tab, string, string][]).map(([k, l, ic]) => (
            <button key={k} onClick={() => setTab(k)} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition whitespace-nowrap"
              style={{ background: tab === k ? "#5E5495" : "var(--bg)", color: tab === k ? "#fff" : "var(--muted)", border: `1px solid ${tab === k ? "#5E5495" : "var(--card-border)"}` }}>
              {ic} {l}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 space-y-3 max-w-3xl mx-auto">
        {loading && <p className="text-center py-8 animate-pulse text-sm" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>}

        {!loading && (<>
          {/* New meeting form */}
          {showNew && (
            <div className="rounded-2xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: "var(--text)" }}>اجتماع جديد</span>
                <button onClick={() => setShowNew(false)} className="text-[10px]" style={{ color: "var(--muted)" }}>✕ إغلاق</button>
              </div>
              <input value={nm.title} onChange={e => setNm({ ...nm, title: e.target.value })} placeholder="عنوان الاجتماع *" className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={is} />
              <textarea value={nm.desc} onChange={e => setNm({ ...nm, desc: e.target.value })} placeholder="الوصف" rows={2} className="w-full px-3 py-2 rounded-lg border text-xs resize-none focus:outline-none" style={is} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold block mb-0.5" style={{ color: "var(--muted)" }}>البداية *</label>
                  <input type="datetime-local" value={nm.start} onChange={e => setNm({ ...nm, start: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border text-xs" style={is} />
                </div>
                <div>
                  <label className="text-[9px] font-bold block mb-0.5" style={{ color: "var(--muted)" }}>النهاية</label>
                  <input type="datetime-local" value={nm.end} onChange={e => setNm({ ...nm, end: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border text-xs" style={is} />
                </div>
              </div>
              <div className="flex gap-2">
                <select value={nm.type} onChange={e => setNm({ ...nm, type: e.target.value })} className="flex-1 px-2 py-1.5 rounded-lg border text-xs" style={is}>
                  <option value="remote">💻 عن بُعد</option>
                  <option value="inperson">🏢 حضوري</option>
                  <option value="hybrid">🔄 مختلط</option>
                </select>
                <select value={nm.recurrence} onChange={e => setNm({ ...nm, recurrence: e.target.value })} className="flex-1 px-2 py-1.5 rounded-lg border text-xs" style={is}>
                  <option value="none">بدون تكرار</option>
                  <option value="daily">يومي</option>
                  <option value="weekly">أسبوعي</option>
                  <option value="monthly">شهري</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input value={nm.link} onChange={e => setNm({ ...nm, link: e.target.value })} placeholder="رابط الاجتماع" className="flex-1 px-2 py-1.5 rounded-lg border text-xs" style={is} />
                <input value={nm.location} onChange={e => setNm({ ...nm, location: e.target.value })} placeholder="المكان (اختياري)" className="flex-1 px-2 py-1.5 rounded-lg border text-xs" style={is} />
              </div>
              <textarea value={nm.notes} onChange={e => setNm({ ...nm, notes: e.target.value })} placeholder="ملاحظات" rows={1} className="w-full px-2 py-1.5 rounded-lg border text-xs resize-none focus:outline-none" style={is} />

              {/* Attendees */}
              <div className="rounded-lg border p-2 space-y-1" style={{ borderColor: "#5E549520" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold" style={{ color: "#5E5495" }}>👥 الحضور</span>
                  <button onClick={() => setNm({ ...nm, attendees: [...nm.attendees, { name: "", role: "attendee" }] })} className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: "#5E549515", color: "#5E5495" }}>+</button>
                </div>
                {nm.attendees.map((a, i) => (
                  <div key={i} className="flex gap-1.5">
                    <input value={a.name} onChange={e => { const u = [...nm.attendees]; u[i] = { ...a, name: e.target.value }; setNm({ ...nm, attendees: u }); }} placeholder="الاسم" className="flex-1 px-2 py-1 rounded-lg border text-[10px]" style={is} />
                    <select value={a.role} onChange={e => { const u = [...nm.attendees]; u[i] = { ...a, role: e.target.value }; setNm({ ...nm, attendees: u }); }} className="px-1 py-1 rounded-lg border text-[10px]" style={is}>
                      <option value="host">مضيف</option>
                      <option value="attendee">حاضر</option>
                      <option value="optional">اختياري</option>
                    </select>
                    <button onClick={() => setNm({ ...nm, attendees: nm.attendees.filter((_, j) => j !== i) })} className="text-[9px]" style={{ color: "#DC2626" }}>✕</button>
                  </div>
                ))}
              </div>

              {/* Agenda */}
              <div className="rounded-lg border p-2 space-y-1" style={{ borderColor: "#D4AF3720" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold" style={{ color: "#D4AF37" }}>📋 جدول الأعمال</span>
                  <button onClick={() => setNm({ ...nm, agenda: [...nm.agenda, { title: "", dur: "10" }] })} className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: "#D4AF3715", color: "#D4AF37" }}>+</button>
                </div>
                {nm.agenda.map((a, i) => (
                  <div key={i} className="flex gap-1.5">
                    <input value={a.title} onChange={e => { const u = [...nm.agenda]; u[i] = { ...a, title: e.target.value }; setNm({ ...nm, agenda: u }); }} placeholder="البند" className="flex-1 px-2 py-1 rounded-lg border text-[10px]" style={is} />
                    <input value={a.dur} onChange={e => { const u = [...nm.agenda]; u[i] = { ...a, dur: e.target.value }; setNm({ ...nm, agenda: u }); }} placeholder="دقيقة" type="number" className="w-14 px-2 py-1 rounded-lg border text-[10px] text-center" style={is} />
                    <button onClick={() => setNm({ ...nm, agenda: nm.agenda.filter((_, j) => j !== i) })} className="text-[9px]" style={{ color: "#DC2626" }}>✕</button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-[10px] cursor-pointer" style={{ color: "var(--muted)" }}>
                  <input type="checkbox" checked={nm.isPrivate} onChange={e => setNm({ ...nm, isPrivate: e.target.checked })} className="rounded" />
                  🔒 خاص
                </label>
              </div>

              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowNew(false)} className="px-3 py-1.5 rounded-lg text-[10px]" style={{ color: "var(--muted)" }}>إلغاء</button>
                <button onClick={create} disabled={!nm.title.trim() || !nm.start} className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40" style={{ background: "#5E5495" }}>إنشاء</button>
              </div>
            </div>
          )}

          {/* Meetings list */}
          {meetings.map(m => {
            const st = STATUS_MAP[m.status] ?? STATUS_MAP.scheduled;
            const tp = TYPE_MAP[m.meetingType] ?? TYPE_MAP.remote;
            const startDate = new Date(m.startTime);
            const duration = getDuration(m);
            return (
              <div key={m.id} className="rounded-2xl border overflow-hidden transition hover:border-[#5E549540] cursor-pointer"
                style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
                onClick={() => router.push(`/meetings/${m.id}`)}>
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{tp.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm truncate" style={{ color: "var(--text)" }}>{m.title}</p>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${st.color}15`, color: st.color }}>{st.label}</span>
                        {m.isPrivate && <span className="text-[9px]">🔒</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[9px]" style={{ color: "var(--muted)" }}>
                          {startDate.toLocaleDateString("ar-SA", { weekday: "short", month: "short", day: "numeric" })} — {startDate.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {duration && <span className="text-[9px] px-1 rounded" style={{ background: "var(--bg)", color: "var(--muted)" }}>{duration}</span>}
                        <span className="text-[9px]" style={{ color: "var(--muted)" }}>{tp.label}</span>
                        {m.location && <span className="text-[9px]" style={{ color: "var(--muted)" }}>📍 {m.location}</span>}
                        {(m.attendeeCount ?? 0) > 0 && <span className="text-[9px]" style={{ color: "var(--muted)" }}>👥 {m.attendeeCount}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      {m.status === "scheduled" && (
                        <button onClick={async () => { try { await completeMeeting(m.id); fetchData(); } catch { alert("حدث خطأ"); } }}
                          className="text-[9px] px-2 py-1 rounded-lg font-bold" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>✅</button>
                      )}
                      {m.meetingLink && (
                        <a href={m.meetingLink} target="_blank" rel="noopener" className="text-[9px] px-2 py-1 rounded-lg font-bold" style={{ background: "#3B82F615", color: "#3B82F6" }}>🔗</a>
                      )}
                      {m.status === "scheduled" && (
                        <button onClick={async () => { try { await cancelMeeting(m.id); fetchData(); } catch { alert("حدث خطأ"); } }}
                          className="text-[9px] px-1.5 py-1 rounded-lg" style={{ color: "#F59E0B" }}>⏸</button>
                      )}
                      <button onClick={async () => { if (confirm("حذف؟")) { try { await deleteMeeting(m.id); fetchData(); } catch { alert("حدث خطأ"); } } }}
                        className="text-[9px] px-1 rounded" style={{ color: "#DC2626" }}>🗑️</button>
                    </div>
                  </div>
                  {m.description && <p className="text-[10px] mt-1.5 line-clamp-2" style={{ color: "var(--muted)" }}>{m.description}</p>}
                </div>
              </div>
            );
          })}

          {meetings.length === 0 && !showNew && (
            <div className="text-center py-12">
              <p className="text-3xl mb-2">📅</p>
              <p className="text-sm" style={{ color: "var(--muted)" }}>لا توجد اجتماعات</p>
              <button onClick={() => setShowNew(true)} className="mt-3 text-[10px] font-bold px-4 py-2 rounded-lg text-white" style={{ background: "#5E5495" }}>+ إنشاء اجتماع</button>
            </div>
          )}
        </>)}
      </div>
    </main>
  );
}
