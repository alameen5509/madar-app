"use client";

import { useState, useEffect } from "react";
import { GeometricDivider } from "@/components/IslamicPattern";
import { getContacts, createContact, deleteContact, formatPhoneForCall, formatPhoneForWhatsApp, type Contact } from "@/lib/api";

/* ─── Page ─────────────────────────────────────────────────────────────── */

export default function UsersPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactNotes, setNewContactNotes] = useState("");
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await getContacts();
      setContacts(res);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }

  async function addContact() {
    if (!newContactName.trim() || !newContactPhone.trim()) { setAddError("الاسم ورقم الجوال مطلوبان"); return; }
    setAddError(""); setAddSuccess("");
    try {
      await createContact({ name: newContactName.trim(), phone: newContactPhone.trim(), notes: newContactNotes.trim() || undefined });
      setAddSuccess(`تم إضافة ${newContactName.trim()}`);
      setNewContactName(""); setNewContactPhone(""); setNewContactNotes("");
      loadData();
    } catch (err: unknown) {
      const msg = (err && typeof err === "object" && "response" in err)
        ? ((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "فشل الإضافة") : "فشل الإضافة";
      setAddError(msg);
    }
  }

  async function removeContact(id: string, name: string) {
    if (!confirm(`حذف "${name}" من جهات الاتصال؟`)) return;
    try { await deleteContact(id); loadData(); } catch {}
  }

  /* ── Main View ── */
  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-gray-200 px-8 py-4 pr-16 md:pr-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[#16213E] font-bold text-lg">جهات الاتصال</h2>
            <p className="text-[#6B7280] text-xs">{contacts.length} جهة اتصال</p>
          </div>
          <button onClick={() => setShowAddContact(!showAddContact)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition"
            style={{ background: "#2ABFBF" }}>
            <span>+</span><span>جهة اتصال</span>
          </button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-5">
        {loading && <p className="text-center text-[#6B7280] text-sm py-8 animate-pulse">جارٍ التحميل...</p>}

        {showAddContact && (
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm fade-up space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-[#16213E]">إضافة جهة اتصال</p>
                <p className="text-[10px] text-[#6B7280]">اسم + رقم جوال — للتواصل السريع وربط بالمهام</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setShowAddContact(false); setAddError(""); setAddSuccess(""); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#6B7280] bg-gray-100">إلغاء</button>
                <button onClick={addContact} className="px-4 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "#2ABFBF" }}>إضافة</button>
              </div>
            </div>
            <input value={newContactName} onChange={(e) => setNewContactName(e.target.value)} placeholder="الاسم"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#2ABFBF]" />
            <input type="tel" value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} placeholder="رقم الجوال (مثال: 0512345678)"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#2ABFBF]" dir="ltr" />
            <input value={newContactNotes} onChange={(e) => setNewContactNotes(e.target.value)} placeholder="ملاحظات (اختياري)"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#2ABFBF]" />
            {addError && <p className="text-red-400 text-xs">{addError}</p>}
            {addSuccess && <p className="text-green-600 text-xs bg-green-50 rounded-lg px-3 py-2">{addSuccess}</p>}
          </div>
        )}

        {!loading && (
          <div className="bg-teal-50 rounded-xl p-4 border border-teal-200">
            <p className="text-teal-800 text-sm font-semibold mb-1">جهات الاتصال</p>
            <ul className="text-teal-600 text-xs space-y-1">
              <li>• أشخاص تتواصل معهم بدون حساب في النظام</li>
              <li>• ربطهم بالمهام لتسهيل الاتصال أو المراسلة عبر الواتساب</li>
              <li>• يمكنك استيرادهم من جهات الاتصال في تطبيق الجوال</li>
            </ul>
          </div>
        )}

        {!loading && contacts.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <p className="text-3xl mb-3">📱</p>
            <p className="text-[#16213E] font-semibold mb-1">لا توجد جهات اتصال</p>
            <p className="text-[#6B7280] text-xs">أضف أشخاصاً بأرقامهم للتواصل السريع</p>
          </div>
        )}

        {!loading && contacts.map((c) => (
          <div key={c.id} className="bg-white rounded-xl px-5 py-4 border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
              style={{ background: "#2ABFBF" }}>
              {c.name.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-[#16213E]">{c.name}</p>
              <p className="text-[10px] text-[#6B7280]" dir="ltr">{c.phone}</p>
              {c.notes && <p className="text-[9px] text-[#9CA3AF]">{c.notes}</p>}
              {c.taskCount > 0 && <p className="text-[9px] text-[#D4AF37]">{c.taskCount} مهمة مرتبطة</p>}
            </div>
            <div className="flex gap-2">
              <a href={formatPhoneForCall(c.phone)} className="w-9 h-9 rounded-full flex items-center justify-center text-lg hover:opacity-80 transition" style={{ background: "#3D8C5A20" }} title="اتصال">
                📞
              </a>
              <a href={formatPhoneForWhatsApp(c.phone)} target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-full flex items-center justify-center text-lg hover:opacity-80 transition" style={{ background: "#25D36620" }} title="واتساب">
                💬
              </a>
              <button onClick={() => removeContact(c.id, c.name)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm hover:opacity-80 transition" style={{ background: "#DC262610", color: "#DC2626" }}>
                ×
              </button>
            </div>
          </div>
        ))}

        <div className="pb-4"><GeometricDivider /></div>
      </div>
    </main>
  );
}
