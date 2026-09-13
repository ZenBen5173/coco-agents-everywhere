"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Pin } from "lucide-react";
import { StickyNoteIcon } from "@/components/ui/sticky-note";
import { NoteEditor } from "@/components/note-editor";
import { noteColour } from "@/lib/note-colours";
import type { Note } from "@/lib/note-types";
import { useWorkspace } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Notes on the overview, as a strip: pinned first, then the most recent. It
 * scrolls sideways rather than growing downward, and disappears entirely when
 * there are none. Read-only on purpose — editing lives on the board.
 */
export function DashboardNotes({ limit = 6 }: { limit?: number }) {
  const { notes } = useWorkspace();
  const shown = notes.slice(0, limit);
  if (shown.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.07 }} className="mt-5">
      <div className="mb-2 flex items-center gap-2">
        <StickyNoteIcon size={12} className="text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Notes</span>
        <Link href="/notes" className="ml-auto text-[11px] text-muted-foreground transition-colors hover:text-foreground">
          All notes →
        </Link>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {shown.map((note, index) => (
          <PinnedCard key={note.id} note={note} index={index} />
        ))}
      </div>
    </motion.div>
  );
}

function PinnedCard({ note, index }: { note: Note; index: number }) {
  const [glow, setGlow] = useState({ x: 0, y: 0, on: false });
  const card = useRef<HTMLAnchorElement>(null);
  const palette = noteColour(note.colour);
  return (
    <Link
      ref={card}
      href="/notes"
      onMouseMove={(e) => {
        const rect = card.current?.getBoundingClientRect();
        if (!rect) return;
        setGlow({ x: e.clientX - rect.left, y: e.clientY - rect.top, on: true });
      }}
      onMouseLeave={() => setGlow((g) => ({ ...g, on: false }))}
      style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
      className={cn("note-settle group/pin relative w-56 shrink-0 overflow-hidden rounded-lg border p-3 backdrop-blur-md transition-colors duration-300 hover:border-foreground/25", palette.surface)}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 transition-opacity duration-300" style={{ opacity: glow.on ? 1 : 0, background: `radial-gradient(180px circle at ${glow.x}px ${glow.y}px, ${palette.glow}, transparent 70%)` }} />
      <div className="relative">
        <div className="note-preview line-clamp-4 text-xs leading-relaxed">
          <NoteEditor value={note.body} editable={false} onChange={() => {}} />
        </div>
        {note.pinned && (
          <div className="mt-2 flex items-center gap-1.5">
            <Pin className="size-2.5 fill-current text-muted-foreground" />
          </div>
        )}
      </div>
    </Link>
  );
}
