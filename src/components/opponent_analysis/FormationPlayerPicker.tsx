import React, { useMemo, useState } from 'react';
import type { FormationPlayer, ScoutingPlayer } from '../../types';
import { Modal } from '../Modal';
import { PhotoCropUpload } from '../PhotoCropUpload';
import { scoutingFitsSlot } from '../../utils/positionZones';
import { User, Check, Star, Trash2, UserPlus, Users, ChevronDown } from 'lucide-react';

interface Props {
  player: FormationPlayer;
  opponentName?: string;
  teamScouting: ScoutingPlayer[];
  onAssignScouting: (sp: ScoutingPlayer) => void;
  onManualChange: (updates: Partial<FormationPlayer>) => void;
  onRemove: () => void;
  onClose: () => void;
}

// Modal que se abre al pulsar un jugador del sistema: elige un jugador de
// scouting que pueda ocupar esa demarcación, o introdúcelo a mano (con foto).
export const FormationPlayerPicker: React.FC<Props> = ({
  player, opponentName, teamScouting, onAssignScouting, onManualChange, onRemove, onClose,
}) => {
  const demarcacion = player.role || player.label || 'Sin demarcación';

  const [showAll, setShowAll] = useState(false);
  const [manualName, setManualName] = useState(player.name || '');
  const [manualNumber, setManualNumber] = useState<string>(String(player.number || ''));
  const [manualPhoto, setManualPhoto] = useState(player.photo_url || '');

  // Jugadores recomendados para esta demarcación vs. el resto.
  const { fits, others } = useMemo(() => {
    const fits: ScoutingPlayer[] = [];
    const others: ScoutingPlayer[] = [];
    teamScouting.forEach(sp => {
      if (scoutingFitsSlot(sp.position, sp.alternative_positions, player.label)) fits.push(sp);
      else others.push(sp);
    });
    const byRating = (a: ScoutingPlayer, b: ScoutingPlayer) => (b.rating || 0) - (a.rating || 0);
    return { fits: fits.sort(byRating), others: others.sort(byRating) };
  }, [teamScouting, player.label]);

  const saveManual = () => {
    onManualChange({
      name: manualName.trim() || undefined,
      number: parseInt(manualNumber) || player.number,
      photo_url: manualPhoto || undefined,
    });
    onClose();
  };

  const renderScoutingRow = (sp: ScoutingPlayer) => (
    <button
      key={sp.id}
      type="button"
      onClick={() => { onAssignScouting(sp); onClose(); }}
      className="w-full flex items-center gap-3 bg-brand-black border border-brand-black-border rounded-lg p-2.5 hover:border-brand-red-600 hover:bg-brand-black-hover transition-colors text-left group"
    >
      <div className="shrink-0 w-11 h-11 rounded-full bg-brand-black-card border border-brand-black-border overflow-hidden flex items-center justify-center">
        {sp.photo_url ? <img src={sp.photo_url} alt={sp.player_name} className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-brand-gray-dark" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {sp.dorsal ? <span className="text-[10px] font-mono font-bold text-brand-red-500 bg-brand-red-600/10 px-1.5 py-0.5 rounded">{sp.dorsal}</span> : null}
          <span className="text-sm font-semibold text-brand-gray-light truncate group-hover:text-white">{sp.player_name}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-brand-gray-muted truncate">{sp.position || 'Sin posición'}</span>
          {sp.rating ? (
            <span className="flex items-center gap-0.5 text-[10px] text-yellow-500">
              <Star className="w-2.5 h-2.5 fill-yellow-500" /> {sp.rating}
            </span>
          ) : null}
        </div>
      </div>
      <Check className="w-4 h-4 text-brand-gray-dark group-hover:text-brand-red-500 shrink-0" />
    </button>
  );

  return (
    <Modal isOpen onClose={onClose} title={`Demarcación: ${demarcacion}`} maxWidth="max-w-lg">
      <div className="space-y-5">
        {/* Info del slot */}
        <div className="flex items-center gap-3 bg-brand-black border border-brand-black-border rounded-xl p-3">
          <div className="w-10 h-10 rounded-full bg-brand-red-600 border-2 border-white/70 flex items-center justify-center overflow-hidden shrink-0">
            {player.photo_url ? <img src={player.photo_url} alt="" className="w-full h-full object-cover" /> : <span className="text-white font-black font-mono text-sm">{player.number}</span>}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{player.name || 'Posición sin asignar'}</p>
            <p className="text-xs text-brand-gray-muted">{player.label ? `${player.label} · ` : ''}{demarcacion}</p>
          </div>
        </div>

        {/* Jugadores de scouting para esta demarcación */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-1.5 mb-2">
            <Users className="w-3.5 h-3.5 text-brand-red-600" />
            {opponentName ? `Scouting de ${opponentName}` : 'Jugadores de scouting'} para esta demarcación
          </h4>

          {teamScouting.length === 0 ? (
            <p className="text-xs text-brand-gray-dark italic bg-brand-black border border-brand-black-border rounded-lg p-3">
              No hay jugadores de este rival en la base de datos de scouting. Introdúcelo a mano abajo.
            </p>
          ) : fits.length === 0 ? (
            <p className="text-xs text-brand-gray-dark italic">Ninguno cuadra con esta demarcación. Mira “todos” o añádelo a mano.</p>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto no-scrollbar pr-1">
              {fits.map(renderScoutingRow)}
            </div>
          )}

          {/* Ver todos (los que no cuadran con la demarcación) */}
          {others.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowAll(v => !v)}
                className="text-[11px] font-semibold text-brand-gray-muted hover:text-white flex items-center gap-1"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} />
                {showAll ? 'Ocultar' : `Ver todos (${others.length} de otras demarcaciones)`}
              </button>
              {showAll && (
                <div className="space-y-2 max-h-52 overflow-y-auto no-scrollbar pr-1 mt-2">
                  {others.map(renderScoutingRow)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Manual */}
        <div className="border-t border-brand-black-border pt-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-1.5 mb-3">
            <UserPlus className="w-3.5 h-3.5 text-brand-red-600" /> ¿No está? Añádelo a mano
          </h4>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="number"
              value={manualNumber}
              onChange={e => setManualNumber(e.target.value)}
              placeholder="Nº"
              className="w-16 bg-black border border-brand-black-border rounded-lg px-2 py-2 text-sm text-brand-gray-light outline-none focus:border-brand-red-600 text-center"
            />
            <input
              type="text"
              value={manualName}
              onChange={e => setManualName(e.target.value)}
              placeholder="Nombre del jugador"
              className="flex-1 bg-black border border-brand-black-border rounded-lg px-3 py-2 text-sm text-brand-gray-light outline-none focus:border-brand-red-600"
            />
          </div>
          <PhotoCropUpload value={manualPhoto} onChange={setManualPhoto} folder="opponents" />
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-between gap-2 border-t border-brand-black-border pt-4">
          <button type="button" onClick={() => { onRemove(); onClose(); }} className="btn-secondary py-2 px-3 text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Quitar del campo
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn-secondary py-2 px-4 text-xs">Cerrar</button>
            <button type="button" onClick={saveManual} className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Guardar manual
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
