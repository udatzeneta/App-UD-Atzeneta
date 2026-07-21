import React from 'react';
import type { ClipCategory, OpponentPhase } from '../../types';
import { OPPONENT_TAXONOMY, ABP_SIDES, PHASE_ORDER, catLabel } from '../../constants/opponentTaxonomy';
import { Tag } from 'lucide-react';

interface Props {
  value?: ClipCategory;
  onChange: (category?: ClipCategory) => void;
  compact?: boolean;
}

// Selector de catalogación: Fase → Subcategoría → (Lado, solo ABP).
export const ClipCategorySelector: React.FC<Props> = ({ value, onChange, compact = false }) => {
  const phase = value?.phase;
  const phaseDef = phase ? OPPONENT_TAXONOMY[phase] : null;

  const setPhase = (p: OpponentPhase | '') => {
    if (!p) return onChange(undefined);
    const def = OPPONENT_TAXONOMY[p];
    onChange({
      phase: p,
      sub: def.subs[0].key,
      side: def.hasSides ? 'ofensivo' : undefined,
    });
  };

  const setSub = (sub: string) => {
    if (!phase) return;
    onChange({ ...value!, phase, sub });
  };

  const setSide = (side: 'ofensivo' | 'defensivo') => {
    if (!phase) return;
    onChange({ ...value!, phase, sub: value!.sub, side });
  };

  const selectClass =
    'bg-black border border-brand-black-border rounded-lg px-2 py-1.5 text-xs text-brand-gray-light outline-none focus:border-brand-red-600 min-w-0';

  return (
    <div className="flex flex-col gap-1.5">
      {!compact && (
        <label className="text-[10px] font-bold text-brand-gray-muted uppercase tracking-wider flex items-center gap-1.5">
          <Tag className="w-3 h-3 text-brand-red-600" /> Catalogar en
        </label>
      )}
      <div className="flex flex-wrap gap-1.5">
        <select className={selectClass} value={phase || ''} onChange={e => setPhase(e.target.value as OpponentPhase | '')}>
          <option value="">Sin catalogar</option>
          {PHASE_ORDER.map(p => (
            <option key={p} value={p}>{OPPONENT_TAXONOMY[p].label}</option>
          ))}
        </select>

        {phaseDef && (
          <select className={selectClass} value={value?.sub || ''} onChange={e => setSub(e.target.value)}>
            {phaseDef.subs.map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        )}

        {phaseDef?.hasSides && (
          <select className={selectClass} value={value?.side || 'ofensivo'} onChange={e => setSide(e.target.value as 'ofensivo' | 'defensivo')}>
            {ABP_SIDES.map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        )}
      </div>
      {!compact && value?.phase && (
        <span className="text-[10px] text-brand-red-500 font-semibold">{catLabel(value)}</span>
      )}
    </div>
  );
};
