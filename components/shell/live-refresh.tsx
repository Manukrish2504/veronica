"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-render server components on a timer so agent progress shows up without a reload. */
export function LiveRefresh({ busy }: { busy: boolean }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, busy ? 4000 : 30_000);
    return () => clearInterval(t);
  }, [busy, router]);
  return null;
}
