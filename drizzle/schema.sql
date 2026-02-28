-- Inventory domain schema reference (Supabase)
-- Source of truth for production policies/indexes: /supabase/migrations/20260227110000_inventory_core.sql

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null
);

create table if not exists household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid,
  invited_email text,
  role text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  created_by uuid not null
);

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  created_by uuid not null
);

create table if not exists containers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  parent_container_id uuid references containers(id) on delete set null,
  name text not null,
  code text,
  description text,
  status text not null default 'active',
  archived_at timestamptz,
  qr_deep_link text,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz not null default now()
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  description text,
  barcode text,
  serial_number text,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  updated_at timestamptz not null default now()
);

create table if not exists item_aliases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  alias_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now()
);

create table if not exists item_tags (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists container_tags (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  container_id uuid not null references containers(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists container_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  container_id uuid not null references containers(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  quantity int not null default 1,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  storage_path_original text not null,
  storage_path_thumb text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  actor_user_id uuid,
  action_type text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Trigram indexes for global search
create index if not exists idx_items_name_trgm on items using gin (lower(name) gin_trgm_ops);
create index if not exists idx_containers_name_trgm on containers using gin (lower(name) gin_trgm_ops);
create index if not exists idx_rooms_name_trgm on rooms using gin (lower(name) gin_trgm_ops);
create index if not exists idx_locations_name_trgm on locations using gin (lower(name) gin_trgm_ops);
create index if not exists idx_tags_name_trgm on tags using gin (lower(name) gin_trgm_ops);
create index if not exists idx_item_aliases_alias_trgm on item_aliases using gin (lower(alias_text) gin_trgm_ops);