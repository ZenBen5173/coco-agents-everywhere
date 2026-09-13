/**
 * The level curve, as something you can look at.
 *
 * the game engine computes a level from XP with `50 * (n + 1) * n`, and until now the
 * page showed only the bar for the level you were on — so the one question the
 * curve exists to answer, "what am I climbing towards", had no answer on
 * screen. These are the same numbers, unrolled.
 *
 * The rewards are read off the two functions that grant them, so this cannot
 * quietly drift from what levelling actually gives you.
 */

import type { PointsLevelTimeline } from "@/components/ui/points-levels-timeline";

/** Mirrors `FREEZE_LEVELS` in the game engine. */
const FREEZE_LEVELS = [3, 6, 9, 12, 15, 20, 25, 30];

/** Mirrors `buddy_slots()` in the game engine. */
const SLOT_LEVELS: Record<number, number> = { 5: 2, 12: 3 };

/** Total XP needed to reach a level — the floor of `level_span()`. */
export function xpFloor(level: number): number {
  return 50 * level * (level - 1);
}

function rewardFor(level: number): string | undefined {
  const rewards: string[] = [];
  if (SLOT_LEVELS[level]) rewards.push(`${SLOT_LEVELS[level]} buddy slots`);
  if (FREEZE_LEVELS.includes(level)) rewards.push("+1 streak freeze");
  return rewards.length ? rewards.join(" · ") : undefined;
}

/**
 * Levels to show. Enough of them that there is always something ahead, but
 * anchored on where you actually are rather than always starting at 1.
 */
export function levelTimeline(currentLevel: number, ahead = 4, behind = 2): PointsLevelTimeline[] {
  const first = Math.max(1, currentLevel - behind);
  const last = currentLevel + ahead;

  const levels: PointsLevelTimeline[] = [];
  for (let level = first; level <= last; level += 1) {
    levels.push({
      id: String(level),
      name: `Level ${level}`,
      points: xpFloor(level),
      description: rewardFor(level),
    });
  }
  return levels;
}
