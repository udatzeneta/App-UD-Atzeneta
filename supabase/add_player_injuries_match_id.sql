-- Adds match_id column to player_injuries table to allow cascading deletes when a match report is deleted
ALTER TABLE IF EXISTS public.player_injuries
ADD COLUMN IF NOT EXISTS match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE;
