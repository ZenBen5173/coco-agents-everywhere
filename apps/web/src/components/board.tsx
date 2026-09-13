"use client";

/**
 * The board: approved items only. Tabs narrow the set (Mine / Everyone / Late /
 * Done); the view changes how the same set is drawn (list / kanban / table).
 * One filtered set feeds every view, so switching views never changes what
 * you are looking at.
 */
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { CalendarCheck2, Inbox, Lock, UserRound } from "lucide-react";
import { toast } from "sonner";
import type { ItemRow, ItemStatus } from "agent-core/shared";
import { daysUntil, formatDue, localDay, parseDue, relativeDue } from "agent-core/shared";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanBoard, KanbanCard, KanbanCards, KanbanHeader, KanbanProvider } from "@/components/kibo-ui/kanban";
import { DataTable } from "@/components/gustflow-table/DataTable";
import type { ColumnDef } from "@/components/gustflow-table/types";
import { OwnerChip } from "@/components/owner-chip";
import { EmptyState } from "@/components/empty-state";
import { useWorkspace } from "@/lib/store";
import { TYPE_META, STATUS_META } from "@/lib/labels";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "mine", label: "Mine" },
  { id: "everyone", label: "Everyone" },
  { id: "late", label: "Late" },
  { id: "done", label: "Done" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const VIEWS = [
  { id: "list", label: "List" },
  { id: "kanban", label: "Kanban" },
  { id: "table", label: "Table" },
] as const;
type View = (typeof VIEWS)[number]["id"];

const COLUMNS: { id: ItemStatus; name: string }[] = [
  { id: "open", name: "Open" },
  { id: "done", name: "Done" },
  { id: "dropped", name: "Dropped" },
];

export function Board() {
  const ws = useWorkspace();
  const router = useRouter();
  const params = useSearchParams();
  const tab = (TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "everyone") as Tab;
  const [view, setView] = useState<View>("list");
  const now = new Date();

  const isLate = (i: ItemRow) => i.status === "open" && !!i.due_date && daysUntil(i.due_date, now, ws.timeZone) < 0;

  const visible = useMemo(() => {
    const open = ws.items.filter((i) => i.status === "open");
    switch (tab) {
      case "mine":
        return open.filter((i) => ws.me && i.owner_slack_id === ws.me);
      case "late":
        return open.filter(isLate);
      case "done":
        return ws.items.filter((i) => i.status === "done");
      default:
        return open;
    }
  }, [ws.items, ws.me, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = {
    mine: ws.items.filter((i) => i.status === "open" && ws.me && i.owner_slack_id === ws.me).length,
    everyone: ws.items.filter((i) => i.status === "open").length,
    late: ws.items.filter(isLate).length,
    done: ws.items.filter((i) => i.status === "done").length,
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Board</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {localDay(now, ws.timeZone)} · {visible.length} item{visible.length === 1 ? "" : "s"} · only what a human approved
        </p>
      </header>

      <Tabs value={tab} onValueChange={(v) => router.replace(`/board?tab=${v}`)}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="relative gap-1.5">
                {t.label}
                <span className={cn("text-[10px] tabular-nums", tab === t.id ? "text-foreground/70" : "text-muted-foreground/70")}>
                  {counts[t.id]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="relative flex rounded-lg bg-muted p-[3px]">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                className={cn(
                  "relative z-10 rounded-md px-3 py-1 text-xs transition-colors",
                  view === v.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {view === v.id && (
                  <motion.span layoutId="view-indicator" className="absolute inset-0 -z-10 rounded-md bg-background shadow-sm" transition={{ type: "spring", stiffness: 300, damping: 24 }} />
                )}
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {TABS.map((t) => (
          <TabsContent key={t.id} value={t.id} className="mt-0">
            {tab === "mine" && !ws.me ? (
              <Empty who title="Who are you?" body="Pick yourself in the sidebar to see your items." />
            ) : visible.length === 0 ? (
              <Empty title="Nothing here" body={tab === "late" ? "Nothing is late. Good." : "Approve something on the Review page and it lands here."} />
            ) : view === "list" ? (
              <ListView items={visible} />
            ) : view === "kanban" ? (
              <KanbanView items={visible} />
            ) : (
              <TableView items={visible} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function Empty({ title, body, who = false }: { title: string; body: string; who?: boolean }) {
  return <EmptyState icon={who ? UserRound : Inbox} title={title} body={body} className="bg-card/35 backdrop-blur-md" />;
}

const BUCKETS = ["Overdue", "Today", "This week", "Later", "No date"] as const;

function bucketOf(i: ItemRow, now: Date, tz: string): (typeof BUCKETS)[number] {
  if (!i.due_date) return "No date";
  const n = daysUntil(i.due_date, now, tz);
  if (i.status === "open" && n < 0) return "Overdue";
  if (n === 0) return "Today";
  if (n <= 7) return "This week";
  return "Later";
}

export function ListView({ items }: { items: ItemRow[] }) {
  const ws = useWorkspace();
  const now = new Date();
  const groups = BUCKETS.map((b) => ({ bucket: b, rows: items.filter((i) => bucketOf(i, now, ws.timeZone) === b) })).filter((g) => g.rows.length);

  return (
    <div className="rounded-lg border border-border bg-card/45 backdrop-blur-md">
      {groups.map((g) => (
        <section key={g.bucket}>
          <h2 className={cn("sticky top-0 z-10 border-b border-border/60 bg-card/70 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide backdrop-blur", g.bucket === "Overdue" ? "text-destructive" : "text-muted-foreground")}>
            {g.bucket} · {g.rows.length}
          </h2>
          <ul className="divide-y divide-border/60">
            {g.rows.map((i, idx) => (
              <ItemLine key={i.id} item={i} index={idx} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ItemLine({ item: i, index }: { item: ItemRow; index: number }) {
  const ws = useWorkspace();
  const now = new Date();
  const late = i.status === "open" && !!i.due_date && daysUntil(i.due_date, now, ws.timeZone) < 0;
  const [busy, setBusy] = useState(false);

  async function toggle(done: boolean) {
    setBusy(true);
    try {
      await ws.updateItem(i.id, { status: done ? "done" : "open" });
      toast.success(done ? `Done: ${i.title}` : `Reopened: ${i.title}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index, 10) * 0.03, duration: 0.2 } }}
      className="group flex items-center gap-3 px-4 py-2.5"
    >
      <Checkbox checked={i.status === "done"} onCheckedChange={(v) => toggle(v === true)} disabled={busy} aria-label="Done" />
      <span className={cn("size-2 shrink-0 rounded-full", TYPE_META[i.type].dot)} />
      <button
        type="button"
        onClick={() => ws.setSelectedItemId(i.id)}
        className={cn("min-w-0 flex-1 truncate text-left text-sm hover:underline", i.status === "done" && "text-muted-foreground line-through")}
        title={i.source_text}
      >
        {i.title}
      </button>
      {i.human_confirmed && (
        <span className="hidden items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 sm:inline-flex dark:text-emerald-400" title="Corrected by a human; Slack can't overwrite it">
          <Lock className="size-3" /> confirmed
        </span>
      )}
      {i.calendar_event_id && (
        <span className="hidden text-muted-foreground sm:inline-flex" title="On the team calendar">
          <CalendarCheck2 className="size-3.5" />
        </span>
      )}
      <OwnerChip id={i.owner_slack_id} size="sm" />
      <span className={cn("w-32 shrink-0 text-right text-xs tabular-nums", late ? "text-destructive" : "text-muted-foreground")}>
        {formatDue(i.due_date, i.all_day, ws.timeZone)}
        {i.due_date && <span className="hidden sm:inline"> · {relativeDue(i.due_date, now, ws.timeZone)}</span>}
      </span>
    </motion.li>
  );
}

type Card = { id: string; name: string; column: string; item: ItemRow };

function KanbanView({ items }: { items: ItemRow[] }) {
  const ws = useWorkspace();
  // Kanban shows every status so a card can be dragged to Done or Dropped —
  // the tab still decides which items are in play.
  const all = ws.items.filter((i) => items.some((v) => v.id === i.id) || i.status !== "open");
  const [cards, setCards] = useState<Card[]>(() => all.map((i) => ({ id: i.id, name: i.title, column: i.status, item: i })));
  const fresh = useMemo(() => all.map((i) => ({ id: i.id, name: i.title, column: i.status, item: i })), [all]); // eslint-disable-line react-hooks/exhaustive-deps
  const keyed = JSON.stringify(fresh.map((c) => [c.id, c.column]));
  const [seen, setSeen] = useState(keyed);
  if (seen !== keyed) {
    setSeen(keyed);
    setCards(fresh);
  }

  return (
    <KanbanProvider
      columns={COLUMNS}
      data={cards}
      onDataChange={setCards}
      onDragEnd={async (e) => {
        const id = String(e.active.id);
        const card = cards.find((c) => c.id === id);
        if (!card) return;
        const status = card.column as ItemStatus;
        if (card.item.status === status) return;
        try {
          await ws.updateItem(id, { status });
          toast.success(`${card.name} → ${STATUS_META[status].label}`);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed");
        }
      }}
      className="min-h-[420px]"
    >
      {(column) => (
        <KanbanBoard id={column.id} key={column.id}>
          <KanbanHeader>
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", STATUS_META[column.id as ItemStatus].chip)}>{column.name}</span>
          </KanbanHeader>
          <KanbanCards id={column.id}>
            {(card: Card) => (
              <KanbanCard key={card.id} id={card.id} name={card.name} column={card.column}>
                <button type="button" onClick={() => ws.setSelectedItemId(card.id)} className="block w-full text-left">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <span className={cn("size-1.5 rounded-full", TYPE_META[card.item.type].dot)} />
                    <span className="truncate">{card.name}</span>
                  </p>
                  <p className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{ws.memberName(card.item.owner_slack_id)}</span>
                    <span className="tabular-nums">{formatDue(card.item.due_date, card.item.all_day, ws.timeZone)}</span>
                  </p>
                </button>
              </KanbanCard>
            )}
          </KanbanCards>
        </KanbanBoard>
      )}
    </KanbanProvider>
  );
}

function TableView({ items }: { items: ItemRow[] }) {
  const ws = useWorkspace();
  const people = ws.members.filter((m) => !m.is_bot);
  const columns: ColumnDef[] = [
    { key: "title", label: "Item", type: "text", editable: true },
    {
      key: "type",
      label: "Type",
      type: "select",
      editable: true,
      options: Object.entries(TYPE_META).map(([value, m]) => ({ value, label: m.label })),
      renderCell: (value) => {
        const meta = TYPE_META[value as keyof typeof TYPE_META];
        return meta ? <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", meta.chip)}>{meta.label}</span> : null;
      },
    },
    {
      key: "owner",
      label: "Owner",
      type: "select",
      editable: true,
      options: [{ value: "", label: "Nobody yet" }, ...people.map((m) => ({ value: m.slack_user_id, label: m.display_name }))],
      renderCell: (value) => <OwnerChip id={value ? String(value) : null} />,
    },
    { key: "due", label: "Due", type: "date", editable: true },
    {
      key: "status",
      label: "Status",
      type: "select",
      editable: true,
      options: Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label })),
      renderCell: (value) => {
        const meta = STATUS_META[value as ItemStatus];
        return meta ? <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", meta.chip)}>{meta.label}</span> : null;
      },
    },
    { key: "confirmed", label: "Confirmed", type: "checkbox", editable: false },
    { key: "source", label: "Said in Slack", type: "text", editable: false, width: 320 },
  ];
  const data = items.map((i) => ({
    id: i.id,
    title: i.title,
    type: i.type,
    owner: i.owner_slack_id ?? "",
    due: i.due_date ? localDay(new Date(i.due_date), ws.timeZone) : null,
    status: i.status,
    confirmed: i.human_confirmed,
    source: i.source_text,
  }));

  return (
    <div className="rounded-lg border border-border bg-card/45 p-2 backdrop-blur-md">
      <DataTable
        columns={columns}
        data={data}
        titleKey="title"
        viewId="board"
        searchable
        paginated={false}
        onRowClick={(row) => ws.setSelectedItemId(String(row.id))}
        onEdit={async (rowId, key, value) => {
          try {
            if (key === "title") await ws.updateItem(rowId, { title: String(value ?? "").trim() || undefined });
            else if (key === "type") await ws.updateItem(rowId, { type: value as ItemRow["type"] });
            else if (key === "owner") await ws.updateItem(rowId, { owner_slack_id: value ? String(value) : null });
            else if (key === "status") await ws.updateItem(rowId, { status: value as ItemStatus });
            else if (key === "due") {
              if (!value) await ws.updateItem(rowId, { due_date: null, all_day: true });
              else {
                const raw = value instanceof Date ? localDay(value, ws.timeZone) : String(value).slice(0, 10);
                const p = parseDue(raw, ws.timeZone);
                await ws.updateItem(rowId, { due_date: p.due_date, all_day: true });
              }
            }
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed");
          }
        }}
      />
    </div>
  );
}
