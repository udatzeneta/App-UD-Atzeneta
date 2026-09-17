-- Migration: FFCV Opponent Analysis Schema
-- Tables: ffcv_competitions, ffcv_groups, ffcv_teams, ffcv_matches, ffcv_players, ffcv_player_team_history, ffcv_match_lineups, ffcv_match_events

CREATE TABLE IF NOT EXISTS public.ffcv_competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ffcv_competition_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'MASCULÍ F11',
  season TEXT DEFAULT '22',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ffcv_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ffcv_group_id TEXT UNIQUE NOT NULL,
  competition_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ffcv_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ffcv_team_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  normalized_name TEXT,
  short_name TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ffcv_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ffcv_match_id TEXT UNIQUE NOT NULL,
  competition_id TEXT,
  group_id TEXT,
  season TEXT DEFAULT '22',
  home_team_id TEXT,
  away_team_id TEXT,
  home_team_name TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  played BOOLEAN DEFAULT FALSE,
  match_date TEXT,
  match_url TEXT,
  status TEXT DEFAULT 'PENDING', -- PENDING, SCRAPING, SCRAPED, ERROR
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ffcv_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ffcv_player_id TEXT UNIQUE NOT NULL,
  license_id TEXT,
  full_name TEXT NOT NULL,
  display_name TEXT,
  position TEXT,
  current_team_id TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ffcv_player_team_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  team_id TEXT,
  team_name TEXT,
  season TEXT DEFAULT '22',
  competition_name TEXT,
  first_seen DATE DEFAULT CURRENT_DATE,
  last_seen DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (player_id, team_name, season)
);

CREATE TABLE IF NOT EXISTS public.ffcv_match_lineups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT NOT NULL REFERENCES public.ffcv_matches(ffcv_match_id) ON DELETE CASCADE,
  team_id TEXT,
  team_name TEXT NOT NULL,
  player_id TEXT NOT NULL REFERENCES public.ffcv_players(ffcv_player_id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  starter BOOLEAN DEFAULT FALSE,
  bench BOOLEAN DEFAULT FALSE,
  shirt_number TEXT,
  position TEXT,
  played BOOLEAN DEFAULT FALSE,
  subbed_in_minute INTEGER,
  subbed_out_minute INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS public.ffcv_match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT NOT NULL REFERENCES public.ffcv_matches(ffcv_match_id) ON DELETE CASCADE,
  team_id TEXT,
  team_name TEXT,
  player_id TEXT REFERENCES public.ffcv_players(ffcv_player_id) ON DELETE SET NULL,
  player_name TEXT,
  related_player_id TEXT REFERENCES public.ffcv_players(ffcv_player_id) ON DELETE SET NULL,
  related_player_name TEXT,
  event_type TEXT NOT NULL, -- GOAL, YELLOW_CARD, RED_CARD, DOUBLE_YELLOW, SUBSTITUTION, SUBSTITUTION_IN, SUBSTITUTION_OUT, OTHER
  minute INTEGER NOT NULL,
  added_minute INTEGER DEFAULT 0,
  shirt_number TEXT,
  related_shirt_number TEXT,
  raw_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ffcv_matches_teams ON public.ffcv_matches(home_team_name, away_team_name);
CREATE INDEX IF NOT EXISTS idx_ffcv_matches_comp ON public.ffcv_matches(competition_id, season);
CREATE INDEX IF NOT EXISTS idx_ffcv_lineups_match ON public.ffcv_match_lineups(match_id);
CREATE INDEX IF NOT EXISTS idx_ffcv_lineups_player ON public.ffcv_match_lineups(player_id);
CREATE INDEX IF NOT EXISTS idx_ffcv_events_match ON public.ffcv_match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_ffcv_events_player ON public.ffcv_match_events(player_id);

-- Enable RLS
ALTER TABLE public.ffcv_competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ffcv_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ffcv_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ffcv_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ffcv_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ffcv_player_team_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ffcv_match_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ffcv_match_events ENABLE ROW LEVEL SECURITY;

-- Allow read and write for authenticated, anon, and service_role
CREATE POLICY "Allow public read ffcv_competitions" ON public.ffcv_competitions FOR SELECT USING (true);
CREATE POLICY "Allow service all ffcv_competitions" ON public.ffcv_competitions FOR ALL USING (true);

CREATE POLICY "Allow public read ffcv_groups" ON public.ffcv_groups FOR SELECT USING (true);
CREATE POLICY "Allow service all ffcv_groups" ON public.ffcv_groups FOR ALL USING (true);

CREATE POLICY "Allow public read ffcv_teams" ON public.ffcv_teams FOR SELECT USING (true);
CREATE POLICY "Allow service all ffcv_teams" ON public.ffcv_teams FOR ALL USING (true);

CREATE POLICY "Allow public read ffcv_matches" ON public.ffcv_matches FOR SELECT USING (true);
CREATE POLICY "Allow service all ffcv_matches" ON public.ffcv_matches FOR ALL USING (true);

CREATE POLICY "Allow public read ffcv_players" ON public.ffcv_players FOR SELECT USING (true);
CREATE POLICY "Allow service all ffcv_players" ON public.ffcv_players FOR ALL USING (true);

CREATE POLICY "Allow public read ffcv_player_team_history" ON public.ffcv_player_team_history FOR SELECT USING (true);
CREATE POLICY "Allow service all ffcv_player_team_history" ON public.ffcv_player_team_history FOR ALL USING (true);

CREATE POLICY "Allow public read ffcv_match_lineups" ON public.ffcv_match_lineups FOR SELECT USING (true);
CREATE POLICY "Allow service all ffcv_match_lineups" ON public.ffcv_match_lineups FOR ALL USING (true);

CREATE POLICY "Allow public read ffcv_match_events" ON public.ffcv_match_events FOR SELECT USING (true);
CREATE POLICY "Allow service all ffcv_match_events" ON public.ffcv_match_events FOR ALL USING (true);

-- Permitir lectura de scouting para análisis de rivales (toda la plantilla)
DROP POLICY IF EXISTS "Ver scouting" ON public.scouting;
CREATE POLICY "Ver scouting" ON public.scouting FOR SELECT USING (true);

