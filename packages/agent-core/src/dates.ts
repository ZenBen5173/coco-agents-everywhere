/**
 * Date handling for a team that lives in one timezone.
 *
 * The model never gets a date library; it gets a table of the next fourteen
 * days ("Friday = 2026-09-18") and returns YYYY-MM-DD[THH:MM] strings, which we
 * turn into instants here. Naive times are the channel's local time, never UTC.
 *
 * Browser-safe: no Node imports.
 */

export const DEFAULT_TIMEZONE = "Asia/Kuala_Lumpur";

export function resolveTimeZone(): string {
  const raw =
    typeof process !== "undefined" ? (process.env?.USER_TIMEZONE ?? "").trim() : "";
  const candidate = raw || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export type LocalFields = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: string; // "Monday"
};

export function fieldsOf(instant: Date, timeZone: string): LocalFields {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "long",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: get("weekday"),
  };
}

/** Minutes the zone is ahead of UTC at this instant. */
function offsetAt(instant: Date, timeZone: string): number {
  const f = fieldsOf(instant, timeZone);
  const asUtc = Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute);
  const truncated = Math.floor(instant.getTime() / 60_000) * 60_000;
  return Math.round((asUtc - truncated) / 60_000);
}

/** Local wall-clock time in `timeZone` → the instant it names. Two passes settle DST. */
export function instantOf(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = offsetAt(new Date(guess), timeZone);
  let candidate = guess - first * 60_000;
  const second = offsetAt(new Date(candidate), timeZone);
  if (second !== first) candidate = guess - second * 60_000;
  return new Date(candidate);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" for an instant, in the team's zone. Never slice an ISO string for this. */
export function localDay(instant: Date, timeZone: string): string {
  const f = fieldsOf(instant, timeZone);
  return `${f.year}-${pad(f.month)}-${pad(f.day)}`;
}

export function addDays(instant: Date, days: number, timeZone: string): Date {
  const f = fieldsOf(instant, timeZone);
  return instantOf(f.year, f.month, f.day + days, f.hour, f.minute, timeZone);
}

/**
 * The prompt block that makes relative dates resolve reliably. Labelling only
 * offset 1 as "tomorrow" hides that day's weekday, so a bare "thursday" said on
 * a Wednesday would resolve eight days out — every row carries its weekday.
 */
export function dateTable(now: Date, timeZone: string): string {
  const today = fieldsOf(now, timeZone);
  const lines = [
    `Today is ${today.weekday}, ${localDay(now, timeZone)} in ${timeZone}. Right now it is ${pad(today.hour)}:${pad(today.minute)}.`,
    "Upcoming dates:",
  ];
  for (let offset = 1; offset <= 14; offset++) {
    const day = addDays(now, offset, timeZone);
    const f = fieldsOf(day, timeZone);
    let label = offset <= 7 ? f.weekday : `next ${f.weekday}`;
    if (offset === 1) label = `${label} (tomorrow)`;
    lines.push(`  ${label} = ${localDay(day, timeZone)}`);
  }
  return lines.join("\n");
}

export type ParsedDue = { due_date: string | null; all_day: boolean };

/** "2026-09-18" → local midnight, all-day; "2026-09-18T17:00" → timed. Anything else → no date. */
export function parseDue(value: string | null | undefined, timeZone: string): ParsedDue {
  if (!value) return { due_date: null, all_day: true };
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!m) return { due_date: null, all_day: true };
  const [, y, mo, d, h, mi] = m;
  const timed = h !== undefined && mi !== undefined;
  const instant = instantOf(
    Number(y),
    Number(mo),
    Number(d),
    timed ? Number(h) : 0,
    timed ? Number(mi) : 0,
    timeZone,
  );
  if (Number.isNaN(instant.getTime())) return { due_date: null, all_day: true };
  return { due_date: instant.toISOString(), all_day: !timed };
}

/** Whole calendar days from today to the due date in the team's zone. Negative = past. */
export function daysUntil(dueIso: string, now: Date, timeZone: string): number {
  const a = localDay(now, timeZone);
  const b = localDay(new Date(dueIso), timeZone);
  const [ay, am, ad] = a.split("-").map(Number) as [number, number, number];
  const [by, bm, bd] = b.split("-").map(Number) as [number, number, number];
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** "Fri 18 Sep" or "Fri 18 Sep, 17:00". */
export function formatDue(dueIso: string | null, allDay: boolean, timeZone: string): string {
  if (!dueIso) return "No date";
  const d = new Date(dueIso);
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
  if (allDay) return date;
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
  return `${date}, ${time}`;
}

/** "in 3 days" / "today" / "2 days ago". */
export function relativeDue(dueIso: string | null, now: Date, timeZone: string): string {
  if (!dueIso) return "";
  const n = daysUntil(dueIso, now, timeZone);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}
