/** Row shapes for the four tables. Browser-safe. */

export const CAPTURE_TYPES = ["commitment", "decision", "deadline"] as const;
export type CaptureType = (typeof CAPTURE_TYPES)[number];

export const CAPTURE_STATUSES = ["pending", "approved", "binned"] as const;
export type CaptureStatus = (typeof CAPTURE_STATUSES)[number];

export const ITEM_STATUSES = ["open", "done", "dropped"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export type Member = {
  slack_user_id: string;
  display_name: string;
  avatar_url: string | null;
  is_bot: boolean;
};

export type MessageRow = {
  ts: string;
  channel_id: string;
  user_id: string | null;
  text: string;
  thread_ts: string | null;
  posted_at: string;
  extracted_at: string | null;
};

export type CaptureRow = {
  id: string;
  type: CaptureType;
  title: string;
  owner_slack_id: string | null;
  due_date: string | null;
  all_day: boolean;
  source_text: string;
  source_ts: string;
  confidence: number;
  reasoning: string | null;
  /** An open list tag — 'hackathon', 'personal' — or null. */
  tag: string | null;
  status: CaptureStatus;
  reviewed_at: string | null;
  created_at: string;
};

export type ItemRow = {
  id: string;
  capture_id: string;
  type: CaptureType;
  title: string;
  owner_slack_id: string | null;
  due_date: string | null;
  all_day: boolean;
  source_text: string;
  source_ts: string;
  status: ItemStatus;
  human_confirmed: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  /** Google Calendar event COCO created for it, if any. */
  calendar_event_id: string | null;
  tag: string | null;
};

/** Fields a human may override when approving or correcting. */
export type ItemEdit = Partial<
  Pick<ItemRow, "title" | "owner_slack_id" | "due_date" | "all_day" | "type" | "status" | "tag">
>;
