-- 20260228190000_inventory_v2_wedge.sql
-- Stowlio V2 wedge: onboarding preferences, AI jobs/suggestions/search docs, and spatial map placement.

create extension if not exists vector;
create extension if not exists pg_trgm;

do $$
begin
  if exists (select 1 from pg_type where typname = 'photo_entity_type') then
    begin
      alter type public.photo_entity_type add value if not exists 'room_layout';
    exception
      when duplicate_object then null;
    end;
  end if;

  if exists (select 1 from pg_type where typname = 'activity_entity_type') then
    begin
      alter type public.activity_entity_type add value if not exists 'suggestion';
      alter type public.activity_entity_type add value if not exists 'placement';
      alter type public.activity_entity_type add value if not exists 'room_layout';
    exception
      when duplicate_object then null;
    end;
  end if;

  if not exists (select 1 from pg_type where typname = 'ai_job_type') then
    create type public.ai_job_type as enum ('photo_analyze', 'embedding_upsert');
  end if;

  if not exists (select 1 from pg_type where typname = 'ai_job_status') then
    create type public.ai_job_status as enum ('queued', 'running', 'succeeded', 'failed');
  end if;

  if not exists (select 1 from pg_type where typname = 'photo_suggestion_status') then
    create type public.photo_suggestion_status as enum ('pending', 'accepted', 'rejected');
  end if;

  if not exists (select 1 from pg_type where typname = 'search_entity_type') then
    create type public.search_entity_type as enum ('item', 'container', 'room', 'location', 'tag');
  end if;

  if not exists (select 1 from pg_type where typname = 'placement_entity_type') then
    create type public.placement_entity_type as enum ('container', 'item');
  end if;
end
$$;

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_household_id uuid references public.households(id) on delete set null,
  active_location_id uuid references public.locations(id) on delete set null,
  active_room_id uuid references public.rooms(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_preferences_active_household_idx
  on public.user_preferences (active_household_id);

create index if not exists user_preferences_active_location_idx
  on public.user_preferences (active_location_id);

create index if not exists user_preferences_active_room_idx
  on public.user_preferences (active_room_id);

create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  job_type public.ai_job_type not null,
  status public.ai_job_status not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  error text,
  attempt_count integer not null default 0,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_jobs_household_idx
  on public.ai_jobs (household_id);

create index if not exists ai_jobs_queue_idx
  on public.ai_jobs (status, run_after, created_at);

create table if not exists public.search_documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  entity_type public.search_entity_type not null,
  entity_id uuid not null,
  content text not null,
  embedding vector(1536),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id)
);

create index if not exists search_documents_household_idx
  on public.search_documents (household_id);

create index if not exists search_documents_household_entity_idx
  on public.search_documents (household_id, entity_type);

create index if not exists search_documents_content_trgm_idx
  on public.search_documents using gin (lower(content) gin_trgm_ops);

create index if not exists search_documents_embedding_ivfflat_idx
  on public.search_documents using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table if not exists public.room_layouts (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  width real not null default 12,
  height real not null default 8,
  background_photo_id uuid references public.photos(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists room_layouts_household_idx
  on public.room_layouts (household_id);

create table if not exists public.placements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  entity_type public.placement_entity_type not null,
  entity_id uuid not null,
  x real not null default 0,
  y real not null default 0,
  rotation real not null default 0,
  label text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, entity_type, entity_id)
);

create index if not exists placements_household_idx
  on public.placements (household_id);

create index if not exists placements_room_idx
  on public.placements (room_id, entity_type);

create table if not exists public.photo_suggestions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete cascade,
  container_id uuid not null references public.containers(id) on delete cascade,
  suggested_name text not null,
  suggested_qty integer check (suggested_qty is null or suggested_qty > 0),
  suggested_tags text[] not null default '{}'::text[],
  confidence real not null default 0,
  status public.photo_suggestion_status not null default 'pending',
  resolved_item_id uuid references public.items(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists photo_suggestions_household_idx
  on public.photo_suggestions (household_id);

create index if not exists photo_suggestions_photo_idx
  on public.photo_suggestions (photo_id);

create index if not exists photo_suggestions_container_idx
  on public.photo_suggestions (container_id);

create index if not exists photo_suggestions_status_idx
  on public.photo_suggestions (household_id, status, created_at desc);

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

drop trigger if exists ai_jobs_set_updated_at on public.ai_jobs;
create trigger ai_jobs_set_updated_at
before update on public.ai_jobs
for each row execute function public.set_updated_at();

drop trigger if exists room_layouts_set_updated_at on public.room_layouts;
create trigger room_layouts_set_updated_at
before update on public.room_layouts
for each row execute function public.set_updated_at();

drop trigger if exists placements_set_updated_at on public.placements;
create trigger placements_set_updated_at
before update on public.placements
for each row execute function public.set_updated_at();

drop trigger if exists photo_suggestions_set_updated_at on public.photo_suggestions;
create trigger photo_suggestions_set_updated_at
before update on public.photo_suggestions
for each row execute function public.set_updated_at();

drop trigger if exists search_documents_set_updated_at on public.search_documents;
create trigger search_documents_set_updated_at
before update on public.search_documents
for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.search_documents enable row level security;
alter table public.room_layouts enable row level security;
alter table public.placements enable row level security;
alter table public.photo_suggestions enable row level security;

drop policy if exists user_preferences_select on public.user_preferences;
create policy user_preferences_select
on public.user_preferences for select
to authenticated
using (user_id = auth.uid());

drop policy if exists user_preferences_insert on public.user_preferences;
create policy user_preferences_insert
on public.user_preferences for insert
to authenticated
with check (
  user_id = auth.uid()
  and (active_household_id is null or public.is_household_member(active_household_id))
);

drop policy if exists user_preferences_update on public.user_preferences;
create policy user_preferences_update
on public.user_preferences for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (active_household_id is null or public.is_household_member(active_household_id))
);

drop policy if exists ai_jobs_select on public.ai_jobs;
create policy ai_jobs_select
on public.ai_jobs for select
to authenticated
using (public.is_household_member(household_id));

drop policy if exists ai_jobs_insert on public.ai_jobs;
create policy ai_jobs_insert
on public.ai_jobs for insert
to authenticated
with check (public.can_write_household(household_id));

drop policy if exists ai_jobs_update on public.ai_jobs;
create policy ai_jobs_update
on public.ai_jobs for update
to authenticated
using (public.can_write_household(household_id))
with check (public.can_write_household(household_id));

drop policy if exists ai_jobs_delete on public.ai_jobs;
create policy ai_jobs_delete
on public.ai_jobs for delete
to authenticated
using (public.can_manage_household(household_id));

drop policy if exists search_documents_select on public.search_documents;
create policy search_documents_select
on public.search_documents for select
to authenticated
using (public.is_household_member(household_id));

drop policy if exists search_documents_insert on public.search_documents;
create policy search_documents_insert
on public.search_documents for insert
to authenticated
with check (public.can_write_household(household_id));

drop policy if exists search_documents_update on public.search_documents;
create policy search_documents_update
on public.search_documents for update
to authenticated
using (public.can_write_household(household_id))
with check (public.can_write_household(household_id));

drop policy if exists search_documents_delete on public.search_documents;
create policy search_documents_delete
on public.search_documents for delete
to authenticated
using (public.can_write_household(household_id));

drop policy if exists room_layouts_select on public.room_layouts;
create policy room_layouts_select
on public.room_layouts for select
to authenticated
using (public.is_household_member(household_id));

drop policy if exists room_layouts_insert on public.room_layouts;
create policy room_layouts_insert
on public.room_layouts for insert
to authenticated
with check (public.can_write_household(household_id));

drop policy if exists room_layouts_update on public.room_layouts;
create policy room_layouts_update
on public.room_layouts for update
to authenticated
using (public.can_write_household(household_id))
with check (public.can_write_household(household_id));

drop policy if exists room_layouts_delete on public.room_layouts;
create policy room_layouts_delete
on public.room_layouts for delete
to authenticated
using (public.can_write_household(household_id));

drop policy if exists placements_select on public.placements;
create policy placements_select
on public.placements for select
to authenticated
using (public.is_household_member(household_id));

drop policy if exists placements_insert on public.placements;
create policy placements_insert
on public.placements for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.can_write_household(household_id)
);

drop policy if exists placements_update on public.placements;
create policy placements_update
on public.placements for update
to authenticated
using (public.can_write_household(household_id))
with check (public.can_write_household(household_id));

drop policy if exists placements_delete on public.placements;
create policy placements_delete
on public.placements for delete
to authenticated
using (public.can_write_household(household_id));

drop policy if exists photo_suggestions_select on public.photo_suggestions;
create policy photo_suggestions_select
on public.photo_suggestions for select
to authenticated
using (public.is_household_member(household_id));

drop policy if exists photo_suggestions_insert on public.photo_suggestions;
create policy photo_suggestions_insert
on public.photo_suggestions for insert
to authenticated
with check (public.can_write_household(household_id));

drop policy if exists photo_suggestions_update on public.photo_suggestions;
create policy photo_suggestions_update
on public.photo_suggestions for update
to authenticated
using (public.can_write_household(household_id))
with check (public.can_write_household(household_id));

drop policy if exists photo_suggestions_delete on public.photo_suggestions;
create policy photo_suggestions_delete
on public.photo_suggestions for delete
to authenticated
using (public.can_write_household(household_id));
