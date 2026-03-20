"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GeometricDivider } from "@/components/IslamicPattern";
import { api } from "@/lib/api";

/* ─── Types ───────────────────────────────────────────────────────────── */

interface User {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

/* ─── Page ─────────────────────────────────────────────────────────────── */

export default function AccountsPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPass, setNewPass] = useState("");
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await api.get<User[]>("/api/users");
      setUsers(res.data);
    } catch { setUsers([]); }
    finally { setLoading(false); }
  }

  async function addUser() {
    if (!newEmail.trim() || !newName.trim() || !newPass.trim()) { setAddError("جميع الحقول مطلوبة"); return; }
    setAddError(""); setAddSuccess("");
    try {
      await api.post("/auth/register", { fullName: newName.trim(), email: newEmail.trim(), password: newPass, role: "User" });
      setAddSuccess(`تم إنشاء حساب ${newName.trim()} بنجاح`);
      setNewEmail(""); setNewName(""); setNewPass("");
      loadUsers();
    } catch (err: unknown) {
      const msg = (err && typeof err === "object" && "response" in err)
        ? JSON.stringify((err as { response?: { data?: unknown } }).response?.data) : "فشل إنشاء الحساب";
      setAddError(String(msg));
    }
  }

  async function toggleUserActive(user: User, e: React.MouseEvent) {
    e.stopPropagation();
    const newStatus = !user.isActive;
    const action = newStatus ? "تفعيل" : "تعطيل";
    if (!confirm(`${action} حساب "${user.fullName}"؟`)) return;
    try {
      await api.patch(`/api/users/${user.id}`, { isActive: newStatus });
      loadUsers();
    } catch { alert(`فشل ${action} الحساب`); }
  }

  async function deleteUser(user: User, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`هل تريد حذف حساب "${user.fullName}" نهائياً؟\n\nسيتم حذف جميع بياناته (مهام، عادات، أهداف..)`)) return;
    try {
      await api.delete(`/api/users/${user.id}`);
      loadUsers();
    } catch { alert("فشل حذف الحساب"); }
  }

  function viewUser(user: User) {
    // تخزين بيانات الاستعراض ثم الانتقال لصفحة العرض
    localStorage.setItem("madar_viewing_user", JSON.stringify({ id: user.id, name: user.fullName }));
    window.dispatchEvent(new Event("storage"));
    router.push(`/accounts/${user.id}`);
  }

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-gray-200 px-8 py-4 pr-16 md:pr-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[#16213E] font-bold text-lg">الحسابات</h2>
            <p className="text-[#6B7280] text-xs">{users.length} حساب مسجّل — المتابعة والتحكم</p>
          </div>
          <button onClick={() => setShowAddUser(!showAddUser)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition"
            style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
            <span>+</span><span>حساب جديد</span>
          </button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-5">
        {loading && <p className="text-center text-[#6B7280] text-sm py-8 animate-pulse">جارٍ التحميل...</p>}

        {showAddUser && (
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm fade-up space-y-3">
            <p className="font-bold text-sm text-[#16213E]">إنشاء حساب مستخدم</p>
            <p className="text-[10px] text-[#6B7280]">حساب كامل — مهام + إشعارات + متابعة</p>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="اسم المستخدم"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="البريد الإلكتروني"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
            <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="كلمة المرور"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
            {addError && <p className="text-red-400 text-xs">{addError}</p>}
            {addSuccess && <p className="text-green-600 text-xs bg-green-50 rounded-lg px-3 py-2">{addSuccess}</p>}
            <div className="flex gap-2">
              <button onClick={() => setShowAddUser(false)} className="flex-1 py-2.5 rounded-xl text-sm text-[#6B7280] bg-gray-100">إلغاء</button>
              <button onClick={addUser} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#2C2C54" }}>إنشاء الحساب</button>
            </div>
          </div>
        )}

        {!loading && (
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <p className="font-bold text-sm text-[#16213E] mb-3">إرسال مهمة سريعة</p>
            <QuickAssignByName users={users} />
          </div>
        )}

        {!loading && users.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <p className="text-3xl mb-3">👤</p>
            <p className="text-[#16213E] font-semibold mb-1">لا يوجد حسابات بعد</p>
            <p className="text-[#6B7280] text-xs">أنشئ حسابات لفريقك لمتابعة أعمالهم</p>
          </div>
        )}

        {!loading && users.map((u) => (
          <div key={u.id} onClick={() => viewUser(u)}
            className="bg-white rounded-xl px-5 py-4 border border-gray-200 shadow-sm cursor-pointer hover:border-[#D4AF37] transition flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
              style={{ background: u.isActive ? "linear-gradient(135deg, #2C2C54, #D4AF37)" : "#9CA3AF" }}>
              {u.fullName.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-[#16213E]">{u.fullName}</p>
              <p className="text-[10px] text-[#6B7280]">{u.email}</p>
              {u.lastLoginAt && <p className="text-[9px] text-[#9CA3AF]">آخر دخول: {new Date(u.lastLoginAt).toLocaleDateString("ar-SA")}</p>}
            </div>
            <button onClick={(e) => toggleUserActive(u, e)}
              className={`text-[10px] px-2 py-1 rounded-full font-semibold ${u.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {u.isActive ? "نشط" : "معطّل"}
            </button>
            <button onClick={(e) => deleteUser(u, e)}
              className="text-[10px] px-2 py-1 rounded-full font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition">
              حذف
            </button>
            <button onClick={(e) => { e.stopPropagation(); viewUser(u); }}
              className="text-[10px] px-3 py-1.5 rounded-lg font-semibold text-white hover:opacity-90 transition"
              style={{ background: "#FF6B35" }}>
              استعراض
            </button>
          </div>
        ))}

        <div className="pb-4"><GeometricDivider /></div>
      </div>
    </main>
  );
}

/* ─── Quick Assign By Name ─────────────────────────────────────────────── */

function QuickAssignByName({ users, preselectedEmail }: {
  users: { id: string; fullName: string; email: string }[];
  preselectedEmail?: string;
}) {
  const [selectedEmail, setSelectedEmail] = useState(preselectedEmail ?? "");
  const [title, setTitle]   = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState("");
  const [error, setError]     = useState("");

  async function submit() {
    const email = selectedEmail || preselectedEmail;
    if (!email || !title.trim()) { setError("اختر المستخدم واكتب عنوان المهمة"); return; }
    setLoading(true); setError(""); setResult("");
    try {
      const { assignTask } = await import("@/lib/api");
      const res = await assignTask(email, title.trim());
      setResult(res.message);
      setTitle("");
    } catch (err: unknown) {
      const msg = (err && typeof err === "object" && "response" in err)
        ? ((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "فشل الإرسال")
        : "فشل الإرسال";
      setError(msg);
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-2 w-full">
      {!preselectedEmail && (
        <select value={selectedEmail} onChange={(e) => setSelectedEmail(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]">
          <option value="">اختر المستخدم…</option>
          {users.map((u) => (
            <option key={u.id} value={u.email}>{u.fullName}</option>
          ))}
        </select>
      )}
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان المهمة…"
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {result && <p className="text-green-600 text-xs bg-green-50 rounded-lg px-3 py-2">{result}</p>}
      <button onClick={submit} disabled={loading}
        className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
        style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
        {loading ? "جارٍ الإرسال…" : "إرسال المهمة"}
      </button>
    </div>
  );
}
