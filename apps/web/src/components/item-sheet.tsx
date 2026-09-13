"use client";

/**
 * The editor for one thing — a pending capture (Edit-then-add) or an item on
 * the board. Every field the extractor guessed is reachable here, because the
 * alternative is binning it and retyping.
 *
 * Sends only what changed. Sending the whole form back would rewrite fields
 * the person never touched, and clearing a date would look like leaving it
 * alone.
 */
import { useEffect, useState } from "react";
import { Check, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CAPTURE_TYPES, ITEM_STATUSES, fieldsOf, localDay, parseDue, type CaptureRow, type ItemEdit, type ItemRow } from "agent-core/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useWorkspace } from "@/lib/store";
import { tagDot } from "@/lib/tag-colours";
import { TYPE_META, STATUS_META } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Form = {
  title: string;
  type: (typeof CAPTURE_TYPES)[number];
  owner: string; // "" = nobody
  date: string; // YYYY-MM-DD or ""
  time: string; // HH:MM or ""
  status: (typeof ITEM_STATUSES)[number];
  tag: string; // "" = none
};

const NOBODY = "__nobody__";

function toForm(row: CaptureRow | ItemRow, timeZone: string): Form {
  const f = row.due_date ? fieldsOf(new Date(row.due_date), timeZone) : null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    title: row.title,
    type: row.type,
    owner: row.owner_slack_id ?? "",
    date: row.due_date ? localDay(new Date(row.due_date), timeZone) : "",
    time: f && !row.all_day ? `${pad(f.hour)}:${pad(f.minute)}` : "",
    status: "status" in row && (ITEM_STATUSES as readonly string[]).includes(row.status) ? (row.status as Form["status"]) : "open",
    tag: row.tag ?? "",
  };
}

export function ItemSheet() {
  const ws = useWorkspace();
  const capture = ws.selectedCaptureId ? ws.captures.find((c) => c.id === ws.selectedCaptureId) ?? null : null;
  const item = ws.selectedItemId ? ws.items.find((i) => i.id === ws.selectedItemId) ?? null : null;
  const row = capture ?? item;
  const mode: "capture" | "item" | null = capture ? "capture" : item ? "item" : null;
  const open = row !== null;

  const [form, setForm] = useState<Form | null>(null);
  const [newTag, setNewTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(row ? toForm(row, ws.timeZone) : null);
    setError(null);
  }, [row?.id, ws.timeZone]); // eslint-disable-line react-hooks/exhaustive-deps

  function close() {
    ws.setSelectedCaptureId(null);
    ws.setSelectedItemId(null);
  }

  if (!row || !form || !mode) {
    return (
      <Sheet open={false}>
        <SheetContent />
      </Sheet>
    );
  }

  const before = toForm(row, ws.timeZone);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm({ ...form, [key]: value });

  function changes(): ItemEdit {
    const edit: ItemEdit = {};
    if (!form) return edit;
    if (form.title.trim() && form.title.trim() !== before.title) edit.title = form.title.trim();
    if (form.type !== before.type) edit.type = form.type;
    if (form.owner !== before.owner) edit.owner_slack_id = form.owner || null;
    if (form.date !== before.date || form.time !== before.time) {
      if (!form.date) {
        edit.due_date = null;
        edit.all_day = true;
      } else {
        const p = parseDue(form.time ? `${form.date}T${form.time}` : form.date, ws.timeZone);
        edit.due_date = p.due_date;
        edit.all_day = p.all_day;
      }
    }
    if (mode === "item" && form.status !== before.status) edit.status = form.status;
    if (form.tag !== before.tag) edit.tag = form.tag || null;
    return edit;
  }

  async function save() {
    const edit = changes();
    setBusy(true);
    setError(null);
    try {
      if (mode === "capture") {
        const saved = await ws.approve(row!.id, edit);
        toast.success(`Added “${saved.title}” to the board`, {
          description: Object.keys(edit).length ? "With your edits — marked human-confirmed." : undefined,
        });
      } else {
        if (Object.keys(edit).length === 0) return close();
        const saved = await ws.updateItem(row!.id, edit);
        toast.success(`Updated “${saved.title}”`, { description: "Marked human-confirmed." });
      }
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "capture") {
        await ws.bin(row!.id);
        toast(`Binned “${row!.title}”`);
      } else {
        await ws.updateItem(row!.id, { status: "dropped" });
        toast(`Dropped “${row!.title}”`);
      }
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const people = ws.members.filter((m) => !m.is_bot);
  const confirmed = mode === "item" && (row as ItemRow).human_confirmed;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            {mode === "capture" ? "Edit, then add" : "Edit item"}
            {confirmed && (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <Lock className="size-3" /> human-confirmed
              </span>
            )}
          </SheetTitle>
          <SheetDescription>
            {mode === "capture"
              ? "Fix what the extractor got wrong, then put it on the board."
              : "Anything you change here is locked against later Slack reads."}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-5 px-4 pb-4">
          <blockquote className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{ws.memberName(("owner_slack_id" in row && row.owner_slack_id) || null) === "Nobody yet" ? "Someone" : ""}</span>
            “{row.source_text}”
          </blockquote>

          <div className="grid gap-2">
            <Label htmlFor="is-title">Title</Label>
            <Input id="is-title" value={form.title} onChange={(e) => set("title", e.target.value)} disabled={busy} />
          </div>

          <div className="grid gap-2">
            <Label>Type</Label>
            <div className="flex gap-1.5">
              {CAPTURE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("type", t)}
                  disabled={busy}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors",
                    form.type === t ? cn("border-transparent", TYPE_META[t].chip) : "border-transparent bg-muted/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {TYPE_META[t].label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Owner</Label>
            <Select value={form.owner || NOBODY} onValueChange={(v) => set("owner", v === NOBODY ? "" : v)} disabled={busy}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Nobody yet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NOBODY}>Nobody yet</SelectItem>
                {people.map((m) => (
                  <SelectItem key={m.slack_user_id} value={m.slack_user_id}>
                    {m.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="is-date">Due</Label>
              <Input id="is-date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} disabled={busy} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="is-time">Time</Label>
              <Input id="is-time" type="time" value={form.time} onChange={(e) => set("time", e.target.value)} disabled={busy || !form.date} />
            </div>
          </div>
          <p className="-mt-3 text-xs text-muted-foreground">Clear the date for no deadline. No time means all day.</p>

          <div className="grid gap-2">
            <Label>List</Label>
            <div className="flex flex-wrap gap-1.5">
              {[...new Set([...ws.lists.map((l) => l.id), ...(form.tag ? [form.tag] : [])])].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("tag", form.tag === t ? "" : t)}
                  disabled={busy}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs capitalize transition-colors",
                    form.tag === t ? "border-foreground/30 bg-muted text-foreground" : "border-transparent bg-muted/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className={cn("size-2 rounded-full", tagDot(t))} />
                  {t}
                </button>
              ))}
              <button
                type="button"
                onClick={() => set("tag", "")}
                disabled={busy}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs transition-colors",
                  form.tag === "" ? "border-foreground/30 bg-muted text-foreground" : "border-transparent bg-muted/40 text-muted-foreground hover:text-foreground",
                )}
              >
                No list
              </button>
            </div>
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const value = newTag.trim().toLowerCase().split(/\s+/).join("-").slice(0, 24);
                if (value.length < 2) return;
                set("tag", value);
                setNewTag("");
              }}
              placeholder="New list…"
              maxLength={24}
              disabled={busy}
              className="h-8 text-xs"
            />
          </div>

          {mode === "item" && (
            <div className="grid gap-2">
              <Label>Status</Label>
              <div className="flex gap-1.5">
                {ITEM_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("status", s)}
                    disabled={busy}
                    className={cn(
                      "flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors",
                      form.status === s ? cn("border-transparent", STATUS_META[s].chip) : "border-transparent bg-muted/40 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {STATUS_META[s].label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <SheetFooter className="flex-row items-center justify-between gap-2 border-t">
          <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={busy} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="size-3.5" />
            {mode === "capture" ? "Bin" : "Drop"}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={save} disabled={busy}>
              <Check className="size-3.5" />
              {busy ? "Saving…" : mode === "capture" ? "Add to board" : "Save"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
