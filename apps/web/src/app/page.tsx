"use client";

/**
 * The overview, laid out the way myTask's dashboard is: a greeting instead of
 * a title, three charts that read as one row, the working list under them so
 * the page lets you do something, and a timeline of what is next.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Flame, Inbox } from "lucide-react";
import type { ItemRow } from "agent-core/shared";
import { addDays, daysUntil, fieldsOf, formatDue, localDay, relativeDue } from "agent-core/shared";
import { useWorkspace } from "@/lib/store";
import { useGame } from "@/lib/use-game";
import { collectable } from "@/lib/game-types";
import { TYPE_META } from "@/lib/labels";
import { greetingFor, type Greeting } from "@/lib/greeting";
import { DURATION, EASE } from "@/lib/motion";
import { ListView } from "@/components/board";
import { EmptyState } from "@/components/empty-state";
import { DashboardNotes } from "@/components/dashboard-notes";
import { CalendarDaysIcon } from "@/components/ui/calendar-days";
import { BreathingBars, SheenRing, SweepSparkline } from "@/components/ui/living-charts";
import { LiquidMetal } from "@/components/ui/liquid-metal";
import { cn } from "@/lib/utils";

const OWNER_TONES = ["text-sky-400", "text-violet-400", "text-amber-400", "text-emerald-400", "text-rose-400", "text-cyan-400"];

/** Seven days of counts ending today, plus one-letter day labels, in the team's zone. */
function byDay(instants: (string | null)[], now: Date, tz: string): { counts: number[]; labels: string[] } {
  const days = Array.from({ length: 7 }, (_, i) => addDays(now, i - 6, tz));
  const keys = days.map((d) => localDay(d, tz));
  const counts = keys.map((k) => instants.filter((iso) => iso && localDay(new Date(iso), tz) === k).length);
  const labels = days.map((d) => fieldsOf(d, tz).weekday.slice(0, 1));
  return { counts, labels };
}

export default function Overview() {
  const ws = useWorkspace();
  const { captures, items, ready, timeZone, channelName, me, memberName, setSelectedCaptureId } = ws;
  const { game } = useGame();
  const now = new Date();

  const open = items.filter((i) => i.status === "open");
  const done = items.filter((i) => i.status === "done");
  const dropped = items.filter((i) => i.status === "dropped");
  const late = open.filter((i) => i.due_date && daysUntil(i.due_date, now, timeZone) < 0);
  const upNext = open
    .filter((i) => i.due_date)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
    .slice(0, 6);

  // Picked after mount: a greeting derived from the clock during render
  // disagrees between server and client.
  const [greeting, setGreeting] = useState<Greeting>({ salutation: "Hello", aside: "" });
  useEffect(() => {
    const first = me ? (memberName(me).split(/\s+/)[0] ?? "") : "";
    setGreeting(greetingFor(new Date(), first, open.length + captures.length > 0));
  }, [me, memberName, open.length, captures.length]);

  const completed = useMemo(() => byDay(done.map((i) => i.completed_at), now, timeZone), [done, timeZone]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastWeek = completed.counts.slice(0, 3).reduce((a, c) => a + c, 0);
  const thisWeek = completed.counts.slice(4).reduce((a, c) => a + c, 0);
  const trend = lastWeek === 0 ? (thisWeek > 0 ? "+100%" : "—") : `${thisWeek >= lastWeek ? "+" : ""}${Math.round(((thisWeek - lastWeek) / lastWeek) * 100)}%`;

  // One row per person with anything on the board, most loaded first.
  const byPerson = useMemo(() => {
    const owners = [...new Set(items.map((i) => i.owner_slack_id ?? ""))];
    return owners
      .map((id, idx) => {
        const mine = items.filter((i) => (i.owner_slack_id ?? "") === id);
        return {
          id,
          label: id ? (memberName(id).split(/\s+/)[0] ?? memberName(id)) : "Unowned",
          value: mine.filter((i) => i.status === "open").length,
          trend: byDay(mine.map((i) => i.created_at), now, timeZone).counts,
          tone: OWNER_TONES[idx % OWNER_TONES.length]!,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [items, memberName, timeZone]); // eslint-disable-line react-hooks/exhaustive-deps

  const segments = [
    { label: "Open", value: open.length, tint: "var(--primary)" },
    { label: "Done", value: done.length, tint: "var(--color-emerald-500)" },
    { label: "Pending", value: captures.length, tint: "var(--color-amber-500)" },
    { label: "Dropped", value: dropped.length, tint: "var(--muted-foreground)" },
  ];

  return (
    <div className="relative mx-auto w-full max-w-6xl px-6 py-7">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.base, ease: EASE.expressive }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{greeting.salutation}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{greeting.aside || `Listening to #${channelName}.`}</p>
          {me && (
            <Link
              href="/progress"
              className="mr-2 mt-3 inline-flex items-center gap-3 rounded-full border border-border/70 bg-card/50 py-1 pl-2.5 pr-3 text-xs backdrop-blur-sm transition-colors hover:border-foreground/30"
            >
              <span className="inline-flex items-center gap-1">
                <Flame className={cn("size-3.5", game.streak > 0 ? "fill-amber-500/20 text-amber-500" : "text-muted-foreground/50")} />
                <span className="tabular-nums">{game.streak}</span>
              </span>
              <span className="h-3 w-px bg-border" />
              <span className="text-muted-foreground">
                Level <span className="tabular-nums text-foreground">{game.level}</span>
              </span>
              {collectable(game) > 0 && (
                <>
                  <span className="h-3 w-px bg-border" />
                  <span className="text-amber-400">coins to collect</span>
                </>
              )}
            </Link>
          )}
          <div className="mt-3 inline-flex items-center gap-3 rounded-full border border-border/70 bg-card/50 py-1 pl-3 pr-3 text-xs backdrop-blur-sm">
            <span className="text-muted-foreground">
              <span className="tabular-nums text-foreground">{open.length}</span> open
            </span>
            <span className="h-3 w-px bg-border" />
            <span className={cn("text-muted-foreground", late.length > 0 && "text-destructive")}>
              <span className="tabular-nums">{late.length}</span> late
            </span>
            <span className="h-3 w-px bg-border" />
            <span className={cn("text-muted-foreground", captures.length > 0 && "text-amber-400")}>
              <span className="tabular-nums">{captures.length}</span> waiting for you
            </span>
          </div>
        </div>

        {/* The one action this page points at, wearing myTask's metal rim: the
            shader shows through the 2px padding and nowhere else. */}
        <div className="relative shrink-0 overflow-hidden rounded-lg" style={{ padding: 2 }}>
          <LiquidMetal colorBack="#4c4f6b" colorTint="#a5b4fc" speed={0.4} repetition={4} distortion={0.15} className="absolute inset-0 z-0 rounded-lg" />
          <Link
            href="/review"
            className="relative z-10 flex items-center gap-2 rounded-md bg-card/80 px-4 py-2 text-sm font-medium text-foreground backdrop-blur-md transition-colors hover:bg-card"
          >
            <Inbox className="size-3.5 text-muted-foreground" />
            Review
            {captures.length > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold tabular-nums text-primary-foreground">
                {captures.length}
              </span>
            )}
          </Link>
        </div>
      </motion.div>

      {/* Notes sit under the greeting and above the numbers: near enough to be
          seen, far enough not to be the headline. */}
      <DashboardNotes />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.base, ease: EASE.expressive, delay: 0.1 }}
        className="mt-5 grid gap-4 lg:grid-cols-3"
      >
        <div className="rounded-lg border border-border bg-card/45 p-4 backdrop-blur-md">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Workload</p>
          <SheenRing
            className="mt-4 flex-col justify-center gap-4 [&>ul]:w-full [&>ul]:max-w-[11rem]"
            size={124}
            stroke={13}
            segments={segments}
            centre={
              <span className="block font-display text-3xl font-semibold leading-none tabular-nums">
                {ready ? items.length + captures.length : "–"}
              </span>
            }
            caption="heard"
          />
        </div>

        <div className="rounded-lg border border-border bg-card/45 p-4 backdrop-blur-md">
          <div className="flex items-baseline justify-between">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Completed</p>
            <p className="text-xs font-medium text-emerald-500">{trend}</p>
          </div>
          <BreathingBars className="mt-3" data={completed.counts} labels={completed.labels} tint="var(--color-emerald-500)" />
        </div>

        <div className="rounded-lg border border-border bg-card/45 p-4 backdrop-blur-md">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">By person</p>
          {byPerson.length === 0 ? (
            <p className="mt-4 text-xs text-muted-foreground">Nobody owns anything yet.</p>
          ) : (
            <ul className="mt-4 space-y-3.5">
              {byPerson.map((row) => (
                <li key={row.id} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 truncate text-xs text-muted-foreground">{row.label}</span>
                  <SweepSparkline
                    data={row.trend}
                    className={cn("h-6 min-w-0 flex-1", row.tone)}
                    tooltip={
                      <>
                        <span className="font-medium">{row.label}</span>
                        <span className="ml-2 tabular-nums text-muted-foreground">{row.value} open</span>
                      </>
                    }
                  />
                  <span className="w-5 shrink-0 text-right text-sm tabular-nums">{row.value}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>

      {/* The working list, so the page lets you do something about the numbers. */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Your list</h2>
          <Link href="/board" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
            Open the board →
          </Link>
        </div>
        <div className="mt-4">
          {open.length === 0 ? (
            <EmptyState icon={Inbox} title="Nothing open" body="Approve something on the Review page and it lands here." className="bg-card/35 backdrop-blur-md" />
          ) : (
            <ListView items={open} />
          )}
        </div>
      </section>

      {/* A rail rather than a bare list: a marker per item, the connector between. */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Up next</h2>
          {captures.length > 0 && (
            <Link href="/review" className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
              {captures.length} waiting for review <ArrowRight className="size-3" />
            </Link>
          )}
        </div>
        {upNext.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nothing dated yet.</p>
        ) : (
          <ol className="mt-4">
            {upNext.map((item, i) => (
              <UpNextRow key={item.id} item={item} first={i === 0} last={i === upNext.length - 1} />
            ))}
          </ol>
        )}
      </section>

      {captures.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Just heard</h2>
          <ul className="mt-4 divide-y divide-border/60 rounded-lg border border-border bg-card/45 backdrop-blur-md">
            {captures.slice(0, 4).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedCaptureId(c.id)}
                  className="flex w-full flex-col gap-1 px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="flex items-center gap-2">
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", TYPE_META[c.type].chip)}>{TYPE_META[c.type].label}</span>
                    <span className="truncate text-sm">{c.title}</span>
                  </span>
                  <span className="truncate pl-0.5 text-xs text-muted-foreground">“{c.source_text}”</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function UpNextRow({ item, first, last }: { item: ItemRow; first: boolean; last: boolean }) {
  const { timeZone, memberName, setSelectedItemId } = useWorkspace();
  const now = new Date();
  const isNow = first && item.due_date !== null && daysUntil(item.due_date, now, timeZone) === 0;
  return (
    <li className="flex gap-4">
      <div className="flex flex-col items-center">
        <span className="relative grid size-6 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground">
          {isNow && (
            <motion.span
              className="absolute inset-0 rounded-full bg-primary/25"
              animate={{ scale: [1, 1.6, 1], opacity: [0.7, 0, 0.7] }}
              transition={{ duration: 2.4, ease: "easeOut", repeat: Infinity }}
            />
          )}
          <CalendarDaysIcon size={12} className="relative" />
        </span>
        {!last && <span className="my-1 w-px flex-1 bg-border" />}
      </div>
      <button type="button" onClick={() => setSelectedItemId(item.id)} className="flex flex-1 items-start gap-3 pb-7 text-left">
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug hover:underline">{item.title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", TYPE_META[item.type].dot)} />
            {memberName(item.owner_slack_id)}
          </p>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {formatDue(item.due_date, item.all_day, timeZone)} · {relativeDue(item.due_date, now, timeZone)}
        </span>
      </button>
    </li>
  );
}
