"use client";

import { useState } from "react";
import { api } from "@/lib/api";

const PRIORITY_OPTIONS = [
  { value: 5, label: "عالية جداً" },
  { value: 4, label: "عالية" },
  { value: 3, label: "متوسطة" },
  { value: 2, label: "منخفضة" },
  { value: 1, label: "منخفضة جداً" },
];

const TASK_CONTEXTS = [
  { key: "Anywhere", label: "أي مكان", icon: "🌐" },
  { key: "Office",   label: "مكتب",   icon: "🏢" },
  { key: "Home",     label: "منزل",   icon: "🏠" },
  { key: "Phone",    label: "اتصال",  icon: "📞" },
  { key: "Online",   label: "أونلاين", icon: "💻" },
  { key: "Car",      label: "مشوار",  icon: "🚗" },
];

export interface EditableTask {
  id: string;
  title: string;
  description?: string;
  priority: string;
  circle: string;
  circleColor?: string;
  isWork: boolean;
  isUrgent: boolean;
  isRecurring: boolean;
  dueDate?: string;
  context: string;
}

export default function EditTaskDialog({ task, onClose, onSaved }: {
  task: EditableTask; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [desc, setDesc] = useState(task.description ?? "");
  const [context, setContext] = useState(task.context ?? "Anywhere");
  const [priority, setPriority] = useState<number>(task.priority === "عالية" ? 4 : task.priority === "متوسطة" ? 3 : 2);
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [isWork, setIsWork] = useState(task.isWork);
  const [isUrgent, setIsUrgent] = useState(task.isUrgent);
  const [isRecurring, setIsRecurring] = useState(task.isRecurring);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!title.trim()) return;
    setLoading(true); setError("");
    try {
      await api.patch(`/api/tasks/${task.id}/status`, { status: "Cancelled" });
      await api.post("/api/tasks", {
        title: title.trim(),
        description: desc.trim() || undefined,
        userPriority: priority,
        dueDate: dueDate || undefined,
        taskContext: context !== "Anywhere" ? context : undefined,
        isWorkTask: isWork || undefined,
        isUrgent: isUrgent || undefined,
        isRecurring: isRecurring || undefined,
      });
      onSaved();
      onClose();
    } catch { setError("فشل الحفظ"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto fade-up"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
        <div className="flex items-center justify-between px-6 pt-6 pb-3" style={{ borderBottom: "1px solid var(--card-border)" }}>
          <h3 className="font-bold" style={{ color: "var(--text)" }}>✏️ تعديل المهمة</h3>
          <button onClick={onClose} style={{ color: "var(--muted)" }}>✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text)" }}>العنوان</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
              style={{ background: "var(--bg)", border: "1px solid var(--card-border)", color: "var(--text)" }} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text)" }}>التفاصيل</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
              className="w-full px-4 py-2.5 rounded-xl text-sm resize-none focus:outline-none"
              style={{ background: "var(--bg)", border: "1px solid var(--card-border)", color: "var(--text)" }} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>الأولوية</label>
            <div className="flex gap-1.5">
              {PRIORITY_OPTIONS.map((p) => (
                <button key={p.value} onClick={() => setPriority(p.value)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium transition"
                  style={{ background: priority === p.value ? "#5E5495" : "var(--bg)", color: priority === p.value ? "#fff" : "var(--muted)", border: `1px solid ${priority === p.value ? "#5E5495" : "var(--card-border)"}` }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>بيئة المهمة</label>
            <div className="flex gap-1.5 flex-wrap">
              {TASK_CONTEXTS.map((c) => (
                <button key={c.key} onClick={() => setContext(c.key)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition"
                  style={{ background: context === c.key ? "#5E5495" : "var(--bg)", color: context === c.key ? "#fff" : "var(--muted)", border: `1px solid ${context === c.key ? "#5E5495" : "var(--card-border)"}` }}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text)" }}>تاريخ الاستحقاق</label>
            <input type="date" value={dueDate ? dueDate.slice(0, 10) : ""} onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
              style={{ background: "var(--bg)", border: "1px solid var(--card-border)", color: "var(--text)" }} />
          </div>
          <div className="flex gap-3 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isWork} onChange={() => setIsWork(!isWork)} className="accent-[#5E5495]" />
              <span className="text-xs" style={{ color: "var(--text)" }}>💼 عمل</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isUrgent} onChange={() => setIsUrgent(!isUrgent)} className="accent-red-500" />
              <span className="text-xs" style={{ color: "var(--text)" }}>🔴 ملحة</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isRecurring} onChange={() => setIsRecurring(!isRecurring)} className="accent-purple-500" />
              <span className="text-xs" style={{ color: "var(--text)" }}>🔄 مكررة</span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--muted)" }}>الدائرة:</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: task.circleColor ? `${task.circleColor}15` : "var(--bg)", color: task.circleColor ?? "var(--text)" }}>
              {task.circle}
            </span>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--bg)", color: "var(--muted)" }}>إلغاء</button>
            <button onClick={save} disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}>
              {loading ? "جارٍ الحفظ…" : "حفظ التعديلات"}
            </button>
          </div>
          <button onClick={async () => {
            if (!confirm("حذف هذه المهمة نهائياً؟")) return;
            try { await api.patch(`/api/tasks/${task.id}/status`, { status: "Cancelled" }); onSaved(); onClose(); } catch {}
          }}
            className="w-full py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-50 transition" style={{ border: "1px solid #FCA5A530" }}>
            🗑️ حذف المهمة
          </button>
        </div>
      </div>
    </div>
  );
}
