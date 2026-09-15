import { cn } from "@/lib/utils";

export function Avatar({ initials, size = 32, className }: { initials: string; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-white font-medium select-none", className)} style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
      {initials}
    </span>
  );
}
