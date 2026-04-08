"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let dest = "/habits";
      try {
        const { data } = await api.get("/api/users/me/type");
        if (data?.type === "web-employee") dest = "/web-projects";
      } catch {}
      if (!cancelled) router.replace(dest);
    })();
    return () => { cancelled = true; };
  }, [router]);
  return null;
}
