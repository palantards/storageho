begin;

create table if not exists public.request_rate_limits (
  scope text not null,
  identifier text not null,
  bucket_start timestamptz not null,
  count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, identifier, bucket_start)
);

create index if not exists request_rate_limits_bucket_start_idx
  on public.request_rate_limits (bucket_start);

create index if not exists request_rate_limits_scope_bucket_idx
  on public.request_rate_limits (scope, bucket_start);

commit;
