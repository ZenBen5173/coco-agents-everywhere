"use client";

import { useRef } from "react";

/** What every animated icon in the library exposes to its parent. */
export interface IconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

export type AnimatedIcon = React.ForwardRefExoticComponent<
  { size?: number; className?: string } & React.RefAttributes<IconHandle>
>;

/**
 * The animated icons play on their own hover, but in a nav the hover target is
 * the whole row — so the row drives the icon through its handle instead.
 */
export function useIconHover() {
  const ref = useRef<IconHandle>(null);
  return {
    ref,
    onMouseEnter: () => ref.current?.startAnimation(),
    onMouseLeave: () => ref.current?.stopAnimation(),
  };
}
