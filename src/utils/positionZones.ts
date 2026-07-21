// =====================================================================
// Mapeo de demarcaciones a "zonas" para filtrar qué jugadores de scouting
// pueden ocupar un slot del sistema de juego.
// Zonas: POR (portero), DEF (defensa), MED (medio), ATT (ataque).
// =====================================================================
export type Zone = 'POR' | 'DEF' | 'MED' | 'ATT';

// Zona a partir del label abreviado del slot de una formación.
export function zoneFromSlotLabel(label?: string): Zone | null {
  if (!label) return null;
  const l = label.toUpperCase();
  if (l === 'GK' || l === 'POR') return 'POR';
  if (['DFC', 'LI', 'LD', 'LB', 'DF', 'CB'].includes(l)) return 'DEF';
  if (['MC', 'MCD', 'MCO', 'MI', 'MD', 'MP', 'VOL', ' MED'].includes(l)) return 'MED';
  if (['EI', 'ED', 'DC', 'SD', 'EXT'].includes(l)) return 'ATT';
  return null;
}

// Zona a partir de un texto libre de posición (scouting, en español).
export function zoneFromText(text?: string): Zone | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/portero|guardameta|arquero|\bpor\b|\bgk\b/.test(t)) return 'POR';
  if (/central|defensa|lateral|carrilero|líbero|libero|\bdfc\b|\bdf\b|\bli\b|\bld\b/.test(t)) return 'DEF';
  if (/medio|mediocentro|pivote|interior|volante|mediapunta|enganche|centrocampista|\bmc\b|\bmcd\b|\bmco\b|\bmi\b|\bmd\b/.test(t)) return 'MED';
  if (/delanter|extremo|punta|ariete|banda|segundo punta|\bdc\b|\bei\b|\bed\b/.test(t)) return 'ATT';
  return null;
}

// ¿Un jugador de scouting (posición + posiciones alternativas) puede ocupar
// el slot indicado? Compara zonas; si el slot no tiene demarcación conocida,
// se considera válido para cualquiera.
export function scoutingFitsSlot(
  position: string | undefined,
  alternativePositions: string | undefined,
  slotLabel: string | undefined,
): boolean {
  const slotZone = zoneFromSlotLabel(slotLabel);
  if (!slotZone) return true; // slot sin demarcación → cualquiera vale
  const zones = new Set<Zone>();
  const mainZone = zoneFromText(position);
  if (mainZone) zones.add(mainZone);
  // Posiciones alternativas (texto separado por comas / barras).
  (alternativePositions || '')
    .split(/[,/|]/)
    .map(s => zoneFromText(s))
    .forEach(z => z && zones.add(z));
  return zones.has(slotZone);
}
