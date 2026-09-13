"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { motion } from "motion/react";
import NumberFlow from "@number-flow/react";
import { Check, Flame, Lock, Snowflake } from "lucide-react";

import { BreathingBars, SheenRing } from "@/components/ui/living-charts";
import { StreakCalendar } from "@/components/ui/streak-calendar";
import { PointsLevelsTimeline } from "@/components/ui/points-levels-timeline";
import { toStreakPeriods } from "@/lib/streak-periods";
import { levelTimeline } from "@/lib/levels";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { PetSprite } from "@/components/pet-sprite";
import { PetDictionary } from "@/components/pet-dictionary";
import { Coin } from "@/components/ui/coin";
import { PetReveal } from "@/components/pet-reveal";
import type { GameSummary } from "@/lib/game-types";
import { MAX_STARS } from "@/lib/game-types";
import { claimQuests, hatchEgg, setBuddies, type Hatched } from "@/lib/game-actions";

/**
 * Progress.
 *
 * Two things are on this page and they are not the same thing. The top half is
 * simply true — streak, punctuality, clean days — and would be worth showing
 * with no game attached at all. The bottom half is the game. If the game ever
 * stops being fun, the top half still earns its place.
 */
const TABS = [
  // Ordered by how often you come for them: the record you check, the game
  // you play, the rules you read once.
  { value: "overview", label: "Overview" },
  { value: "buddies", label: "Buddies" },
  { value: "points", label: "Points" },
];

/** Remembered for the session, like the task table remembers its grouping. */
const TAB_KEY = "coco-progress-tab";

export function ProgressView({
  game,
  completedByDay,
  dayLabels,
  onChanged,
}: {
  game: GameSummary;
  completedByDay: number[];
  dayLabels: string[];
  /** Re-read the summary after a write. */
  onChanged: () => Promise<void> | void;
}) {
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);
  const [petAnim, setPetAnim] = useState<"idle" | "rebirth">("idle");
  const [hatched, setHatched] = useState<Hatched | null>(null);
  const [showAll, setShowAll] = useState(false);
  // Which slot is being filled, or null when the panel is just a summary.
  const [picking, setPicking] = useState<number | null>(null);
  // "2h ago" is a different string on the server than on the client a
  // moment later, and rendering it in both places breaks hydration. It
  // arrives once the page is running.
  const [mounted, setMounted] = useState(false);
  const [tab, setTabRaw] = useState("overview");

  // Read after mount, never during render: the server has no session
  // storage, and starting on a different tab than the server drew is a
  // hydration mismatch.
  useEffect(() => {
    setMounted(true);
    try {
      const saved = sessionStorage.getItem(TAB_KEY);
      if (saved && TABS.some((t) => t.value === saved)) setTabRaw(saved);
    } catch {
      // Private window, or storage refused. The default tab is fine.
    }
  }, []);

  function setTab(next: string) {
    setTabRaw(next);
    try {
      sessionStorage.setItem(TAB_KEY, next);
    } catch {
      // Not worth failing a tab change over.
    }
  }

  const unclaimedCount = game.quests.filter((q) => q.done && !q.paid).length;
  const unclaimed = game.quests
    .filter((q) => q.done && !q.paid)
    .reduce((n, q) => n + q.coins, 0);

  const ownedPets = useMemo(
    () => game.catalogue.filter((p) => p.owned && p.id),
    [game.catalogue],
  );

  /**
   * Put a buddy in a slot, or empty it.
   *
   * The whole set is rebuilt and sent at once. Sending "add this" and "remove
   * that" separately would leave a moment with more buddies equipped than
   * there are slots, which the server is right to refuse.
   */
  async function swapBuddy(slot: number, petId: string | null) {
    const next = game.equipped.map((p) => p.id);
    // A buddy already working somewhere moves rather than appearing twice.
    const from = petId ? next.indexOf(petId) : -1;
    if (from !== -1) next[from] = "";
    next[slot] = petId ?? "";

    setPicking(null);
    run(() => setBuddies(next.filter(Boolean)));
  }

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      setFlash(result.message);
      void onChanged();
    });
  }

  function openEgg(egg: string) {
    startTransition(async () => {
      const result = await hatchEgg(egg);
      if (!result.ok) {
        setFlash(result.message);
      } else {
        setHatched(result);
      }
      void onChanged();
    });
  }

  // Totals, on the same scale the timeline below uses. The bar used to count
  // from the start of the level — 335 of the 400 this level needs — while the
  // timeline said level 4 runs 600 to 999. Both were right and they read as a
  // contradiction, because nothing said one restarted at every level.
  const nextLevelAt = game.xp - game.level_xp + game.level_span;
  // Filled by the same fraction it prints. Measuring the bar one way and
  // labelling it another is the bug this is fixing.
  const pct = nextLevelAt ? (game.xp / nextLevelAt) * 100 : 0;

  const periods = useMemo(
    () => toStreakPeriods(game.active_days, game.streak_grace),
    [game.active_days, game.streak_grace],
  );
  const levels = useMemo(() => levelTimeline(game.level), [game.level]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <header className="mt-5 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Level {game.level}
          </h1>
        </div>

        {flash && (
          <motion.span
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1 text-xs text-emerald-400"
          >
            <Check className="size-3" />
            {flash}
          </motion.span>
        )}
      </header>

      {/* Level bar */}
      <div className="mb-6">
        <div className="mb-1.5 flex items-baseline justify-between text-[11px] text-muted-foreground">
          <span className="tabular-nums">
            {game.xp.toLocaleString()} / {nextLevelAt.toLocaleString()} XP
          </span>
          <span className="tabular-nums">Level {game.level + 1}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>


      {/* The page outgrew a single column. Nine panels stacked put the one
          thing you open it for — the quests — in the middle of a scroll, so
          they are grouped by what they answer: what you did, what the game
          is doing, and where the numbers come from.

          The level bar stays above, because it is the headline and belongs
          on every tab. The same arrangement the tasks page uses. */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="relative data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {/* Slides between tabs rather than cutting, the way the task
                  views do. One layoutId shared by every trigger is the trick. */}
              {tab === t.value && (
                <motion.span
                  layoutId="progress-tab-indicator"
                  transition={SPRING.default}
                  className="absolute inset-0 rounded-md bg-background shadow-sm"
                />
              )}
              <span className="relative inline-flex items-center gap-1.5">
                {t.label}
                {/* Coins waiting say so on the tab itself. Behind a tab they
                    would otherwise be invisible until you happened to look. */}
                {t.value === "buddies" && unclaimedCount > 0 && (
                  <span className="grid size-4 place-items-center rounded-full bg-brand text-[10px] font-medium text-neutral-950">
                    {unclaimedCount}
                  </span>
                )}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">

        {/* ---- The true half ------------------------------------------- */}
        <div className="mb-7 grid gap-4 lg:grid-cols-3">
          <Panel>
            <Label>Streak</Label>
            <div className="mt-3 flex items-center gap-3">
              <Flame
                className={cn(
                  "size-9 shrink-0",
                  game.streak > 0 ? "fill-amber-500/20 text-amber-500" : "text-muted-foreground/40",
                )}
              />
              <div>
                <p className="font-display text-3xl font-semibold tabular-nums">
                  <NumberFlow value={game.streak} />
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {game.streak === 1 ? "day" : "days"} · best {game.best_streak}
                </p>
              </div>
            </div>

            {/* The run itself. A number says "3"; this says which three, and puts
                a snowflake on the days grace covered — a rule that until now
                existed only on the server and never showed up anywhere. */}
            <StreakCalendar
              className="mt-4"
              streak={periods}
              view="month"
              showFreezes
              startOfWeek={1}
            />

            {/* There used to be an "I'm clear today" button here. Confirming
                that you had nothing to do is a question with one answer, and
                forgetting to press it cost a streak the task list already
                proved was intact. An empty day now marks itself, and gives the
                mark back the moment something turns up. */}
            <p className="mt-4 text-xs text-muted-foreground">
              {game.auto_clear
                ? "Nothing due today — counted."
                : game.checked_in
                  ? "Today's counted."
                  : `${game.overdue + game.due_today} thing${
                      game.overdue + game.due_today === 1 ? "" : "s"
                    } still due — finish one to keep the streak.`}
            </p>
          </Panel>

          <Panel>
            <Label>Deadlines met</Label>
            <SheenRing
              className="mt-3"
              size={112}
              stroke={12}
              segments={[
                { label: "On time", value: game.on_time, tint: "var(--color-emerald-500)" },
                {
                  label: "Late",
                  value: game.with_deadline - game.on_time,
                  tint: "var(--color-slate-500)",
                },
              ]}
              centre={
                <p className="font-display text-xl font-semibold tabular-nums">
                  {game.punctuality === null ? "—" : `${game.punctuality}%`}
                </p>
              }
              caption="on time"
            />
          </Panel>

          <Panel>
            <Label>Finished per day</Label>
            <BreathingBars
              className="mt-3"
              data={completedByDay}
              labels={dayLabels}
              tint="var(--color-emerald-500)"
            />
            <p className="mt-3 text-[11px] text-muted-foreground">
              <span className="tabular-nums text-foreground">{game.clean_days}</span>{" "}
              clean day{game.clean_days === 1 ? "" : "s"} — ended with nothing overdue
            </p>
          </Panel>
        </div>
        </TabsContent>

        <TabsContent value="buddies">

        {/* ---- The game half ------------------------------------------- */}
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Panel>
            <div className="flex items-baseline justify-between">
              <Label>Today</Label>
              {unclaimed > 0 && (
                <button
                  onClick={() => run(claimQuests)}
                  disabled={pending}
                  className="rounded-md bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-400 transition-colors hover:bg-amber-500/25 disabled:opacity-40"
                >
                  <span className="inline-flex items-center gap-1">
                    Collect {unclaimed} <Coin />
                  </span>
                </button>
              )}
            </div>

            <ul className="mt-3 grid gap-2">
              {game.quests.map((quest) => (
                <li
                  key={quest.key}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                    quest.done
                      ? "border-emerald-500/25 bg-emerald-500/5"
                      : "border-border/60 bg-card/40",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded-full border",
                      quest.done
                        ? "border-emerald-500 bg-emerald-500 text-background"
                        : "border-border",
                    )}
                  >
                    {quest.done && <Check className="size-2.5" strokeWidth={3} />}
                  </span>
                  <span className={cn("flex-1", quest.done && "text-muted-foreground line-through")}>
                    {quest.label}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {quest.paid ? (
                      "collected"
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        {quest.coins} <Coin />
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <div className="flex items-baseline justify-between">
              <Label>Buddies</Label>
              <span className="inline-flex items-baseline gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-sm font-medium tabular-nums text-amber-400">
                <NumberFlow value={game.coins} />
                <Coin />
              </span>
            </div>

            {/* What is actually equipped. This used to hardcode the phoenix into
                the first slot and the dragon into the second, which said "two
                pets" to someone who owned none — and flatly contradicted the
                dictionary below, where the same two were correctly greyed out. */}
            <div className="mt-3 flex gap-2">
              {Array.from({ length: 3 }, (_, i) => {
                const mine = game.equipped[i];
                const unlocked = i < game.buddy_slots;
                return (
                  <div
                    key={i}
                    className={cn(
                      // Tall enough for the phoenix's rebirth at 2x, which is
                      // 102px of egg, flame and bird.
                      "group/slot relative grid h-28 flex-1 place-items-center overflow-hidden rounded-lg border text-[10px]",
                      mine
                        ? "border-amber-500/25 bg-amber-500/5"
                        : unlocked
                          ? "border-dashed border-border text-muted-foreground"
                          : "border-dashed border-border/40 text-muted-foreground/40",
                    )}
                  >
                    {mine && mine.spec.sprite ? (
                      <button
                        type="button"
                        // A phoenix that cannot be made to burn down and come
                        // back is wasting the one animation it has. Poking is
                        // the click; changing who is in the slot is the button
                        // underneath, so one does not steal the other.
                        onClick={() => {
                          if (mine.spec.sprite === "phoenix" && petAnim === "idle") {
                            setPetAnim("rebirth");
                          }
                        }}
                        title={mine.spec.sprite === "phoenix" ? "Poke" : undefined}
                        className="grid h-full w-full place-items-center"
                      >
                        <PetSprite
                          pet={mine.spec.sprite as "phoenix" | "dragon"}
                          animation={mine.spec.sprite === "phoenix" ? petAnim : "idle"}
                          loop={mine.spec.sprite !== "phoenix" || petAnim === "idle"}
                          onEnd={() => setPetAnim("idle")}
                        />
                      </button>
                    ) : mine ? (
                      mine.spec.name ?? "equipped"
                    ) : unlocked ? (
                      "empty"
                    ) : (
                      <span className="flex items-center gap-1">
                        <Lock className="size-2.5" />
                        lv {i === 1 ? 5 : 12}
                      </span>
                    )}

                    {/* The way in. Every equip until now happened by accident —
                        a newly hatched pet filled a free slot and nothing could
                        ever move it again, so a second pet you liked better
                        stayed on the shelf for good. */}
                    {unlocked && (
                      <button
                        type="button"
                        onClick={() => setPicking(i)}
                        disabled={pending}
                        className="absolute inset-x-0 bottom-0 bg-background/80 py-1 text-[10px] text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/slot:opacity-100 disabled:opacity-0 [@media(hover:none)]:opacity-100"
                      >
                        {mine ? "Change" : "Choose"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Who is available. Open only while choosing, so the panel stays
                a summary the rest of the time. */}
            {picking !== null && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-2 overflow-hidden rounded-lg border border-border/60 bg-card/60"
              >
                <div className="flex items-center justify-between px-3 py-2 text-[11px] text-muted-foreground">
                  <span>Slot {picking + 1}</span>
                  <button
                    type="button"
                    onClick={() => setPicking(null)}
                    className="transition-colors hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>

                <ul className="max-h-56 overflow-y-auto border-t border-border/40">
                  {ownedPets.length === 0 && (
                    <li className="px-3 py-3 text-[11px] text-muted-foreground">
                      Nothing to choose yet — hatch an egg first.
                    </li>
                  )}
                  {ownedPets.map((pet) => {
                    const inSlot = game.equipped[picking]?.id === pet.id;
                    // Equipped elsewhere: picking it should move it, not
                    // clone it, so the slot it was in is left empty.
                    const elsewhere = pet.equipped && !inSlot;
                    return (
                      <li key={pet.id}>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => void swapBuddy(picking, pet.id)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 disabled:opacity-40"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {pet.shiny && "Shiny "}
                            {pet.name}
                            <span className="ml-1.5 text-[10px] text-amber-400">
                              {"★".repeat(pet.stars)}<span className="text-muted-foreground/40">{"★".repeat(MAX_STARS - pet.stars)}</span>
                            </span>
                          </span>
                          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                            +{Math.round(pet.strength * 100)}%{" "}
                            {pet.ability === "both" ? "XP & coins" : pet.ability}
                          </span>
                          <span className="w-16 shrink-0 text-right text-[10px] text-muted-foreground">
                            {inSlot ? "in this slot" : elsewhere ? "move here" : ""}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {game.equipped[picking] && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void swapBuddy(picking, null)}
                    className="w-full border-t border-border/40 px-3 py-2 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                  >
                    Leave the slot empty
                  </button>
                )}
              </motion.div>
            )}

            <div className="mt-3 grid gap-2">
              {game.eggs.map((egg) => {
                const blocked = egg.locked || !egg.affordable || pending;
                return (
                  <button
                    key={egg.key}
                    onClick={() => openEgg(egg.key)}
                    disabled={blocked}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      blocked
                        ? "cursor-not-allowed border-border/50 opacity-50"
                        : "border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm">{egg.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {egg.locked
                          ? `Unlocks at level ${egg.min_level}`
                          : `${Math.round(egg.odds.rare * 100)}% rare or better`}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-amber-400">
                      <span className="inline-flex items-center gap-1">
                        {egg.cost} <Coin />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <dl className="mt-4 grid gap-1.5 text-xs">
              <Row label="Slots unlocked" value={`${game.buddy_slots} of 3`} />
              <Row
                label="Streak freezes"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Snowflake className="size-3" />
                    {game.freezes}
                  </span>
                }
              />
              <Row label="Collected" value={`${game.pets_owned} of ${game.pets_total}`} />
              <Row
                label="Earning rate"
                value={`${game.multipliers.xp}× XP · ${game.multipliers.coins}× coins`}
              />
            </dl>

          </Panel>
        </div>

        <PetDictionary pets={game.catalogue} />

        </TabsContent>

        <TabsContent value="points">

        {/* What was actually earned. The table below says what things are
            worth; this says what you got, which is the question anyone
            actually has when a number moves. */}
        {game.ledger.length > 0 && (
          <section className="mt-4 min-w-0 rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
            <div className="flex items-baseline justify-between gap-4">
              <Label>Recent earnings</Label>
              <span className="text-[10px] text-muted-foreground">newest first</span>
            </div>

            <ul className="mt-3 divide-y divide-border/40">
              {game.ledger.slice(0, showAll ? undefined : 8).map((entry, i) => (
                <motion.li
                  key={`${entry.at}-${entry.title}-${i}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center gap-4 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{entry.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {[mounted ? when(entry.at) : null, ...entry.reasons]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>

                  {entry.xp !== 0 && (
                    <span className="shrink-0 tabular-nums text-sm font-medium text-sky-400">
                      +{entry.xp}
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">XP</span>
                    </span>
                  )}

                  {entry.coins !== 0 && (
                    <span
                      className={cn(
                        "inline-flex w-16 shrink-0 items-center justify-end gap-1 tabular-nums text-sm font-medium",
                        // Spent, not earned — an egg costs coins, and a minus
                        // sign in the same colour as a reward reads as one.
                        entry.coins < 0 && "text-muted-foreground",
                      )}
                    >
                      {entry.coins > 0 ? "+" : "−"}
                      {Math.abs(entry.coins)} <Coin />
                    </span>
                  )}
                </motion.li>
              ))}
            </ul>

            {game.ledger.length > 8 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="mt-3 w-full border-t border-border/40 pt-3 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {showAll
                  ? "Show less"
                  : `Show ${game.ledger.length - 8} more`}
              </button>
            )}
          </section>
        )}

        {/* Where the points come from. The numbers are the ones the server
            scores with, sent down with the summary — written out again here
            they would eventually disagree with what actually gets awarded, and
            a rewards table that lies is worse than none. */}
        <section className="mt-4 min-w-0 rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
          <Label>How you earn</Label>

          <ul className="mt-3 divide-y divide-border/40">
            {game.awards.map((award, i) => (
              <motion.li
                key={award.action}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="group/award flex items-center gap-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{award.action}</p>
                  {/* The caveat each line carries, kept out of the way until
                      wanted — the row reads as a number at a glance, and
                      explains itself when you look at it. */}
                  <p className="mt-0.5 max-h-0 overflow-hidden text-[11px] leading-relaxed text-muted-foreground opacity-0 transition-all duration-300 group-hover/award:max-h-10 group-hover/award:opacity-100 [@media(hover:none)]:max-h-10 [@media(hover:none)]:opacity-100">
                    {award.detail}
                  </p>
                </div>

                <span className="shrink-0 tabular-nums text-sm font-medium text-sky-400">
                  +{award.xp}
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">XP</span>
                </span>

                <span className="inline-flex w-16 shrink-0 items-center justify-end gap-1 tabular-nums text-sm font-medium">
                  +{award.coins} <Coin />
                </span>

                <span className="w-14 shrink-0 text-right text-[10px] text-muted-foreground">
                  {award.per_day ? "per day" : ""}
                </span>
              </motion.li>
            ))}
          </ul>

          <p className="mt-3 border-t border-border/40 pt-3 text-[11px] leading-relaxed text-muted-foreground">
            Deadline bonuses need a deadline, and need the task to have existed for
            at least {game.unplanned_minutes} minutes — something written down and
            finished in the same breath had no lead time to reward, which is not the
            same as cheating and is never penalised.
            {game.multipliers.xp !== 1 || game.multipliers.coins !== 1 ? (
              <>
                {" "}Your buddies are multiplying these by ×{game.multipliers.xp} XP
                and ×{game.multipliers.coins} coins.
              </>
            ) : null}
          </p>
        </section>

        {/* What the bar at the top is climbing towards. The curve was always
            there in the engine; this is the first time it is legible. */}
        <section className="mt-4 min-w-0 rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
          <Label>What is ahead</Label>
          <PointsLevelsTimeline
            className="mt-3"
            levels={levels}
            currentPoints={game.xp}
            currentLevelLabel={`Level ${game.level}`}
            formatPoints={(value) => value.toLocaleString()}
          />
        </section>
        </TabsContent>
      </Tabs>

      {/* Outside the tabs on purpose: it is a modal, and a hatch begun on one
          tab must not be unmounted by switching to another. */}

      <PetReveal result={hatched} onClose={() => setHatched(null)} />

    </main>
  );
}

/** "just now", "2h ago", "3d ago" — short enough to sit beside a number. */
function when(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  const days = Math.round(mins / 1440);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{children}</p>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
