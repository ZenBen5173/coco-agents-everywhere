"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A pet, played from a sprite sheet.
 *
 * Nothing here is drawn in code — earlier attempts to generate creatures
 * procedurally never got close to art a person had made, so this only plays
 * what an artist drew.
 *
 * Rendered with CSS `background-position` on a stepped frame rather than a
 * canvas: no JavaScript runs per frame, it survives a background tab, and it
 * costs nothing on a page that already has plenty moving.
 */

/**
 * Every sheet: cell size, which row holds which animation, and how far to
 * blow it up.
 *
 * `scale` exists because a cell is not a creature. The phoenix is a 23x21 bird
 * adrift in a 40x56 cell, and the dragon fills 79x41 of its 83x48 — drawn at
 * the same cell height the bird looked half the size of everything else,
 * because it was. Each sheet is scaled so the *body* lands near 45px, and only
 * by whole numbers: a fractional scale is precisely what turns pixel art into
 * porridge.
 *
 * `body` is the largest bounding box the creature reaches across its frames,
 * measured rather than eyeballed. Multiply it by `scale` to know what actually
 * shows up on screen.
 *
 * `offset` is how far the body's centre sits below the cell's, per animation.
 * The phoenix's idle bird is pinned to the floor of a cell built tall enough
 * for the rebirth, so centring the *cell* leaves the bird sunk to the bottom
 * and, once doubled, standing on its feet outside the box. Shifting by this
 * puts the creature in the middle instead of the canvas it came on.
 */
const SHEETS = {
  phoenix: {
    name: "Phoenixling",
    src: "/pets/phoenix.png",
    cellW: 40,
    cellH: 56,
    width: 640,
    height: 112,
    rows: { idle: 0, rebirth: 1 },
    frames: { idle: 4, rebirth: 16 },
    fps: { idle: 6, rebirth: 8 },
    body: { w: 23, h: 21 },
    // The idle bird sits at y33-53 of a 56-tall cell; the rebirth uses y3-53
    // and is already centred.
    offset: { idle: 15, rebirth: 0 },
    scale: 2, // 21px of bird becomes 42 on screen, level with the rest
  },
  dragon: {
    // One row. The pack ships Idle, Idle Battle and Walking, and only Walking
    // survives the shrink: measured at pet size it moves 7.9/255 against 3.0
    // for either idle, which at 48px is the difference between a creature and
    // a statue. The idles were built for a 725x445 canvas where a head-dip
    // reads; fifteen times smaller, it does not.
    name: "Dragon",
    src: "/pets/dragon.png",
    cellW: 83,
    cellH: 48,
    width: 1328,
    height: 48,
    rows: { idle: 0 },
    frames: { idle: 16 },
    fps: { idle: 12 },
    body: { w: 79, h: 41 },
    offset: { idle: 4 }, // body y10-46 in a 48 cell
    scale: 1, // already 41px tall
  },
  kitten: {
    name: "Kitten",
    src: "/pets/kitten.png",
    cellW: 35,
    cellH: 48,
    width: 350,
    height: 48,
    rows: { idle: 0 },
    frames: { idle: 10 },
    fps: { idle: 12 },
    body: { w: 34, h: 48 },
    offset: { idle: 0 },
    scale: 1,
  },
  duck: {
    name: "Duck",
    src: "/pets/duck.png",
    cellW: 31,
    cellH: 48,
    width: 310,
    height: 48,
    rows: { idle: 0 },
    frames: { idle: 10 },
    fps: { idle: 12 },
    body: { w: 30, h: 48 },
    offset: { idle: 0 },
    scale: 1,
  },
  bunny: {
    name: "Bunny",
    src: "/pets/bunny.png",
    cellW: 31,
    cellH: 48,
    width: 248,
    height: 48,
    rows: { idle: 0 },
    frames: { idle: 8 },
    fps: { idle: 12 },
    body: { w: 31, h: 48 },
    offset: { idle: 0 },
    scale: 1,
  },
  mushroom: {
    name: "Mushroom",
    src: "/pets/mushroom.png",
    cellW: 45,
    cellH: 48,
    width: 450,
    height: 48,
    rows: { idle: 0 },
    frames: { idle: 10 },
    fps: { idle: 12 },
    body: { w: 45, h: 48 },
    offset: { idle: 0 },
    scale: 1,
  },
  hatchling: {
    name: "Hatchling",
    src: "/pets/hatchling.png",
    cellW: 24,
    cellH: 36,
    width: 120,
    height: 36,
    rows: { idle: 0 },
    frames: { idle: 5 },
    fps: { idle: 12 },
    body: { w: 24, h: 36 },
    offset: { idle: 0 },
    scale: 1,
  },
  penguin: {
    name: "Penguin",
    src: "/pets/penguin.png",
    cellW: 31,
    cellH: 48,
    width: 310,
    height: 48,
    rows: { idle: 0 },
    frames: { idle: 10 },
    fps: { idle: 12 },
    body: { w: 30, h: 48 },
    offset: { idle: 0 },
    scale: 1,
  },
  teddy_bear: {
    name: "Teddy Bear",
    src: "/pets/teddy_bear.png",
    cellW: 32,
    cellH: 48,
    width: 320,
    height: 48,
    rows: { idle: 0 },
    frames: { idle: 10 },
    fps: { idle: 12 },
    body: { w: 32, h: 48 },
    offset: { idle: 0 },
    scale: 1,
  },
  slime: {
    name: "Adventurer",
    src: "/pets/slime.png",
    cellW: 44,
    cellH: 48,
    width: 440,
    height: 48,
    rows: { idle: 0 },
    frames: { idle: 10 },
    fps: { idle: 12 },
    body: { w: 44, h: 48 },
    offset: { idle: 0 },
    scale: 1,
  },
  flame_sprite: {
    name: "Flame Sprite",
    src: "/pets/flame_sprite.png",
    cellW: 26,
    cellH: 18,
    width: 338,
    height: 18,
    rows: { idle: 0 },
    frames: { idle: 13 },
    fps: { idle: 12 },
    body: { w: 26, h: 18 },
    offset: { idle: 0 },
    scale: 2,
  },
  zombie: {
    name: "Zombie",
    src: "/pets/zombie.png",
    cellW: 38,
    cellH: 48,
    width: 342,
    height: 48,
    rows: { idle: 0 },
    frames: { idle: 9 },
    fps: { idle: 12 },
    body: { w: 37, h: 48 },
    offset: { idle: 0 },
    scale: 1,
  },
  polar_bear: {
    name: "Polar Bear",
    src: "/pets/polar_bear.png",
    cellW: 32,
    cellH: 48,
    width: 320,
    height: 48,
    rows: { idle: 0 },
    frames: { idle: 10 },
    fps: { idle: 12 },
    body: { w: 32, h: 48 },
    offset: { idle: 0 },
    scale: 1,
  },
} as const;

export type PetKey = keyof typeof SHEETS;
export type PetAnimation = "idle" | "rebirth";

export function PetSprite({
  pet = "phoenix",
  animation = "idle",
  scale: scaleOverride,
  fps,
  silhouette = false,
  loop = true,
  onEnd,
  className,
}: {
  pet?: PetKey;
  animation?: PetAnimation;
  /** Overrides the sheet's own scale. Whole numbers only, for the same reason
   *  the sheet has a scale at all. */
  scale?: number;
  fps?: number;
  /** Draws the creature as a flat shape: you can see it move and make out its
   *  outline, but not what it is. `brightness(0)` flattens every colour to
   *  black while leaving alpha alone, and `invert` lifts that black to a grey
   *  that shows up on either theme. */
  silhouette?: boolean;
  /** `rebirth` reads better once, then held on its last frame. */
  loop?: boolean;
  onEnd?: () => void;
  className?: string;
}) {
  const [frame, setFrame] = useState(0);
  const done = useRef(false);

  const sheet = SHEETS[pet];
  // Not every pet has every animation; fall back rather than render a blank row.
  const anim = (animation in sheet.rows ? animation : "idle") as keyof typeof sheet.rows;
  const count = (sheet.frames as Record<string, number>)[anim];
  const rate = fps ?? (sheet.fps as Record<string, number>)[anim];

  useEffect(() => {
    setFrame(0);
    done.current = false;

    // Someone who asked for less motion gets the first frame, held.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(() => {
      setFrame((f) => {
        const next = f + 1;
        if (next < count) return next;
        if (loop) return 0;
        if (!done.current) {
          done.current = true;
          onEnd?.();
        }
        return count - 1; // hold the last frame
      });
    }, 1000 / rate);

    return () => window.clearInterval(id);
  }, [pet, anim, count, rate, loop, onEnd]);

  const scale = scaleOverride ?? sheet.scale;
  const row = (sheet.rows as Record<string, number>)[anim];
  const shift = ((sheet.offset as Record<string, number>)[anim] ?? 0) * scale;

  return (
    <div
      role="img"
      aria-label={silhouette ? "Undiscovered pet" : `${sheet.name}, ${anim}`}
      className={cn("shrink-0", className)}
      style={{
        width: sheet.cellW * scale,
        height: sheet.cellH * scale,
        backgroundImage: `url(${sheet.src})`,
        // The sheet scales as a whole, so the offsets scale with it.
        backgroundSize: `${sheet.width * scale}px ${sheet.height * scale}px`,
        backgroundPosition: `-${frame * sheet.cellW * scale}px -${row * sheet.cellH * scale}px`,
        backgroundRepeat: "no-repeat",
        // Lifts the creature to the middle of its box rather than the middle
        // of the canvas it was drawn on.
        transform: shift ? `translateY(-${shift}px)` : undefined,
        filter: silhouette ? "brightness(0) invert(0.38)" : undefined,
        // Without this the browser smooths the upscale and the pixels turn to mush.
        imageRendering: "pixelated",
      }}
    />
  );
}
