"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Icon } from "@/components/mt/icon";
import { cn } from "@/lib/utils";

const SKINS = [
  { id: "light", label: "Violet Lite", description: "The paper look with violet warmth", bg: "#FBFAF7", card: "#ffffff", accent: "#6D28D9", line: "#E1E3DD" },
  { id: "dark", label: "Midnight", description: "After-hours dark with a violet aurora", bg: "#101411", card: "#161A17", accent: "#C4B5FD", line: "#2A2E2B" },
];

/** MT_v2 Settings → Appearance picker. */
export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const current = mounted ? theme ?? "light" : "light";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {SKINS.map((s) => {
        const active = current === s.id;
        return (
          <button key={s.id} type="button" onClick={() => setTheme(s.id)} className={cn("state-layer text-left rounded-2xl border p-3 transition", active ? "border-primary ring-2 ring-primary/20" : "border-outline-variant hover:border-primary/40")}>
            <div className="h-24 rounded-xl border overflow-hidden p-3 flex flex-col gap-2" style={{ background: s.bg, borderColor: s.line }}>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: s.accent }} />
                <span className="h-1.5 w-14 rounded-full" style={{ background: s.accent, opacity: 0.55 }} />
              </div>
              <span className="h-2 w-3/4 rounded-full" style={{ background: s.accent, opacity: 0.4 }} />
              <span className="h-2 w-1/2 rounded-full" style={{ background: s.accent, opacity: 0.25 }} />
              <span className="mt-auto h-4 w-16 rounded-full" style={{ background: s.accent }} />
            </div>
            <span className="mt-3 flex items-start gap-2">
              <span className="min-w-0 flex-1">
                <span className="block text-[0.8125rem] font-medium">{s.label}</span>
                <span className="block text-[0.6875rem] text-muted-foreground mt-0.5">{s.description}</span>
              </span>
              {active && <Icon name="check_circle" size={18} filled className="text-primary shrink-0 mt-0.5" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
