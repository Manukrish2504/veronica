import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

/** MD3 chip (MT_v2 primitives/Chip.tsx). */
export function Chip({ selected, icon, trailing, variant = "assist", className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; icon?: string; trailing?: ReactNode; variant?: "assist" | "filter" | "suggestion" }) {
  return (
    <button
      type="button"
      className={cn(
        "state-layer inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[0.8125rem] font-medium transition border whitespace-nowrap",
        selected ? "bg-secondary-container text-secondary-container-foreground border-transparent" : "border-outline-variant text-foreground bg-transparent",
        variant === "suggestion" && !selected && "bg-surface-1 border-transparent",
        className,
      )}
      {...rest}
    >
      {selected && <Icon name="check" size={16} />}
      {!selected && icon && <Icon name={icon} size={16} />}
      <span>{children}</span>
      {trailing}
    </button>
  );
}

/** Pill chip as used on the MT landing (rounded-full, outlined). */
export function PillChip({ icon, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: string }) {
  return (
    <button type="button" className={cn("state-layer inline-flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-full border border-outline-variant bg-card/70 text-[0.75rem] font-medium text-foreground transition whitespace-nowrap", className)} {...rest}>
      {icon && <Icon name={icon} size={15} />}
      {children}
    </button>
  );
}
