"use client";

/**
 * A sticky note whose folded corner peels back on hover.
 *
 * Written rather than sourced: the component library has no note glyph, and
 * every other icon in the rail is one of its animated set, so a static lucide
 * icon would have been the one row that does nothing when you point at it.
 * Follows the same shape as the library's icons — motion variants, a handle
 * exposed through the ref so a parent row can drive the animation.
 */

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

export interface StickyNoteIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface StickyNoteIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

// The page itself lifts a touch, the way paper does when the corner is caught.
const PAGE_VARIANTS: Variants = {
  normal: { translateY: 0, rotate: 0, transition: { type: "spring", stiffness: 220, damping: 20 } },
  animate: { translateY: -1, rotate: -2, transition: { type: "spring", stiffness: 220, damping: 20 } },
};

// The turned-down corner: flat when at rest, curled open on hover.
const FOLD_VARIANTS: Variants = {
  normal: { d: "M15 3v6h6", transition: { duration: 0.25 } },
  animate: { d: "M15 3v6h6", transition: { duration: 0.25 } },
};

const LINE_VARIANTS: Variants = {
  normal: { pathLength: 1, opacity: 1 },
  animate: {
    pathLength: [0, 1],
    opacity: 1,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

const StickyNoteIcon = forwardRef<StickyNoteIconHandle, StickyNoteIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: () => controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
      };
    });

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseEnter?.(e);
        } else {
          controls.start("animate");
        }
      },
      [controls, onMouseEnter],
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseLeave?.(e);
        } else {
          controls.start("normal");
        }
      },
      [controls, onMouseLeave],
    );

    return (
      <div
        className={cn(className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <svg
          fill="none"
          height={size}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          <motion.g animate={controls} initial="normal" variants={PAGE_VARIANTS}>
            {/* The sheet, with the top-right corner cut away for the fold. */}
            <path d="M15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9Z" />
            <motion.path d="M15 3v6h6" variants={FOLD_VARIANTS} />
            {/* Two lines of writing, drawn on as the note is picked up. */}
            <motion.path d="M7 12h6" variants={LINE_VARIANTS} />
            <motion.path d="M7 16h4" variants={LINE_VARIANTS} />
          </motion.g>
        </svg>
      </div>
    );
  },
);

StickyNoteIcon.displayName = "StickyNoteIcon";

export { StickyNoteIcon };
