"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pin, PinOff, Search, Trash2, X } from "lucide-react";
import { ArchiveIcon } from "@/components/ui/archive";
import { PlusIcon } from "@/components/ui/plus";
import { useIconHover } from "@/components/icon-hover";
import { NoteEditor } from "@/components/note-editor";
import { OwnerChip } from "@/components/owner-chip";
import { NOTE_COLOURS, noteColour, type NoteColour } from "@/lib/note-colours";
import type { Note, NoteChanges } from "@/lib/note-types";
import { useWorkspace } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * The board, from myTask. Masonry via CSS columns because notes are different
 * lengths; dnd-kit sorts by measured rectangles so it copes with columns.
 * Nothing here calls a model — every action is a database write.
 */
export function NotesBoard() {
  const ws = useWorkspace();
  const { notes, me } = ws;
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState<Note | null>(null);

  const sensors = useSensors(
    // A small distance threshold, so clicking into a note to edit it is not a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? notes.filter((n) => n.body.toLowerCase().includes(needle)) : notes;
  }, [notes, query]);

  function onDragEnd(event: DragEndEvent) {
    setDragging(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = visible.map((n) => n.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    void ws.reorderNotes(next);
  }

  const pinned = visible.filter((n) => n.pinned).length;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Notes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {notes.length === 0
              ? "Nothing kept yet. Things worth remembering that aren't tasks."
              : [`${visible.length} note${visible.length === 1 ? "" : "s"}`, pinned > 0 ? `${pinned} pinned` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="h-9 w-full rounded-lg border border-border bg-card/60 pl-9 pr-8 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/30"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground">
              <X className="size-3" />
            </button>
          )}
        </div>
      </header>

      <NoteComposer onCreate={(fields) => ws.createNote({ ...fields, ...(me ? { author_slack_id: me } : {}) } as Parameters<typeof ws.createNote>[0])} />

      <div className="pt-5">
        {visible.length === 0 ? (
          <p className="pt-10 text-center text-sm text-muted-foreground">{query ? `Nothing matches “${query.trim()}”.` : "No notes yet."}</p>
        ) : (
          <DndContext
            id="notes-board"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(e: DragStartEvent) => setDragging(notes.find((n) => n.id === e.active.id) ?? null)}
            onDragCancel={() => setDragging(null)}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={visible.map((n) => n.id)} strategy={rectSortingStrategy}>
              <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 2xl:columns-4">
                {visible.map((note, index) => (
                  <SortableNote key={note.id} note={note} index={index} onPatch={ws.updateNote} onDelete={ws.deleteNote} />
                ))}
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
              {dragging ? (
                <div className={cn("w-72 rotate-2 rounded-xl border p-4 shadow-2xl", noteColour(dragging.colour).surface)}>
                  <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed">{dragging.body}</p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}

/** The capture field, collapsed to one line until you use it. Saves on its own. */
function NoteComposer({ onCreate }: { onCreate: (fields: { body: string; colour: string }) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [colour, setColour] = useState<NoteColour>("slate");
  const [saving, setSaving] = useState(false);
  const plus = useIconHover();

  async function keepAndClose() {
    if (saving) return;
    const text = body.trim();
    setOpen(false);
    if (!text) return setBody("");
    setSaving(true);
    try {
      await onCreate({ body: text, colour });
    } finally {
      setBody("");
      setColour("slate");
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        onMouseEnter={plus.onMouseEnter}
        onMouseLeave={plus.onMouseLeave}
        className="mt-5 flex h-11 w-full items-center gap-2 rounded-xl border border-dashed border-border bg-card/30 px-4 text-left text-sm text-muted-foreground backdrop-blur-sm transition-colors hover:border-foreground/30 hover:text-foreground"
      >
        <PlusIcon ref={plus.ref} size={15} />
        Write a note…
      </button>
    );
  }

  return (
    <div
      className={cn("mt-5 rounded-xl border p-3 transition-colors", noteColour(colour).surface)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void keepAndClose();
      }}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        void keepAndClose();
      }}
    >
      <NoteEditor value={body} editable autoFocus onChange={setBody} onEscape={() => void keepAndClose()} className="min-h-[4.5rem] text-sm leading-relaxed" />
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/50 pt-2">
        <ColourRow value={colour} onChange={setColour} />
        <span className="ml-auto text-[10px] text-muted-foreground">{saving ? "Saving…" : "Saves on its own · ⌘↵ to finish"}</span>
      </div>
    </div>
  );
}

function SortableNote({ note, index, onPatch, onDelete }: { note: Note; index: number; onPatch: (id: string, c: NoteChanges) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: note.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, animationDelay: `${Math.min(index, 12) * 28}ms` }}
      className={cn("note-settle mb-4 break-inside-avoid", isDragging && "opacity-30")}
    >
      <NoteCard
        note={note}
        onPatch={onPatch}
        onDelete={onDelete}
        handle={
          <button
            {...attributes}
            {...listeners}
            aria-label="Reorder note"
            className="cursor-grab rounded p-1 text-muted-foreground/50 opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 active:cursor-grabbing group-hover/note:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <GripVertical className="size-3.5" />
          </button>
        }
      />
    </div>
  );
}

function NoteCard({ note, onPatch, onDelete, handle }: { note: Note; onPatch: (id: string, c: NoteChanges) => Promise<void>; onDelete: (id: string) => Promise<void>; handle: ReactNode }) {
  const [draft, setDraft] = useState(note.body);
  const [glow, setGlow] = useState({ x: 0, y: 0, on: false });
  const card = useRef<HTMLDivElement>(null);
  const palette = noteColour(note.colour);

  useEffect(() => setDraft(note.body), [note.body]);

  function commit() {
    const next = draft.trim();
    if (!next) return setDraft(note.body);
    if (next !== note.body.trim()) void onPatch(note.id, { body: next });
  }

  // Saving on every keystroke writes a row per character; waiting only for
  // blur loses a tick when the tab closes straight after. Both, then.
  useEffect(() => {
    const next = draft.trim();
    if (!next || next === note.body.trim()) return;
    const id = setTimeout(() => void onPatch(note.id, { body: next }), 900);
    return () => clearTimeout(id);
  }, [draft, note.id, note.body, onPatch]);

  return (
    <div
      ref={card}
      onMouseMove={(e) => {
        const rect = card.current?.getBoundingClientRect();
        if (!rect) return;
        setGlow({ x: e.clientX - rect.left, y: e.clientY - rect.top, on: true });
      }}
      onMouseEnter={() => setGlow((g) => ({ ...g, on: true }))}
      onMouseLeave={() => setGlow((g) => ({ ...g, on: false }))}
      className={cn("group/note relative overflow-hidden rounded-xl border p-4 backdrop-blur-md transition-colors duration-300 hover:border-foreground/25", palette.surface)}
    >
      {/* Spotlight Card's glow: the light moves as you lean over the paper. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{ opacity: glow.on ? 1 : 0, background: `radial-gradient(240px circle at ${glow.x}px ${glow.y}px, ${palette.glow}, transparent 70%)` }}
      />
      <div className="relative">
        <div className="mb-1.5 flex items-center gap-1">
          {handle}
          {note.pinned && <Pin className="size-3 fill-current text-foreground/60" />}
          <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/note:opacity-100 [@media(hover:none)]:opacity-100">
            <CardAction label={note.pinned ? "Unpin" : "Pin to overview"} onClick={() => void onPatch(note.id, { pinned: !note.pinned })}>
              {note.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            </CardAction>
            <CardAction label="Archive" onClick={() => void onPatch(note.id, { archived: true })}>
              <ArchiveIcon size={14} />
            </CardAction>
            <CardAction label="Delete" onClick={() => void onDelete(note.id)} danger>
              <Trash2 className="size-3.5" />
            </CardAction>
          </div>
        </div>

        <NoteEditor value={note.body} editable onChange={setDraft} onBlur={commit} onEscape={() => setDraft(note.body)} />

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/40 pt-2.5">
          <div className="opacity-0 transition-opacity focus-within:opacity-100 group-hover/note:opacity-100 [@media(hover:none)]:opacity-100">
            <ColourRow value={(note.colour as NoteColour) ?? "slate"} onChange={(colour) => void onPatch(note.id, { colour })} />
          </div>
          {note.author_slack_id && <OwnerChip id={note.author_slack_id} size="sm" />}
          <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/60">
            {new Date(note.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </span>
        </div>
      </div>
    </div>
  );
}

function CardAction({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className={cn("rounded p-1 text-muted-foreground transition-colors", danger ? "hover:text-red-500" : "hover:text-foreground")}>
      {children}
    </button>
  );
}

/** Six swatches. Not a colour picker — see note-colours.ts for why. */
export function ColourRow({ value, onChange }: { value: NoteColour; onChange: (c: NoteColour) => void }) {
  return (
    <div className="flex items-center gap-1">
      {NOTE_COLOURS.map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          title={c.label}
          aria-label={c.label}
          aria-pressed={value === c.id}
          className={cn(
            "size-3.5 rounded-full transition-transform hover:scale-125",
            c.swatch,
            value === c.id ? "ring-2 ring-foreground/50 ring-offset-1 ring-offset-background" : "opacity-60 hover:opacity-100",
          )}
        />
      ))}
    </div>
  );
}
