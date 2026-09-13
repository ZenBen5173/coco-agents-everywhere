"use client";

/**
 * The page's live view of the queue and the board, plus the only three actions
 * a human can take on them. Shared by the pages and by the chat panel's tools,
 * so a correction typed to the agent and a click on a row move the same state.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CaptureRow, ItemEdit, ItemRow, Member } from "agent-core/shared";
import { resolveTimeZone } from "agent-core/shared";
import { browserClient } from "./supabase-browser";
import type { Note, NoteChanges } from "./note-types";

export type Workspace = {
  ready: boolean;
  error: string | null;
  members: Member[];
  /** Pending captures only, newest first. */
  captures: CaptureRow[];
  /** Every item on the board. */
  items: ItemRow[];
  /** Sticky notes, unarchived, pinned first then by position. */
  notes: Note[];
  /** Every tag in use, with how many open items carry it. Most-used first. */
  lists: { id: string; count: number }[];
  /** The list the board is filtered to, published by the board page. */
  activeList: string | null;
  setActiveList: (id: string | null) => void;
  me: string | null;
  setMe: (id: string | null) => void;
  timeZone: string;
  channelName: string;
  selectedItemId: string | null;
  setSelectedItemId: (id: string | null) => void;
  selectedCaptureId: string | null;
  setSelectedCaptureId: (id: string | null) => void;
  approve: (captureId: string, overrides?: ItemEdit) => Promise<ItemRow>;
  bin: (captureId: string) => Promise<void>;
  updateItem: (itemId: string, edit: ItemEdit) => Promise<ItemRow>;
  createNote: (fields: { body: string; colour?: string | null; pinned?: boolean }) => Promise<Note>;
  updateNote: (id: string, changes: NoteChanges) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  reorderNotes: (order: string[]) => Promise<void>;
  refresh: () => Promise<void>;
  memberName: (id: string | null | undefined) => string;
  member: (id: string | null | undefined) => Member | undefined;
};

const WorkspaceContext = createContext<Workspace | null>(null);

const ME_KEY = "coco:me";

async function call<T>(url: string, method: "POST" | "PATCH", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(json.error ?? `${method} ${url} failed (${res.status})`);
  return json;
}

export function WorkspaceProvider({
  channelName,
  children,
}: {
  channelName: string;
  children: ReactNode;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [captures, setCaptures] = useState<CaptureRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [me, setMeState] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null);
  const [activeList, setActiveList] = useState<string | null>(null);
  const timeZone = useMemo(() => resolveTimeZone(), []);
  const loading = useRef<Promise<void> | null>(null);

  useEffect(() => {
    try {
      setMeState(window.localStorage.getItem(ME_KEY));
    } catch {
      /* private mode */
    }
  }, []);

  const setMe = useCallback((id: string | null) => {
    setMeState(id);
    try {
      if (id) window.localStorage.setItem(ME_KEY, id);
      else window.localStorage.removeItem(ME_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(async () => {
    if (loading.current) return loading.current;
    const db = browserClient();
    if (!db) {
      setError("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setReady(true);
      return;
    }
    loading.current = (async () => {
      const [m, c, i, n] = await Promise.all([
        db.from("members").select("*").order("display_name"),
        db.from("captures").select("*").eq("status", "pending").order("created_at", { ascending: false }),
        db.from("items").select("*").order("due_date", { ascending: true, nullsFirst: false }),
        db
          .from("notes")
          .select("*")
          .is("archived_at", null)
          .order("pinned", { ascending: false })
          .order("position", { ascending: true })
          .order("created_at", { ascending: false }),
      ]);
      const failed = m.error ?? c.error ?? i.error ?? n.error;
      if (failed) {
        setError(failed.message);
      } else {
        setError(null);
        setMembers((m.data ?? []) as Member[]);
        setCaptures((c.data ?? []) as CaptureRow[]);
        setItems((i.data ?? []) as ItemRow[]);
        setNotes((n.data ?? []) as Note[]);
      }
      setReady(true);
    })().finally(() => {
      loading.current = null;
    });
    return loading.current;
  }, []);

  // Initial load, Realtime on every table, and a slow poll as a safety net.
  useEffect(() => {
    void refresh();
    const db = browserClient();
    if (!db) return;
    const channel = db
      .channel("workspace")
      .on("postgres_changes", { event: "*", schema: "public", table: "captures" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "members" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, () => void refresh())
      .subscribe();
    const poll = setInterval(() => void refresh(), 20_000);
    return () => {
      clearInterval(poll);
      void db.removeChannel(channel);
    };
  }, [refresh]);

  const approve = useCallback(async (captureId: string, overrides: ItemEdit = {}) => {
    const { item } = await call<{ item: ItemRow }>(`/api/captures/${captureId}/approve`, "POST", { overrides });
    setCaptures((rows) => rows.filter((r) => r.id !== captureId));
    setItems((rows) => [item, ...rows.filter((r) => r.id !== item.id)]);
    return item;
  }, []);

  const bin = useCallback(async (captureId: string) => {
    await call(`/api/captures/${captureId}/bin`, "POST");
    setCaptures((rows) => rows.filter((r) => r.id !== captureId));
  }, []);

  const updateItem = useCallback(async (itemId: string, edit: ItemEdit) => {
    const { item } = await call<{ item: ItemRow }>(`/api/items/${itemId}`, "PATCH", { ...edit, actor: me });
    setItems((rows) => rows.map((r) => (r.id === item.id ? item : r)));
    return item;
  }, [me]);

  // Notes: change locally first, then write, so a pin or a drag lands instantly.
  const createNote = useCallback(async (fields: { body: string; colour?: string | null; pinned?: boolean }) => {
    const { note } = await call<{ note: Note }>("/api/notes", "POST", fields);
    setNotes((rows) => [note, ...rows.filter((r) => r.id !== note.id)]);
    return note;
  }, []);
  const updateNote = useCallback(async (id: string, changes: NoteChanges) => {
    setNotes((rows) => (changes.archived ? rows.filter((r) => r.id !== id) : rows.map((r) => (r.id === id ? { ...r, ...changes } : r))));
    await call(`/api/notes/${id}`, "PATCH", changes);
  }, []);
  const deleteNote = useCallback(async (id: string) => {
    setNotes((rows) => rows.filter((r) => r.id !== id));
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
  }, []);
  const reorderNotes = useCallback(async (order: string[]) => {
    setNotes((rows) => {
      const byId = new Map(rows.map((r) => [r.id, r]));
      const moved = order.map((id) => byId.get(id)).filter((r): r is Note => Boolean(r));
      const rest = rows.filter((r) => !order.includes(r.id));
      return [...moved, ...rest];
    });
    await call("/api/notes/reorder", "POST", { order });
  }, []);

  const member = useCallback(
    (id: string | null | undefined) => (id ? members.find((m) => m.slack_user_id === id) : undefined),
    [members],
  );
  const memberName = useCallback(
    (id: string | null | undefined) => (id ? (member(id)?.display_name ?? id) : "Nobody yet"),
    [member],
  );

  const lists = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items) if (i.tag) counts.set(i.tag, (counts.get(i.tag) ?? 0) + (i.status === "open" ? 1 : 0));
    for (const c of captures) if (c.tag && !counts.has(c.tag)) counts.set(c.tag, 0);
    return [...counts.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  }, [items, captures]);

  const value = useMemo<Workspace>(
    () => ({
      ready,
      error,
      members,
      captures,
      items,
      me,
      setMe,
      timeZone,
      channelName,
      selectedItemId,
      setSelectedItemId,
      selectedCaptureId,
      setSelectedCaptureId,
      notes,
      lists,
      activeList,
      setActiveList,
      approve,
      bin,
      updateItem,
      createNote,
      updateNote,
      deleteNote,
      reorderNotes,
      refresh,
      memberName,
      member,
    }),
    [ready, error, members, captures, items, notes, lists, activeList, me, setMe, timeZone, channelName, selectedItemId, selectedCaptureId, approve, bin, updateItem, createNote, updateNote, deleteNote, reorderNotes, refresh, memberName, member],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Workspace {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
