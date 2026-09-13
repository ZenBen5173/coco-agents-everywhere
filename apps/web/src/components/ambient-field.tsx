"use client";

import { WaterRipples } from "@/components/ui/water-ripples";

export function AmbientField() {
  return (
    <WaterRipples
      className="absolute inset-0 z-0"
      refraction={1}
      speed={0.5}
      specular={0.35}
    />
  );
}
