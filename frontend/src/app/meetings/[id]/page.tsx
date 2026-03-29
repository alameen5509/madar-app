"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  type Meeting, type MeetingAttendee, type MeetingAgendaItem, type MeetingMinute, type MeetingActionItem,
  getMeeting, updateMeeting, deleteMeeting, completeMeeting, cancelMeeting,
  addMeetingAttendee, updateMeetingAttendee, removeMeetingAttendee,
  addMeetingAgendaItem, updateMeetingAgendaItem, removeMeetingAgendaItem,
  addMeetingMinute, removeMeetingMinute,
  addMeetingActionItem, updateMeetingActionItem, removeMeetingActionItem,
} from "@/lib/api";

type Tab = "details" | "attendees" | "agenda" | "minutes" | "actions";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  scheduled: { label: "مجدولة", color: "#3B82F6" },
  inprogress: { label: "جارية", color: "#F59E0B" },
  completed: { label: "مكتملة", color: "#3D8C5A" },
  cancelled: { label: "ملغاة", color: "#DC2626" },
  postponed: { label: "مؤجلة", color: "#8B5CF6" },
};
const TYPE_MAP: Record<string, { label: string; icon: string }> = {
  remote: { label: "عن بُعد", icon: "💻" },
  inperson: { label: "حضوري", icon: "🏢" },
  hybrid: { label: "مختلط", icon: "🔄" },
};
const ROLE_MAP: Record<string, string> = { host: "مضيف", attendee: "حاضر", optional: "اختياري" };
const ATTEND_STATUS: Record<string, { label: string; color: string }> = {
  invited: { label: "مدعو", color: "#3B82F6" },
  confirmed: { label: "مؤكد", color: "#3D8C5A" },
  declined: { label: "رفض", color: "#DC2626" },
  attended: { label: "حضر", color: "#3D8C5A" },
  absent: { label: "غائب", color: "#DC2626" },
};
const is = { background: "var(--bg)", borderColor: "var(--card-border)", color: "var(--text)" } as const;

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("details");
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ title: "", description: "", location: "", meetingLink: "", notes: "", platform: "" });

  // New item states
  const [newAttendee, setNewAttendee] = useState({ name: "", role: "attendee" });
  const [newAgenda, setNewAgenda] = useState({ title: "", duration: "10" });
  const [newMinute, setNewMinute] = useState("");
  const [newAction, setNewAction] = useState({ title: "", assignedTo: "", dueDate: "" });

  const fetchMeeting = useCallback(async () => {
    try {
      const data = await getMeeting(id);
      setMeeting(data);
      setEditData({
        title: data.title, description: data.description ?? "", location: data.location ?? "",
        meetingLink: data.meetingLink ?? "", notes: data.notes ?? "", platform: data.platform ?? "",
      });
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchMeeting(); }, [fetchMeeting]);

  if (loading) return (
    <main className="flex-1 overflow-y-auto flex items-center justify-center" dir="rtl" style={{ background: "var(--bg)" }}>
      <p className="animate-pulse text-sm" style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>
    </main>
  );

  if (!meeting) return (
    <main className="flex-1 overflow-y-auto flex items-center justify-center" dir="rtl" style={{ background: "var(--bg)" }}>
      <div className="text-center">
        <p className="text-3xl mb-2">❌</p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>الاجتماع غير موجود</p>
        <button onClick={() => router.push("/meetings")} className="mt-3 text-xs underline" style={{ color: "#5E5495" }}>العودة للاجتماعات</button>
      </div>
    </main>
  );

  const st = STATUS_MAP[meeting.status] ?? STATUS_MAP.scheduled;
  const tp = TYPE_MAP[meeting.meetingType] ?? TYPE_MAP.remote;
  const startDate = new Date(meeting.startTime);

  async function saveEdit() {
    try {
      await updateMeeting(id, {
        title: editData.title || undefined,
        description: editData.description || undefined,
        location: editData.location || undefined,
        meetingLink: editData.meetingLink || undefined,
        notes: editData.notes || undefined,
        platform: editData.platform || undefined,
      });
      setEditing(false);
      fetchMeeting();
    } catch {}
  }

  async function handleComplete() { try { await completeMeeting(id); fetchMeeting(); } catch {} }
  async function handleCancel() { try { await cancelMeeting(id); fetchMeeting(); } catch {} }
  async function handleDelete() {
    if (!confirm("حذف الاجتماع؟")) return;
    try { await deleteMeeting(id); router.push("/meetings"); } catch {}
  }

  // Attendees
  async function handleAddAttendee() {
    if (!newAttendee.name.trim()) return;
    try { await addMeetingAttendee(id, { name: newAttendee.name, role: newAttendee.role }); setNewAttendee({ name: "", role: "attendee" }); fetchMeeting(); } catch {}
  }
  async function handleUpdateAttendeeStatus(aId: string, status: string) {
    try { await updateMeetingAttendee(aId, { status }); fetchMeeting(); } catch {}
  }
  async function handleRemoveAttendee(aId: string) {
    try { await removeMeetingAttendee(aId); fetchMeeting(); } catch {}
  }

  // Agenda
  async function handleAddAgenda() {
    if (!newAgenda.title.trim()) return;
    try { await addMeetingAgendaItem(id, { title: newAgenda.title, duration: parseInt(newAgenda.duration) || 10 }); setNewAgenda({ title: "", duration: "10" }); fetchMeeting(); } catch {}
  }
  async function handleToggleAgenda(aId: string, current: boolean) {
    try { await updateMeetingAgendaItem(aId, { isCompleted: !current }); fetchMeeting(); } catch {}
  }
  async function handleRemoveAgenda(aId: string) {
    try { await removeMeetingAgendaItem(aId); fetchMeeting(); } catch {}
  }

  // Minutes
  async function handleAddMinute() {
    if (!newMinute.trim()) return;
    try { await addMeetingMinute(id, newMinute); setNewMinute(""); fetchMeeting(); } catch {}
  }
  async function handleRemoveMinute(mId: string) {
    try { await removeMeetingMinute(mId); fetchMeeting(); } catch {}
  }

  // Actions
  async function handleAddAction() {
    if (!newAction.title.trim()) return;
    try {
      await addMeetingActionItem(id, {
        title: newAction.title,
        assignedTo: newAction.assignedTo || undefined,
        dueDate: newAction.dueDate || undefined,
      });
      setNewAction({ title: "", assignedTo: "", dueDate: "" });
      fetchMeeting();
    } catch {}
  }
  async function handleToggleAction(aId: string, current: boolean) {
    try { await updateMeetingActionItem(aId, { isCompleted: !current }); fetchMeeting(); } catch {}
  }
  async function handleRemoveAction(aId: string) {
    try { await removeMeetingActionItem(aId); fetchMeeting(); } catch {}
  }

  const tabs: { key: Tab; label: string; icon: string; count?: number }[] = [
    { key: "details", label: "التفاصيل", icon: "📋" },
    { key: "attendees", label: "الحضور", icon: "👥", count: meeting.attendees?.length },
    { key: "agenda", label: "جدول الأعمال", icon: "📝", count: meeting.agenda?.length },
    { key: "minutes", label: "المحضر", icon: "📄", count: meeting.minutes?.length },
    { key: "actions", label: "المهام", icon: "✅", count: meeting.actionItems?.length },
  ];

  const totalAgendaDuration = (meeting.agenda ?? []).reduce((s, a) => s + a.duration, 0);
  const completedAgenda = (meeting.agenda ?? []).filter(a => a.isCompleted).length;
  const completedActions = (meeting.actionItems ?? []).filter(a => a.isCompleted).length;

  return (
    <main className="flex-1 overflow-y-auto" dir="rtl" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur border-b px-4 sm:px-6 py-3 pr-14 md:pr-6" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => router.push("/meetings")} className="text-xs" style={{ color: "#5E5495" }}>← الاجتماعات</button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xl">{tp.icon}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-lg truncate" style={{ color: "var(--text)" }}>{meeting.title}</h2>
                <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${st.color}15`, color: st.color }}>{st.label}</span>
                {meeting.isPrivate && <span className="text-[9px]">🔒</span>}
              </div>
              <div className="flex items-center gap-2 text-[9px] flex-wrap" style={{ color: "var(--muted)" }}>
                <span>{startDate.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
                <span>{startDate.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</span>
                {meeting.endTime && <span>← {new Date(meeting.endTime).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</span>}
                <span>{tp.label}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-1.5">
            {meeting.meetingLink && <a href={meeting.meetingLink} target="_blank" rel="noopener" className="text-[9px] px-2 py-1.5 rounded-lg font-bold" style={{ background: "#3B82F615", color: "#3B82F6" }}>🔗 انضم</a>}
            {meeting.status === "scheduled" && <button onClick={handleComplete} className="text-[9px] px-2 py-1.5 rounded-lg font-bold" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>✅ تم</button>}
            {meeting.status === "scheduled" && <button onClick={handleCancel} className="text-[9px] px-2 py-1.5 rounded-lg" style={{ background: "#F59E0B15", color: "#F59E0B" }}>⏸ إلغاء</button>}
            <button onClick={handleDelete} className="text-[9px] px-2 py-1.5 rounded-lg" style={{ background: "#DC262610", color: "#DC2626" }}>🗑️</button>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mt-3 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition whitespace-nowrap flex items-center gap-1"
              style={{ background: tab === t.key ? "#5E5495" : "var(--bg)", color: tab === t.key ? "#fff" : "var(--muted)", border: `1px solid ${tab === t.key ? "#5E5495" : "var(--card-border)"}` }}>
              {t.icon} {t.label}
              {(t.count ?? 0) > 0 && <span className="text-[8px] px-1 rounded-full" style={{ background: tab === t.key ? "rgba(255,255,255,0.2)" : "var(--card-border)" }}>{t.count}</span>}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 max-w-3xl mx-auto space-y-4">

        {/* ═══ Details Tab ═══ */}
        {tab === "details" && (
          <>
            {!editing ? (
              <div className="rounded-2xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: "var(--text)" }}>معلومات الاجتماع</span>
                  <button onClick={() => setEditing(true)} className="text-[9px] px-2 py-1 rounded-lg" style={{ background: "#5E549515", color: "#5E5495" }}>✏️ تعديل</button>
                </div>
                {meeting.description && <p className="text-xs" style={{ color: "var(--text)" }}>{meeting.description}</p>}
                <div className="grid grid-cols-2 gap-2">
                  {meeting.location && <InfoItem label="المكان" value={`📍 ${meeting.location}`} />}
                  {meeting.platform && <InfoItem label="المنصة" value={meeting.platform} />}
                  {meeting.meetingLink && <InfoItem label="الرابط" value={<a href={meeting.meetingLink} target="_blank" rel="noopener" className="underline" style={{ color: "#3B82F6" }}>{meeting.meetingLink.substring(0, 40)}...</a>} />}
                  {meeting.recurrence && meeting.recurrence !== "none" && <InfoItem label="التكرار" value={({ daily: "يومي", weekly: "أسبوعي", monthly: "شهري" } as Record<string, string>)[meeting.recurrence] ?? meeting.recurrence} />}
                  {meeting.project && <InfoItem label="المشروع" value={meeting.project.title} />}
                  {meeting.work && <InfoItem label="العمل" value={meeting.work.name} />}
                  {meeting.circle && <InfoItem label="دائرة الحياة" value={meeting.circle.name} />}
                </div>
                {meeting.notes && (
                  <div>
                    <span className="text-[9px] font-bold block mb-0.5" style={{ color: "var(--muted)" }}>ملاحظات</span>
                    <p className="text-[10px] whitespace-pre-wrap" style={{ color: "var(--text)" }}>{meeting.notes}</p>
                  </div>
                )}
                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t" style={{ borderColor: "var(--card-border)" }}>
                  <StatBox icon="👥" label="حضور" value={meeting.attendees?.length ?? 0} />
                  <StatBox icon="📋" label="بنود" value={`${completedAgenda}/${meeting.agenda?.length ?? 0}`} />
                  <StatBox icon="✅" label="مهام" value={`${completedActions}/${meeting.actionItems?.length ?? 0}`} />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <span className="text-xs font-bold" style={{ color: "var(--text)" }}>تعديل الاجتماع</span>
                <input value={editData.title} onChange={e => setEditData({ ...editData, title: e.target.value })} placeholder="العنوان" className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={is} />
                <textarea value={editData.description} onChange={e => setEditData({ ...editData, description: e.target.value })} placeholder="الوصف" rows={2} className="w-full px-3 py-2 rounded-lg border text-xs resize-none focus:outline-none" style={is} />
                <div className="grid grid-cols-2 gap-2">
                  <input value={editData.location} onChange={e => setEditData({ ...editData, location: e.target.value })} placeholder="المكان" className="px-2 py-1.5 rounded-lg border text-xs" style={is} />
                  <input value={editData.platform} onChange={e => setEditData({ ...editData, platform: e.target.value })} placeholder="المنصة" className="px-2 py-1.5 rounded-lg border text-xs" style={is} />
                </div>
                <input value={editData.meetingLink} onChange={e => setEditData({ ...editData, meetingLink: e.target.value })} placeholder="رابط الاجتماع" className="w-full px-2 py-1.5 rounded-lg border text-xs" style={is} />
                <textarea value={editData.notes} onChange={e => setEditData({ ...editData, notes: e.target.value })} placeholder="ملاحظات" rows={2} className="w-full px-2 py-1.5 rounded-lg border text-xs resize-none focus:outline-none" style={is} />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg text-[10px]" style={{ color: "var(--muted)" }}>إلغاء</button>
                  <button onClick={saveEdit} className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white" style={{ background: "#5E5495" }}>حفظ</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ Attendees Tab ═══ */}
        {tab === "attendees" && (
          <div className="rounded-2xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold" style={{ color: "#5E5495" }}>👥 الحضور ({meeting.attendees?.length ?? 0})</span>
            </div>
            {/* Add attendee */}
            <div className="flex gap-1.5">
              <input value={newAttendee.name} onChange={e => setNewAttendee({ ...newAttendee, name: e.target.value })}
                onKeyDown={e => { if (e.key === "Enter") handleAddAttendee(); }}
                placeholder="اسم الحاضر" className="flex-1 px-2 py-1.5 rounded-lg border text-[10px] focus:outline-none" style={is} />
              <select value={newAttendee.role} onChange={e => setNewAttendee({ ...newAttendee, role: e.target.value })} className="px-1.5 py-1.5 rounded-lg border text-[10px]" style={is}>
                <option value="host">مضيف</option>
                <option value="attendee">حاضر</option>
                <option value="optional">اختياري</option>
              </select>
              <button onClick={handleAddAttendee} disabled={!newAttendee.name.trim()} className="px-3 py-1.5 rounded-lg text-[9px] font-bold text-white disabled:opacity-40" style={{ background: "#5E5495" }}>+</button>
            </div>
            {/* List */}
            <div className="space-y-1.5">
              {(meeting.attendees ?? []).map(a => {
                const as_ = ATTEND_STATUS[a.status] ?? ATTEND_STATUS.invited;
                return (
                  <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: "var(--bg)" }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "#5E5495" }}>
                      {a.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: "var(--text)" }}>{a.name}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px]" style={{ color: "var(--muted)" }}>{ROLE_MAP[a.role] ?? a.role}</span>
                        <span className="text-[8px] px-1 rounded" style={{ background: `${as_.color}15`, color: as_.color }}>{as_.label}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {a.status === "invited" && (
                        <>
                          <button onClick={() => handleUpdateAttendeeStatus(a.id, "confirmed")} className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>تأكيد</button>
                          <button onClick={() => handleUpdateAttendeeStatus(a.id, "declined")} className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: "#DC262615", color: "#DC2626" }}>رفض</button>
                        </>
                      )}
                      {meeting.status === "completed" && a.status !== "attended" && a.status !== "absent" && (
                        <>
                          <button onClick={() => handleUpdateAttendeeStatus(a.id, "attended")} className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: "#3D8C5A15", color: "#3D8C5A" }}>حضر</button>
                          <button onClick={() => handleUpdateAttendeeStatus(a.id, "absent")} className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: "#DC262615", color: "#DC2626" }}>غائب</button>
                        </>
                      )}
                      <button onClick={() => handleRemoveAttendee(a.id)} className="text-[8px] px-1 rounded" style={{ color: "#DC2626" }}>✕</button>
                    </div>
                  </div>
                );
              })}
              {(meeting.attendees ?? []).length === 0 && <p className="text-center text-[10px] py-4" style={{ color: "var(--muted)" }}>لا يوجد حضور</p>}
            </div>
          </div>
        )}

        {/* ═══ Agenda Tab ═══ */}
        {tab === "agenda" && (
          <div className="rounded-2xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold" style={{ color: "#D4AF37" }}>📝 جدول الأعمال ({completedAgenda}/{meeting.agenda?.length ?? 0})</span>
              <span className="text-[9px]" style={{ color: "var(--muted)" }}>⏱ {totalAgendaDuration} دقيقة</span>
            </div>
            {/* Progress bar */}
            {(meeting.agenda?.length ?? 0) > 0 && (
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(completedAgenda / (meeting.agenda?.length || 1)) * 100}%`, background: "#D4AF37" }} />
              </div>
            )}
            {/* Add */}
            <div className="flex gap-1.5">
              <input value={newAgenda.title} onChange={e => setNewAgenda({ ...newAgenda, title: e.target.value })}
                onKeyDown={e => { if (e.key === "Enter") handleAddAgenda(); }}
                placeholder="بند جديد" className="flex-1 px-2 py-1.5 rounded-lg border text-[10px] focus:outline-none" style={is} />
              <input value={newAgenda.duration} onChange={e => setNewAgenda({ ...newAgenda, duration: e.target.value })} type="number" placeholder="د" className="w-14 px-2 py-1.5 rounded-lg border text-[10px] text-center" style={is} />
              <button onClick={handleAddAgenda} disabled={!newAgenda.title.trim()} className="px-3 py-1.5 rounded-lg text-[9px] font-bold text-white disabled:opacity-40" style={{ background: "#D4AF37" }}>+</button>
            </div>
            {/* List */}
            <div className="space-y-1">
              {(meeting.agenda ?? []).map((a, i) => (
                <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: "var(--bg)" }}>
                  <button onClick={() => handleToggleAgenda(a.id, a.isCompleted)} className="text-sm">{a.isCompleted ? "✅" : "⬜"}</button>
                  <span className="text-[9px] font-bold w-5 text-center" style={{ color: "var(--muted)" }}>{i + 1}</span>
                  <span className={`flex-1 text-xs ${a.isCompleted ? "line-through opacity-50" : ""}`} style={{ color: "var(--text)" }}>{a.title}</span>
                  <span className="text-[9px] px-1.5 rounded" style={{ background: "#D4AF3715", color: "#D4AF37" }}>{a.duration}د</span>
                  <button onClick={() => handleRemoveAgenda(a.id)} className="text-[8px]" style={{ color: "#DC2626" }}>✕</button>
                </div>
              ))}
              {(meeting.agenda ?? []).length === 0 && <p className="text-center text-[10px] py-4" style={{ color: "var(--muted)" }}>لا توجد بنود</p>}
            </div>
          </div>
        )}

        {/* ═══ Minutes Tab ═══ */}
        {tab === "minutes" && (
          <div className="rounded-2xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <span className="text-xs font-bold" style={{ color: "#3D8C5A" }}>📄 محضر الاجتماع ({meeting.minutes?.length ?? 0})</span>
            {/* Add */}
            <div className="flex gap-1.5">
              <input value={newMinute} onChange={e => setNewMinute(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAddMinute(); }}
                placeholder="أضف ملاحظة للمحضر..." className="flex-1 px-2 py-1.5 rounded-lg border text-[10px] focus:outline-none" style={is} />
              <button onClick={handleAddMinute} disabled={!newMinute.trim()} className="px-3 py-1.5 rounded-lg text-[9px] font-bold text-white disabled:opacity-40" style={{ background: "#3D8C5A" }}>+</button>
            </div>
            {/* List */}
            <div className="space-y-1.5">
              {(meeting.minutes ?? []).map(mn => (
                <div key={mn.id} className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--bg)" }}>
                  <div className="flex-1">
                    <p className="text-xs whitespace-pre-wrap" style={{ color: "var(--text)" }}>{mn.content}</p>
                    <p className="text-[8px] mt-0.5" style={{ color: "var(--muted)" }}>{new Date(mn.createdAt).toLocaleString("ar-SA")}</p>
                  </div>
                  <button onClick={() => handleRemoveMinute(mn.id)} className="text-[8px] mt-0.5" style={{ color: "#DC2626" }}>✕</button>
                </div>
              ))}
              {(meeting.minutes ?? []).length === 0 && <p className="text-center text-[10px] py-4" style={{ color: "var(--muted)" }}>لا توجد ملاحظات</p>}
            </div>
          </div>
        )}

        {/* ═══ Action Items Tab ═══ */}
        {tab === "actions" && (
          <div className="rounded-2xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold" style={{ color: "#5E5495" }}>✅ المهام الناتجة ({completedActions}/{meeting.actionItems?.length ?? 0})</span>
            </div>
            {/* Progress */}
            {(meeting.actionItems?.length ?? 0) > 0 && (
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(completedActions / (meeting.actionItems?.length || 1)) * 100}%`, background: "#5E5495" }} />
              </div>
            )}
            {/* Add */}
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                <input value={newAction.title} onChange={e => setNewAction({ ...newAction, title: e.target.value })}
                  onKeyDown={e => { if (e.key === "Enter") handleAddAction(); }}
                  placeholder="عنوان المهمة" className="flex-1 px-2 py-1.5 rounded-lg border text-[10px] focus:outline-none" style={is} />
                <button onClick={handleAddAction} disabled={!newAction.title.trim()} className="px-3 py-1.5 rounded-lg text-[9px] font-bold text-white disabled:opacity-40" style={{ background: "#5E5495" }}>+</button>
              </div>
              <div className="flex gap-1.5">
                <input value={newAction.assignedTo} onChange={e => setNewAction({ ...newAction, assignedTo: e.target.value })} placeholder="المسؤول (اختياري)" className="flex-1 px-2 py-1.5 rounded-lg border text-[10px]" style={is} />
                <input type="date" value={newAction.dueDate} onChange={e => setNewAction({ ...newAction, dueDate: e.target.value })} className="px-2 py-1.5 rounded-lg border text-[10px]" style={is} />
              </div>
            </div>
            {/* List */}
            <div className="space-y-1.5">
              {(meeting.actionItems ?? []).map(ai => (
                <div key={ai.id} className="flex items-center gap-2 px-2 py-2 rounded-lg" style={{ background: "var(--bg)" }}>
                  <button onClick={() => handleToggleAction(ai.id, ai.isCompleted)} className="text-sm">{ai.isCompleted ? "✅" : "⬜"}</button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${ai.isCompleted ? "line-through opacity-50" : ""}`} style={{ color: "var(--text)" }}>{ai.title}</p>
                    <div className="flex items-center gap-2">
                      {ai.assignedTo && <span className="text-[8px]" style={{ color: "#5E5495" }}>👤 {ai.assignedTo}</span>}
                      {ai.dueDate && <span className="text-[8px]" style={{ color: new Date(ai.dueDate) < new Date() && !ai.isCompleted ? "#DC2626" : "var(--muted)" }}>📅 {new Date(ai.dueDate).toLocaleDateString("ar-SA")}</span>}
                    </div>
                  </div>
                  <button onClick={() => handleRemoveAction(ai.id)} className="text-[8px]" style={{ color: "#DC2626" }}>✕</button>
                </div>
              ))}
              {(meeting.actionItems ?? []).length === 0 && <p className="text-center text-[10px] py-4" style={{ color: "var(--muted)" }}>لا توجد مهام</p>}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-[9px] font-bold block" style={{ color: "var(--muted)" }}>{label}</span>
      <span className="text-[10px]" style={{ color: "var(--text)" }}>{value}</span>
    </div>
  );
}

function StatBox({ icon, label, value }: { icon: string; label: string; value: number | string }) {
  return (
    <div className="text-center py-2 rounded-lg" style={{ background: "var(--bg)" }}>
      <p className="text-sm">{icon}</p>
      <p className="text-xs font-bold" style={{ color: "var(--text)" }}>{value}</p>
      <p className="text-[8px]" style={{ color: "var(--muted)" }}>{label}</p>
    </div>
  );
}
