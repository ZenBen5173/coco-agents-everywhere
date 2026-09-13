"use client";

/**
 * The chat column. Same agent everywhere; the page it sits beside is its
 * context. Keeps a small history of conversations per browser so a thread can
 * be reopened, and lets you start a fresh one.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CopilotChat, CopilotChatInput, UseAgentUpdate, useAgent, useConfigureSuggestions } from "@copilotkit/react-core/v2";
import { History, Plus } from "lucide-react";
import { AnimatedLucide, type IconHandle } from "@/components/ui/animated-lucide";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Composer } from "@/components/composer";
import { useWorkspace } from "@/lib/store";
import { cn } from "@/lib/utils";

type Entry = { id: string; title: string; at: number };
const HISTORY_KEY = "coco:chat-history";
const CURRENT_KEY = "coco:chat-thread";
const transcriptKey = (id: string) => `coco:chat:${id}`;

function readHistory(): Entry[] {
  try {
    return JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]") as Entry[];
  } catch {
    return [];
  }
}
function writeHistory(entries: Entry[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 30)));
  } catch {
    /* ignore */
  }
}
function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}
function ago(at: number) {
  const m = Math.round((Date.now() - at) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** The greeting's mark: a lucide sparkle that draws itself on, again every few seconds. */
function DrawnMark() {
  const icon = useRef<IconHandle>(null);
  useEffect(() => {
    const play = () => icon.current?.startAnimation();
    const first = setTimeout(play, 300);
    const loop = setInterval(play, 6_000);
    return () => {
      clearTimeout(first);
      clearInterval(loop);
    };
  }, []);
  return (
    <span className="ck-chat-mark" onMouseEnter={() => icon.current?.startAnimation()}>
      <AnimatedLucide ref={icon} name="sparkles" size={22} trigger="manual" duration={1.1} />
    </span>
  );
}

export function ChatPanel() {
  const { captures, me, memberName } = useWorkspace();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [open, setOpen] = useState(false);

  // Pick up where this browser left off.
  useEffect(() => {
    setHistory(readHistory());
    let current: string | null = null;
    try {
      current = window.localStorage.getItem(CURRENT_KEY);
    } catch {
      /* ignore */
    }
    setThreadId(current ?? newId());
  }, []);

  useEffect(() => {
    if (!threadId) return;
    try {
      window.localStorage.setItem(CURRENT_KEY, threadId);
    } catch {
      /* ignore */
    }
  }, [threadId]);

  // Title a thread by its first user message, once one exists.
  const { agent } = useAgent({ updates: [UseAgentUpdate.OnMessagesChanged] });
  const firstLine = useMemo(() => {
    const first = agent.messages.find((m) => m.role === "user");
    const content = first?.content;
    const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((p) => ("text" in p ? p.text : "")).join(" ") : "";
    return text.trim().slice(0, 80);
  }, [agent.messages]);

  // The local runtime keeps no thread history, so the transcript lives in
  // this browser: saved as it grows, put back when the thread is reopened.
  useEffect(() => {
    if (!threadId || agent.messages.length === 0) return;
    try {
      window.localStorage.setItem(transcriptKey(threadId), JSON.stringify(agent.messages));
    } catch {
      /* quota */
    }
  }, [threadId, agent.messages]);

  useEffect(() => {
    if (!threadId) return;
    let saved: unknown[] | null = null;
    try {
      const raw = window.localStorage.getItem(transcriptKey(threadId));
      saved = raw ? (JSON.parse(raw) as unknown[]) : null;
    } catch {
      saved = null;
    }
    if (!saved?.length) return;
    // After CopilotChat has (re)connected the thread and found nothing.
    const timer = setTimeout(() => {
      if (agent.messages.length === 0) agent.setMessages(saved as typeof agent.messages);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    if (!threadId || !firstLine) return;
    setHistory((prev) => {
      const existing = prev.find((e) => e.id === threadId);
      const next = existing
        ? prev.map((e) => (e.id === threadId ? { ...e, title: e.title || firstLine, at: Date.now() } : e))
        : [{ id: threadId, title: firstLine, at: Date.now() }, ...prev];
      next.sort((a, b) => b.at - a.at);
      writeHistory(next);
      return next;
    });
  }, [threadId, firstLine]);

  const switchTo = useCallback(
    (id: string) => {
      // Clear first so the previous thread's messages are never saved under the new id.
      agent.setMessages([]);
      setThreadId(id);
      setOpen(false);
    },
    [agent],
  );
  const startNew = useCallback(() => switchTo(newId()), [switchTo]);

  useConfigureSuggestions(
    {
      suggestions: [
        { title: "What's late?", message: "What is late on the board right now? Show me a list." },
        {
          title: captures.length ? `Walk me through the ${captures.length} pending` : "What's pending?",
          message: "Walk me through what is waiting for review, one line each, with who said it.",
        },
        {
          title: me ? `What did ${memberName(me)} commit to?` : "Who owns what?",
          message: me ? `What did ${memberName(me)} commit to? Show open items only.` : "Who owns what on the board?",
        },
      ],
      available: "before-first-message",
    },
    [captures.length, me],
  );

  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border/60 px-4">
        <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold leading-tight">Ask COCO</p>
          <p className="truncate text-[11px] leading-tight text-muted-foreground">Corrections you type here move the cards.</p>
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Chat history"
              className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <History className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-1">
            <button
              type="button"
              onClick={startNew}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/60"
            >
              <Plus className="size-3.5" /> New chat
            </button>
            {history.length > 0 && <div className="my-1 border-t border-border/60" />}
            <ul className="max-h-64 overflow-y-auto">
              {history.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => switchTo(e.id)}
                    className={cn(
                      "flex w-full flex-col rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/60",
                      e.id === threadId && "bg-muted/40",
                    )}
                  >
                    <span className="truncate text-sm">{e.title || "Untitled"}</span>
                    <span className="text-[11px] text-muted-foreground">{ago(e.at)}</span>
                  </button>
                </li>
              ))}
              {history.length === 0 && <li className="px-2 py-2 text-xs text-muted-foreground">No conversations yet.</li>}
            </ul>
          </PopoverContent>
        </Popover>
        <button
          type="button"
          onClick={startNew}
          aria-label="New chat"
          className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
      </div>
      {threadId && agent.messages.length === 0 && (
        <div className="ck-chat-empty">
          <DrawnMark />
          <p className="font-display text-base font-semibold">What would you like to know?</p>
          <p className="max-w-[26ch] text-xs leading-relaxed text-muted-foreground">
            Ask about the queue or the board, or type a correction — “the AWS deadline is tomorrow, not today”.
          </p>
        </div>
      )}
      {threadId && (
        <CopilotChat
          key={threadId}
          threadId={threadId}
          className={cn("ck-chat", agent.messages.length === 0 && "ck-chat--empty")}
          labels={{ chatInputPlaceholder: "Message COCO…" }}
          // The slot wants the component with its static sub-parts attached; ours renders it inside.
          input={Composer as unknown as typeof CopilotChatInput}
        />
      )}
    </>
  );
}
