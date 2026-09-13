"use client";

/**
 * Game writes, through the route handlers where the rules that guard them
 * live. The player is whoever the sidebar says you are.
 */
const ME_KEY = "coco:me";

export function currentMember(): string | null {
  try {
    return window.localStorage.getItem(ME_KEY);
  } catch {
    return null;
  }
}

async function call<T = { ok: boolean; message: string }>(path: string, payload?: Record<string, unknown>): Promise<T & { ok: boolean; message: string }> {
  const member = currentMember();
  if (!member) return { ok: false, message: "Pick yourself in the sidebar first." } as T & { ok: boolean; message: string };
  try {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ member, ...(payload ?? {}) }) });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ...(body as object), ok: false, message: String(body.error ?? `Request failed (${res.status}).`) } as T & { ok: boolean; message: string };
    return { ...(body as object), ok: true, message: String(body.message ?? "Done.") } as T & { ok: boolean; message: string };
  } catch {
    return { ok: false, message: "Couldn't reach the server." } as T & { ok: boolean; message: string };
  }
}

export async function fetchGame(member: string) {
  const res = await fetch(`/api/game?member=${encodeURIComponent(member)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`game summary failed (${res.status})`);
  return res.json();
}

export async function checkIn() {
  return call("/api/game/checkin");
}

export async function claimQuests() {
  return call("/api/game/quests/claim");
}

export type Hatched = {
  ok: boolean;
  message: string;
  outcome?: "new" | "star" | "refund";
  pet_key?: string;
  sprite?: string | null;
  name?: string;
  rarity?: "common" | "rare" | "epic" | "legendary";
  shiny?: boolean;
  stars?: number;
};

export async function hatchEgg(egg: string): Promise<Hatched> {
  return call<Hatched>("/api/game/hatch", { egg });
}

export async function setBuddies(petIds: string[]) {
  return call("/api/game/buddies", { pets: petIds });
}
