import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The library's empty / error state: dashed frame, icon tile, one line of copy, optional actions. */
export function EmptyState({
  icon: Icon,
  tone = "muted",
  title,
  body,
  children,
  className,
}: {
  icon: LucideIcon;
  tone?: "muted" | "danger";
  title: string;
  body: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid place-items-center rounded-xl border border-dashed border-border px-6 py-14 text-center", className)}>
      <div
        className={
          tone === "danger"
            ? "grid size-11 place-items-center rounded-xl border border-destructive/25 bg-destructive/10 text-destructive"
            : "grid size-11 place-items-center rounded-xl border border-border bg-muted text-muted-foreground"
        }
      >
        <Icon className="size-5" />
      </div>
      <p className="mt-4 text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">{body}</p>
      {children && <div className="mt-5 flex gap-2">{children}</div>}
    </div>
  );
}
