import type { CaptureType, ItemStatus } from "agent-core/shared";

/** Classes written out in full — Tailwind only ships what it can see. */
export const TYPE_META: Record<CaptureType, { label: string; chip: string; dot: string }> = {
  commitment: { label: "Commitment", chip: "bg-sky-500/15 text-sky-500 dark:text-sky-400", dot: "bg-sky-500" },
  decision: { label: "Decision", chip: "bg-violet-500/15 text-violet-500 dark:text-violet-400", dot: "bg-violet-500" },
  deadline: { label: "Deadline", chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
};

export const STATUS_META: Record<ItemStatus, { label: string; chip: string }> = {
  open: { label: "Open", chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  done: { label: "Done", chip: "bg-muted text-muted-foreground" },
  dropped: { label: "Dropped", chip: "bg-rose-500/15 text-rose-500 dark:text-rose-400" },
};

export function confidenceLabel(c: number): string {
  if (c >= 0.85) return "Clear";
  if (c >= 0.6) return "Likely";
  return "Doubtful";
}
