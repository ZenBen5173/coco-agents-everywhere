/**
 * The game layer: scoring, streaks, quests, pets. Ported from myTask's
 * game.py, per team member.
 *
 * Two rules run through all of it. **Rewards come only from real work** —
 * nothing pays out for opening the app or tapping a button; the one action
 * that looks free, the clear-day check-in, is only counted when the server can
 * see nothing overdue and nothing due. **The game never gates the app** —
 * every feature works identically at level 1 and level 50.
 *
 * And a third, inherited from the review queue: "done" here is a human's
 * claim on a promise the team heard in Slack. What can be verified is a
 * deadline set and met, and how far ahead it was finished. So: reward
 * promises kept, not boxes ticked. Every line is a bonus. Nothing subtracts.
 */
import { serviceClient } from "../supabase";
import { addDays, fieldsOf, localDay, resolveTimeZone } from "../dates";
import type { ItemRow } from "../types";

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export const XP_COMPLETE = 5;
export const XP_ON_TIME = 15;
export const XP_PER_DAY_EARLY = 5;
export const XP_EARLY_CAP = 25;
export const XP_OVERDUE_CLEARED = 10;
export const XP_CAPTURED = 5;
export const XP_CHECKIN = 5;
export const COINS_CHECKIN = 3;

export const COINS_COMPLETE = 2;
export const COINS_ON_TIME = 6;
export const COINS_PER_DAY_EARLY = 2;
export const COINS_EARLY_CAP = 10;
export const COINS_OVERDUE_CLEARED = 4;
export const COINS_CAPTURED = 2;

/** An item approved and finished within this window involved no planning: base award only. */
const UNPLANNED_MINUTES = 10;

export function awardTable() {
  return [
    { action: "Finish anything", detail: "Every completed item, however it arrived.", xp: XP_COMPLETE, coins: COINS_COMPLETE },
    { action: "Heard in Slack", detail: "The item came from the channel rather than being typed here.", xp: XP_CAPTURED, coins: COINS_CAPTURED },
    { action: "Meet a deadline", detail: "Finished on or before its due time. Needs a deadline to beat.", xp: XP_ON_TIME, coins: COINS_ON_TIME },
    { action: "Finish early", detail: `Per whole day ahead, up to ${XP_EARLY_CAP} XP and ${COINS_EARLY_CAP} coins.`, xp: XP_PER_DAY_EARLY, coins: COINS_PER_DAY_EARLY, per_day: true },
    { action: "Clear something overdue", detail: "Late is never a penalty. Paying the debt still counts.", xp: XP_OVERDUE_CLEARED, coins: COINS_OVERDUE_CLEARED },
  ];
}

const LEDGER_LABELS: Record<string, string> = {
  complete: "finished",
  captured: "heard in Slack",
  on_time: "on time",
  overdue_cleared: "overdue cleared",
  checkin: "clear day",
  duplicate: "duplicate",
  freeze_used: "streak freeze",
};
const REASON_ORDER: Record<string, number> = { finished: 0, "heard in Slack": 1, "on time": 2, early: 3, "overdue cleared": 4 };
const ITEM_AWARD_KINDS = new Set(["complete", "captured", "on_time", "early", "overdue_cleared"]);
const AWARD_GROUP_WINDOW_MS = 5000;

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

/** Level n starts at 50·n·(n−1) XP: 0, 100, 300, 600, 1000, 1500… */
export function levelFor(xp: number): number {
  let level = 1;
  while (xp >= 50 * (level + 1) * level) level++;
  return level;
}
export function levelSpan(xp: number): { level: number; into: number; span: number } {
  const level = levelFor(xp);
  const floor = 50 * level * (level - 1);
  const ceiling = 50 * (level + 1) * level;
  return { level, into: xp - floor, span: ceiling - floor };
}
export function buddySlots(level: number): number {
  return level >= 12 ? 3 : level >= 5 ? 2 : 1;
}
const FREEZE_LEVELS = [3, 6, 9, 12, 15, 20, 25, 30];
export function freezesEarned(level: number): number {
  return FREEZE_LEVELS.filter((m) => level >= m).length;
}

// ---------------------------------------------------------------------------
// Pets
// ---------------------------------------------------------------------------

export type Rarity = "common" | "rare" | "epic" | "legendary";
export type PetSpec = { name: string; rarity: Rarity; ability: "xp" | "coins" | "both"; amount: number; blurb: string; sprite: string };
const RARITIES: Rarity[] = ["common", "rare", "epic", "legendary"];

export const PETS: Record<string, PetSpec> = {
  kitten: { name: "Kitten", rarity: "common", ability: "coins", amount: 0.1, blurb: "Sits on the notes you need.", sprite: "kitten" },
  duck: { name: "Duck", rarity: "common", ability: "coins", amount: 0.08, blurb: "You explain the problem, it nods.", sprite: "duck" },
  bunny: { name: "Bunny", rarity: "common", ability: "xp", amount: 0.2, blurb: "Never once walks anywhere.", sprite: "bunny" },
  mushroom: { name: "Mushroom", rarity: "common", ability: "xp", amount: 0.12, blurb: "Grew overnight, like the list.", sprite: "mushroom" },
  hatchling: { name: "Hatchling", rarity: "common", ability: "xp", amount: 0.15, blurb: "Small leaps, every single day.", sprite: "hatchling" },
  penguin: { name: "Penguin", rarity: "rare", ability: "xp", amount: 0.3, blurb: "Dressed for an occasion you forgot.", sprite: "penguin" },
  teddy_bear: { name: "Teddy Bear", rarity: "rare", ability: "coins", amount: 0.25, blurb: "Just glad you showed up today.", sprite: "teddy_bear" },
  slime: { name: "Adventurer", rarity: "rare", ability: "coins", amount: 0.2, blurb: "Heads out before the plan is finished.", sprite: "slime" },
  flame_sprite: { name: "Flame Sprite", rarity: "epic", ability: "xp", amount: 0.4, blurb: "Burns brightest the night before.", sprite: "flame_sprite" },
  zombie: { name: "Zombie", rarity: "epic", ability: "coins", amount: 0.4, blurb: "Still going. Nobody knows how.", sprite: "zombie" },
  polar_bear: { name: "Polar Bear", rarity: "legendary", ability: "both", amount: 0.25, blurb: "Unbothered by the deadline, or anything.", sprite: "polar_bear" },
  exam_dragon: { name: "Dragon", rarity: "legendary", ability: "xp", amount: 0.5, blurb: "Turns up the week before. Always ready.", sprite: "dragon" },
  phoenixling: { name: "Phoenixling", rarity: "legendary", ability: "both", amount: 0.2, blurb: "Burns down on a bad day and comes back on the next.", sprite: "phoenix" },
};
const BY_RARITY: Record<Rarity, string[]> = { common: [], rare: [], epic: [], legendary: [] };
for (const [key, spec] of Object.entries(PETS)) BY_RARITY[spec.rarity].push(key);

export const EGGS: Record<string, { name: string; cost: number; min_level?: number; odds: Record<Rarity, number> }> = {
  study: { name: "Team Egg", cost: 60, odds: { common: 0.7, rare: 0.25, epic: 0.04, legendary: 0.01 } },
  golden: { name: "Golden Egg", cost: 150, min_level: 5, odds: { common: 0.3, rare: 0.45, epic: 0.2, legendary: 0.05 } },
};
const SHINY_CHANCE = 0.05;
const PITY_AT = 40;
export const MAX_STARS = 5;

/** +25% of the base per star. 0 stars is the base; 5 stars is 2.25x it. */
export function abilityStrength(petKey: string, stars: number): number {
  return (PETS[petKey]?.amount ?? 0) * (1 + 0.25 * stars);
}
export function multipliers(equipped: PetRow[]): { xp: number; coins: number } {
  let xp = 1;
  let coins = 1;
  for (const pet of equipped) {
    const spec = PETS[pet.pet_key];
    if (!spec) continue;
    const s = abilityStrength(pet.pet_key, pet.stars);
    if (spec.ability === "xp" || spec.ability === "both") xp += s;
    if (spec.ability === "coins" || spec.ability === "both") coins += s;
  }
  return { xp: Math.round(xp * 100) / 100, coins: Math.round(coins * 100) / 100 };
}

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

const PLAN_AHEAD_DAYS = 7;
export const QUESTS: Record<string, { label: string; coins: number }> = {
  capture: { label: "Approve something from the review queue", coins: 15 },
  finish_two: { label: "Finish two things", coins: 15 },
  clear_overdue: { label: "Clear something overdue", coins: 20 },
  finish_early: { label: "Finish something a day early", coins: 20 },
  plan_ahead: { label: "Put something on the board due next week or later", coins: 10 },
};
const ALWAYS = "capture";

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type GameEvent = {
  id: string;
  member_slack_id: string;
  item_id: string | null;
  kind: string;
  xp: number;
  coins: number;
  multiplier: number;
  coin_multiplier: number;
  detail: string | null;
  day: string;
  created_at: string;
};
export type PetRow = { id: string; member_slack_id: string; pet_key: string; stars: number; shiny: boolean; equipped: boolean; acquired_at: string };

const STREAK_GRACE = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const tz = () => resolveTimeZone();
const dayOf = (iso: string) => localDay(new Date(iso), tz());
const todayKey = () => localDay(new Date(), tz());
const daysBetween = (a: string, b: string) => {
  const [ay, am, ad] = a.split("-").map(Number) as [number, number, number];
  const [by, bm, bd] = b.split("-").map(Number) as [number, number, number];
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
};

/** When an item is actually late. An all-day item's deadline is the *end* of that day. */
export function deadlineOf(item: Pick<ItemRow, "due_date" | "all_day">): Date | null {
  if (!item.due_date) return null;
  const due = new Date(item.due_date);
  if (!item.all_day) return due;
  const f = fieldsOf(due, tz());
  // 23:59:59 local of that day: take local midnight of the next day minus one second.
  const nextMidnight = addDays(new Date(Date.UTC(f.year, f.month - 1, f.day, 12)), 1, tz());
  const nf = fieldsOf(nextMidnight, tz());
  const startNext = new Date(due.getTime());
  // Compute local midnight of the next day via instant math: easier to reuse dates helpers.
  void nf;
  void startNext;
  const dayEnd = new Date(due.getTime() + 24 * 60 * 60 * 1000 - 1000);
  return dayEnd;
}

function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (const ch of seed) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return () => {
    h = (Math.imul(h ^ (h >>> 15), 2246822519) ^ Math.imul(h ^ (h >>> 13), 3266489917)) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
}
function sample<T>(items: T[], n: number, rnd: () => number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]!);
  return out;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

async function events(member: string, limit = 2000): Promise<GameEvent[]> {
  const { data } = await serviceClient().from("game_events").select("*").eq("member_slack_id", member).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as GameEvent[];
}
async function pets(member: string): Promise<PetRow[]> {
  const { data } = await serviceClient().from("pets").select("*").eq("member_slack_id", member).order("acquired_at");
  return (data ?? []) as PetRow[];
}
async function checkins(member: string): Promise<{ day: string }[]> {
  const { data } = await serviceClient().from("clear_checkins").select("day").eq("member_slack_id", member);
  return (data ?? []) as { day: string }[];
}
async function memberItems(member: string): Promise<ItemRow[]> {
  const { data } = await serviceClient().from("items").select("*").eq("owner_slack_id", member);
  return (data ?? []) as ItemRow[];
}
async function memberNoteDays(member: string): Promise<string[]> {
  const { data } = await serviceClient().from("notes").select("created_at").eq("author_slack_id", member);
  return ((data ?? []) as { created_at: string }[]).map((n) => dayOf(n.created_at));
}
async function approvedTodayCount(): Promise<number> {
  const { data } = await serviceClient().from("captures").select("reviewed_at").eq("status", "approved").not("reviewed_at", "is", null);
  const today = todayKey();
  return ((data ?? []) as { reviewed_at: string }[]).filter((c) => dayOf(c.reviewed_at) === today).length;
}
async function totals(member: string): Promise<{ xp: number; coins: number }> {
  const rows = await events(member, 5000);
  return rows.reduce((t, e) => ({ xp: t.xp + (e.xp || 0), coins: t.coins + (e.coins || 0) }), { xp: 0, coins: 0 });
}
async function record(member: string, ev: Partial<GameEvent> & { kind: string; day: string }): Promise<GameEvent | null> {
  const row = { member_slack_id: member, xp: 0, coins: 0, multiplier: 1, coin_multiplier: 1, ...ev };
  const { data, error } = await serviceClient().from("game_events").upsert(row, { onConflict: "member_slack_id,item_id,kind", ignoreDuplicates: true }).select("*").maybeSingle();
  if (error) {
    console.error("[game]", error.message);
    return null;
  }
  return (data as GameEvent | null) ?? null;
}

async function buffed(member: string, xp: number, coins: number) {
  const equipped = (await pets(member)).filter((p) => p.equipped);
  const m = multipliers(equipped);
  return { xp: Math.round(xp * m.xp), coins: Math.round(coins * m.coins), multiplier: m.xp, coin_multiplier: m.coins };
}

// ---------------------------------------------------------------------------
// Awarding
// ---------------------------------------------------------------------------

/**
 * Bank what a finished item earned. Idempotent per (member, item, kind) by
 * unique index, so ticking twice pays once. The player is the item's owner,
 * or whoever ticked it when nobody owns it.
 */
export async function awardForItem(item: ItemRow, actor: string | null): Promise<GameEvent[]> {
  const member = item.owner_slack_id ?? actor;
  if (!member || !item.completed_at) return [];
  const doneAt = new Date(item.completed_at);
  const createdAt = new Date(item.created_at);
  const day = dayOf(item.completed_at);
  const m = multipliers((await pets(member)).filter((p) => p.equipped));

  const lines: [string, number, number, string | null][] = [["complete", XP_COMPLETE, COINS_COMPLETE, null]];
  // Everything on the board was heard in Slack; that is the habit this rewards.
  lines.push(["captured", XP_CAPTURED, COINS_CAPTURED, null]);

  const planned = doneAt.getTime() - createdAt.getTime() >= UNPLANNED_MINUTES * 60_000;
  const due = deadlineOf(item);
  if (due && planned) {
    if (doneAt <= due) {
      lines.push(["on_time", XP_ON_TIME, COINS_ON_TIME, null]);
      const daysEarly = Math.floor((due.getTime() - doneAt.getTime()) / 86_400_000);
      if (daysEarly >= 1) {
        lines.push(["early", Math.min(daysEarly * XP_PER_DAY_EARLY, XP_EARLY_CAP), Math.min(daysEarly * COINS_PER_DAY_EARLY, COINS_EARLY_CAP), `${daysEarly}d early`]);
      }
    } else {
      lines.push(["overdue_cleared", XP_OVERDUE_CLEARED, COINS_OVERDUE_CLEARED, null]);
    }
  }

  const awarded: GameEvent[] = [];
  for (const [kind, xp, coins, detail] of lines) {
    const row = await record(member, { item_id: item.id, kind, xp: Math.round(xp * m.xp), coins: Math.round(coins * m.coins), multiplier: m.xp, coin_multiplier: m.coins, detail, day });
    if (row) awarded.push(row);
  }
  return awarded;
}

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

function offerable(key: string, day: string, items: ItemRow[], now: Date): boolean {
  if (key === ALWAYS) return true;
  const open = items.filter((i) => i.status === "open");
  const finishedToday = items.filter((i) => i.completed_at && dayOf(i.completed_at) === day);
  if (key === "plan_ahead") {
    return !open.some((i) => i.due_date && (deadlineOf(i)!.getTime() - now.getTime()) / 86_400_000 >= PLAN_AHEAD_DAYS);
  }
  if (key === "finish_two") {
    const onPlate = open.filter((i) => !i.due_date || deadlineOf(i)! < now || dayOf(i.due_date) === day);
    return onPlate.length + finishedToday.length >= 2;
  }
  if (key === "clear_overdue") {
    return open.some((i) => i.due_date && deadlineOf(i)! < now) || finishedToday.some((i) => i.due_date && deadlineOf(i)! < new Date(i.completed_at!));
  }
  if (key === "finish_early") {
    return open.some((i) => i.due_date && dayOf(i.due_date) > day);
  }
  return true;
}

/** The day's quests, fixed the first time the day is looked at. */
async function questsFor(member: string, day: string, items: ItemRow[]): Promise<string[]> {
  const db = serviceClient();
  const { data } = await db.from("daily_quests").select("quest_keys").eq("member_slack_id", member).eq("day", day).maybeSingle();
  if (data?.quest_keys?.length) return data.quest_keys as string[];
  const now = new Date();
  const pool = Object.keys(QUESTS).filter((k) => k !== ALWAYS && offerable(k, day, items, now));
  const picked = sample(pool, Math.min(2, pool.length), seededRandom(`${member}:${day}`));
  const keys = [ALWAYS, ...picked];
  await db.from("daily_quests").upsert({ member_slack_id: member, day, quest_keys: keys }, { onConflict: "member_slack_id,day", ignoreDuplicates: true });
  return keys;
}

async function questState(member: string, day: string, todayEvents: GameEvent[], items: ItemRow[]) {
  const finishedToday = items.filter((i) => i.completed_at && dayOf(i.completed_at) === day);
  const kinds = new Set(todayEvents.map((e) => e.kind));
  const now = new Date();
  const met: Record<string, boolean> = {
    capture: (await approvedTodayCount()) > 0,
    finish_two: finishedToday.length >= 2,
    clear_overdue: kinds.has("overdue_cleared"),
    finish_early: kinds.has("early"),
    plan_ahead: items.some((i) => dayOf(i.created_at) === day && i.due_date && (new Date(i.due_date).getTime() - now.getTime()) / 86_400_000 >= PLAN_AHEAD_DAYS),
  };
  const paid = new Set(todayEvents.filter((e) => e.kind === "quest").map((e) => e.detail));
  return (await questsFor(member, day, items)).map((key) => ({ key, label: QUESTS[key]!.label, coins: QUESTS[key]!.coins, done: met[key] ?? false, paid: paid.has(key) }));
}

export async function claimQuests(member: string): Promise<{ ok: boolean; message: string; coins: number }> {
  const day = todayKey();
  const items = await memberItems(member);
  const todayEvents = (await events(member)).filter((e) => e.day === day);
  const quests = await questState(member, day, todayEvents, items);
  let coins = 0;
  for (const q of quests) {
    if (!q.done || q.paid) continue;
    const award = await buffed(member, 0, q.coins);
    const row = await record(member, { kind: "quest", detail: q.key, day, ...award });
    if (row) coins += award.coins;
  }
  return coins ? { ok: true, message: `Collected ${coins} coins.`, coins } : { ok: false, message: "Nothing to collect yet.", coins: 0 };
}

// ---------------------------------------------------------------------------
// Eggs and buddies
// ---------------------------------------------------------------------------

function hatch(egg: string, sinceLegendary: number): { petKey: string; shiny: boolean } {
  let rarity: Rarity = "common";
  if (sinceLegendary + 1 >= PITY_AT) rarity = "legendary";
  else {
    const odds = EGGS[egg]!.odds;
    const draw = Math.random();
    let cumulative = 0;
    for (const r of RARITIES) {
      cumulative += odds[r];
      if (draw < cumulative) {
        rarity = r;
        break;
      }
    }
  }
  const pool = BY_RARITY[rarity];
  return { petKey: pool[Math.floor(Math.random() * pool.length)]!, shiny: Math.random() < SHINY_CHANCE };
}

export async function openEgg(member: string, eggKey: string) {
  const spec = EGGS[eggKey];
  if (!spec) throw new Error(`No such egg: ${eggKey}`);
  const t = await totals(member);
  const level = levelFor(t.xp);
  if (spec.min_level && level < spec.min_level) throw new Error(`${spec.name} unlocks at level ${spec.min_level}.`);
  if (t.coins < spec.cost) {
    const short = spec.cost - t.coins;
    throw new Error(`${short} more coin${short === 1 ? "" : "s"} needed.`);
  }
  let since = 0;
  for (const e of await events(member, 1000)) {
    if (e.kind !== "egg") continue;
    const key = (e.detail ?? "").split(":")[0] ?? "";
    if (PETS[key]?.rarity === "legendary") break;
    since++;
  }
  const { petKey, shiny } = hatch(eggKey, since);
  const pet = PETS[petKey]!;
  const db = serviceClient();
  const owned = await pets(member);
  const existing = owned.find((p) => p.pet_key === petKey && p.shiny === shiny);
  let outcome: "new" | "star" | "refund";
  let stars = 0;
  if (!existing) {
    const equippedCount = owned.filter((p) => p.equipped).length;
    await db.from("pets").insert({ member_slack_id: member, pet_key: petKey, shiny, stars: 0, equipped: equippedCount < buddySlots(level) });
    outcome = "new";
  } else if (existing.stars < MAX_STARS) {
    stars = existing.stars + 1;
    await db.from("pets").update({ stars }).eq("id", existing.id);
    outcome = "star";
  } else {
    stars = MAX_STARS;
    outcome = "refund";
  }
  const spent = outcome === "refund" ? 0 : -spec.cost;
  await db.from("game_events").insert({ member_slack_id: member, kind: "egg", xp: 0, coins: spent, detail: `${petKey}:${eggKey}`, day: todayKey() });
  const name = (shiny ? "Shiny " : "") + pet.name;
  const message = { new: `${name}!`, star: `${name} is now ${stars} star${stars === 1 ? "" : "s"}.`, refund: `${name} again, already at ${MAX_STARS} stars — coins refunded.` }[outcome];
  return { ok: true, outcome, pet_key: petKey, sprite: pet.sprite, name, rarity: pet.rarity, shiny, stars, spent: -spent, message };
}

export async function setEquipped(member: string, petIds: string[]) {
  const owned = await pets(member);
  const wanted = [...new Set(petIds)];
  if (wanted.some((id) => !owned.some((p) => p.id === id))) throw new Error("You do not own that buddy.");
  const level = levelFor((await totals(member)).xp);
  const slots = buddySlots(level);
  if (wanted.length > slots) throw new Error(`You have ${slots} buddy slot${slots === 1 ? "" : "s"}. Level up for more.`);
  const db = serviceClient();
  for (const p of owned) {
    const should = wanted.includes(p.id);
    if (p.equipped !== should) await db.from("pets").update({ equipped: should }).eq("id", p.id);
  }
  const equipped = (await pets(member)).filter((p) => p.equipped);
  return { ok: true, message: equipped.length ? "Buddies updated." : "Slot emptied.", equipped: equipped.map((p) => p.id), multipliers: multipliers(equipped) };
}

// ---------------------------------------------------------------------------
// The read model
// ---------------------------------------------------------------------------

function streak(days: Set<string>, today: string): { current: number; best: number } {
  if (days.size === 0) return { current: 0, best: 0 };
  const ordered = [...days].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < ordered.length; i++) {
    if (daysBetween(ordered[i - 1]!, ordered[i]!) <= STREAK_GRACE + 1) run++;
    else run = 1;
    best = Math.max(best, run);
  }
  if (daysBetween(ordered[ordered.length - 1]!, today) > STREAK_GRACE) return { current: 0, best };
  let current = 1;
  for (let i = ordered.length - 1; i > 0; i--) {
    if (daysBetween(ordered[i - 1]!, ordered[i]!) <= STREAK_GRACE + 1) current++;
    else break;
  }
  return { current, best };
}

async function ledger(member: string, limit = 40) {
  const rows = await events(member, 400);
  const ids = [...new Set(rows.map((e) => e.item_id).filter(Boolean))] as string[];
  const titles = new Map<string, string>();
  if (ids.length) {
    const { data } = await serviceClient().from("items").select("id,title").in("id", ids);
    for (const it of (data ?? []) as { id: string; title: string }[]) titles.set(it.id, it.title);
  }
  type Row = { at: string; day: string; title: string; reasons: string[]; xp: number; coins: number; kind: string };
  const groups = new Map<string, Row>();
  const order: string[] = [];
  const lastForItem = new Map<string, { at: number; key: string }>();
  for (const e of rows) {
    let key: string;
    if (e.item_id) {
      const at = new Date(e.created_at).getTime();
      const prev = lastForItem.get(e.item_id);
      key = prev && Math.abs(prev.at - at) <= AWARD_GROUP_WINDOW_MS ? prev.key : `${e.item_id}:${e.created_at}`;
      lastForItem.set(e.item_id, { at, key });
    } else key = `solo:${e.id}`;
    if (!groups.has(key)) {
      let title: string;
      if (e.item_id) title = titles.get(e.item_id) ?? "An item since removed";
      else if (e.kind === "quest") title = QUESTS[e.detail ?? ""]?.label ?? "Quest";
      else if (e.kind === "egg") title = "Hatched " + (PETS[(e.detail ?? "").split(":")[0] ?? ""]?.name ?? "a buddy");
      else if (e.kind === "checkin") title = "Nothing due";
      else if (ITEM_AWARD_KINDS.has(e.kind)) title = "An item since removed";
      else title = (LEDGER_LABELS[e.kind] ?? e.kind).replace(/^./, (c) => c.toUpperCase());
      groups.set(key, { at: e.created_at, day: e.day, title, reasons: [], xp: 0, coins: 0, kind: e.kind });
      order.push(key);
    }
    const row = groups.get(key)!;
    row.xp += e.xp || 0;
    row.coins += e.coins || 0;
    let reason: string | null | undefined;
    if (e.kind === "early" && e.detail) reason = e.detail;
    else if (["quest", "egg", "checkin"].includes(e.kind)) reason = null;
    else reason = LEDGER_LABELS[e.kind];
    if (reason && !row.reasons.includes(reason)) row.reasons.push(reason);
  }
  for (const row of groups.values()) row.reasons.sort((a, b) => (REASON_ORDER[a] ?? 3) - (REASON_ORDER[b] ?? 3));
  return order.slice(0, limit).map((k) => groups.get(k)!);
}

/** Everything the Progress page needs, in one pass. Also marks a clear day and pays for it. */
export async function summary(member: string) {
  const db = serviceClient();
  const today = todayKey();
  const now = new Date();
  const t = await totals(member);
  let { level, into, span } = levelSpan(t.xp);

  const items = await memberItems(member);
  const done = items.filter((i) => i.completed_at);
  const dated = done.filter((i) => i.due_date);
  const onTime = dated.filter((i) => new Date(i.completed_at!) <= deadlineOf(i)!);

  const evs = await events(member);
  const cis = await checkins(member);
  const noteDays = await memberNoteDays(member);
  const days = new Set<string>([...evs.map((e) => e.day), ...cis.map((c) => c.day), ...noteDays]);

  // Days that ended with nothing overdue, counted back from today.
  let clean = 0;
  for (let offset = 0; offset < 30; offset++) {
    const d = addDays(now, -offset, tz());
    const key = localDay(d, tz());
    const f = fieldsOf(d, tz());
    const end = new Date(Date.UTC(f.year, f.month - 1, f.day, 23, 59, 59)); // approximate day end
    const rotten = items.some((i) => i.due_date && deadlineOf(i)! < end && (!i.completed_at || new Date(i.completed_at) > end));
    if (rotten) break;
    clean++;
    void key;
  }

  const overdue = items.filter((i) => i.status === "open" && i.due_date && deadlineOf(i)! < now);
  const dueToday = items.filter((i) => i.status === "open" && i.due_date && dayOf(i.due_date) === today);
  const isClear = overdue.length === 0 && dueToday.length === 0;
  let marked = cis.some((c) => c.day === today);
  if (isClear && !marked) {
    await db.from("clear_checkins").upsert({ member_slack_id: member, day: today }, { onConflict: "member_slack_id,day", ignoreDuplicates: true });
    days.add(today);
    marked = true;
    if (!evs.some((e) => e.kind === "checkin" && e.day === today)) {
      const award = await buffed(member, XP_CHECKIN, COINS_CHECKIN);
      const row = await record(member, { kind: "checkin", detail: "clear", day: today, ...award });
      if (row) {
        t.xp += award.xp;
        t.coins += award.coins;
        ({ level, into, span } = levelSpan(t.xp));
        evs.unshift(row);
      }
    }
  } else if (!isClear && marked) {
    await db.from("clear_checkins").delete().eq("member_slack_id", member).eq("day", today);
    marked = false;
    if (!evs.some((e) => e.day === today) && !noteDays.includes(today)) days.delete(today);
  }
  const s = streak(days, today);

  const owned = await pets(member);
  const equipped = owned.filter((p) => p.equipped);
  const m = multipliers(equipped);
  const todayEvents = evs.filter((e) => e.day === today);

  const order: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
  const catalogue = Object.entries(PETS)
    .map(([key, spec]) => {
      const mine = owned.filter((p) => p.pet_key === key).sort((a, b) => Number(b.shiny) - Number(a.shiny))[0];
      return {
        key,
        name: spec.name,
        rarity: spec.rarity,
        ability: spec.ability,
        amount: spec.amount,
        blurb: spec.blurb,
        sprite: spec.sprite,
        id: mine?.id ?? null,
        owned: Boolean(mine),
        equipped: Boolean(mine?.equipped),
        shiny: Boolean(mine?.shiny),
        stars: mine?.stars ?? 0,
        strength: mine ? Math.round(abilityStrength(key, mine.stars) * 10000) / 10000 : spec.amount,
      };
    })
    .sort((a, b) => order[a.rarity] - order[b.rarity] || a.name.localeCompare(b.name));

  return {
    member,
    xp: t.xp,
    coins: t.coins,
    level,
    level_xp: into,
    level_span: span,
    buddy_slots: buddySlots(level),
    freezes: freezesEarned(level) - evs.filter((e) => e.kind === "freeze_used").length,
    streak: s.current,
    best_streak: s.best,
    active_days: [...days].filter((d) => daysBetween(d, today) >= 0 && daysBetween(d, today) < 366).sort(),
    streak_grace: STREAK_GRACE,
    clean_days: clean,
    completed: done.length,
    with_deadline: dated.length,
    on_time: onTime.length,
    punctuality: dated.length ? Math.round((onTime.length / dated.length) * 100) : null,
    quests: await questState(member, today, todayEvents, items),
    multipliers: m,
    equipped: equipped.map((p) => ({ ...p, spec: PETS[p.pet_key] ?? {} })),
    pets_owned: owned.length,
    pets_total: Object.keys(PETS).length,
    catalogue,
    eggs: Object.entries(EGGS).map(([key, spec]) => ({ key, name: spec.name, cost: spec.cost, min_level: spec.min_level ?? 1, locked: level < (spec.min_level ?? 1), affordable: t.coins >= spec.cost, odds: spec.odds })),
    awards: awardTable(),
    ledger: await ledger(member),
    unplanned_minutes: UNPLANNED_MINUTES,
    can_check_in: false,
    checked_in: marked,
    auto_clear: isClear,
    overdue: overdue.length,
    due_today: dueToday.length,
  };
}
