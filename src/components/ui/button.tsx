import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/utils/class-name";

const BUTTON_VARIANT_CLASSES = {
  primary:
    "bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-400 disabled:text-white",
  secondary:
    "bg-slate-200 text-slate-900 hover:bg-slate-300 disabled:bg-slate-100 disabled:text-slate-400",
  outline:
    "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 disabled:border-slate-200 disabled:text-slate-400",
  ghost:
    "bg-transparent text-slate-900 hover:bg-slate-100 disabled:text-slate-400",
  danger:
    "bg-red-600 text-white hover:bg-red-500 disabled:bg-red-300 disabled:text-red-50",
} as const;

const BUTTON_SIZE_CLASSES = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
} as const;

type ButtonVariant = keyof typeof BUTTON_VARIANT_CLASSES;
type ButtonSize = keyof typeof BUTTON_SIZE_CLASSES;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      fullWidth = false,
      isLoading = false,
      className,
      disabled,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-lg font-medium transition disabled:cursor-not-allowed",
        BUTTON_VARIANT_CLASSES[variant],
        BUTTON_SIZE_CLASSES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);

Button.displayName = "Button";
