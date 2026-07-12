-- =====================================================================
-- MÓDULO "MEJORA INDIVIDUAL" — Campograma por jugada
-- Añade el lienzo táctico (mismo formato que el editor de sesión:
-- JSON con jugadores, flechas, zonas...) a cada acción/jugada.
-- =====================================================================

ALTER TABLE public.improvement_actions
    ADD COLUMN IF NOT EXISTS board_data TEXT;  -- JSON del TaskBoardEditor (BoardElement[] + BoardLine[])
