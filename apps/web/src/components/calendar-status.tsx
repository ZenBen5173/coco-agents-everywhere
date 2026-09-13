"use client";

/**
 * The team's Google Calendar, in the sidebar footer: connected or not, and
 * the one link that changes that. Approved items with a due date become
 * events; done ticks them off; dropped removes them.
 */
import { useEffect, useState } from "react";
import { CalendarCheck2, CalendarOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = { configured: boolean; connected: boolean; calendarId: string | null; source: "db" | "env" | null };

export function CalendarStatus({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/google/status")
      .then((r) => r.json())
      .then((s: Status) => alive && setStatus(s))
      .catch(() => alive && setStatus({ configured: false, connected: false, calendarId: null, source: null }));
    return () => {
      alive = false;
    };
  }, []);

  if (!status || !status.configured) return null;
  const Icon = status.connected ? CalendarCheck2 : CalendarOff;

  if (compact) {
    return (
      <span title={status.connected ? "Google Calendar connected" : "Google Calendar not connected"} className="grid size-8 place-items-center text-muted-foreground">
        <Icon className={cn("size-4", status.connected && "text-emerald-500")} />
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-card/30 px-2 py-1.5 text-xs backdrop-blur-sm">
      <Icon className={cn("size-3.5 shrink-0", status.connected ? "text-emerald-500" : "text-muted-foreground")} />
      <span className="min-w-0 flex-1 truncate text-muted-foreground">
        {status.connected ? "Google Calendar on" : "No calendar"}
      </span>
      <a
        href={status.connected ? "/api/google/disconnect" : "/api/google/start"}
        className="shrink-0 text-[11px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
      >
        {status.connected ? "Disconnect" : "Connect"}
      </a>
    </div>
  );
}
