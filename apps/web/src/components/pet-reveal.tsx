"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Sparkles, Star } from "lucide-react";
import { MAX_STARS } from "@/lib/game-types";

import { PetSprite, type PetKey } from "@/components/pet-sprite";
import { cn } from "@/lib/utils";
import type { Hatched } from "@/lib/game-actions";

/**
 * The moment an egg opens.
 *
 * The pet was already appearing in the dictionary and the buddy row the instant
 * it hatched — correct, and completely flat. A collection needs the finding to
 * be worth something, and the cheapest way to spend nothing and get that is to
 * hold the shape back for a beat.
 *
 * So the sprite arrives as the same grey silhouette the dictionary shows for
 * everything unfound, sits there long enough to be read as "something", and
 * then turns over into the real thing. The reveal is the silhouette leaving.
 */

const HOLD_MS = 850;

const RARITY: Record<string, { label: string; text: string; glow: string; ring: string }> = {
  common: { label: "Common", text: "text-muted-foreground", glow: "bg-slate-400/20", ring: "border-border" },
  rare: { label: "Rare", text: "text-sky-400", glow: "bg-sky-500/25", ring: "border-sky-500/40" },
  epic: { label: "Epic", text: "text-violet-400", glow: "bg-violet-500/25", ring: "border-violet-500/40" },
  legendary: { label: "Legendary", text: "text-amber-400", glow: "bg-amber-500/30", ring: "border-amber-500/50" },
};

export function PetReveal({
  result,
  onClose,
}: {
  result: Hatched | null;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!result) {
      setRevealed(false);
      return;
    }
    // Someone who asked for less motion is shown the pet, not a suspense beat.
    if (reduced) {
      setRevealed(true);
      return;
    }
    setRevealed(false);
    const id = window.setTimeout(() => setRevealed(true), HOLD_MS);
    return () => window.clearTimeout(id);
  }, [result, reduced]);

  // Dismiss on Escape as well as a tap, since it covers the page.
  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result, onClose]);

  const rarity = RARITY[result?.rarity ?? "common"] ?? RARITY.common;
  const isNew = result?.outcome === "new";

  return (
    <AnimatePresence>
      {result?.sprite && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={revealed ? `${result.name} found` : "Opening"}
        >
          <motion.div
            className={cn(
              "relative grid w-full max-w-xs justify-items-center gap-1 rounded-2xl border bg-card/90 px-6 py-8 text-center",
              revealed ? rarity.ring : "border-border",
            )}
            initial={{ scale: 0.9, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* The glow only exists once there is something to be pleased about,
                and it is stronger the rarer the find. */}
            <AnimatePresence>
              {revealed && (
                <motion.div
                  className={cn("pointer-events-none absolute inset-0 rounded-2xl blur-2xl", rarity.glow)}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
            </AnimatePresence>

            <div className="relative grid h-28 w-full place-items-center">
              <motion.div
                key={revealed ? "shown" : "hidden"}
                initial={reduced ? false : { scale: revealed ? 0.7 : 1, opacity: revealed ? 0 : 1 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
              >
                <PetSprite pet={result.sprite as PetKey} silhouette={!revealed} />
              </motion.div>
            </div>

            <p className="relative mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              {revealed ? (isNew ? "Found" : "Again") : "Opening"}
            </p>

            <p className="relative flex items-center gap-1.5 font-display text-lg font-semibold">
              {revealed ? result.name : "???"}
              {revealed && result.shiny && <Sparkles className="size-4 text-amber-400" />}
            </p>

            {revealed && (
              <motion.div
                className="relative grid justify-items-center gap-2"
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
              >
                <p className={cn("text-[10px] uppercase tracking-wider", rarity.text)}>
                  {rarity.label}
                </p>
                <span className="inline-flex items-center gap-0.5">
                  {Array.from({ length: MAX_STARS }, (_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "size-3",
                        i < (result.stars ?? 0) ? "fill-amber-400 text-amber-400" : "text-border",
                      )}
                    />
                  ))}
                </span>
                <p className="max-w-[24ch] text-xs leading-snug text-muted-foreground">
                  {result.message}
                </p>
              </motion.div>
            )}

            <button
              onClick={onClose}
              className="relative mt-3 rounded-md bg-foreground px-4 py-1.5 text-xs font-medium text-background"
            >
              {revealed ? "Keep" : "Skip"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
