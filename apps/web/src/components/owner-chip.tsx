"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkspace } from "@/lib/store";
import { initials } from "@/components/member-picker";
import { cn } from "@/lib/utils";

/** An owner as avatar + name; just the avatar at small sizes, name on hover. */
export function OwnerChip({
  id,
  size = "md",
  className,
}: {
  id: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
}) {
  const { member } = useWorkspace();
  const m = member(id);
  const name = m?.display_name ?? (id ? id : "Nobody yet");
  const avatar = (
    <Avatar className={cn(size === "sm" ? "size-5" : "size-6", !m && "opacity-50")}>
      {m?.avatar_url && <AvatarImage src={m.avatar_url} alt="" />}
      <AvatarFallback className="text-[9px]">{m ? initials(m.display_name) : "?"}</AvatarFallback>
    </Avatar>
  );
  if (size === "sm") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex shrink-0", className)}>{avatar}</span>
        </TooltipTrigger>
        <TooltipContent>{name}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", !m && "text-muted-foreground", className)}>
      {avatar}
      <span className="truncate">{name}</span>
    </span>
  );
}
