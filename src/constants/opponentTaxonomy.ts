// =====================================================================
// Taxonomía táctica del Análisis del Rival
// Define las fases de juego y sus subcategorías. Se usa para catalogar
// clips de vídeo y para renderizar las secciones del mural.
// =====================================================================
import type { ClipCategory, OpponentPhase } from '../types';

export type { OpponentPhase };

export type AbpSide = 'ofensivo' | 'defensivo';

export interface TaxonomySub {
  key: string;
  label: string;
}

export interface TaxonomyPhase {
  label: string;
  hasSides?: boolean;
  subs: TaxonomySub[];
}

export const OPPONENT_TAXONOMY: Record<OpponentPhase, TaxonomyPhase> = {
  con_balon: {
    label: 'Con Balón',
    subs: [
      { key: 'salida_balon', label: 'Salida de balón' },
      { key: 'canalizacion', label: 'Canalización' },
      { key: 'finalizacion', label: 'Finalización' },
    ],
  },
  sin_balon: {
    label: 'Sin Balón',
    subs: [
      { key: 'presion_alta', label: 'Presión alta' },
      { key: 'repliegue_medio', label: 'Repliegue medio' },
      { key: 'repliegue_bajo', label: 'Repliegue bajo' },
    ],
  },
  abp: {
    label: 'ABP',
    hasSides: true,
    subs: [
      { key: 'corners', label: 'Córners' },
      { key: 'faltas', label: 'Faltas' },
      { key: 'saques_banda', label: 'Saques de banda' },
    ],
  },
};

export const ABP_SIDES: { key: AbpSide; label: string }[] = [
  { key: 'ofensivo', label: 'Ofensivo' },
  { key: 'defensivo', label: 'Defensivo' },
];

export const PHASE_ORDER: OpponentPhase[] = ['con_balon', 'sin_balon', 'abp'];

/** Clave estable de una categoría (para diccionarios y filtrado de clips). */
export function catKey(phase: OpponentPhase, sub: string, side?: AbpSide): string {
  return side ? `${phase}:${sub}:${side}` : `${phase}:${sub}`;
}

/** Clave de una categoría de clip (o null si no está catalogado). */
export function clipCatKey(category?: ClipCategory | null): string | null {
  if (!category?.phase || !category?.sub) return null;
  return catKey(category.phase, category.sub, category.side);
}

/** Etiqueta legible de una categoría, p. ej. "Con Balón → Salida de balón". */
export function catLabel(category?: ClipCategory | null): string {
  if (!category?.phase || !category?.sub) return 'Sin catalogar';
  const phase = OPPONENT_TAXONOMY[category.phase];
  if (!phase) return 'Sin catalogar';
  const sub = phase.subs.find(s => s.key === category.sub);
  const subLabel = sub?.label || category.sub;
  const sideLabel = category.side ? ` (${category.side === 'ofensivo' ? 'Ofensivo' : 'Defensivo'})` : '';
  return `${phase.label} → ${subLabel}${sideLabel}`;
}
