-- Añadir columnas para almacenar la intención de asistencia previa del jugador
ALTER TABLE training_attendance 
ADD COLUMN player_intent boolean DEFAULT NULL,
ADD COLUMN player_reason text DEFAULT NULL;
