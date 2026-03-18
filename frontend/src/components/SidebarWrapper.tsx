'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

const AUTH_PATHS = ['/login', '/register'];

export default function SidebarWrapper() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) return null;

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-3 right-3 z-50 w-10 h-10 rounded-xl flex items-center justify-center text-white md:hidden"
        style={{ background: "#1A1A2E" }}
      >
        ☰
      </button>

      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile overlay sidebar */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative w-64 h-full" onClick={() => setOpen(false)}>
            <Sidebar />
          </div>
        </div>
      )}
    </>
  );
}
