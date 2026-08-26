"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const toastContainerVariants = cva(
  "fixed z-50 flex flex-col gap-2.5 pointer-events-none p-4 sm:p-6",
  {
    variants: {
      position: {
        "bottom-right": "bottom-0 right-0 max-w-md w-full",
        "bottom-left": "bottom-0 left-0 max-w-md w-full",
        "top-right": "top-0 right-0 max-w-md w-full",
        "top-left": "top-0 left-0 max-w-md w-full",
      },
    },
    defaultVariants: {
      position: "bottom-right",
    },
  },
);

export interface ToastContainerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toastContainerVariants> {}

export function ToastContainer({
  className,
  position,
  children,
  ...props
}: ToastContainerProps) {
  return (
    <div
      className={cn(toastContainerVariants({ position }), className)}
      role="region"
      aria-label="Notifications"
      {...props}
    >
      {children}
    </div>
  );
}

const toastVariants = cva(
  "pointer-events-auto relative w-full overflow-hidden rounded-xl border p-4 shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-5",
  {
    variants: {
      variant: {
        default: "bg-white text-gray-900 border-gray-200",
        retrying: "bg-amber-50/95 text-amber-950 border-amber-200 shadow-amber-500/10",
        recovered: "bg-emerald-50/95 text-emerald-950 border-emerald-200 shadow-emerald-500/10",
        exhausted: "bg-rose-50/95 text-rose-950 border-rose-200 shadow-rose-500/10",
        cancelled: "bg-slate-50/95 text-slate-900 border-slate-200 shadow-slate-500/10",
        info: "bg-blue-50/95 text-blue-950 border-blue-200 shadow-blue-500/10",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface ToastProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toastVariants> {
  onDismiss?: () => void;
}

export function Toast({
  className,
  variant,
  children,
  onDismiss,
  ...props
}: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      {children}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 opacity-80 hover:bg-black/5 hover:text-gray-700 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-400"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function ToastHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-start gap-2.5 pr-6 font-semibold", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function ToastTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h4
      className={cn("text-sm font-semibold leading-tight tracking-tight", className)}
      {...props}
    >
      {children}
    </h4>
  );
}

export function ToastDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <div
      className={cn("mt-1 text-xs leading-relaxed opacity-90", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function ToastActions({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-3 flex flex-wrap items-center gap-2 pt-1", className)}
      {...props}
    >
      {children}
    </div>
  );
}
