'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

const AUTH_PATHS = ['/login', '/register'];

export default function SidebarWrapper() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // إغلاق القائمة عند الانتقال لصفحة جديدة
  useEffect(() => { setOpen(false); }, [pathname]);

  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) return null;

  return (
    <>
      {/* Toggle button — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed top-2 right-2 z-[80] w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg touch-manipulation transition-transform"
        style={{ background: "#1A1A2E" }}
        aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
      >
        {open ? "✕" : "☰"}
      </button>

      {/* Overlay + Sidebar */}
      {open && (
        <div className="fixed inset-0 z-[70]">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          {/* Sidebar panel */}
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
