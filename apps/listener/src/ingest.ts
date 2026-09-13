/**
 * The extraction cycle: unread messages → model → captures (pending).
 *
 * Debounced so a burst of chatter is read as one conversation, not one call per
 * line. Writes captures only. Never items.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractCaptures, type ExtractableMessage } from "agent-core";
import type { Member } from "agent-core/shared";

const BATCH = 40;
const CONTEXT = 12;

export type IngestOptions = {
  db: SupabaseClient;
  timeZone: string;
  debounceMs?: number;
  log?: (line: string) => void;
};

export function createIngest({ db, timeZone, debounceMs = 8_000, log = console.log }: IngestOptions) {
  let timer: NodeJS.Timeout | undefined;
  let running = false;
  let queued = false;

  async function runOnce(): Promise<void> {
    const { data: fresh, error } = await db
      .from("messages")
      .select("ts,user_id,text,posted_at")
      .is("extracted_at", null)
      .order("posted_at", { ascending: true })
      .limit(BATCH);
    if (error) throw new Error(`read unextracted: ${error.message}`);
    if (!fresh?.length) return;

    const earliest = fresh[0]!.posted_at;
    const { data: earlier } = await db
      .from("messages")
      .select("ts,user_id,text,posted_at")
      .lt("posted_at", earliest)
      .order("posted_at", { ascending: false })
      .limit(CONTEXT);
    const context = ((earlier ?? []) as ExtractableMessage[]).reverse();

    const { data: members } = await db.from("members").select("*");

    const captures = await extractCaptures({
      messages: fresh as ExtractableMessage[],
      context,
      members: (members ?? []) as Member[],
      timeZone,
    });

    let inserted = 0;
    if (captures.length) {
      // The unique (source_ts, type, title) constraint makes re-reads harmless.
      const { data, error: insertError } = await db
        .from("captures")
        .upsert(captures, { onConflict: "source_ts,type,title", ignoreDuplicates: true })
        .select("id");
      if (insertError) throw new Error(`captures insert: ${insertError.message}`);
      inserted = data?.length ?? 0;
    }

    const { error: markError } = await db
      .from("messages")
      .update({ extracted_at: new Date().toISOString() })
      .in("ts", fresh.map((m) => m.ts));
    if (markError) throw new Error(`mark extracted: ${markError.message}`);

    log(`extracted ${fresh.length} message(s) → ${captures.length} capture(s), ${inserted} new`);
    for (const c of captures) {
      log(`  · ${c.type} "${c.title}" owner=${c.owner_slack_id ?? "-"} due=${c.due_date ?? "-"} conf=${c.confidence.toFixed(2)}`);
    }
    if (fresh.length === BATCH) queued = true; // more waiting
  }

  async function drain(): Promise<void> {
    if (running) {
      queued = true;
      return;
    }
    running = true;
    try {
      do {
        queued = false;
        await runOnce();
      } while (queued);
    } catch (err) {
      log(`extraction failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      running = false;
    }
  }

  return {
    /** Call after every new message; the actual run happens once the channel goes quiet. */
    schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void drain(), debounceMs);
    },
    /** Run now (startup, tests). */
    runNow: drain,
  };
}
