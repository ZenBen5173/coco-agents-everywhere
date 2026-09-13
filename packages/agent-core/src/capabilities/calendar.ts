/**
 * Google Calendar writes, ported from myTask's gcal.py.
 *
 * One shared team calendar, connected once (OAuth via /api/google, or a
 * refresh token in the environment). Only ever touches events it created
 * itself, tracked by `calendar_event_id` on the item. Called from the approve
 * and update routes, never by the agent: whether an item gets an event is a
 * consequence of having a due date, not a decision the model makes.
 *
 * Plain fetch against the REST API — no googleapis dependency.
 */
import { serviceClient } from "../supabase";
import { fieldsOf, localDay } from "../dates";
import type { ItemRow } from "../types";

export const CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

/** Fallback only. A deadline is a moment; a calendar needs a duration. */
const DEFAULT_MINUTES = 60;

export class NotConnected extends Error {}

type Connection = {
  refresh_token: string;
  token: string | null;
  expires_at: string | null;
  calendar_id: string;
  source: "db" | "env";
};

function clientCredentials() {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!id || !secret) throw new NotConnected("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set.");
  return { id, secret };
}

export function isCalendarClientConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

/** The team's grant: the connected row if there is one, else the environment. */
export async function calendarConnection(): Promise<Connection | null> {
  const db = serviceClient();
  const { data } = await db.from("integrations").select("*").eq("service", "google").maybeSingle();
  if (data?.refresh_token) {
    return { refresh_token: data.refresh_token, token: data.token, expires_at: data.expires_at, calendar_id: data.calendar_id || "primary", source: "db" };
  }
  const env = process.env.GOOGLE_REFRESH_TOKEN?.trim();
  if (env) return { refresh_token: env, token: null, expires_at: null, calendar_id: process.env.GOOGLE_CALENDAR_ID?.trim() || "primary", source: "env" };
  return null;
}

export async function isCalendarConnected(): Promise<boolean> {
  try {
    return (await calendarConnection()) !== null;
  } catch {
    return false;
  }
}

/** A valid access token, refreshed and cached in the database when stale. */
async function accessToken(conn: Connection, force = false): Promise<string> {
  const fresh = conn.token && conn.expires_at && new Date(conn.expires_at).getTime() - Date.now() > 60_000;
  if (!force && fresh) return conn.token!;

  const { id, secret } = clientCredentials();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: conn.refresh_token, grant_type: "refresh_token" }),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) {
    throw new NotConnected(`Google refused the refresh token (${json.error ?? res.status}). Reconnect the calendar.`);
  }
  conn.token = json.access_token;
  conn.expires_at = new Date(Date.now() + ((json.expires_in ?? 3600) - 300) * 1000).toISOString();
  if (conn.source === "db") {
    await serviceClient().from("integrations").update({ token: conn.token, expires_at: conn.expires_at, updated_at: new Date().toISOString() }).eq("service", "google");
  }
  return conn.token;
}

async function call(conn: Connection, method: string, path: string, body?: unknown, retry = true): Promise<Response> {
  const token = await accessToken(conn);
  const res = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  // A cached token can be revoked early; one re-authorised retry, like the original.
  if (res.status === 401 && retry) {
    await accessToken(conn, true);
    return call(conn, method, path, body, false);
  }
  return res;
}

/** The event payload for an item. Assumes it has a due date. */
export function eventBody(item: Pick<ItemRow, "title" | "due_date" | "all_day" | "source_text" | "type">, timeZone: string, ownerName?: string) {
  const due = new Date(item.due_date!);
  const start = item.all_day ? { date: localDay(due, timeZone) } : { dateTime: due.toISOString(), timeZone };
  let end: { date: string } | { dateTime: string; timeZone: string };
  if (item.all_day) {
    // Google treats an all-day `end` as exclusive: the next morning.
    const f = fieldsOf(due, timeZone);
    const next = new Date(Date.UTC(f.year, f.month - 1, f.day + 1));
    end = { date: next.toISOString().slice(0, 10) };
  } else {
    end = { dateTime: new Date(due.getTime() + DEFAULT_MINUTES * 60_000).toISOString(), timeZone };
  }
  const description = [ownerName ? `Owner: ${ownerName}` : null, `Said in Slack: “${item.source_text}”`, "Added by COCO."].filter(Boolean).join("\n\n");
  return { summary: item.title, start, end, description };
}

export async function createEvent(item: ItemRow, timeZone: string, ownerName?: string): Promise<string> {
  const conn = await calendarConnection();
  if (!conn) throw new NotConnected("No Google Calendar connected.");
  const res = await call(conn, "POST", `calendars/${encodeURIComponent(conn.calendar_id)}/events`, eventBody(item, timeZone, ownerName));
  if (!res.ok) throw new Error(`Calendar insert failed: ${res.status} ${await res.text()}`);
  const event = (await res.json()) as { id: string };
  return event.id;
}

export async function updateEvent(item: ItemRow, timeZone: string, ownerName?: string): Promise<void> {
  if (!item.calendar_event_id) return;
  if (!item.due_date) return deleteEvent(item);
  const conn = await calendarConnection();
  if (!conn) return;
  const res = await call(conn, "PATCH", `calendars/${encodeURIComponent(conn.calendar_id)}/events/${encodeURIComponent(item.calendar_event_id)}`, eventBody(item, timeZone, ownerName));
  if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`Calendar update failed: ${res.status} ${await res.text()}`);
}

/** Tick the event off rather than deleting it, so the calendar records what got done. Frees the time. */
export async function markEventDone(item: ItemRow): Promise<void> {
  if (!item.calendar_event_id) return;
  const conn = await calendarConnection();
  if (!conn) return;
  const title = item.title.startsWith("✓") ? item.title : `✓ ${item.title}`;
  const res = await call(conn, "PATCH", `calendars/${encodeURIComponent(conn.calendar_id)}/events/${encodeURIComponent(item.calendar_event_id)}`, {
    summary: title,
    status: "confirmed",
    transparency: "transparent",
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`Calendar tick failed: ${res.status} ${await res.text()}`);
}

/** Remove the event entirely. Used when an item is dropped, not completed. */
export async function deleteEvent(item: Pick<ItemRow, "calendar_event_id">): Promise<void> {
  if (!item.calendar_event_id) return;
  const conn = await calendarConnection();
  if (!conn) return;
  const res = await call(conn, "DELETE", `calendars/${encodeURIComponent(conn.calendar_id)}/events/${encodeURIComponent(item.calendar_event_id)}`);
  // Already gone is not a failure.
  if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`Calendar delete failed: ${res.status} ${await res.text()}`);
}

/**
 * Reconcile one item with its calendar after a change. Best-effort: a calendar
 * failure is logged and never blocks the board. Returns the event id to store
 * (or null to clear), or undefined when nothing needs writing back.
 */
export async function syncItem(item: ItemRow, timeZone: string, ownerName?: string): Promise<string | null | undefined> {
  try {
    if (item.status === "dropped") {
      await deleteEvent(item);
      return item.calendar_event_id ? null : undefined;
    }
    if (item.status === "done") {
      if (item.calendar_event_id) await markEventDone(item);
      return undefined;
    }
    if (!item.due_date) {
      if (item.calendar_event_id) {
        await deleteEvent(item);
        return null;
      }
      return undefined;
    }
    if (item.calendar_event_id) {
      await updateEvent(item, timeZone, ownerName);
      return undefined;
    }
    if (!(await calendarConnection())) return undefined;
    return await createEvent(item, timeZone, ownerName);
  } catch (error) {
    if (!(error instanceof NotConnected)) console.error("[calendar]", error instanceof Error ? error.message : error);
    return undefined;
  }
}
