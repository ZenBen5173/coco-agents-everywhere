/**
 * Colours for an open tag set — client-safe, so both the server-side data
 * layer and the shell can import it.
 *
 * It lives apart from shell-data.ts deliberately: that module is `server-only`
 * because it holds the Supabase service key, and importing a colour helper
 * from it would have pulled the key into the browser bundle. The build caught
 * that; the split is the fix rather than a workaround.
 *
 * Classes are written out rather than built with template strings. Tailwind
 * only ships classes it can see in the source, so `bg-${hue}-500` compiles to
 * nothing at all.
 */

const PALETTE = [
  { dot: "bg-sky-500", text: "text-sky-400", chip: "bg-sky-500/15 text-sky-400" },
  { dot: "bg-violet-500", text: "text-violet-400", chip: "bg-violet-500/15 text-violet-400" },
  { dot: "bg-amber-500", text: "text-amber-400", chip: "bg-amber-500/15 text-amber-400" },
  { dot: "bg-emerald-500", text: "text-emerald-400", chip: "bg-emerald-500/15 text-emerald-400" },
  { dot: "bg-rose-500", text: "text-rose-400", chip: "bg-rose-500/15 text-rose-400" },
  { dot: "bg-cyan-500", text: "text-cyan-400", chip: "bg-cyan-500/15 text-cyan-400" },
  { dot: "bg-fuchsia-500", text: "text-fuchsia-400", chip: "bg-fuchsia-500/15 text-fuchsia-400" },
  { dot: "bg-lime-500", text: "text-lime-400", chip: "bg-lime-500/15 text-lime-400" },
];

/** The starting four keep the hues the design was drawn with. */
const SEEDED: Record<string, number> = { course: 0, club: 1, project: 2, personal: 3 };

/**
 * A tag's colour, derived from its own name.
 *
 * Hashing the name means the same tag is always the same colour without the
 * choice being stored anywhere — so a tag coined over WhatsApp already has its
 * colour by the time the dashboard renders it.
 */
export function paletteFor(tag: string) {
  if (tag in SEEDED) return PALETTE[SEEDED[tag]];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export const tagChip = (tag: string) =>
  tag === "untagged" ? "bg-muted text-muted-foreground" : paletteFor(tag).chip;

export const tagDot = (tag: string) =>
  tag === "untagged" ? "bg-muted-foreground/40" : paletteFor(tag).dot;
