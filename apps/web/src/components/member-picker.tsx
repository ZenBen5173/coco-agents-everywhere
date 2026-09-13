"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspace } from "@/lib/store";

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Who is looking at the board. There is no sign-in — this is a team's own
 * channel — so "Mine" is whoever you say you are, remembered per browser.
 */
export function MemberPicker({ compact = false }: { compact?: boolean }) {
  const { members, me, setMe, member } = useWorkspace();
  const people = members.filter((m) => !m.is_bot);
  const current = member(me);

  return (
    <Select value={me ?? ""} onValueChange={(v) => setMe(v || null)}>
      <SelectTrigger
        aria-label="Who are you?"
        className={compact ? "h-8 w-8 justify-center border-0 bg-transparent p-0 shadow-none [&>svg:last-child]:hidden" : "h-9 w-full"}
      >
        {compact ? (
          <Avatar className="size-7">
            {current?.avatar_url && <AvatarImage src={current.avatar_url} alt="" />}
            <AvatarFallback className="text-[10px]">{current ? initials(current.display_name) : "?"}</AvatarFallback>
          </Avatar>
        ) : (
          <SelectValue placeholder="Who are you?" />
        )}
      </SelectTrigger>
      <SelectContent>
        {people.map((m) => (
          <SelectItem key={m.slack_user_id} value={m.slack_user_id}>
            <span className="flex items-center gap-2">
              <Avatar className="size-5">
                {m.avatar_url && <AvatarImage src={m.avatar_url} alt="" />}
                <AvatarFallback className="text-[9px]">{initials(m.display_name)}</AvatarFallback>
              </Avatar>
              {m.display_name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
