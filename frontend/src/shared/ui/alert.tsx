import type * as React from "react";
import { cn } from "@/shared/lib/cn";

export function Alert({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "destructive" | "success";
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-md border border-primary/15 bg-card/90 p-3 text-sm shadow-sm",
        variant === "destructive" &&
          "border-destructive/30 bg-destructive/10 text-destructive",
        variant === "success" &&
          "border-emerald-200 bg-emerald-50 text-emerald-900",
        className
      )}
      {...props}
    />
  );
}
