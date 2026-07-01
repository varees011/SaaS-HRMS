import type * as React from "react";
import { cn } from "@/shared/lib/cn";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "secondary" | "outline" | "success";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        variant === "default" && "bg-primary text-primary-foreground",
        variant === "secondary" &&
          "border-primary/10 bg-secondary text-secondary-foreground",
        variant === "outline" && "border-primary/20 bg-card text-primary",
        variant === "success" &&
          "border-emerald-200 bg-emerald-100 text-emerald-900",
        className
      )}
      {...props}
    />
  );
}
