"use client";
import { useState, useEffect } from "react";

export default function ImpersonationBar() {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [targetName, setTargetName] = useState("");

  useEffect(() => {
    const check = () => {
      const data = localStorage.getItem("madar_impersonation");
      if (data) {
        const parsed = JSON.parse(data);
        setIsImpersonating(true);
        setTargetName(parsed.targetUserName || "");
      } else {
        setIsImpersonating(false);
      }
    };
    check();
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, []);

  const stopImpersonation = () => {
    const data = localStorage.getItem("madar_impersonation");
    if (data) {
      const parsed = JSON.parse(data);
      // Restore admin tokens
      if (parsed.adminAccessToken) {
        localStorage.setItem("accessToken", parsed.adminAccessToken);
        document.cookie = `madar_token=${parsed.adminAccessToken};path=/;max-age=${60 * 60 * 24}`;
      }
      if (parsed.adminRefreshToken) {
        localStorage.setItem("refreshToken", parsed.adminRefreshToken);
      }
      localStorage.removeItem("madar_impersonation");
      setIsImpersonating(false);
      window.location.href = "/users";
    }
  };

  if (!isImpersonating) return null;

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
      <span>أنت تستعرض: {targetName}</span>
      <button
        onClick={stopImpersonation}
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
