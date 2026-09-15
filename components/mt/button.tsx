import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

type Variant = "filled" | "tonal" | "outlined" | "text" | "elevated";
type Size = "sm" | "md" | "lg";

const base =
  "state-layer inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all select-none disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background whitespace-nowrap";

const variants: Record<Variant, string> = {
  filled: "bg-primary text-primary-foreground hover:shadow-sm",
  tonal: "bg-primary-container text-primary-container-foreground",
  outlined: "border border-outline-variant text-foreground bg-transparent hover:bg-surface-1",
  text: "text-primary bg-transparent",
  elevated: "bg-card text-foreground shadow-sm hover:shadow",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[0.8125rem]",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-6 text-[0.9375rem]",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: string;
  iconFilled?: boolean;
  trailing?: ReactNode;
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "filled", size = "md", icon, iconFilled, trailing, className, children, asChild, ...rest },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {asChild ? children : (
        <>
          {icon && <Icon name={icon} filled={iconFilled} size={size === "sm" ? 16 : 18} />}
          {children}
          {trailing}
        </>
      )}
    </Comp>
  );
});

const iconButtonVariants = {
  standard: "text-foreground hover:bg-surface-2",
  filled: "bg-primary text-primary-foreground",
  tonal: "bg-primary-container text-primary-container-foreground",
  outlined: "border border-outline-variant text-foreground",
};

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; filled?: boolean; variant?: keyof typeof iconButtonVariants; size?: number; label: string }>(
  function IconButton({ icon, filled, variant = "standard", size = 40, label, className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        className={cn("state-layer inline-flex items-center justify-center rounded-full transition disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40", iconButtonVariants[variant], className)}
        style={{ width: size, height: size }}
        {...rest}
      >
        <Icon name={icon} filled={filled} size={Math.round(size * 0.55)} />
      </button>
    );
  },
);
