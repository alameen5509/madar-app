"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { EightPointedStar, GeometricDivider } from "@/components/IslamicPattern";
import { api } from "@/lib/api";

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
          id="auth-girih"
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
      <rect width="100%" height="100%" fill="url(#auth-girih)" />
    </svg>
  );
}

// ─── Input field ──────────────────────────────────────────────────────────────
function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-white/70 font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30
                   bg-white/[0.07] border border-white/10
                   focus:outline-none focus:border-[#C9A84C]/60 focus:bg-white/10
                   transition-all duration-200"
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await api.post("/api/auth/login", { email, password });

      if (!data.succeeded) {
        setError(data.errors?.[0] ?? "بريد إلكتروني أو كلمة مرور غير صحيحة");
        return;
      }

      const accessToken  = data.data?.accessToken  ?? data.accessToken;
      const refreshToken = data.data?.refreshToken ?? data.refreshToken ?? "";
      localStorage.setItem("accessToken",  accessToken);
      localStorage.setItem("refreshToken", refreshToken);

      // Set cookie for middleware auth check
      document.cookie = `madar_token=${accessToken};path=/;max-age=86400;SameSite=Lax`;
      try {
        await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: accessToken }),
        });
      } catch {}

      // Small delay to ensure cookie is set before redirect
      await new Promise(r => setTimeout(r, 100));
      window.location.href = "/tasks";
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
            "radial-gradient(ellipse 70% 60% at 50% 40%, rgba(94,84,149,0.25) 0%, transparent 70%)",
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md mx-4 fade-up">
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

          <GeometricDivider label="تسجيل الدخول" />

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <Field
              label="البريد الإلكتروني"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="example@email.com"
              autoComplete="email"
            />
            <Field
              label="كلمة المرور"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              autoComplete="current-password"
            />

            {error && (
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5 text-center">
                {error}
              </p>
            )}

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
              {loading ? "جارٍ الدخول…" : "دخول"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-white/40">
            ليس لديك حساب؟{" "}
            <Link
              href="/register"
              className="text-[#C9A84C] hover:text-[#E8C96A] transition-colors font-medium"
            >
              إنشاء حساب
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
