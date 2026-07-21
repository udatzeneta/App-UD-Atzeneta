-- Videoteca central + contenido por subsección para el Análisis del Rival profesional.
-- library_videos: vídeos del rival (YouTube/Vimeo/MP4/embed) con sus clips catalogados.
-- sub_sections: descripción + campograma por subcategoría táctica (keyed por catKey).
ALTER TABLE opponent_analysis ADD COLUMN IF NOT EXISTS library_videos jsonb DEFAULT '[]'::jsonb;
ALTER TABLE opponent_analysis ADD COLUMN IF NOT EXISTS sub_sections jsonb DEFAULT '{}'::jsonb;
-- Alineación / sistema de juego del rival (campograma arrastrable).
ALTER TABLE opponent_analysis ADD COLUMN IF NOT EXISTS general_formation jsonb DEFAULT '{}'::jsonb;
