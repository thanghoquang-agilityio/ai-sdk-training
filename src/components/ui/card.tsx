import type { HTMLAttributes } from "react";
import { cn } from "@/utils/class-name";

const CARD_VARIANT_CLASSES = {
  glass:
    "border border-white/10 bg-[linear-gradient(165deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] shadow-[0_10px_30px_rgba(7,12,30,0.26)] backdrop-blur-md",
  panel: "border border-white/8 bg-white/4 backdrop-blur-[20px]",
  soft: "border border-white/8 bg-white/6",
  success: "border border-emerald-400/28 bg-emerald-500/10",
  danger: "border border-rose-400/28 bg-rose-500/10",
} as const;

type CardVariant = keyof typeof CARD_VARIANT_CLASSES;

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
};

export function Card({
  variant = "glass",
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn("rounded-2xl", CARD_VARIANT_CLASSES[variant], className)}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-white/8 px-4 py-3", className)} {...props} />;
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 py-3", className)} {...props} />;
}

