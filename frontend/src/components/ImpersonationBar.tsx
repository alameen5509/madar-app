"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ImpersonationBar() {
  const [viewingName, setViewingName] = useState("");
  const pathname = usePathname();

  useEffect(() => {
    const check = () => {
      const data = localStorage.getItem("madar_viewing_user");
      if (data) {
        try {
          const parsed = JSON.parse(data);
          setViewingName(parsed.name || "");
        } catch { setViewingName(""); }
      } else {
        setViewingName("");
      }
    };
    check();
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, []);

  // فقط أظهر الشريط في صفحات غير /accounts/[userId]
  // (صفحة الاستعراض لديها شريطها الخاص)
  if (!viewingName || pathname.startsWith("/accounts/")) return null;

  const stopViewing = () => {
    localStorage.removeItem("madar_viewing_user");
    setViewingName("");
    window.location.href = "/accounts";
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        backgroundColor: "#FF6B35",
        color: "#FFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 20px",
        fontSize: "14px",
        fontWeight: 600,
        direction: "rtl",
      }}
    >
      <span>جارٍ استعراض صفحة {viewingName}</span>
      <button
        onClick={stopViewing}
        style={{
          background: "rgba(255,255,255,0.25)",
          border: "none",
          color: "#FFF",
          padding: "4px 14px",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: "13px",
        }}
      >
        إيقاف الاستعراض
      </button>
    </div>
  );
}
