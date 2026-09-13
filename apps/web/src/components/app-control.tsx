"use client";

/**
 * What the agent can see and what it can do on the page.
 *
 * Context: the queue, the board, the members, who is looking, today and the
 * date table — so a typed correction resolves without asking.
 *
 * Tools: everything a human could do by clicking, except the two decisions
 * that put something on the board or bin it. Those are gated behind an
 * in-chat click in generative-ui.tsx.
 */
import { useRouter } from "next/navigation";
import { useAgentContext, useFrontendTool } from "@copilotkit/react-core/v2";
import { toast } from "sonner";
import { z } from "zod";
import { CAPTURE_TYPES, ITEM_STATUSES, dateTable, daysUntil, localDay, parseDue, type ItemEdit } from "agent-core/shared";
import { useWorkspace } from "@/lib/store";

function fail(error: unknown) {
  return { status: "error", message: error instanceof Error ? error.message : String(error) };
}

export function AppControl() {
  const ws = useWorkspace();
  const router = useRouter();
  const now = new Date();

  useAgentContext({
    description:
      "The COCO workspace the user is looking at. captures = pending review queue (agent proposals, NOT on the board). items = the board (human-approved). human_confirmed items are ground truth. CRITICAL: you cannot approve or bin anything yourself — approve_capture and bin_capture ask the user to click. update_item applies a human's typed correction immediately. Dates you pass to tools are YYYY-MM-DD or YYYY-MM-DDTHH:MM in the team's timezone (use the date table), or 'none' to clear. Never pass null anywhere; use '' or 'none'. Refer to people by display_name.",
    value: {
      today: localDay(now, ws.timeZone),
      timeZone: ws.timeZone,
      dateTable: dateTable(now, ws.timeZone),
      channel: ws.channelName,
      viewer: ws.me ? { slack_user_id: ws.me, display_name: ws.memberName(ws.me) } : null,
      members: ws.members.filter((m) => !m.is_bot).map((m) => ({ slack_user_id: m.slack_user_id, display_name: m.display_name })),
      captures: ws.captures.map((c) => ({
        id: c.id,
        type: c.type,
        title: c.title,
        owner: ws.memberName(c.owner_slack_id),
        owner_slack_id: c.owner_slack_id,
        due_date: c.due_date,
        confidence: c.confidence,
        said_by: c.source_text,
        reasoning: c.reasoning,
      })),
      items: ws.items.map((i) => ({
        id: i.id,
        type: i.type,
        title: i.title,
        owner: ws.memberName(i.owner_slack_id),
        owner_slack_id: i.owner_slack_id,
        due_date: i.due_date,
        all_day: i.all_day,
        status: i.status,
        late: Boolean(i.status === "open" && i.due_date && daysUntil(i.due_date, now, ws.timeZone) < 0),
        human_confirmed: i.human_confirmed,
        source_text: i.source_text,
      })),
    },
  });

  useFrontendTool(
    {
      name: "update_item",
      description:
        "Apply a human's correction to an item on the board: title, owner, due date, type or status. Marks it human_confirmed. Use for 'the X deadline is tomorrow', 'that one is Amy's', 'mark Y done', 'drop Z'.",
      parameters: z.object({
        itemId: z.string(),
        title: z.string().min(1).max(200).optional(),
        owner_slack_id: z.string().optional().describe("A member's slack_user_id, or the empty string to clear the owner."),
        due_date: z
          .string()
          .optional()
          .describe("YYYY-MM-DD or YYYY-MM-DDTHH:MM in the team's timezone, or the word 'none' to clear the date."),
        type: z.enum(CAPTURE_TYPES).optional(),
        status: z.enum(ITEM_STATUSES).optional(),
      }),
      handler: async ({ itemId, due_date, owner_slack_id, ...rest }) => {
        try {
          const edit: ItemEdit = { ...rest };
          if (owner_slack_id !== undefined) edit.owner_slack_id = owner_slack_id || null;
          if (due_date !== undefined) {
            if (due_date === "" || due_date.toLowerCase() === "none") {
              edit.due_date = null;
              edit.all_day = true;
            } else {
              const parsed = parseDue(due_date, ws.timeZone);
              if (!parsed.due_date) return fail(new Error(`Could not read date '${due_date}'. Use YYYY-MM-DD or YYYY-MM-DDTHH:MM.`));
              edit.due_date = parsed.due_date;
              edit.all_day = parsed.all_day;
            }
          }
          const item = await ws.updateItem(itemId, edit);
          toast.success(`Updated “${item.title}”`, { description: "Marked human-confirmed." });
          return { status: "ok", item: { id: item.id, title: item.title, owner: ws.memberName(item.owner_slack_id), due_date: item.due_date, status: item.status, human_confirmed: true } };
        } catch (error) {
          return fail(error);
        }
      },
    },
    [ws.updateItem, ws.timeZone, ws.memberName],
  );

  useFrontendTool(
    {
      name: "open_item",
      description: "Open an item's editor panel on screen so the user can see it. Read-only; changes nothing.",
      parameters: z.object({ itemId: z.string() }),
      handler: async ({ itemId }) => {
        ws.setSelectedItemId(itemId);
        return { status: "ok", message: `Opened the editor for item ${itemId}.` };
      },
    },
    [ws.setSelectedItemId],
  );

  useFrontendTool(
    {
      name: "go_to",
      description: "Navigate the page: overview, review (the pending queue) or board (tab: mine, everyone, late, done).",
      parameters: z.object({
        page: z.enum(["overview", "review", "board"]),
        tab: z.enum(["mine", "everyone", "late", "done"]).optional(),
      }),
      handler: async ({ page, tab }) => {
        const href = page === "overview" ? "/" : page === "review" ? "/review" : `/board${tab ? `?tab=${tab}` : ""}`;
        router.push(href);
        return { status: "ok", message: `Navigated to ${href}.` };
      },
    },
    [router],
  );

  useFrontendTool(
    {
      name: "set_viewer",
      description: "Set who is using the page (drives the 'Mine' tab). Only when the user says who they are.",
      parameters: z.object({ slack_user_id: z.string() }),
      handler: async ({ slack_user_id }) => {
        if (!ws.member(slack_user_id)) return fail(new Error("Unknown member id."));
        ws.setMe(slack_user_id);
        return { status: "ok", message: `The viewer is now ${ws.memberName(slack_user_id)}.` };
      },
    },
    [ws.setMe, ws.member],
  );

  return null;
}
