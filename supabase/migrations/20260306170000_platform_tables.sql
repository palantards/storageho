begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'webhook_status') then
    create type public.webhook_status as enum ('processed', 'ignored', 'failed');
  end if;

  if not exists (select 1 from pg_type where typname = 'support_status') then
    create type public.support_status as enum ('open', 'closed');
  end if;
end
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  supabase_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  stripe_customer_id text,
  is_admin boolean not null default false,
  is_flagged boolean not null default false,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists users_supabase_user_id_idx
  on public.users (supabase_user_id);

create unique index if not exists users_email_idx
  on public.users (email);

create unique index if not exists users_stripe_customer_id_idx
  on public.users (stripe_customer_id);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  stripe_subscription_id text not null,
  stripe_customer_id text not null,
  status text not null,
  price_id text,
  product_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subscriptions_stripe_subscription_id_idx
  on public.subscriptions (stripe_subscription_id);

create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions (stripe_customer_id);

create index if not exists subscriptions_status_idx
  on public.subscriptions (status);

create index if not exists subscriptions_current_period_end_idx
  on public.subscriptions (current_period_end);

create index if not exists subscriptions_user_id_idx
  on public.subscriptions (user_id);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null,
  type text not null,
  created timestamptz not null,
  processed_at timestamptz,
  payload_hash text,
  status public.webhook_status not null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists webhook_events_stripe_event_id_idx
  on public.webhook_events (stripe_event_id);

create index if not exists webhook_events_status_idx
  on public.webhook_events (status);

create index if not exists webhook_events_created_idx
  on public.webhook_events (created);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  email text,
  title text not null,
  content text not null,
  category text not null default 'support',
  status text not null default 'new',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  email text not null,
  subject text not null,
  message text not null,
  status public.support_status not null default 'open',
  ticket_id uuid references public.tickets(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_user_id_idx
  on public.support_requests (user_id);

create index if not exists support_status_idx
  on public.support_requests (status);

create index if not exists support_ticket_id_idx
  on public.support_requests (ticket_id);

create table if not exists public.ticket_votes (
  user_id uuid not null references public.users(id),
  ticket_id uuid not null references public.tickets(id),
  created_at timestamptz not null default now(),
  primary key (user_id, ticket_id)
);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists webhook_events_set_updated_at on public.webhook_events;
create trigger webhook_events_set_updated_at
before update on public.webhook_events
for each row execute function public.set_updated_at();

drop trigger if exists tickets_set_updated_at on public.tickets;
create trigger tickets_set_updated_at
before update on public.tickets
for each row execute function public.set_updated_at();

drop trigger if exists support_requests_set_updated_at on public.support_requests;
create trigger support_requests_set_updated_at
before update on public.support_requests
for each row execute function public.set_updated_at();

commit;
