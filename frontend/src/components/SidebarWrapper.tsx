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
      {/* Mobile/tablet hamburger — visible below lg (1024px) */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-3 right-3 z-[60] w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg lg:hidden touch-manipulation"
        style={{ background: "#1A1A2E" }}
      >
        ☰
      </button>

      {/* Desktop sidebar — visible at lg+ */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile/tablet overlay sidebar */}
      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative h-full" style={{ width: "min(280px, 85vw)" }} onClick={() => setOpen(false)}>
            <button onClick={() => setOpen(false)}
              className="absolute top-3 left-3 z-10 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition touch-manipulation">
              ✕
            </button>
            <Sidebar />
          </div>
        </div>
      )}
    </>
  );
}
