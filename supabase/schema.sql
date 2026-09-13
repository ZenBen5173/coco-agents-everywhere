-- COCO: Slack channel → review queue → task board.
-- The rule: agents only ever write to captures. Only approve_capture() writes items.
-- Run this once in the Supabase SQL editor (it is the migration the demo uses).

create type capture_type as enum ('commitment', 'decision', 'deadline');
create type capture_status as enum ('pending', 'approved', 'binned');
create type item_status as enum ('open', 'done', 'dropped');

create table members (
  slack_user_id text primary key,
  display_name text not null,
  avatar_url text,
  is_bot boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Raw Slack messages, kept so every capture/item can link back to its exact source line.
create table messages (
  ts text primary key,                       -- Slack message ts, unique per channel
  channel_id text not null,
  user_id text references members(slack_user_id),
  text text not null,
  thread_ts text,
  posted_at timestamptz not null,
  extracted_at timestamptz,                  -- null until the extractor has looked at it
  created_at timestamptz not null default now()
);
create index messages_unextracted_idx on messages (posted_at) where extracted_at is null;

-- The review queue. Written by agents, decided by humans.
create table captures (
  id uuid primary key default gen_random_uuid(),
  type capture_type not null,
  title text not null,
  owner_slack_id text references members(slack_user_id),
  due_date timestamptz,
  all_day boolean not null default true,
  source_text text not null,
  source_ts text not null references messages(ts),
  confidence real not null check (confidence >= 0 and confidence <= 1),
  reasoning text,
  status capture_status not null default 'pending',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint captures_no_duplicate_extraction unique (source_ts, type, title)
);
create index captures_pending_idx on captures (created_at desc) where status = 'pending';

-- Approved records only.
create table items (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null unique references captures(id),
  type capture_type not null,
  title text not null,
  owner_slack_id text references members(slack_user_id),
  due_date timestamptz,
  all_day boolean not null default true,
  source_text text not null,
  source_ts text not null references messages(ts),
  status item_status not null default 'open',
  human_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index items_open_due_idx on items (due_date) where status = 'open';
create index items_owner_idx on items (owner_slack_id);

-- Guard: an item can only ever be inserted for a capture a human has approved.
create function items_require_approved_capture() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from captures where id = new.capture_id and status = 'approved') then
    raise exception 'items may only be created from an approved capture (capture % is not approved)', new.capture_id
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger items_guard before insert on items
  for each row execute function items_require_approved_capture();

create function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  if new.status = 'done' and old.status is distinct from 'done' then new.completed_at = now(); end if;
  if new.status <> 'done' then new.completed_at = null; end if;
  return new;
end $$;
create trigger items_touch before update on items
  for each row execute function touch_updated_at();

-- The one write path onto the board. Atomic: mark the capture approved, insert the item.
-- overrides: optional {title, owner_slack_id, due_date, all_day, type} from Edit-then-add.
-- Any override marks the item human_confirmed.
create function approve_capture(p_capture_id uuid, p_overrides jsonb default '{}'::jsonb)
returns items language plpgsql as $$
declare
  c captures%rowtype;
  it items%rowtype;
  edited boolean := coalesce(p_overrides, '{}'::jsonb) <> '{}'::jsonb;
begin
  select * into c from captures where id = p_capture_id for update;
  if not found then raise exception 'capture % not found', p_capture_id; end if;
  if c.status <> 'pending' then raise exception 'capture % is already %', p_capture_id, c.status; end if;

  update captures set status = 'approved', reviewed_at = now() where id = p_capture_id;

  insert into items (capture_id, type, title, owner_slack_id, due_date, all_day, source_text, source_ts, human_confirmed)
  values (
    c.id,
    coalesce((p_overrides->>'type')::capture_type, c.type),
    coalesce(nullif(trim(p_overrides->>'title'), ''), c.title),
    case when p_overrides ? 'owner_slack_id' then nullif(p_overrides->>'owner_slack_id', '') else c.owner_slack_id end,
    case when p_overrides ? 'due_date' then nullif(p_overrides->>'due_date', '')::timestamptz else c.due_date end,
    coalesce((p_overrides->>'all_day')::boolean, c.all_day),
    c.source_text,
    c.source_ts,
    edited
  )
  returning * into it;
  return it;
end $$;

create function bin_capture(p_capture_id uuid) returns captures
language plpgsql as $$
declare c captures%rowtype;
begin
  update captures set status = 'binned', reviewed_at = now()
    where id = p_capture_id and status = 'pending'
    returning * into c;
  if not found then raise exception 'capture % is not pending', p_capture_id; end if;
  return c;
end $$;

-- Live updates for the web app.
alter publication supabase_realtime add table captures, items, messages;
