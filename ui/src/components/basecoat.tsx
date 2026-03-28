import { forwardRef } from "react";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";

import { cx } from "../lib/utils";

type ButtonVariant = "primary" | "secondary" | "light" | "outline" | "ghost" | "destructive";

const BUTTON_BY_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "btn border-(--cora-border) bg-(--cora-text) text-(--cora-bg) hover:opacity-90 transition-opacity",
  secondary:
    "btn border-(--cora-border) bg-(--cora-accent-muted) text-(--cora-text) hover:bg-(--cora-accent-muted)/80",
  light:
    "btn border-(--cora-border) bg-(--cora-panel) text-(--cora-text) hover:bg-(--cora-border)",
  outline:
    "btn-outline border-(--cora-border) text-(--cora-text) hover:bg-(--cora-border)",
  ghost:
    "btn-ghost text-(--cora-text-muted) hover:text-(--cora-text) hover:bg-(--cora-border)",
  destructive:
    "btn-destructive border-transparent bg-rose-600 text-white hover:bg-rose-700",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  loadingText?: string;
  children: ReactNode;
}

function Spinner() {
  return (
    <svg
      className="size-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", isLoading = false, loadingText, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx(
        BUTTON_BY_VARIANT[variant],
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-none px-4 py-2 text-sm font-medium transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="pointer-events-none flex items-center justify-center gap-1.5">
          <Spinner />
          <span>{loadingText ?? children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
});

type BadgeVariant = "default" | "neutral" | "success" | "error" | "warning";

const BADGE_BY_VARIANT: Record<BadgeVariant, string> = {
  default: "border-(--cora-accent)/20 bg-(--cora-accent)/10 text-(--cora-accent)",
  neutral: "border-(--cora-border) bg-(--cora-border)/5 text-(--cora-text-muted)",
  success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  error: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, variant = "default", ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cx(
        "inline-flex items-center rounded-none border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        BADGE_BY_VARIANT[variant],
        className,
      )}
      {...props}
    />
  );
});

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cx(
        "card rounded-none border border-(--cora-border) bg-(--cora-panel) px-6 py-6 text-(--cora-text) shadow-xl shadow-black/5 backdrop-blur-xl sm:px-8 sm:py-8",
        className,
      )}
      {...props}
    />
  );
});

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cx(
        "input w-full rounded-none border border-(--cora-border) bg-(--cora-bg) text-(--cora-text) shadow-none outline-none placeholder:text-(--cora-text-muted) focus:ring-2 focus:ring-(--cora-accent)/20 transition-all px-4 py-2",
        className,
      )}
      {...props}
    />
  );
});

export const TableRoot = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function TableRoot(
  { className, children, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cx("w-full overflow-x-auto", className)} {...props}>
      {children}
    </div>
  );
});

export const Table = forwardRef<HTMLTableElement, TableHTMLAttributes<HTMLTableElement>>(function Table(
  { className, ...props },
  ref,
) {
  return <table ref={ref} className={cx("w-full border-collapse border-spacing-0", className)} {...props} />;
});

export const TableHead = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  function TableHead({ className, ...props }, ref) {
    return <thead ref={ref} className={className} {...props} />;
  },
);

export const TableHeaderCell = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  function TableHeaderCell({ className, ...props }, ref) {
    return <th ref={ref} className={cx("px-4 py-4 text-left font-semibold text-(--cora-text-muted) uppercase tracking-widest text-[10px]", className)} {...props} />;
  },
);

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  function TableBody({ className, ...props }, ref) {
    return <tbody ref={ref} className={className} {...props} />;
  },
);

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(function TableRow(
  { className, ...props },
  ref,
) {
  return <tr ref={ref} className={cx("border-b border-(--cora-border) last:border-0 hover:bg-(--cora-border)/20 transition-colors", className)} {...props} />;
});

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(function TableCell(
  { className, ...props },
  ref,
) {
  return <td ref={ref} className={cx("px-4 py-4 text-sm align-middle whitespace-nowrap", className)} {...props} />;
});

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("animate-pulse rounded-none bg-(--cora-border)", className)} {...props} />;
}
