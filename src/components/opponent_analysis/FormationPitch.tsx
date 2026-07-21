import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { OpponentFormation, FormationPlayer, ScoutingPlayer, OpponentRosterPlayer } from '../../types';
import { FORMATIONS_SLOTS } from '../../utils/formations';
import { dataService } from '../../services/data';
import { FormationPlayerPicker } from './FormationPlayerPicker';
import { RefreshCw, User, DownloadCloud, Star } from 'lucide-react';

interface Props {
  value?: OpponentFormation;
  onChange: (data: OpponentFormation) => void;
  readOnly?: boolean;
  opponentName?: string;
  rosterPlayers?: OpponentRosterPlayer[];
}

const EMPTY: OpponentFormation = { system: 'Libre', players: [] };

// Dorsales por defecto para un 11 (portero = 1, resto correlativo).
const defaultNumber = (idx: number) => idx + 1;

// Campograma interactivo estilo scouting: coloca un sistema de juego y
// arrastra las fichas de los jugadores del rival. Componente controlado.
// Los nombres/fotos se rellenan desde la base de datos de scouting (por
// equipo) o manualmente (con foto).
export const FormationPitch: React.FC<Props> = ({ value, onChange, readOnly = false, opponentName, rosterPlayers = [] }) => {
  const data = {
    system: value?.system || EMPTY.system,
    players: value?.players || EMPTY.players,
  };
  const pitchRef = useRef<HTMLDivElement>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [pickerId, setPickerId] = useState<string | null>(null);
  const hasDraggedRef = useRef(false);
  const playersRef = useRef<FormationPlayer[]>(data.players);

  useEffect(() => { playersRef.current = data.players; }, [data.players]);

  // Jugadores del rival en la base de datos de scouting.
  const { data: scoutingPlayers = [] } = useQuery({
    queryKey: ['scouting'],
    queryFn: () => dataService.getScouting(),
    enabled: !readOnly,
  });
  const teamScouting = opponentName
    ? scoutingPlayers.filter(p => p.team?.toLowerCase() === opponentName.toLowerCase())
    : [];

  const commit = (players: FormationPlayer[], system = data.system) => onChange({ system, players });

  // Aplicar una formación: reposiciona los 11 en los slots (o crea el 11 si falta).
  const applyFormation = (system: string) => {
    if (system === 'Libre') { commit(data.players, 'Libre'); return; }
    const slots = FORMATIONS_SLOTS[system];
    if (!slots) return;
    const players: FormationPlayer[] = slots.map((slot, idx) => {
      const existing = data.players[idx];
      return {
        id: existing?.id || `fp-${Date.now()}-${idx}`,
        number: existing?.number ?? defaultNumber(idx),
        name: existing?.name,
        photo_url: existing?.photo_url,
        label: slot.label,
        role: slot.role,
        x: slot.x,
        y: slot.y,
      };
    });
    commit(players, system);
  };

  // Rellenar los tokens actuales con los jugadores de scouting del rival (en orden).
  const fillFromScouting = () => {
    if (teamScouting.length === 0) return;
    let base = data.players;
    // Si no hay tokens, crea uno por cada jugador de scouting (colocados en fila).
    if (base.length === 0) {
      base = teamScouting.map((_, idx) => ({
        id: `fp-${Date.now()}-${idx}`,
        number: idx + 1,
        x: 10 + (idx % 6) * 15,
        y: 15 + Math.floor(idx / 6) * 15,
      }));
    }
    const players = base.map((p, idx) => {
      const sp = teamScouting[idx];
      if (!sp) return p;
      return { ...p, name: sp.player_name, number: sp.dorsal || p.number, photo_url: sp.photo_url || p.photo_url };
    });
    commit(players);
  };

  const clear = () => {
    if (!window.confirm('¿Retirar a todos los jugadores del campograma?')) return;
    commit([], 'Libre');
    setPickerId(null);
  };

  // --- Drag (ratón / táctil) ---
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    if (readOnly) return;
    e.preventDefault();
    hasDraggedRef.current = false;
    setActiveDragId(id);
  };
  const handleTouchStart = (id: string) => {
    if (readOnly) return;
    hasDraggedRef.current = false;
    setActiveDragId(id);
  };

  useEffect(() => {
    if (!activeDragId) return;

    const move = (clientX: number, clientY: number) => {
      if (!pitchRef.current) return;
      hasDraggedRef.current = true;
      const rect = pitchRef.current.getBoundingClientRect();
      let x = ((clientX - rect.left) / rect.width) * 100;
      let y = ((clientY - rect.top) / rect.height) * 100;
      x = Math.max(3, Math.min(97, x));
      y = Math.max(3, Math.min(97, y));
      const next = playersRef.current.map(p => (p.id === activeDragId ? { ...p, x: Math.round(x), y: Math.round(y) } : p));
      commit(next, data.system === 'Libre' ? 'Libre' : data.system);
    };
    const onMouseMove = (e: MouseEvent) => move(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => { const t = e.touches[0]; move(t.clientX, t.clientY); };
    const onUp = () => setActiveDragId(null);

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onUp);
    };
  }, [activeDragId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTokenClick = (id: string) => {
    if (hasDraggedRef.current) { hasDraggedRef.current = false; return; }
    if (readOnly) return;
    setPickerId(id);
  };

  const updatePlayer = (id: string, updates: Partial<FormationPlayer>) => {
    commit(data.players.map(p => (p.id === id ? { ...p, ...updates } : p)));
  };

  const removePlayer = (id: string) => {
    commit(data.players.filter(p => p.id !== id));
    setPickerId(null);
  };

  const addPlayer = () => {
    const num = data.players.length + 1;
    const newPlayer: FormationPlayer = { id: `fp-${Date.now()}`, number: num, x: 50, y: 50 };
    commit([...data.players, newPlayer]);
    setPickerId(newPlayer.id);
  };

  // Asignar un jugador de scouting a una ficha del sistema.
  const assignScouting = (id: string, sp: ScoutingPlayer) => {
    updatePlayer(id, {
      name: sp.player_name,
      photo_url: sp.photo_url,
      ...(sp.dorsal ? { number: sp.dorsal } : {}),
    });
  };

  const pickerPlayer = data.players.find(p => p.id === pickerId) || null;

  return (
    <div className="space-y-3">
      {/* Controles */}
      {!readOnly && (
        <div className="bg-brand-black border border-brand-black-border p-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-brand-gray-light flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-brand-red-600" /> Sistema:
            </label>
            <select
              value={data.system}
              onChange={e => applyFormation(e.target.value)}
              className="form-input bg-brand-black-bg border-brand-black-border py-1.5 text-xs w-40"
            >
              <option value="Libre">Libre (Arrastrar)</option>
              {Object.keys(FORMATIONS_SLOTS).map(sys => (
                <option key={sys} value={sys}>{sys}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {teamScouting.length > 0 && (
              <button
                type="button"
                onClick={fillFromScouting}
                className="btn-secondary py-1.5 px-3 text-xs bg-brand-red-600/10 text-brand-red-500 border-brand-red-600/30 hover:bg-brand-red-600 hover:text-white transition-colors flex items-center gap-1.5"
                title={`Rellenar con los ${teamScouting.length} jugadores de scouting de ${opponentName}`}
              >
                <DownloadCloud className="w-3.5 h-3.5" /> Rellenar de Scouting
              </button>
            )}
            <button type="button" onClick={addPlayer} className="btn-secondary py-1.5 px-3 text-xs">+ Jugador</button>
            <button type="button" onClick={clear} className="btn-secondary py-1.5 px-3 text-xs text-red-400 hover:text-red-300">Limpiar</button>
          </div>
        </div>
      )}

      {/* Campo */}
      <div
        ref={pitchRef}
        className="relative w-full max-w-md mx-auto aspect-[2/3] bg-gradient-to-b from-emerald-800 to-emerald-950 border-4 border-emerald-100/30 rounded-2xl overflow-hidden shadow-2xl select-none"
      >
        {/* Franjas del césped */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className={`h-[10%] w-full ${i % 2 === 0 ? 'bg-white' : 'bg-transparent'}`} />
          ))}
        </div>

        {/* Líneas del campo */}
        <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-emerald-100/35 -translate-y-1/2" />
        <div className="absolute top-1/2 left-1/2 w-[30%] aspect-square border-2 border-emerald-100/35 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-emerald-100/40 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/5 h-[16%] border-b-2 border-x-2 border-emerald-100/35" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[6%] border-b-2 border-x-2 border-emerald-100/35" />
        <div className="absolute top-[16%] left-1/2 -translate-x-1/2 w-[20%] h-[7%] border-b-2 border-emerald-100/35 rounded-b-full" />
        <div className="absolute top-[11%] left-1/2 w-1.5 h-1.5 bg-emerald-100/35 rounded-full -translate-x-1/2" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/5 h-[16%] border-t-2 border-x-2 border-emerald-100/35" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-[6%] border-t-2 border-x-2 border-emerald-100/35" />
        <div className="absolute bottom-[16%] left-1/2 -translate-x-1/2 w-[20%] h-[7%] border-t-2 border-emerald-100/35 rounded-t-full" />
        <div className="absolute bottom-[11%] left-1/2 w-1.5 h-1.5 bg-emerald-100/35 rounded-full -translate-x-1/2" />

        {/* Jugadores */}
        {data.players.map(player => {
          const isStar = rosterPlayers.some(rp => rp.name && player.name && rp.name.toLowerCase() === player.name.toLowerCase());
          
          return (
          <div
            key={player.id}
            style={{
              left: `${player.x}%`,
              top: `${player.y}%`,
              transform: 'translate(-50%, -50%)',
              cursor: readOnly ? 'default' : activeDragId === player.id ? 'grabbing' : 'grab',
            }}
            onMouseDown={e => handleMouseDown(e, player.id)}
            onTouchStart={() => handleTouchStart(player.id)}
            onClick={() => handleTokenClick(player.id)}
            className="absolute z-10 group flex flex-col items-center select-none"
          >
            {isStar && (
              <div className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-[2px] shadow-md border border-amber-900 z-20" title="Jugador Destacado">
                <Star className="w-3 h-3 fill-white" />
              </div>
            )}
            <div className={`relative w-10 h-10 rounded-full bg-brand-red-600 border-2 shadow-premium flex items-center justify-center overflow-visible group-hover:scale-110 transition-transform duration-150 ${pickerId === player.id ? 'border-white ring-2 ring-white/50' : 'border-white/70'}`}>
              {player.photo_url ? (
                <img src={player.photo_url} alt={player.name || ''} className="w-full h-full object-cover rounded-full pointer-events-none" />
              ) : (
                <span className="text-white font-black text-sm font-mono pointer-events-none">{player.number}</span>
              )}
              {player.photo_url && (
                <span className="absolute -bottom-1 -right-1 bg-brand-red-600 text-white font-mono text-[9px] font-black w-4 h-4 rounded-full border border-emerald-950 flex items-center justify-center">
                  {player.number}
                </span>
              )}
            </div>
            {player.name && (
              <span className="mt-1 bg-brand-black/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow border border-brand-black-border max-w-[85px] truncate text-center leading-none">
                {player.name}
              </span>
            )}
          </div>
        )})}

        {data.players.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-emerald-100/60 text-xs gap-2 pointer-events-none px-6 text-center">
            <User className="w-8 h-8 opacity-50" />
            {readOnly ? 'Sin alineación definida.' : 'Elige un sistema arriba para colocar el 11, o añade jugadores.'}
          </div>
        )}
      </div>

      {/* Modal selector de jugador por demarcación */}
      {pickerPlayer && !readOnly && (
        <FormationPlayerPicker
          player={pickerPlayer}
          opponentName={opponentName}
          teamScouting={teamScouting}
          onAssignScouting={sp => assignScouting(pickerPlayer.id, sp)}
          onManualChange={updates => updatePlayer(pickerPlayer.id, updates)}
          onRemove={() => removePlayer(pickerPlayer.id)}
          onClose={() => setPickerId(null)}
        />
      )}
    </div>
  );
};
