"use client";

/**
 * What the agent can draw in the chat, and the two decisions it must ask for.
 *
 * approve_capture / bin_capture are human-in-the-loop: the agent proposes, the
 * card waits, the person clicks. The click is what calls the store — the same
 * route the review page's buttons use — so "approve all of those" typed into
 * the chat still ends in a click per item.
 *
 * `respond` is a function ONLY while the tool call is executing; narrowing on
 * its presence is safer than importing the ToolCallStatus enum.
 */
import { useState } from "react";
import { useComponent, useHumanInTheLoop } from "@copilotkit/react-core/v2";
import { z } from "zod";
import { toast } from "sonner";
import { Check, Trash2 } from "lucide-react";
import { CAPTURE_TYPES, parseDue, formatDue, type ItemEdit } from "agent-core/shared";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/store";
import { TYPE_META, STATUS_META } from "@/lib/labels";
import { cn } from "@/lib/utils";

/** Tool results travel as JSON so CopilotKit's inspector can parse them. */
const reply = (status: "approved" | "declined" | "binned" | "kept" | "error" | "stale", message: string) =>
  JSON.stringify({ status, message });

function shownResult(result: unknown): string {
  if (typeof result !== "string") return String(result ?? "");
  try {
    const parsed = JSON.parse(result) as { message?: string };
    return parsed.message ?? result;
  } catch {
    return result;
  }
}

function GateCard({
  title,
  eyebrow,
  children,
  done,
}: {
  title: string;
  eyebrow: string;
  children?: React.ReactNode;
  done?: string;
}) {
  return (
    <article className="my-2 rounded-lg border border-border bg-card p-3 text-sm shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
      <h3 className="mt-0.5 font-medium">{title}</h3>
      {done ? <p className="mt-2 text-xs text-muted-foreground">{done}</p> : children}
    </article>
  );
}

export function GenerativeUI() {
  const ws = useWorkspace();

  useComponent({
    name: "item_list",
    description:
      "Draw a list of items or captures as cards. Use whenever you answer 'what is late / pending / mine / done' or list more than one thing. Pass ids from context; rows render from live data.",
    parameters: z.object({
      title: z.string().describe("Short heading, e.g. 'Late', 'Amy's open items'."),
      ids: z.array(z.string()).max(20).describe("item ids or capture ids from context"),
    }),
    render: ({ title, ids }) => <ItemList title={title ?? "Items"} ids={ids ?? []} />,
  });

  useHumanInTheLoop({
    name: "approve_capture",
    description:
      "Propose putting a pending capture on the board. The USER must click Add; you cannot approve. Optional overrides apply the user's corrections at the same time (Edit-then-add).",
    parameters: z.object({
      captureId: z.string(),
      title: z.string().optional(),
      owner_slack_id: z.string().optional().describe("slack_user_id, or the empty string for nobody"),
      due_date: z.string().optional().describe("YYYY-MM-DD or YYYY-MM-DDTHH:MM, or 'none' to clear"),
      type: z.enum(CAPTURE_TYPES).optional(),
    }),
    render: ({ args, respond, result }) => (
      <ApproveGate args={args} respond={respond} result={result} />
    ),
  });

  useHumanInTheLoop({
    name: "bin_capture",
    description: "Propose binning a pending capture (a joke, a duplicate, not a real commitment). The USER must click Bin.",
    parameters: z.object({ captureId: z.string(), reason: z.string().optional() }),
    render: ({ args, respond, result }) => <BinGate args={args} respond={respond} result={result} />,
  });

  return null;
}

type GateProps<T> = { args: Partial<T>; respond?: (r: unknown) => Promise<void>; result?: unknown };

function ApproveGate({
  args,
  respond,
  result,
}: GateProps<{ captureId: string; title?: string; owner_slack_id?: string; due_date?: string; type?: (typeof CAPTURE_TYPES)[number] }>) {
  const ws = useWorkspace();
  const [busy, setBusy] = useState(false);
  const capture = ws.captures.find((c) => c.id === args.captureId);
  const title = args.title ?? capture?.title ?? "…";
  const type = args.type ?? capture?.type;
  const owner = args.owner_slack_id === undefined ? capture?.owner_slack_id : args.owner_slack_id || null;
  const clearDate = args.due_date !== undefined && (args.due_date === "" || args.due_date.toLowerCase() === "none");
  const parsedDue = args.due_date && !clearDate ? parseDue(args.due_date, ws.timeZone) : null;
  const due = args.due_date === undefined ? capture?.due_date : clearDate ? null : parsedDue?.due_date ?? null;
  // Only a real difference counts as an edit — the model often echoes the
  // capture's own values back as "overrides", and that must not mark the item
  // human-confirmed.
  const titleChanged = args.title !== undefined && capture !== undefined && args.title.trim() !== capture.title;
  const ownerChanged = args.owner_slack_id !== undefined && capture !== undefined && (args.owner_slack_id || null) !== capture.owner_slack_id;
  const typeChanged = args.type !== undefined && capture !== undefined && args.type !== capture.type;
  const dueChanged = args.due_date !== undefined && capture !== undefined && (due ?? null) !== capture.due_date;
  const edited = titleChanged || ownerChanged || typeChanged || dueChanged;

  if (!respond) {
    return <GateCard eyebrow="Add to board" title={title} done={result ? shownResult(result) : "Waiting…"} />;
  }
  if (!capture) {
    return (
      <GateCard eyebrow="Add to board" title={title}>
        <p className="mt-2 text-xs text-muted-foreground">This capture is no longer pending.</p>
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => respond(reply("stale", "That capture is no longer pending; nothing changed."))}>
          Dismiss
        </Button>
      </GateCard>
    );
  }
  return (
    <GateCard eyebrow={edited ? "Edit, then add to board" : "Add to board"} title={title}>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {type && <span className={cn("rounded px-1.5 py-0.5 font-medium", TYPE_META[type].chip)}>{TYPE_META[type].label}</span>}
        <span>{ws.memberName(owner)}</span>
        <span>· {formatDue(due ?? null, parsedDue ? parsedDue.all_day : capture.all_day, ws.timeZone)}</span>
      </div>
      <p className="mt-2 truncate text-xs text-muted-foreground">“{capture.source_text}”</p>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const overrides: ItemEdit = {};
              if (titleChanged) overrides.title = args.title;
              if (ownerChanged) overrides.owner_slack_id = args.owner_slack_id || null;
              if (typeChanged) overrides.type = args.type;
              if (dueChanged) {
                const p = clearDate || !parsedDue ? { due_date: null, all_day: true } : parsedDue;
                overrides.due_date = p.due_date;
                overrides.all_day = p.all_day;
              }
              const item = await ws.approve(capture.id, overrides);
              toast.success(`Added “${item.title}” to the board`);
              await respond(reply("approved", `The user clicked Add. "${item.title}" is now on the board (owner ${ws.memberName(item.owner_slack_id)}, due ${item.due_date ?? "none"}${item.human_confirmed ? ", human-confirmed" : ""}).`));
            } catch (error) {
              await respond(reply("error", `Adding failed: ${error instanceof Error ? error.message : String(error)}. Nothing changed.`));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Check className="size-3.5" /> Add to board
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => respond(reply("declined", "The user declined. Nothing was added; the capture is still pending."))}>
          Not now
        </Button>
      </div>
    </GateCard>
  );
}

function BinGate({ args, respond, result }: GateProps<{ captureId: string; reason?: string }>) {
  const ws = useWorkspace();
  const [busy, setBusy] = useState(false);
  const capture = ws.captures.find((c) => c.id === args.captureId);
  const title = capture?.title ?? "…";
  if (!respond) return <GateCard eyebrow="Bin" title={title} done={result ? shownResult(result) : "Waiting…"} />;
  if (!capture) {
    return (
      <GateCard eyebrow="Bin" title={title}>
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => respond(reply("stale", "That capture is no longer pending; nothing changed."))}>
          Dismiss
        </Button>
      </GateCard>
    );
  }
  return (
    <GateCard eyebrow="Bin" title={title}>
      {args.reason && <p className="mt-1 text-xs text-muted-foreground">{args.reason}</p>}
      <p className="mt-2 truncate text-xs text-muted-foreground">“{capture.source_text}”</p>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await ws.bin(capture.id);
              toast(`Binned “${capture.title}”`);
              await respond(reply("binned", `The user clicked Bin. "${capture.title}" was binned and will never reach the board.`));
            } catch (error) {
              await respond(reply("error", `Binning failed: ${error instanceof Error ? error.message : String(error)}. Nothing changed.`));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Trash2 className="size-3.5" /> Bin it
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => respond(reply("kept", "The user declined. The capture is still pending."))}>
          Keep
        </Button>
      </div>
    </GateCard>
  );
}

function ItemList({ title, ids }: { title: string; ids: string[] }) {
  const ws = useWorkspace();
  const now = new Date();
  const rows = ids
    .map((id) => {
      const item = ws.items.find((i) => i.id === id);
      if (item) return { kind: "item" as const, id, title: item.title, type: item.type, owner: item.owner_slack_id, due: item.due_date, allDay: item.all_day, status: item.status, confirmed: item.human_confirmed };
      const c = ws.captures.find((x) => x.id === id);
      if (c) return { kind: "capture" as const, id, title: c.title, type: c.type, owner: c.owner_slack_id, due: c.due_date, allDay: c.all_day, status: null, confirmed: false };
      return null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return (
    <article className="my-2 rounded-lg border border-border bg-card text-sm shadow-sm">
      <header className="border-b border-border/60 px-3 py-2">
        <h3 className="font-display text-xs font-semibold">{title}</h3>
      </header>
      {rows.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted-foreground">Nothing to show.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => (r.kind === "item" ? ws.setSelectedItemId(r.id) : ws.setSelectedCaptureId(r.id))}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40"
              >
                <span className={cn("size-1.5 shrink-0 rounded-full", TYPE_META[r.type].dot)} />
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{ws.memberName(r.owner)}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{formatDue(r.due, r.allDay, ws.timeZone)}</span>
                {r.status && <span className={cn("shrink-0 rounded px-1 py-0.5 text-[10px]", STATUS_META[r.status].chip)}>{STATUS_META[r.status].label}</span>}
                {r.kind === "capture" && <span className="shrink-0 rounded bg-primary/15 px-1 py-0.5 text-[10px] text-primary">pending</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="sr-only">{now.toISOString()}</p>
    </article>
  );
}
