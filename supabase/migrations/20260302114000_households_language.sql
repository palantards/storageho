begin;

alter table public.households
  add column if not exists language text not null default 'en';

-- keep a simple constraint to avoid empty strings
alter table public.households
  add constraint households_language_chk check (length(language) between 2 and 10);

commit;
