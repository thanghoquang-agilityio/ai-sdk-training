import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/utils/class-name";

const INPUT_VARIANT_CLASSES = {
  default:
    "border-slate-300 bg-white/95 text-slate-900 shadow-sm hover:border-slate-400",
  subtle:
    "border-slate-200 bg-slate-50/90 text-slate-900 hover:border-slate-300",
  ghost:
    "border-transparent bg-transparent text-slate-900 hover:border-slate-200",
  error:
    "border-red-300 bg-red-50/70 text-red-900 shadow-sm hover:border-red-400",
  dark:
    "border-white/12 bg-white/6 text-white/80 placeholder:text-white/30 hover:border-violet-500/50",
} as const;

const INPUT_SIZE_CLASSES = {
  sm: "h-8 px-2 text-xs",
  md: "h-10 px-3 text-sm",
  lg: "h-11 px-4 text-sm",
} as const;

type InputVariant = keyof typeof INPUT_VARIANT_CLASSES;
type InputSize = keyof typeof INPUT_SIZE_CLASSES;

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  variant?: InputVariant;
  controlSize?: InputSize;
  fullWidth?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      variant = "default",
      controlSize = "md",
      fullWidth = false,
      className,
      ...props
    },
    ref,
  ) => (
    <input
      ref={ref}
      className={cn(
        "rounded-xl border outline-none transition duration-200",
        "placeholder:text-slate-400",
        variant === "dark"
          ? "focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
          : "focus:border-sky-400 focus:ring-2 focus:ring-sky-100",
        "disabled:cursor-not-allowed disabled:opacity-60",
        INPUT_VARIANT_CLASSES[variant],
        INPUT_SIZE_CLASSES[controlSize],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
