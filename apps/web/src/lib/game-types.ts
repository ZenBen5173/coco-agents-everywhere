/**
 * The shape of the game summary, client-safe.
 *
 * Kept apart from game.ts for the same reason shell-types.ts is kept apart
 * from shell-data.ts: that module holds server credentials, and a client
 * component importing even a type from it fails to compile in dev.
 */

export type LedgerEntry = {
  /** When it was earned, ISO. */
  at: string;
  /** The local day it counted towards. */
  day: string;
  /** The task, quest or buddy it came from. */
  title: string;
  /** Why it paid — "finished", "on time", "8d early". Empty when the title
   *  already says it, as a quest name does. */
  reasons: string[];
  xp: number;
  /** Negative when coins were spent rather than earned, as on an egg. */
  coins: number;
  kind: string;
};

export type Award = {
  action: string;
  detail: string;
  xp: number;
  coins: number;
  /** Paid per whole day ahead rather than once. */
  per_day?: boolean;
};

export type Quest = {
  key: string;
  label: string;
  coins: number;
  done: boolean;
  paid: boolean;
};

export type EquippedPet = {
  id: string;
  pet_key: string;
  stars: number;
  shiny: boolean;
  asleep?: boolean;
  spec: { name?: string; rarity?: string; blurb?: string; sprite?: string | null };
};

/** Stars a buddy can reach. A new pet is 0 stars, which is its base rate;
 *  each duplicate hatched adds one, worth +25% of that base. */
export const MAX_STARS = 5;

export type PetEntry = {
  key: string;
  /** The owned row's id, or null for a pet nobody has yet. */
  id: string | null;
  equipped: boolean;
  /** What it gives at the stars it actually has, not the base rate. */
  strength: number;
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  ability: "xp" | "coins" | "both";
  /** A share, not a percentage: 0.2 means a fifth more. */
  amount: number;
  blurb: string;
  /** Which sprite sheet plays it, or null while it has no artwork yet. */
  sprite: string | null;
  owned: boolean;
  shiny: boolean;
  stars: number;
};

export type EggOption = {
  key: string;
  name: string;
  cost: number;
  min_level: number;
  locked: boolean;
  affordable: boolean;
  odds: Record<string, number>;
};

export type GameSummary = {
  xp: number;
  coins: number;
  level: number;
  level_xp: number;
  level_span: number;
  buddy_slots: number;
  freezes: number;
  streak: number;
  best_streak: number;
  /** Every day that kept the streak alive, ISO, oldest first, past year only. */
  active_days: string[];
  /** Missed days a streak survives — shown on the calendar as freezes. */
  streak_grace: number;
  clean_days: number;
  completed: number;
  with_deadline: number;
  on_time: number;
  /** Null until at least one task with a deadline has been finished. */
  punctuality: number | null;
  quests: Quest[];
  /** What each action pays. Built server-side from the scoring constants, so
   *  the table on screen cannot drift from the rules that award the points. */
  awards: Award[];
  /** Recent awards, newest first, grouped by what earned them. */
  ledger: LedgerEntry[];
  /** Minutes a task must exist before its deadline bonuses count. */
  unplanned_minutes: number;
  multipliers: { xp: number; coins: number };
  equipped: EquippedPet[];
  pets_owned: number;
  pets_total: number;
  catalogue: PetEntry[];
  eggs: EggOption[];
  /** Always false now: an empty day marks itself, so there is nothing
   *  left for anybody to confirm. */
  can_check_in: boolean;
  checked_in: boolean;
  /** True when it was "nothing was due" that counted the day. */
  auto_clear: boolean;
  overdue: number;
  due_today: number;
};

/**
 * How many things are sitting on Progress waiting to be tapped.
 *
 * Counts moves, not coins: a finished quest whose coins have not been
 * collected. That money only arrives if you go and ask for it, and nothing
 * says so from another page — which is the whole reason the tab needs a
 * number on it.
 *
 * The clear-day check-in used to count here too. It marks itself now, so
 * there is no longer a day on which anybody has something to confirm.
 */
export function collectable(game: GameSummary): number {
  return game.quests.filter((q) => q.done && !q.paid).length;
}

/** What the page shows before the API has ever answered. */
export const EMPTY_GAME: GameSummary = {
  xp: 0, coins: 0, level: 1, level_xp: 0, level_span: 100,
  buddy_slots: 1, freezes: 0, streak: 0, best_streak: 0, clean_days: 0,
  active_days: [], streak_grace: 2,
  completed: 0, with_deadline: 0, on_time: 0, punctuality: null,
  quests: [], awards: [], ledger: [], unplanned_minutes: 10,
  multipliers: { xp: 1, coins: 1 }, equipped: [],
  pets_owned: 0, pets_total: 13, catalogue: [], eggs: [],
  can_check_in: false, checked_in: false, auto_clear: false, overdue: 0, due_today: 0,
};
