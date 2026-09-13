/**
 * The six paper colours a note can be.
 *
 * Six, not a colour picker. Choices you can tell apart at a glance beat
 * sixteen million you cannot, and a fixed set means a note keeps its meaning
 * when the theme flips — each entry is tuned for both.
 *
 * Client-safe, like tag-colours.ts and for the same reason: the server-only
 * data module holds the service key, so shared constants live apart from it.
 *
 * Classes are written out in full because Tailwind only ships what it can see
 * in the source — `bg-${name}-500/10` compiles to nothing.
 */

export type NoteColour = "amber" | "rose" | "violet" | "sky" | "emerald" | "slate";

export const NOTE_COLOURS: {
  id: NoteColour;
  label: string;
  /** The card itself. */
  surface: string;
  /** The swatch in the colour row. */
  swatch: string;
  /** The glow that follows the cursor, as a raw colour for a gradient. */
  glow: string;
}[] = [
  { id: "amber", label: "Amber", swatch: "bg-amber-400",
    surface: "border-amber-500/25 bg-amber-500/10", glow: "rgba(245,158,11,0.20)" },
  { id: "rose", label: "Rose", swatch: "bg-rose-400",
    surface: "border-rose-500/25 bg-rose-500/10", glow: "rgba(244,63,94,0.20)" },
  { id: "violet", label: "Violet", swatch: "bg-violet-400",
    surface: "border-violet-500/25 bg-violet-500/10", glow: "rgba(139,92,246,0.20)" },
  { id: "sky", label: "Sky", swatch: "bg-sky-400",
    surface: "border-sky-500/25 bg-sky-500/10", glow: "rgba(14,165,233,0.20)" },
  { id: "emerald", label: "Emerald", swatch: "bg-emerald-400",
    surface: "border-emerald-500/25 bg-emerald-500/10", glow: "rgba(16,185,129,0.20)" },
  { id: "slate", label: "Slate", swatch: "bg-slate-400",
    surface: "border-border bg-card", glow: "rgba(99,102,241,0.16)" },
];

const BY_ID = new Map(NOTE_COLOURS.map((c) => [c.id, c]));

/** Null is the default paper, which is the plain card surface. */
export function noteColour(id: string | null) {
  return (id && BY_ID.get(id as NoteColour)) || BY_ID.get("slate")!;
}
