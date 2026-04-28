import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";
import { cn } from "@/utils/class-name";

const SELECT_VARIANT_CLASSES = {
  default:
    "border-slate-300 bg-white/95 text-slate-900 shadow-sm hover:border-slate-400",
  subtle:
    "border-slate-200 bg-slate-50/90 text-slate-900 hover:border-slate-300",
  ghost:
    "border-transparent bg-transparent text-slate-900 hover:border-slate-200",
  dark:
    "border-white/12 bg-white/6 text-white/80 hover:border-violet-500/50 [&>option]:text-slate-900",
} as const;

const SELECT_SIZE_CLASSES = {
  sm: "h-8 px-2 text-xs",
  md: "h-10 px-3 text-sm",
  lg: "h-11 px-4 text-sm",
} as const;

type SelectVariant = keyof typeof SELECT_VARIANT_CLASSES;
type SelectSize = keyof typeof SELECT_SIZE_CLASSES;

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  variant?: SelectVariant;
  controlSize?: SelectSize;
  fullWidth?: boolean;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      variant = "default",
      controlSize = "md",
      fullWidth = false,
      className,
      children,
      ...props
    },
    ref,
  ) => (
    <div className={cn("relative", fullWidth && "w-full")}>
      <select
        ref={ref}
        className={cn(
          "peer w-full appearance-none rounded-xl border pr-10 outline-none transition duration-200",
          variant === "dark"
            ? "focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
            : "focus:border-sky-400 focus:ring-2 focus:ring-sky-100",
          "disabled:cursor-not-allowed disabled:opacity-60",
          SELECT_VARIANT_CLASSES[variant],
          SELECT_SIZE_CLASSES[controlSize],
          className,
        )}
        {...props}
      >
        {children}
      </select>

      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500 transition peer-focus:text-sky-500">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="h-4 w-4"
        >
          <path
            d="M5.5 7.5L10 12l4.5-4.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  ),
);

Select.displayName = "Select";
