"use client";

/**
 * A dashboard mark: four panes that settle into place on hover.
 *
 * Written rather than sourced. The component library has no dashboard or grid
 * glyph, and every other row in the rail is one of its animated icons — a
 * static one would be the row that does nothing when you point at it. Same
 * shape as the library's icons: motion variants, a handle on the ref so the
 * row can drive it.
 */

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

export interface LayoutIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface LayoutIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

/** Each pane drifts a little off its corner, then comes back. */
const pane = (dx: number, dy: number): Variants => ({
  normal: {
    x: 0,
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 18 },
  },
  animate: {
    x: dx,
    y: dy,
    transition: { type: "spring", stiffness: 260, damping: 18 },
  },
});

const LayoutIcon = forwardRef<LayoutIconHandle, LayoutIconProps>(
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
          {/* Panes drift outward from the centre, so the whole mark breathes
              rather than any one corner jumping. */}
          <motion.rect
            animate={controls}
            initial="normal"
            variants={pane(-0.9, -0.9)}
            x="3"
            y="3"
            width="7"
            height="9"
            rx="1.5"
          />
          <motion.rect
            animate={controls}
            initial="normal"
            variants={pane(0.9, -0.9)}
            x="14"
            y="3"
            width="7"
            height="5"
            rx="1.5"
          />
          <motion.rect
            animate={controls}
            initial="normal"
            variants={pane(0.9, 0.9)}
            x="14"
            y="12"
            width="7"
            height="9"
            rx="1.5"
          />
          <motion.rect
            animate={controls}
            initial="normal"
            variants={pane(-0.9, 0.9)}
            x="3"
            y="16"
            width="7"
            height="5"
            rx="1.5"
          />
        </svg>
      </div>
    );
  },
);

LayoutIcon.displayName = "LayoutIcon";

export { LayoutIcon };
