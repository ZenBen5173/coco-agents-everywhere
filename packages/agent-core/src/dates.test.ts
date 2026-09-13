import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dateTable, daysUntil, formatDue, localDay, parseDue, relativeDue } from "./dates";

const TZ = "Asia/Kuala_Lumpur"; // UTC+8, no DST
// Wednesday 16 Sep 2026, 23:30 in KL = 15:30 UTC. Late enough that a UTC slice
// would still say the 16th but an American zone would say something else.
const NOW = new Date("2026-09-16T15:30:00.000Z");

describe("dateTable", () => {
  it("labels every row with its weekday, and tomorrow as tomorrow", () => {
    const table = dateTable(NOW, TZ);
    assert.match(table, /^Today is Wednesday, 2026-09-16 in Asia\/Kuala_Lumpur\. Right now it is 23:30\./);
    assert.match(table, /Thursday \(tomorrow\) = 2026-09-17/);
    assert.match(table, /Friday = 2026-09-18/);
    assert.match(table, /next Wednesday = 2026-09-23/);
    assert.equal(table.split("\n").length, 2 + 14);
  });
});

describe("parseDue", () => {
  it("treats a bare date as all-day at local midnight", () => {
    const p = parseDue("2026-09-18", TZ);
    assert.equal(p.all_day, true);
    assert.equal(p.due_date, "2026-09-17T16:00:00.000Z"); // 00:00 KL
  });

  it("treats a time as local time, never UTC", () => {
    const p = parseDue("2026-09-18T17:00", TZ);
    assert.equal(p.all_day, false);
    assert.equal(p.due_date, "2026-09-18T09:00:00.000Z");
  });

  it("returns no date for garbage rather than throwing", () => {
    assert.deepEqual(parseDue("next friday", TZ), { due_date: null, all_day: true });
    assert.deepEqual(parseDue(null, TZ), { due_date: null, all_day: true });
    assert.deepEqual(parseDue("2026-13-45", TZ), { due_date: null, all_day: true });
  });
});

describe("day arithmetic", () => {
  it("counts calendar days in the team's zone, not 24h blocks", () => {
    assert.equal(localDay(NOW, TZ), "2026-09-16");
    assert.equal(daysUntil(parseDue("2026-09-17", TZ).due_date!, NOW, TZ), 1);
    assert.equal(daysUntil(parseDue("2026-09-16", TZ).due_date!, NOW, TZ), 0);
    assert.equal(daysUntil(parseDue("2026-09-14", TZ).due_date!, NOW, TZ), -2);
  });

  it("formats for humans", () => {
    const timed = parseDue("2026-09-18T17:00", TZ).due_date!;
    assert.equal(formatDue(timed, false, TZ), "Fri 18 Sep, 17:00");
    assert.equal(formatDue(timed, true, TZ), "Fri 18 Sep");
    assert.equal(formatDue(null, true, TZ), "No date");
    assert.equal(relativeDue(parseDue("2026-09-17", TZ).due_date, NOW, TZ), "tomorrow");
    assert.equal(relativeDue(parseDue("2026-09-14", TZ).due_date, NOW, TZ), "2 days ago");
  });
});
