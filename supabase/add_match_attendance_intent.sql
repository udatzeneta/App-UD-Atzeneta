-- Add attendance intent columns to player_match_stats
ALTER TABLE public.player_match_stats 
ADD COLUMN IF NOT EXISTS player_intent BOOLEAN,
ADD COLUMN IF NOT EXISTS player_reason TEXT;
