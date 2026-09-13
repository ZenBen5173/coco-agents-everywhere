"use client";

/**
 * The chat composer in myTask's metal rim: quiet at rest, alive while you are
 * typing into it. Fills CopilotChat's `input` slot, rendering the stock
 * CopilotChatInput inside so nothing about sending changes.
 */
import { useEffect, useState, type ComponentProps } from "react";
import { CopilotChatInput } from "@copilotkit/react-core/v2";
import { LiquidMetal } from "@/components/ui/liquid-metal";
import { SendButton } from "@/components/send-button";
import { prefersReducedMotion } from "@/lib/reduced-motion";
import { cn } from "@/lib/utils";

const RIM = 2;

export function Composer(props: ComponentProps<typeof CopilotChatInput>) {
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(false);
  // Read after mount: the server has no window.
  useEffect(() => setReduced(prefersReducedMotion()), []);
  const live = focused && !reduced;

  return (
    <div
      className={cn("ck-composer relative overflow-hidden rounded-[1.25rem] transition-colors", !live && "bg-border/50")}
      style={{ padding: RIM }}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      {live && (
        <LiquidMetal colorBack="#4c4f6b" colorTint="#a5b4fc" speed={0.4} repetition={4} distortion={0.15} className="absolute inset-0 z-0 rounded-[1.25rem]" />
      )}
      <div className="relative z-10">
        <CopilotChatInput {...props} sendButton={SendButton} showDisclaimer={false} />
      </div>
    </div>
  );
}
