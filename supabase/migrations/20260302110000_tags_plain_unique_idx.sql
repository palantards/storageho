begin;

-- Align tags ON CONFLICT target with application code (household_id, name).
-- Keep the existing lower(name) index for fuzzy search; add a plain unique index.
create unique index if not exists tags_household_name_plain_unique_idx
  on public.tags (household_id, name);

commit;
