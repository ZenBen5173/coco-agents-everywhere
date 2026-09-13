"use client";

/**
 * The chat's send button, as the library's Generate Button: a pill with a
 * travelling border light and letters that lift while it works. Drops into
 * CopilotChat's `sendButton` slot, so it receives the same onClick/disabled
 * the default button would.
 */
import type { ButtonHTMLAttributes } from "react";
import { GenerateButton } from "@/components/ui/generate-button";
import { cn } from "@/lib/utils";

export function SendButton({ disabled, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <GenerateButton
      {...props}
      disabled={disabled}
      label="Send"
      activeLabel="Sending"
      hue={245}
      isGenerating={disabled ? false : undefined}
      aria-label="Send message"
      className={cn("!py-1 !pl-3 !pr-1.5 text-[11px] leading-none", className)}
    />
  );
}
