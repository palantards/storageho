begin;

alter table public.households
  add column if not exists language text not null default 'en';

-- keep a simple constraint to avoid empty strings
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.households'::regclass
      and conname = 'households_language_chk'
  ) then
    alter table public.households
      add constraint households_language_chk
      check (length(language) between 2 and 10);
  end if;
end
$$;

commit;
