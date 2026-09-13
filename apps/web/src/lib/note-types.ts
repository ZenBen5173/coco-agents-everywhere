/** A sticky note: something the team wants to keep, not something to do. */
export type Note = {
  id: string;
  body: string;
  colour: string | null;
  pinned: boolean;
  archived_at: string | null;
  position: number;
  author_slack_id: string | null;
  created_at: string;
  updated_at: string;
};

export type NoteChanges = {
  body?: string;
  colour?: string | null;
  pinned?: boolean;
  archived?: boolean;
};
