"use client";

import { Lock, Sparkles, Star } from "lucide-react";
import { MAX_STARS } from "@/lib/game-types";

import { PetSprite, type PetKey } from "@/components/pet-sprite";
import { cn } from "@/lib/utils";
import type { PetEntry } from "@/lib/game-types";

/**
 * The dictionary: everything there is to collect, and what each one does.
 *
 * Abilities are readable from the start. Hiding them would make the collection
 * a list of locked boxes, and knowing what is out there is the whole reason to
 * go looking for it.
 *
 * What stays hidden is the artwork. An undiscovered pet still moves and still
 * has its outline — you can see there is something there and roughly its
 * shape, but not what it is. That is the part worth saving for the moment it
 * hatches.
 */

const RARITY: Record<PetEntry["rarity"], { label: string; ring: string; text: string }> = {
  common: { label: "Common", ring: "border-border/60", text: "text-muted-foreground" },
  rare: { label: "Rare", ring: "border-sky-500/30", text: "text-sky-400" },
  epic: { label: "Epic", ring: "border-violet-500/30", text: "text-violet-400" },
  legendary: { label: "Legendary", ring: "border-amber-500/30", text: "text-amber-400" },
};

function abilityLine(entry: PetEntry, rate: number): string {
  const pct = Math.round(rate * 100);
  if (entry.ability === "both") return `+${pct}% XP and coins`;
  return `+${pct}% ${entry.ability === "xp" ? "XP" : "coins"}`;
}

export function PetDictionary({ pets }: { pets: PetEntry[] }) {
  const found = pets.filter((p) => p.owned).length;

  return (
    <section className="mt-4 min-w-0 rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Dictionary
        </p>
        <p className="text-[11px] tabular-nums text-muted-foreground">
          {found} of {pets.length} found
        </p>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pets.map((pet) => {
          const rarity = RARITY[pet.rarity];
          const hasArt = pet.sprite !== null;

          return (
            <li
              key={pet.key}
              className={cn(
                "flex min-w-0 gap-3 rounded-lg border bg-card/40 p-3",
                rarity.ring,
                !pet.owned && "opacity-90",
              )}
            >
              {/* The picture, or the shape of one. */}
              {/* 96 wide, because the dragon's cell is 83 and a square box
                  would shave its tail off. */}
              <div className="grid h-20 w-24 shrink-0 place-items-center overflow-hidden rounded-md border border-border/40 bg-background/40">
                {hasArt ? (
                  <PetSprite
                    pet={pet.sprite as PetKey}
                    silhouette={!pet.owned}
                    scale={1}
                  />
                ) : (
                  // No artwork drawn for this one yet, so there is not even a
                  // shape to show. Saying so beats a shrug of an icon.
                  <span className="text-[10px] text-muted-foreground/50">no art yet</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <p className={cn("truncate text-sm font-medium", !pet.owned && "text-muted-foreground")}>
                    {pet.name}
                  </p>
                  {pet.shiny && <Sparkles className="size-3 shrink-0 text-amber-400" />}
                  {!pet.owned && <Lock className="size-3 shrink-0 text-muted-foreground/50" />}
                </div>

                <p className={cn("mt-0.5 text-[10px] uppercase tracking-wider", rarity.text)}>
                  {rarity.label}
                </p>

                {/* The rate it gives at the stars you have, not the base
                    base. A starred pet read its base rate while earning more, so the
                    one number on the card that stars change was the one that
                    never did. The base stays beside it so the jump is legible. */}
                <p className="mt-1.5 text-xs tabular-nums">
                  {abilityLine(pet, pet.owned ? pet.strength : pet.amount)}
                  {pet.owned && pet.strength > pet.amount && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground">
                      base {Math.round(pet.amount * 100)}%
                    </span>
                  )}
                </p>

                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  {pet.blurb}
                </p>

                {pet.owned && (
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-0.5">
                      {Array.from({ length: MAX_STARS }, (_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "size-2.5",
                            i < pet.stars ? "fill-amber-400 text-amber-400" : "text-border",
                          )}
                        />
                      ))}
                    </span>

                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
