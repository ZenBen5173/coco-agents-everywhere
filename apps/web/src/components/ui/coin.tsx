import { cn } from "@/lib/utils";

/**
 * A spinning coin, by truezipp — CC0.
 *
 * The first version of this was drawn in CSS: a gold gradient on a card
 * rotating in 3D. It span, and it still read as the emoji it replaced, because
 * a radial gradient at 15px is a shiny dot however you turn it. Six frames
 * drawn by hand carry the rotation instead — the coin narrows, passes through a
 * single-pixel edge, and opens out the other side.
 *
 * Played the same way the pets are: background-position stepped by a CSS
 * keyframe, so no JavaScript runs per frame.
 */

const FRAMES = 6;
const CELL_W = 9;
const CELL_H = 10;

export function Coin({
  scale = 1,
  spin = true,
  className,
}: {
  /** Whole numbers only — a fractional scale blurs the pixels. */
  scale?: 1 | 2 | 3;
  /** Every coin on the Progress page turns, so nothing passes this today. It
   *  stays because a coin that cannot be asked to hold still is a worse
   *  component than one that can. */
  spin?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("coin inline-block shrink-0 align-[-0.1em]", spin && "coin-spin", className)}
      style={{
        width: CELL_W * scale,
        height: CELL_H * scale,
        backgroundSize: `${CELL_W * FRAMES * scale}px ${CELL_H * scale}px`,
        // The keyframe walks this to the end of the strip.
        ["--coin-strip" as string]: `-${CELL_W * FRAMES * scale}px`,
      }}
    />
  );
}
