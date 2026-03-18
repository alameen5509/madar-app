"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { EightPointedStar, GeometricDivider } from "@/components/IslamicPattern";

type Status = "idle" | "loading" | "success" | "error";

export default function WatchLoginPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleLink = async () => {
    const trimmed = code.replace(/\s/g, "");
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      setError("أدخل رمزاً مكوناً من 6 أرقام");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError("");
    try {
      const res = await api.post("/api/watch-auth/link", { code: trimmed });
      if (res.data?.succeeded) {
        setStatus("success");
      } else {
        setError(res.data?.message || "فشل الربط");
        setStatus("error");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { status?: number; data?: { message?: string } } })?.response?.data?.message
        || (err as { response?: { status?: number } })?.response?.status === 401
          ? "يجب تسجيل الدخول أولاً"
          : "رمز غير صالح أو منتهي الصلاحية";
      setError(msg);
      setStatus("error");
    }
  };

  return (
    <div
      className="relative min-h-screen w-screen flex items-center justify-center overflow-hidden fixed inset-0 z-10"
      style={{ background: "linear-gradient(145deg, #1e1b38 0%, #2A2542 60%, #1a1730 100%)" }}
    >
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
          {/* Header */}
          <div className="flex flex-col items-center gap-3 mb-6">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(135deg, #C9A84C, #E8C96A)" }}
            >
              <EightPointedStar size={30} color="#2A2542" />
            </div>
            <div className="text-center">
              <h1 className="text-white font-bold text-2xl leading-none">مدار</h1>
              <p className="text-white/40 text-xs mt-1">ربط ساعة Wear OS</p>
            </div>
          </div>

          <GeometricDivider label="ربط الساعة" />

          <div className="mt-6 flex flex-col items-center gap-5">
            {status === "success" ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(34,197,94,0.15)" }}
                >
                  <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-green-400 font-bold text-lg">تم ربط الساعة بنجاح</p>
                  <p className="text-white/40 text-sm mt-1">يمكنك الآن استخدام مدار من ساعتك</p>
                </div>
              </div>
            ) : (
              <>
                {/* Instructions */}
                <div className="w-full space-y-2">
                  {[
                    'افتح تطبيق مدار على الساعة',
                    'اضغط "ربط بالحساب"',
                    "أدخل الرمز المعروض على الساعة هنا",
                  ].map((step, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.05)" }}
                    >
                      <span
                        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: "rgba(201,168,76,0.2)", color: "#C9A84C" }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-white/70 text-sm">{step}</span>
                    </div>
                  ))}
                </div>

                {/* Code Input */}
                <div className="w-full">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={7}
                    placeholder="000 000"
                    value={code}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 6);
                      const formatted = raw.length > 3 ? raw.slice(0, 3) + " " + raw.slice(3) : raw;
                      setCode(formatted);
                      if (status === "error") setStatus("idle");
                    }}
                    className="w-full text-center text-3xl font-bold tracking-[0.3em] py-4 rounded-xl border-2 outline-none transition-colors"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      borderColor: status === "error" ? "rgba(239,68,68,0.5)" : "rgba(201,168,76,0.3)",
                      color: "#C9A84C",
                      caretColor: "#C9A84C",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "rgba(201,168,76,0.6)")}
                    onBlur={(e) =>
                      (e.target.style.borderColor =
                        status === "error" ? "rgba(239,68,68,0.5)" : "rgba(201,168,76,0.3)")
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleLink();
                    }}
                  />
                </div>

                {/* Error message */}
                {status === "error" && (
                  <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5 text-center">
                    {error}
                  </p>
                )}

                {/* Submit button */}
                <button
                  onClick={handleLink}
                  disabled={status === "loading" || code.replace(/\s/g, "").length < 6}
                  className="w-full py-3 rounded-xl font-bold text-sm transition-all duration-200
                             hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]
                             disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{
                    background: "linear-gradient(135deg, #C9A84C, #E8C96A)",
                    color: "#1e1b38",
                  }}
                >
                  {status === "loading" ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-[#1e1b38] border-t-transparent rounded-full animate-spin" />
                      جارٍ الربط...
                    </span>
                  ) : (
                    "ربط الساعة"
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
