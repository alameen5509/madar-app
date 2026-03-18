"use client";

import { useState, useEffect } from "react";
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

interface UserTask {
  id: string;
  title: string;
  status: string;
  userPriority: number;
  dueDate?: string;
}

interface UserGoal {
  id: string;
  title: string;
  status: string;
  progressPercent: number;
}

/* ─── Page ─────────────────────────────────────────────────────────────── */

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userTasks, setUserTasks] = useState<UserTask[]>([]);
  const [userGoals, setUserGoals] = useState<UserGoal[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPass, setNewPass] = useState("");
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  async function impersonateUser(user: User) {
    if (!confirm(`هل تريد الدخول كـ "${user.fullName}"؟`)) return;
    try {
      // Backup current admin tokens
      const adminAccessToken = localStorage.getItem("accessToken") || "";
      const adminRefreshToken = localStorage.getItem("refreshToken") || "";

      const { data } = await api.post(`/api/admin/impersonate/${user.id}`);
      // Store impersonation state
      localStorage.setItem("madar_impersonation", JSON.stringify({
        targetUserId: user.id,
        targetUserName: user.fullName,
        adminAccessToken,
        adminRefreshToken,
      }));
      // Set new tokens
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      document.cookie = `madar_token=${data.accessToken};path=/;max-age=${60 * 60}`;
      // Trigger storage event for ImpersonationBar
      window.dispatchEvent(new Event("storage"));
      // Reload to reflect new user
      window.location.href = "/tasks";
    } catch {
      alert("فشل استعراض المستخدم — تأكد من صلاحيات المدير");
    }
  }

  async function loadUsers() {
    setLoading(true);
    try {
      const { data } = await api.get<User[]>("/api/users");
      setUsers(data);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  async function viewUser(user: User) {
    setSelectedUser(user);
    setLoadingDetail(true);
    try {
      const [tasksRes, goalsRes] = await Promise.all([
        api.get<UserTask[]>(`/api/users/${user.id}/tasks`),
        api.get<UserGoal[]>(`/api/users/${user.id}/goals`),
      ]);
      setUserTasks(tasksRes.data);
      setUserGoals(goalsRes.data);
    } catch {} finally {
      setLoadingDetail(false);
    }
  }

  async function addUser() {
    if (!newEmail.trim() || !newName.trim() || !newPass.trim()) {
      setAddError("جميع الحقول مطلوبة");
      return;
    }
    setAddError(""); setAddSuccess("");
    try {
      await api.post("/auth/register", {
        fullName: newName.trim(),
        email: newEmail.trim(),
        password: newPass,
        role: "User",
      });
      setAddSuccess(`تم إنشاء حساب ${newName.trim()} بنجاح`);
      setNewEmail(""); setNewName(""); setNewPass("");
      loadUsers();
    } catch (err: unknown) {
      const msg = (err && typeof err === "object" && "response" in err)
        ? JSON.stringify((err as { response?: { data?: unknown } }).response?.data)
        : "فشل إنشاء الحساب";
      setAddError(String(msg));
    }
  }

  async function sendTaskToUser() {
    // Will use the existing assignTask API
  }

  const statusLabel: Record<string, string> = {
    Todo: "للعمل", InProgress: "قيد التنفيذ", Completed: "مكتملة", Deferred: "مؤجلة", Inbox: "وارد",
  };

  /* ── User Detail View ── */
  if (selectedUser) {
    const completedCount = userTasks.filter((t) => t.status === "Completed").length;
    const totalTasks = userTasks.length;
    const pct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

    return (
      <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedUser(null)} className="text-[#6B7280] hover:text-[#16213E] text-sm">← رجوع</button>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
                {selectedUser.fullName.charAt(0)}
              </div>
              <div>
                <h2 className="text-[#16213E] font-bold text-lg">{selectedUser.fullName}</h2>
                <p className="text-[#6B7280] text-xs">{selectedUser.email}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="px-8 py-6 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
              <p className="text-[10px] text-[#6B7280]">إجمالي المهام</p>
              <p className="text-2xl font-black text-[#2C2C54]">{totalTasks}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
              <p className="text-[10px] text-[#6B7280]">مكتملة</p>
              <p className="text-2xl font-black text-[#3D8C5A]">{completedCount}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
              <p className="text-[10px] text-[#6B7280]">نسبة الإنجاز</p>
              <p className="text-2xl font-black text-[#D4AF37]">{pct}%</p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 flex-wrap">
            <QuickAssignByName users={[selectedUser]} preselectedEmail={selectedUser.email} />
          </div>

          {loadingDetail && <p className="text-center text-[#6B7280] text-sm py-8 animate-pulse">جارٍ التحميل...</p>}

          {/* Tasks */}
          <GeometricDivider label={`مهام ${selectedUser.fullName}`} />
          {userTasks.length === 0 && !loadingDetail && (
            <p className="text-center text-[#9CA3AF] text-xs py-4">لا توجد مهام</p>
          )}
          <div className="space-y-1.5">
            {userTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-200">
                <div className={`w-4 h-4 rounded-full flex-shrink-0 border-2 flex items-center justify-center
                  ${t.status === "Completed" ? "bg-[#3D8C5A] border-[#3D8C5A]" : "border-[#D4AF37]"}`}>
                  {t.status === "Completed" && <span className="text-white text-[8px]">✓</span>}
                </div>
                <span className={`flex-1 text-sm ${t.status === "Completed" ? "line-through text-[#9CA3AF]" : "text-[#16213E]"}`}>{t.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-[#6B7280]">{statusLabel[t.status] ?? t.status}</span>
                {t.dueDate && <span className="text-[10px] text-[#9CA3AF]">{t.dueDate}</span>}
              </div>
            ))}
          </div>

          {/* Goals */}
          {userGoals.length > 0 && (
            <>
              <GeometricDivider label="أهداف المستخدم" />
              <div className="space-y-2">
                {userGoals.map((g) => (
                  <div key={g.id} className="bg-white rounded-xl px-5 py-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-[#16213E]">{g.title}</p>
                      <span className="text-xs font-bold text-[#D4AF37]">{g.progressPercent}%</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full bg-[#D4AF37]" style={{ width: `${g.progressPercent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="pb-4"><GeometricDivider /></div>
        </div>
      </main>
    );
  }

  /* ── Users List ── */
  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[#16213E] font-bold text-lg">المستخدمون</h2>
            <p className="text-[#6B7280] text-xs">إدارة الحسابات الرديفة ومتابعة الأعمال</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition"
            style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
            <span>+</span><span>مستخدم جديد</span>
          </button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-5">

        {/* Add user form */}
        {showAdd && (
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm fade-up space-y-3">
            <p className="font-bold text-sm text-[#16213E]">إنشاء حساب رديف</p>
            <p className="text-[10px] text-[#6B7280]">حساب بسيط — مهام فقط — تنبيهات عند حلول المهمة</p>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="اسم المستخدم"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="البريد الإلكتروني"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
            <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="كلمة المرور"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
            {addError && <p className="text-red-400 text-xs">{addError}</p>}
            {addSuccess && <p className="text-green-600 text-xs bg-green-50 rounded-lg px-3 py-2">{addSuccess}</p>}
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl text-sm text-[#6B7280] bg-gray-100">إلغاء</button>
              <button onClick={addUser} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#2C2C54" }}>إنشاء الحساب</button>
            </div>
          </div>
        )}

        {/* Quick assign - by name */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <p className="font-bold text-sm text-[#16213E] mb-3">إرسال مهمة سريعة</p>
          <p className="text-[10px] text-[#6B7280] mb-3">اختر المستخدم بالاسم وأرسل له مهمة</p>
          <QuickAssignByName users={users} />
        </div>

        {/* Info */}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-blue-800 text-sm font-semibold mb-1">نظام الحسابات الرديفة</p>
          <ul className="text-blue-600 text-xs space-y-1">
            <li>• حسابات بسيطة للأشخاص الذين تعمل معهم</li>
            <li>• إمكانية إضافة شخص لعدة مشاريع وأدوار</li>
            <li>• تنبيهات عند حلول وقت المهمة أو إضافة مهمة جديدة</li>
            <li>• تحويل المهام باختيار الحساب (وليس الإيميل)</li>
          </ul>
        </div>

        {loading && <p className="text-center text-[#6B7280] text-sm py-8 animate-pulse">جارٍ التحميل...</p>}

        {!loading && users.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <p className="text-3xl mb-3">👥</p>
            <p className="text-[#16213E] font-semibold mb-1">لا يوجد مستخدمون بعد</p>
            <p className="text-[#6B7280] text-xs">أنشئ حسابات رديفة لفريقك لمتابعة أعمالهم</p>
          </div>
        )}

        {users.map((u) => (
          <div key={u.id}
            onClick={() => viewUser(u)}
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
            <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${u.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {u.isActive ? "نشط" : "غير نشط"}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); impersonateUser(u); }}
              className="text-[10px] px-3 py-1.5 rounded-lg font-semibold text-white hover:opacity-90 transition"
              style={{ background: "#FF6B35" }}
              title="استعراض كـمستخدم"
            >
              👁 دخول
            </button>
            <span className="text-[#D4AF37] text-sm">←</span>
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
            <option key={u.id} value={u.email}>{u.fullName} ({u.email})</option>
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
