-- ==========================================================================
-- BamaHub — schéma Supabase du module « Événements & Bons plans IA »
-- --------------------------------------------------------------------------
-- À exécuter une fois dans l’éditeur SQL de Supabase (ou via `supabase db push`).
--
-- Principes :
--   • Le navigateur ne parle jamais directement à Supabase : les fonctions
--     Netlify utilisent la clé `service_role` et restent seules autorisées.
--   • RLS activée partout, aucune politique publique : la clé anon ne peut
--     ni lire ni écrire. On pourra ouvrir une lecture publique plus tard si
--     le site décide d’interroger PostgREST directement.
--   • `dedupe_key` porte l’unicité métier (titre + jour + lieu).
--   • `consume_rate_limit` est atomique (upsert + verrou de ligne).
-- ==========================================================================

create extension if not exists pgcrypto;

-- ------------------------------- Événements -------------------------------

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  title text not null check (char_length(title) between 3 and 140),
  description text not null default '' check (char_length(description) <= 1200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue text not null default '',
  neighborhood text not null default 'Bamako',
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  price_fcfa integer not null default 0 check (price_fcfa >= 0),
  original_price_fcfa integer check (original_price_fcfa is null or original_price_fcfa >= 0),
  organizer text not null default '',
  source_url text not null default '',
  category text not null default 'bonplan' check (
    category in ('concert', 'festival', 'expo', 'theatre', 'sport', 'marche',
                 'conference', 'cinema', 'atelier', 'soiree', 'bonplan')
  ),
  reliability smallint not null default 50 check (reliability between 0 and 100),
  status text not null default 'ai_suggested' check (status in ('ai_suggested', 'pending', 'verified', 'rejected')),
  source_kind text not null default 'ai' check (source_kind in ('ai', 'poster', 'organizer', 'seed')),
  deal boolean not null default false,
  image_url text not null default '',
  tags text[] not null default '{}',
  contact text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_dates_valid check (ends_at > starts_at),
  constraint events_bamako_area check (
    lat is null or (lat between 12.3 and 12.9 and lng between -8.3 and -7.7)
  )
);

comment on column public.events.status is 'ai_suggested = détecté par IA à confirmer ; pending = proposition à valider ; verified = publié.';
comment on column public.events.reliability is 'Indice 0-100 : qualité et concordance des sources.';

create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists events_status_starts_idx on public.events (status, starts_at);
create index if not exists events_category_idx on public.events (category);
create index if not exists events_neighborhood_idx on public.events (neighborhood);

-- ----------------------------- Propositions --------------------------------

create table if not exists public.event_submissions (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'structured', 'approved', 'rejected')),
  source_kind text not null default 'organizer' check (source_kind in ('poster', 'organizer')),
  client_hash text not null default '',
  draft jsonb,
  ai_model text,
  event_id uuid references public.events (id) on delete set null,
  created_at timestamptz not null default now(),
  structured_at timestamptz,
  reviewed_at timestamptz,
  constraint submission_has_payload check (jsonb_typeof(payload) = 'object')
);

create index if not exists submissions_status_idx on public.event_submissions (status, created_at);

-- ----------------------------- Signalements --------------------------------

create table if not exists public.event_reports (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  reason text not null default 'other' check (reason in ('wrong-date', 'wrong-place', 'cancelled', 'fake', 'offensive', 'other')),
  note text not null default '' check (char_length(note) <= 500),
  reporter_hash text not null,
  created_at timestamptz not null default now(),
  unique (event_id, reporter_hash)
);

create index if not exists reports_event_idx on public.event_reports (event_id);

-- --------------------------- Limitation de débit ---------------------------

create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null default now()
);

create index if not exists rate_limits_reset_idx on public.rate_limits (reset_at);

/**
 * Incrémente un compteur et indique si l’action est autorisée.
 * Atomique : l’upsert verrouille la ligne le temps de la transaction.
 * Retourne (allowed, remaining, retry_after en secondes).
 */
create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_reset timestamptz;
begin
  if p_limit is null or p_limit <= 0 or p_window_seconds is null or p_window_seconds <= 0 then
    return query select true, 2147483647, 0;
    return;
  end if;

  -- Nettoyage opportuniste des compteurs expirés depuis plus d’un jour.
  delete from public.rate_limits where reset_at < v_now - interval '1 day';

  insert into public.rate_limits (key, count, reset_at)
  values (p_key, 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set count = case when public.rate_limits.reset_at <= v_now then 1 else public.rate_limits.count + 1 end,
        reset_at = case when public.rate_limits.reset_at <= v_now
                        then v_now + make_interval(secs => p_window_seconds)
                        else public.rate_limits.reset_at end
  returning public.rate_limits.count, public.rate_limits.reset_at into v_count, v_reset;

  return query
    select v_count <= p_limit,
           greatest(p_limit - v_count, 0),
           case when v_count <= p_limit then 0
                else greatest(ceil(extract(epoch from (v_reset - v_now)))::integer, 1)
           end;
end;
$$;

comment on function public.consume_rate_limit is 'Compteur atomique par clé (IP + session). Retourne allowed/remaining/retry_after.';

-- ------------------------------- updated_at --------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists events_touch_updated_at on public.events;
create trigger events_touch_updated_at
before update on public.events
for each row execute function public.touch_updated_at();

-- --------------------------------- RLS ------------------------------------

alter table public.events enable row level security;
alter table public.event_submissions enable row level security;
alter table public.event_reports enable row level security;
alter table public.rate_limits enable row level security;

-- Aucune politique = aucun accès pour anon/authenticated.
-- Les fonctions Netlify utilisent la clé service_role, qui contourne la RLS.
revoke all on public.events from anon, authenticated;
revoke all on public.event_submissions from anon, authenticated;
revoke all on public.event_reports from anon, authenticated;
revoke all on public.rate_limits from anon, authenticated;

-- Le rôle service_role garde les droits complets (déjà accordés par Supabase).
grant select, insert, update, delete on public.events to service_role;
grant select, insert, update, delete on public.event_submissions to service_role;
grant select, insert, update, delete on public.event_reports to service_role;
grant select, insert, update, delete on public.rate_limits to service_role;
revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- ------------------------- Purge (optionnelle) -----------------------------
-- La tâche Netlify `refresh-events` supprime déjà les événements terminés.
-- Si vous préférez Postgres, activez pg_cron puis décommentez :
--
-- select cron.schedule(
--   'purge-past-events',
--   '30 3 * * *',
--   $$delete from public.events where ends_at < now() - interval '6 hours'$$
-- );
