import { cn } from "@/lib/utils";

/** Material Symbols Rounded ligature icon (MT_v2 primitives/Icon.tsx). */
export function Icon({ name, filled, size = 20, weight = 400, className }: { name: string; filled?: boolean; size?: number; weight?: 300 | 400 | 500 | 600; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("msr select-none", filled && "filled", className)}
      style={{ fontSize: size, fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size}` }}
    >
      {name}
    </span>
  );
}
