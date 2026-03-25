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
      {/* Hamburger — visible below xl (1280px), covers 1024x600 screens */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-2 right-2 z-[80] w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg xl:hidden touch-manipulation"
        style={{ background: "#1A1A2E" }}
      >
        ☰
      </button>

      {/* Desktop sidebar — visible at xl+ */}
      <div className="hidden xl:block">
        <Sidebar />
      </div>

      {/* Overlay sidebar for mobile/tablet */}
      {open && (
        <div className="fixed inset-0 z-[90] xl:hidden">
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
