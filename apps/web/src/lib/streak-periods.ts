/**
 * Turning a list of days into the calendar's period model.
 *
 * The server sends the days that kept the streak alive. The calendar wants
 * ranges, and it draws a snowflake on any day inside a range marked
 * `usedFreeze`. Those two facts together let the grace rule become visible:
 * a day you missed that the streak survived anyway is exactly a freeze, so it
 * is emitted as its own one-day period and shows a snowflake rather than a
 * gap. Until now that rule existed only in `game.py` and nothing on screen
 * ever admitted it was there.
 */

export type StreakPeriod = {
  periodStart: string;
  periodEnd: string;
  usedFreeze?: boolean;
};

/** `YYYY-MM-DD` in local time. Parsing it with `new Date(iso)` reads as UTC
 *  and lands on the previous day for anyone west of Greenwich. */
function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const DAY = 86_400_000;

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * @param activeDays ISO days that kept the streak alive, any order.
 * @param grace      Missed days a streak survives — `STREAK_GRACE` server-side.
 */
export function toStreakPeriods(activeDays: string[], grace: number): StreakPeriod[] {
  if (activeDays.length === 0) return [];

  const days = [...new Set(activeDays)].sort().map(parseLocal);
  const periods: StreakPeriod[] = [];

  let runStart = days[0];
  let previous = days[0];

  for (const day of days.slice(1)) {
    const gap = daysBetween(previous, day) - 1; // days missed between the two

    if (gap === 0) {
      previous = day;
      continue;
    }

    if (gap <= grace) {
      // Covered by grace: close nothing, but mark each missed day so the
      // snowflake lands on the day itself rather than the whole run.
      for (let i = 1; i <= gap; i += 1) {
        const missed = toKey(new Date(previous.getTime() + i * DAY));
        periods.push({ periodStart: missed, periodEnd: missed, usedFreeze: true });
      }
      previous = day;
      continue;
    }

    // The gap broke the streak, so the run ends at the last active day.
    periods.push({ periodStart: toKey(runStart), periodEnd: toKey(previous) });
    runStart = day;
    previous = day;
  }

  periods.push({ periodStart: toKey(runStart), periodEnd: toKey(previous) });
  return periods;
}
