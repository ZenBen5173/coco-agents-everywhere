"use client";

/**
 * The review page: everything the extractor heard, waiting for a human.
 * Add · Edit-then-add · Bin. Each row shows the exact line it came from and
 * who said it, because that is what you need to decide.
 */
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Inbox, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CaptureRow } from "agent-core/shared";
import { formatDue, relativeDue } from "agent-core/shared";
import { Button } from "@/components/ui/button";
import { OwnerChip } from "@/components/owner-chip";
import { EmptyState } from "@/components/empty-state";
import { MathCurveLoader } from "@/components/ui/math-curve-loader";
import { useWorkspace } from "@/lib/store";
import { TYPE_META, confidenceLabel } from "@/lib/labels";
import { tagChip } from "@/lib/tag-colours";
import { cn } from "@/lib/utils";

export function ReviewQueue() {
  const { captures, ready, error, channelName } = useWorkspace();
  const counts = { commitment: 0, decision: 0, deadline: 0 };
  for (const c of captures) counts[c.type]++;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Review</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {captures.length === 0
              ? "Nothing waiting."
              : `${captures.length} thing${captures.length === 1 ? "" : "s"} heard in #${channelName}. Your call.`}
          </p>
        </div>
        <div className="flex gap-1.5">
          {(Object.keys(TYPE_META) as (keyof typeof TYPE_META)[]).map((t) => (
            <span key={t} className={cn("rounded-md px-2 py-1 text-[11px] font-medium tabular-nums", TYPE_META[t].chip)}>
              {counts[t]} {TYPE_META[t].label.toLowerCase()}{counts[t] === 1 ? "" : "s"}
            </span>
          ))}
        </div>
      </header>

      {error && <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      <div className="rounded-lg border border-border bg-card/45 backdrop-blur-md">
        {!ready ? (
          <div className="grid place-items-center px-4 py-14">
            <MathCurveLoader curve="lissajous" size={44} className="text-primary" label="Loading the queue" />
          </div>
        ) : captures.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="The queue is clear"
            body={`Tally is listening to #${channelName}. When someone commits to something, decides something, or names a deadline, it shows up here — and only here, until you say so.`}
            className="m-3"
          />
        ) : (
          <ul className="divide-y divide-border/60">
            <AnimatePresence initial={false}>
              {captures.map((c, i) => (
                <CaptureItem key={c.id} capture={c} index={i} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}

function CaptureItem({ capture: c, index }: { capture: CaptureRow; index: number }) {
  const { approve, bin, setSelectedCaptureId, memberName, timeZone, member } = useWorkspace();
  const [busy, setBusy] = useState<"add" | "bin" | null>(null);
  const now = new Date();
  const speaker = c.source_text ? undefined : undefined;
  void speaker;

  async function run(kind: "add" | "bin") {
    setBusy(kind);
    try {
      if (kind === "add") {
        const item = await approve(c.id);
        toast.success(`Added “${item.title}” to the board`);
      } else {
        await bin(c.id);
        toast(`Binned “${c.title}”`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
      setBusy(null);
    }
  }

  const meta = TYPE_META[c.type];
  const low = c.confidence < 0.6;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index, 8) * 0.04, duration: 0.25, ease: [0.16, 1, 0.3, 1] } }}
      exit={{ opacity: 0, x: busy === "bin" ? -24 : 24, transition: { duration: 0.2 } }}
      className="group px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <span className={cn("mt-2 size-2 shrink-0 rounded-full", meta.dot)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", meta.chip)}>{meta.label}</span>
            {c.tag && <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize", tagChip(c.tag))}>{c.tag}</span>}
            <button
              type="button"
              onClick={() => setSelectedCaptureId(c.id)}
              className="truncate text-left text-sm font-medium hover:underline"
            >
              {c.title}
            </button>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] tabular-nums",
                low ? "bg-rose-500/10 text-rose-500" : "bg-muted text-muted-foreground",
              )}
              title={c.reasoning ?? undefined}
            >
              {confidenceLabel(c.confidence)} · {Math.round(c.confidence * 100)}%
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <OwnerChip id={c.owner_slack_id} />
            <span className={cn("tabular-nums", c.due_date && relativeDue(c.due_date, now, timeZone).includes("ago") && "text-destructive")}>
              {formatDue(c.due_date, c.all_day, timeZone)}
              {c.due_date && ` · ${relativeDue(c.due_date, now, timeZone)}`}
            </span>
          </div>
          <blockquote className="mt-1.5 truncate border-l-2 border-border pl-2 text-xs text-muted-foreground" title={c.source_text}>
            “{c.source_text}”
          </blockquote>
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
          <Button size="sm" onClick={() => run("add")} disabled={busy !== null} aria-label="Add to board">
            <Check className="size-3.5" />
            <span className="hidden sm:inline">Add</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedCaptureId(c.id)} disabled={busy !== null} aria-label="Edit then add">
            <Pencil className="size-3.5" />
            <span className="hidden sm:inline">Edit</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => run("bin")}
            disabled={busy !== null}
            aria-label="Bin"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            <span className="hidden sm:inline">Bin</span>
          </Button>
        </div>
      </div>
      <p className="sr-only">{memberName(c.owner_slack_id)} {member(c.owner_slack_id)?.display_name}</p>
    </motion.li>
  );
}
