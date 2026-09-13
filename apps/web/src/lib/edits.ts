import { z } from "zod";
import { CAPTURE_TYPES, ITEM_STATUSES } from "agent-core/shared";

/** What a human may change on an item, or override when approving a capture. */
export const itemEditSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    owner_slack_id: z.string().nullable().optional(),
    due_date: z.iso.datetime({ offset: true }).nullable().optional(),
    all_day: z.boolean().optional(),
    type: z.enum(CAPTURE_TYPES).optional(),
    status: z.enum(ITEM_STATUSES).optional(),
    tag: z
      .string()
      .trim()
      .toLowerCase()
      .transform((t) => t.split(/\s+/).join("-").slice(0, 24))
      .pipe(z.string().min(2).max(24))
      .nullable()
      .optional(),
  })
  .strict();

export type ItemEditInput = z.infer<typeof itemEditSchema>;
