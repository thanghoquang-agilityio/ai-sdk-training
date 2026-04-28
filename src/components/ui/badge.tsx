import type { HTMLAttributes } from "react";
import { cn } from "@/utils/class-name";

const BADGE_VARIANT_CLASSES = {
  neutral: "border-white/20 bg-white/8 text-white/80",
  subtle: "border-white/16 bg-white/5 text-white/62",
  brand: "border-violet-400/35 bg-violet-500/16 text-violet-200",
  info: "border-cyan-400/30 bg-cyan-500/14 text-cyan-100",
  success: "border-emerald-400/35 bg-emerald-500/15 text-emerald-100",
  warning: "border-amber-300/35 bg-amber-500/15 text-amber-100",
  danger: "border-rose-400/35 bg-rose-500/15 text-rose-100",
} as const;

const BADGE_SIZE_CLASSES = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-0.5 text-[11px]",
  lg: "px-3 py-1 text-xs",
} as const;

type BadgeVariant = keyof typeof BADGE_VARIANT_CLASSES;
type BadgeSize = keyof typeof BADGE_SIZE_CLASSES;

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  size?: BadgeSize;
};

export function Badge({
  variant = "neutral",
  size = "md",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border font-dm-sans font-medium",
        BADGE_VARIANT_CLASSES[variant],
        BADGE_SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  );
}

