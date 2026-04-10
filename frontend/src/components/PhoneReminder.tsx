"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export default function PhoneReminder() {
  const [show, setShow] = useState(false);
  const [hours, setHours] = useState("");
  const [mins, setMins] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("madar_phone_reminded")) return;

    // Don't run on login/register pages or if no token
    const path = window.location.pathname;
    if (path.startsWith("/login") || path.startsWith("/register")) return;
    const token = document.cookie.includes("madar_token") || !!localStorage.getItem("accessToken");
    if (!token) return;

    // Check if yesterday's log exists
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;

    api.get("/api/phone-addiction/logs?days=3").then(({ data }) => {
      const logs = Array.isArray(data) ? data : [];
      const hasYesterday = logs.some((l: { date?: string }) => l.date?.startsWith(yesterday));
      if (!hasYesterday) setShow(true);
    }).catch(() => {});
  }, []);

  async function save() {
    const actual = (Number(hours) || 0) * 60 + (Number(mins) || 0);
    if (actual === 0) return;
    setSaving(true);
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
    try {
      await api.post("/api/phone-addiction/logs", { date: yesterday, actualMinutes: actual, targetMinutes: 120 });
    } catch {}
    dismiss();
  }

  function dismiss() {
    sessionStorage.setItem("madar_phone_reminded", "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-sm mx-4 mb-4 sm:mb-0 rounded-2xl shadow-2xl overflow-hidden" dir="rtl" style={{ background: "var(--card, #fff)" }}>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📵</span>
            <div>
              <p className="font-bold text-sm" style={{ color: "var(--text)" }}>كم استخدمت الجوال أمس؟</p>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>سجّل استخدامك لتتبع تقدمك</p>
            </div>
          </div>

          <div className="flex gap-3 items-center justify-center">
            <div className="text-center">
              <input type="number" value={hours} onChange={e => setHours(e.target.value)} min="0" max="24" placeholder="0"
                className="w-16 h-14 rounded-xl border text-center text-2xl font-black focus:outline-none"
                style={{ borderColor: "#DC262640", color: "#DC2626", background: "var(--bg)" }} />
              <p className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>ساعة</p>
            </div>
            <span className="text-xl font-bold" style={{ color: "var(--muted)" }}>:</span>
            <div className="text-center">
              <input type="number" value={mins} onChange={e => setMins(e.target.value)} min="0" max="59" placeholder="0"
                className="w-16 h-14 rounded-xl border text-center text-2xl font-black focus:outline-none"
                style={{ borderColor: "#DC262640", color: "#DC2626", background: "var(--bg)" }} />
              <p className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>دقيقة</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={save} disabled={saving || ((Number(hours) || 0) === 0 && (Number(mins) || 0) === 0)}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #DC2626, #5E5495)" }}>
              {saving ? "جارٍ الحفظ..." : "حفظ ✓"}
            </button>
            <button onClick={dismiss} className="px-4 py-3 rounded-xl text-sm font-medium" style={{ color: "var(--muted)" }}>
              لاحقاً
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
