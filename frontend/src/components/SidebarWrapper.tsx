'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';

const AUTH_PATHS = ['/login', '/register'];
const EMPLOYEE_PATHS = ['/web-projects', '/settings'];

export default function SidebarWrapper() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isWebEmployee, setIsWebEmployee] = useState(false);

  // Close sidebar on navigation
  useEffect(() => { setOpen(false); }, [pathname]);

  // Check if user is a web-projects-only employee
  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = async () => {
      try {
        const { api } = await import("@/lib/api");
        // Check if user owns any works/tasks (real user)
        const [tasks, works] = await Promise.all([
          api.get("/api/tasks").then(r => r.data?.length ?? 0).catch(() => 0),
          api.get("/api/works").then(r => r.data?.length ?? 0).catch(() => 0),
        ]);
        if (tasks === 0 && works === 0) {
          // Check if member in web projects
          const wp = await api.get("/api/web-projects").then(r => r.data?.length ?? 0).catch(() => 0);
          if (wp > 0) {
            setIsWebEmployee(true);
            // Redirect to web-projects if on wrong page
            if (!EMPLOYEE_PATHS.some(p => pathname.startsWith(p))) {
              router.replace("/web-projects");
            }
          }
        }
      } catch {}
    };
    check();
  }, [pathname, router]);

  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) return null;

  // Web employee: minimal nav
  if (isWebEmployee) {
    return (
      <>
        <button
          onClick={() => setOpen(o => !o)}
          className="fixed top-2 right-2 z-[80] w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg touch-manipulation"
          style={{ background: "#1A1A2E" }}
          aria-label={open ? "إغلاق" : "القائمة"}
        >
          {open ? "✕" : "☰"}
        </button>

        {open && (
          <div className="fixed inset-0 z-[70]">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <div className="absolute top-0 right-0 h-full p-4 space-y-3" dir="rtl"
              style={{ width: "min(280px, 85vw)", background: "#1A1A2E" }}>
              <div className="pt-12 space-y-2">
                <p className="text-white/40 text-[10px] px-4">القائمة</p>
                <button onClick={() => { router.push("/web-projects"); setOpen(false); }}
                  className="w-full text-right px-4 py-3 rounded-xl text-sm font-bold text-white transition"
                  style={{ background: pathname.startsWith("/web-projects") ? "#2D6B9E" : "transparent" }}>
                  🌐 إدارة المواقع
                </button>
                <button onClick={() => { router.push("/settings"); setOpen(false); }}
                  className="w-full text-right px-4 py-3 rounded-xl text-sm text-white/60 transition hover:bg-white/10">
                  ⚙ الإعدادات
                </button>
                <button onClick={() => {
                  document.cookie = "madar_token=; path=/; max-age=0";
                  localStorage.removeItem("refreshToken");
                  window.location.href = "/login";
                }}
                  className="w-full text-right px-4 py-3 rounded-xl text-sm text-red-400 transition hover:bg-red-500/10">
                  🚪 تسجيل الخروج
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed top-2 right-2 z-[80] w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg touch-manipulation transition-transform"
        style={{ background: "#1A1A2E" }}
        aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
      >
        {open ? "✕" : "☰"}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div
            className="absolute top-0 right-0 h-full animate-slideIn"
            style={{ width: "min(280px, 85vw)" }}
          >
            <Sidebar />
          </div>
        </div>
      )}
    </>
  );
}
