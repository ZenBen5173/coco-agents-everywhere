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

export type Workspace = {
  ready: boolean;
  error: string | null;
  members: Member[];
  /** Pending captures only, newest first. */
  captures: CaptureRow[];
  /** Every item on the board. */
  items: ItemRow[];
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
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [me, setMeState] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null);
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
      const [m, c, i] = await Promise.all([
        db.from("members").select("*").order("display_name"),
        db.from("captures").select("*").eq("status", "pending").order("created_at", { ascending: false }),
        db.from("items").select("*").order("due_date", { ascending: true, nullsFirst: false }),
      ]);
      const failed = m.error ?? c.error ?? i.error;
      if (failed) {
        setError(failed.message);
      } else {
        setError(null);
        setMembers((m.data ?? []) as Member[]);
        setCaptures((c.data ?? []) as CaptureRow[]);
        setItems((i.data ?? []) as ItemRow[]);
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
    const { item } = await call<{ item: ItemRow }>(`/api/items/${itemId}`, "PATCH", edit);
    setItems((rows) => rows.map((r) => (r.id === item.id ? item : r)));
    return item;
  }, []);

  const member = useCallback(
    (id: string | null | undefined) => (id ? members.find((m) => m.slack_user_id === id) : undefined),
    [members],
  );
  const memberName = useCallback(
    (id: string | null | undefined) => (id ? (member(id)?.display_name ?? id) : "Nobody yet"),
    [member],
  );

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
      approve,
      bin,
      updateItem,
      refresh,
      memberName,
      member,
    }),
    [ready, error, members, captures, items, me, setMe, timeZone, channelName, selectedItemId, selectedCaptureId, approve, bin, updateItem, refresh, memberName, member],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Workspace {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
