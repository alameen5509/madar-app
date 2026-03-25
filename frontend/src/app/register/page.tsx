"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EightPointedStar, GeometricDivider } from "@/components/IslamicPattern";
import { register } from "@/lib/api";

// ─── Full-page Islamic background pattern ────────────────────────────────────
function FullPagePattern() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <pattern
          id="register-girih"
          x="0"
          y="0"
          width="80"
          height="80"
          patternUnits="userSpaceOnUse"
        >
          <polygon
            points="40,4 72,22 72,58 40,76 8,58 8,22"
            fill="none"
            stroke="white"
            strokeWidth="0.6"
          />
          <polygon
            points="40,16 62,28 62,52 40,64 18,52 18,28"
            fill="none"
            stroke="white"
            strokeWidth="0.6"
          />
          <line x1="40" y1="4"  x2="40" y2="16" stroke="white" strokeWidth="0.6" />
          <line x1="72" y1="22" x2="62" y2="28" stroke="white" strokeWidth="0.6" />
          <line x1="72" y1="58" x2="62" y2="52" stroke="white" strokeWidth="0.6" />
          <line x1="40" y1="76" x2="40" y2="64" stroke="white" strokeWidth="0.6" />
          <line x1="8"  y1="58" x2="18" y2="52" stroke="white" strokeWidth="0.6" />
          <line x1="8"  y1="22" x2="18" y2="28" stroke="white" strokeWidth="0.6" />
          <polygon
            points="40,22 43,31 52,28 45,35 52,42 43,39 40,48 37,39 28,42 35,35 28,28 37,31"
            fill="none"
            stroke="white"
            strokeWidth="0.6"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#register-girih)" />
    </svg>
  );
}

// ─── Input field ──────────────────────────────────────────────────────────────
let regFieldId = 0;
function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  hint,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
}) {
  const id = `field-reg-${type}-${++regFieldId}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-white/70 font-medium">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        aria-required="true"
        aria-label={label}
        minLength={type === "password" ? 8 : undefined}
        className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30
                   bg-white/[0.07] border border-white/10
                   focus:outline-none focus:border-[#C9A84C]/60 focus:bg-white/10
                   transition-all duration-200"
      />
      {hint && <p className="text-xs text-white/30">{hint}</p>}
    </div>
  );
}

// ─── Strength indicator ───────────────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  const score =
    (password.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/[0-9]/.test(password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0);

  if (!password) return null;

  const levels = [
    { label: "ضعيفة",    color: "#ef4444" },
    { label: "مقبولة",   color: "#f97316" },
    { label: "جيدة",     color: "#eab308" },
    { label: "قوية",     color: "#22c55e" },
  ];
  const { label, color } = levels[Math.max(0, score - 1)];

  return (
    <div className="flex items-center gap-2 mt-1">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-1 flex-1 rounded-full transition-all duration-300"
          style={{ background: i <= score ? color : "rgba(255,255,255,0.1)" }}
        />
      ))}
      <span className="text-xs" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName]       = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [confirm, setConfirm]         = useState("");
  const [role, setRole]               = useState<"User" | "BusinessOwner">("User");
  const [error, setError]             = useState("");
  const [success, setSuccess]         = useState(false);
  const [loading, setLoading]         = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("كلمة المرور: 8 أحرف على الأقل، حرف كبير ورقم");
      return;
    }

    setLoading(true);

    try {
      const data = await register(fullName, email, password, role);

      if (!data.succeeded) {
        setError(data.errors?.[0] ?? "حدث خطأ أثناء إنشاء الحساب");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 1800);
    } catch {
      setError("تعذّر الاتصال بالخادم، يرجى المحاولة لاحقاً");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="relative min-h-screen w-screen flex items-center justify-center overflow-hidden fixed inset-0 z-10"
      style={{ background: "linear-gradient(145deg, #1e1b38 0%, #2A2542 60%, #1a1730 100%)" }}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.07]">
        <FullPagePattern />
      </div>

      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 45%, rgba(94,84,149,0.25) 0%, transparent 70%)",
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md mx-4 my-8 fade-up">
        <div
          className="rounded-2xl px-8 py-10 shadow-2xl"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(16px)",
          }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(135deg, #C9A84C, #E8C96A)" }}
            >
              <EightPointedStar size={30} color="#2A2542" />
            </div>
            <div className="text-center">
              <h1 className="text-white font-bold text-2xl leading-none">مدار</h1>
              <p className="text-white/40 text-xs mt-1">نظام إدارة الحياة الذكي</p>
            </div>
          </div>

          <GeometricDivider label="إنشاء حساب جديد" />

          {/* Success state */}
          {success ? (
            <div className="mt-8 flex flex-col items-center gap-4 text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}
              >
                <span className="text-3xl text-green-400">✓</span>
              </div>
              <p className="text-white font-semibold">تم إنشاء الحساب بنجاح!</p>
              <p className="text-white/40 text-sm">جارٍ تحويلك لصفحة الدخول…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              {/* Account type selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-white/70 font-medium">نوع الحساب</label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { value: "User" as const, label: "مستخدم", icon: "👤" },
                    { value: "BusinessOwner" as const, label: "رجل أعمال", icon: "💼" },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRole(opt.value)}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm
                                 font-medium transition-all duration-200 border"
                      style={{
                        background: role === opt.value
                          ? "rgba(201,168,76,0.15)"
                          : "rgba(255,255,255,0.04)",
                        borderColor: role === opt.value
                          ? "rgba(201,168,76,0.5)"
                          : "rgba(255,255,255,0.1)",
                        color: role === opt.value
                          ? "#E8C96A"
                          : "rgba(255,255,255,0.5)",
                      }}
                    >
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Field
                label="الاسم الكامل"
                type="text"
                value={fullName}
                onChange={setFullName}
                placeholder="محمد العمري"
                autoComplete="name"
              />
              <Field
                label="البريد الإلكتروني"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="example@email.com"
                autoComplete="email"
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-white/70 font-medium">كلمة المرور</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30
                             bg-white/[0.07] border border-white/10
                             focus:outline-none focus:border-[#C9A84C]/60 focus:bg-white/10
                             transition-all duration-200"
                />
                <PasswordStrength password={password} />
              </div>
              <Field
                label="تأكيد كلمة المرور"
                type="password"
                value={confirm}
                onChange={setConfirm}
                placeholder="••••••••"
                autoComplete="new-password"
              />

              <div aria-live="polite" aria-atomic="true">
                {error && (
                  <p role="alert" className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5 text-center">
                    {error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full py-3 rounded-xl font-bold text-sm transition-all duration-200
                           disabled:opacity-60 disabled:cursor-not-allowed
                           hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  background: loading
                    ? "rgba(201,168,76,0.5)"
                    : "linear-gradient(135deg, #C9A84C, #E8C96A)",
                  color: "#1e1b38",
                }}
              >
                {loading ? "جارٍ الإنشاء…" : "إنشاء الحساب"}
              </button>
            </form>
          )}

          {!success && (
            <p className="mt-6 text-center text-sm text-white/40">
              لديك حساب بالفعل؟{" "}
              <Link
                href="/login"
                className="text-[#C9A84C] hover:text-[#E8C96A] transition-colors font-medium"
              >
                تسجيل الدخول
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
