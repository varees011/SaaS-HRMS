import type * as React from "react";
import { cn } from "@/lib/utils";

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
        "rounded-md border p-3 text-sm",
        variant === "destructive" &&
          "border-destructive/30 bg-destructive/10 text-destructive",
        variant === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        className
      )}
      {...props}
    />
  );
}
