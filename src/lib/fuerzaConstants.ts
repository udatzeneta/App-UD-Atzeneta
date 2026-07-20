export const GRUPOS_MUSCULARES = [
  { key: 'cuadriceps', label: 'Cuádriceps' },
  { key: 'isquiotibiales', label: 'Isquiotibiales' },
  { key: 'gluteos', label: 'Glúteos' },
  { key: 'gemelos', label: 'Gemelos' },
  { key: 'core', label: 'Core/Abdomen' },
  { key: 'pecho', label: 'Pecho' },
  { key: 'espalda', label: 'Espalda' },
  { key: 'hombro', label: 'Hombro' },
  { key: 'biceps', label: 'Bíceps' },
  { key: 'triceps', label: 'Tríceps' },
  { key: 'otro', label: 'Otro' },
];

export const GRUPO_LABEL = Object.fromEntries(GRUPOS_MUSCULARES.map(g => [g.key, g.label]));

export const TIPOS_SESION_FUERZA = [
  { key: 'tabata', label: 'Tabata' },
  { key: 'repeticiones', label: 'Por repeticiones' },
];

// Escala de 4 tonos de azul (0 = neutro, 4+ = tope)
export const HEATMAP_COLORS = ['#E5E7EB', '#BFDBFE', '#60A5FA', '#3B82F6', '#1D4ED8'];

export function colorForCount(count: number) {
  const idx = Math.max(0, Math.min(4, count || 0));
  return HEATMAP_COLORS[idx];
}

// Cuenta, por grupo muscular, cuántos ejercicios distintos (de una lista de ids) lo trabajan
export function computeGruposCounts(ejercicioIds: string[], catalogo: any[]) {
  const counts: Record<string, number> = {};
  GRUPOS_MUSCULARES.forEach(g => { counts[g.key] = 0; });
  const uniqueIds = [...new Set(ejercicioIds)];
  uniqueIds.forEach(id => {
    const ex = catalogo.find(e => e.id === id);
    if (!ex) return;
    (ex.grupos || []).forEach((g: string) => {
      if (counts[g] !== undefined) counts[g]++;
    });
  });
  return counts;
}

export function nombreEjercicioLabel(ex: any) {
  if (!ex) return '?';
  return ex.nombre;
}

export function gruposLabel(ex: any) {
  if (!ex || !ex.grupos) return '';
  return ex.grupos
    .map((g: string) => g === 'otro' && ex.otroTexto ? ex.otroTexto : GRUPO_LABEL[g])
    .filter(Boolean)
    .join(', ');
}
