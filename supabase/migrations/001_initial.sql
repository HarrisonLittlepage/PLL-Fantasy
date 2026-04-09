-- CageLeague database schema
-- Run this in the Supabase SQL Editor

-- ── PROFILES ──────────────────────────────────────────────────────────────────
-- One row per user. Created by commissioner.
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  display_name text not null,
  is_commissioner boolean default false,
  team_id integer unique, -- links to fantasy_teams.id
  created_at timestamptz default now()
);

-- ── FANTASY TEAMS ─────────────────────────────────────────────────────────────
create table public.fantasy_teams (
  id serial primary key,
  name text not null,
  owner_name text not null,
  icon text default '🏒',
  created_at timestamptz default now()
);

-- ── LEAGUE SETTINGS ───────────────────────────────────────────────────────────
create table public.league_settings (
  id integer primary key default 1, -- single row table
  current_week integer default 1 check (current_week between 1 and 12),
  bye_scoring_mode text default 'avg' check (bye_scoring_mode in ('avg', 'pick')),
  season_year integer default 2025,
  updated_at timestamptz default now()
);

-- Insert the single settings row
insert into public.league_settings (id) values (1);

-- ── PLAYERS ───────────────────────────────────────────────────────────────────
create table public.players (
  id serial primary key,
  name text not null,
  position text not null check (position in ('A','M','D','SSDM','FO','G')),
  pll_team text not null,
  avg_pts numeric(5,1) default 0,
  created_at timestamptz default now()
);

-- ── WEEKLY SCORES ─────────────────────────────────────────────────────────────
-- Commissioner enters scores here each week
create table public.player_scores (
  id serial primary key,
  player_id integer references public.players on delete cascade,
  week integer not null check (week between 1 and 12),
  game text default 'A' check (game in ('A','B')), -- B = second game for double-header
  points integer not null default 0,
  created_at timestamptz default now(),
  unique(player_id, week, game)
);

-- ── ROSTERS ───────────────────────────────────────────────────────────────────
-- Each row = one slot on a team's roster
create table public.rosters (
  id serial primary key,
  team_id integer references public.fantasy_teams on delete cascade,
  slot_index integer not null check (slot_index between 0 and 13),
  player_id integer references public.players on delete set null,
  updated_at timestamptz default now(),
  unique(team_id, slot_index)
);

-- ── GAME PICKS ────────────────────────────────────────────────────────────────
-- When bye_scoring_mode = 'pick', teams with a double-header pick game A or B
create table public.game_picks (
  id serial primary key,
  team_id integer references public.fantasy_teams on delete cascade,
  week integer not null,
  game_choice text default 'A' check (game_choice in ('A','B')),
  updated_at timestamptz default now(),
  unique(team_id, week)
);

-- ── WEEK SCHEDULE ─────────────────────────────────────────────────────────────
-- Commissioner can define the schedule. Pre-seeded below.
create table public.week_schedule (
  id serial primary key,
  week integer not null,
  week_type text default 'regular' check (week_type in ('regular','playoffs')),
  playoff_label text, -- e.g. 'Semifinals', 'Championship'
  bye_team_id integer references public.fantasy_teams,      -- team on bye
  double_team_id integer references public.fantasy_teams    -- team playing twice
);

-- ── MATCHUPS ──────────────────────────────────────────────────────────────────
create table public.matchups (
  id serial primary key,
  week integer not null,
  home_team_id integer references public.fantasy_teams,
  away_team_id integer references public.fantasy_teams,
  is_playoff boolean default false
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────
-- Everyone can read everything
alter table public.profiles enable row level security;
alter table public.fantasy_teams enable row level security;
alter table public.league_settings enable row level security;
alter table public.players enable row level security;
alter table public.player_scores enable row level security;
alter table public.rosters enable row level security;
alter table public.game_picks enable row level security;
alter table public.week_schedule enable row level security;
alter table public.matchups enable row level security;

-- Public read for everything
create policy "public read profiles" on public.profiles for select using (true);
create policy "public read teams" on public.fantasy_teams for select using (true);
create policy "public read settings" on public.league_settings for select using (true);
create policy "public read players" on public.players for select using (true);
create policy "public read scores" on public.player_scores for select using (true);
create policy "public read rosters" on public.rosters for select using (true);
create policy "public read game_picks" on public.game_picks for select using (true);
create policy "public read schedule" on public.week_schedule for select using (true);
create policy "public read matchups" on public.matchups for select using (true);

-- Only own team can update their roster
create policy "team owner updates roster" on public.rosters for all
  using (
    team_id = (select team_id from public.profiles where id = auth.uid())
  );

-- Own team can upsert game picks
create policy "team owner updates picks" on public.game_picks for all
  using (
    team_id = (select team_id from public.profiles where id = auth.uid())
  );

-- Commissioner can do everything (via service role key in API routes)
-- We handle commissioner auth in the API layer using the service role key.

-- ── HELPER FUNCTION ───────────────────────────────────────────────────────────
-- Called after a user signs up to link their profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
