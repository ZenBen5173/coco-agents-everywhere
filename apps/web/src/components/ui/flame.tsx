"use client";

/**
 * A flame that flickers on hover.
 *
 * Written rather than sourced — the component library has no flame, and the
 * rail's other rows are all animated icons from it, so a static one would be
 * the row that does nothing when you point at it. Same shape as the library's
 * icons: motion variants and a handle on the ref.
 */

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

export interface FlameIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface FlameIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const BODY: Variants = {
  normal: { scale: 1, y: 0, transition: { type: "spring", stiffness: 220, damping: 18 } },
  animate: {
    scale: [1, 1.08, 0.98, 1.04, 1],
    y: [0, -1, 0.5, -0.5, 0],
    transition: { duration: 1.1, ease: "easeInOut", repeat: Infinity },
  },
};

// The inner tongue moves faster than the body, which is what reads as fire
// rather than a wobbling shape.
const CORE: Variants = {
  normal: { scale: 1, opacity: 1 },
  animate: {
    scale: [1, 0.86, 1.1, 1],
    opacity: [1, 0.75, 1],
    transition: { duration: 0.7, ease: "easeInOut", repeat: Infinity },
  },
};

const FlameIcon = forwardRef<FlameIconHandle, FlameIconProps>(
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
        if (isControlledRef.current) onMouseEnter?.(e);
        else controls.start("animate");
      },
      [controls, onMouseEnter],
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) onMouseLeave?.(e);
        else controls.start("normal");
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
          <motion.path
            animate={controls}
            initial="normal"
            variants={BODY}
            style={{ transformOrigin: "12px 20px" }}
            d="M12 2c1.5 3.5 5 5.5 5 9.5A5 5 0 0 1 7 12c0-1.5.5-2.5 1.5-3.5C9 10 10 10.5 11 10c-.5-3 1-6 1-8Z"
          />
          <motion.path
            animate={controls}
            initial="normal"
            variants={CORE}
            style={{ transformOrigin: "12px 19px" }}
            d="M12 21a2.5 2.5 0 0 1-2.5-2.5c0-1.5 2.5-3.5 2.5-3.5s2.5 2 2.5 3.5A2.5 2.5 0 0 1 12 21Z"
          />
        </svg>
      </div>
    );
  },
);

FlameIcon.displayName = "FlameIcon";

export { FlameIcon };
