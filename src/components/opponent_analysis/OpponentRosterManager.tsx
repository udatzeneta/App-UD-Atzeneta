import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { OpponentRosterPlayer } from '../../types';
import { dataService } from '../../services/data';
import { Plus, Trash2, DownloadCloud, User, Star } from 'lucide-react';
import { isSameTeam } from '../../utils/teamUtils';

interface Props {
  players: OpponentRosterPlayer[];
  onChange: (p: OpponentRosterPlayer[]) => void;
  opponentName?: string;
}

export const OpponentRosterManager: React.FC<Props> = ({ players, onChange, opponentName }) => {
  const { data: scoutingPlayers = [] } = useQuery({
    queryKey: ['scouting'],
    queryFn: () => dataService.getScouting()
  });

  type ScoutingRow = typeof scoutingPlayers[0];

  const hasRealStats = (sp?: ScoutingRow) =>
    !!sp && [sp.jugados, sp.convocados, sp.titular, sp.goles, sp.amarillas]
      .some(v => (Number(v) || 0) > 0);

  // Temporada más reciente disponible para el equipo (la plantilla "actual" es la de esa temporada)
  const currentSeasonFor = (team: string) => {
    const seasons = scoutingPlayers
      .filter(p => isSameTeam(p.team, team))
      .map(p => p.season)
      .filter((s): s is string => Boolean(s));
    if (seasons.length === 0) return null;
    return seasons.sort().at(-1)!;
  };

  // Construye la plantilla "actual": jugadores de la temporada más reciente, reforzando
  // con las estadísticas de la temporada anterior cuando la actual aún no tiene partidos jugados.
  const buildCurrentRoster = (team: string): ScoutingRow[] => {
    const matchingSp = scoutingPlayers.filter(p => isSameTeam(p.team, team));
    if (matchingSp.length === 0) return [];

    const currentSeason = currentSeasonFor(team);
    const currentSp = currentSeason ? matchingSp.filter(p => p.season === currentSeason) : matchingSp;
    const byName = new Map<string, ScoutingRow>();

    for (const sp of currentSp) {
      const key = sp.player_name.toLowerCase().trim();
      if (byName.has(key)) continue;

      if (hasRealStats(sp)) {
        byName.set(key, sp);
        continue;
      }

      // Temporada actual aún sin partidos: usar estadísticas de la temporada anterior como referencia
      const previous = matchingSp
        .filter(p => p.player_name.toLowerCase().trim() === key && p.season !== currentSeason)
        .sort((a, b) => (b.season || '').localeCompare(a.season || ''))
        .find(hasRealStats);

      byName.set(key, previous
        ? {
            ...sp,
            ...previous,
            dorsal: sp.dorsal ?? previous.dorsal,
            position: sp.position || previous.position,
            photo_url: sp.photo_url || previous.photo_url,
            season: sp.season,
            notes: `Estadísticas de referencia: temporada ${previous.season}`
          }
        : sp);
    }

    return Array.from(byName.values());
  };

  const toRosterPlayer = (sp: ScoutingRow): OpponentRosterPlayer => ({
    id: `player-${Date.now()}-${Math.random()}`,
    name: sp.player_name,
    number: sp.dorsal || undefined,
    position: sp.position || 'DF',
    comments: sp.notes || '',
    photo_url: sp.photo_url,
    matches_played: sp.jugados ?? sp.convocados ?? sp.matches_played ?? 0,
    starter_count: sp.titular ?? sp.starter_count ?? (sp.jugados ?? sp.convocados ?? sp.matches_played ?? 0),
    minutes_played: sp.minutes_played ?? 0,
    goals: sp.goles ?? sp.goals ?? 0,
    assists: sp.assists ?? 0,
    yellow_cards: sp.amarillas ?? sp.yellow_cards ?? 0,
    red_cards: sp.rojas ?? sp.red_cards ?? 0,
    rating: sp.rating
  });

  // Refresca un jugador ya presente con los datos de scouting más recientes,
  // conservando lo que el cuerpo técnico haya editado a mano (comentarios, destacado, valoración manual).
  const mergeWithFreshData = (existing: OpponentRosterPlayer, sp: ScoutingRow): OpponentRosterPlayer => {
    const fresh = toRosterPlayer(sp);
    return {
      ...fresh,
      id: existing.id,
      comments: existing.comments?.trim() ? existing.comments : fresh.comments,
      is_featured: existing.is_featured,
      rating: existing.rating ?? fresh.rating
    };
  };

  const importSingleScoutingPlayer = (spId: string) => {
    if (!spId) return;
    const sp = scoutingPlayers.find(p => p.id === spId);
    if (!sp) return;

    const existing = players.find(p => p.name.toLowerCase() === sp.player_name.toLowerCase());
    if (existing) {
      onChange(players.map(p => p.id === existing.id ? mergeWithFreshData(p, sp) : p));
    } else {
      onChange([...players, toRosterPlayer(sp)]);
    }
  };

  const importAllOpponentScoutingPlayers = () => {
    if (!opponentName) return;
    const roster = buildCurrentRoster(opponentName);
    if (roster.length === 0) return;

    const byName = new Map(players.map(p => [p.name.toLowerCase(), p]));
    const updated = players.map(p => {
      const sp = roster.find(r => r.player_name.toLowerCase() === p.name.toLowerCase());
      return sp ? mergeWithFreshData(p, sp) : p;
    });
    const newItems = roster
      .filter(sp => !byName.has(sp.player_name.toLowerCase()))
      .map(toRosterPlayer);

    onChange([...updated, ...newItems]);
  };

  const addPlayer = () => {
    const newPlayer: OpponentRosterPlayer = {
      id: `player-${Date.now()}`,
      name: '',
      number: undefined,
      position: 'DF',
      comments: ''
    };
    onChange([...players, newPlayer]);
  };

  const removePlayer = (id: string) => {
    onChange(players.filter(p => p.id !== id));
  };

  const updatePlayer = (id: string, updates: Partial<OpponentRosterPlayer>) => {
    onChange(players.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const teamHasScoutingData = opponentName && scoutingPlayers.some(p => isSameTeam(p.team, opponentName));

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-white">Plantilla Rival</h3>
          <p className="text-xs text-brand-gray-muted">Añade los jugadores destacados y sus comentarios tácticos.</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {teamHasScoutingData && (
            <>
              <button
                type="button"
                onClick={importAllOpponentScoutingPlayers}
                className="btn-secondary py-2 px-3 text-xs bg-brand-red-600/10 text-brand-red-400 border-brand-red-600/30 hover:bg-brand-red-600/20 font-bold flex items-center gap-1.5"
                title="Cargar toda la plantilla del rival desde la base de datos de scouting"
              >
                <DownloadCloud className="w-3.5 h-3.5 text-brand-red-500" />
                Cargar Toda la Plantilla
              </button>
              <select
                className="btn-secondary py-2 px-2 text-xs bg-brand-red-600/10 text-brand-red-500 border-brand-red-600/30 outline-none w-48 truncate cursor-pointer"
                onChange={(e) => {
                  importSingleScoutingPlayer(e.target.value);
                  e.target.value = '';
                }}
                defaultValue=""
              >
                <option value="" disabled>+ Jugador de Scouting...</option>
                {buildCurrentRoster(opponentName || '')
                  .filter(p => !players.some(rp => rp.name.toLowerCase() === p.player_name.toLowerCase()))
                  .sort((a, b) => a.player_name.localeCompare(b.player_name))
                  .map(sp => (
                    <option key={sp.id} value={sp.id}>
                      {sp.player_name} {sp.dorsal ? `(#${sp.dorsal})` : ''} ({sp.season})
                    </option>
                  ))}
              </select>
            </>
          )}
          <button
            type="button"
            onClick={addPlayer}
            className="btn-primary py-2 px-4 text-xs"
          >
            <Plus className="w-4 h-4 mr-1" />
            Añadir Manual
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-3 no-scrollbar pb-10">
        {players.length === 0 ? (
          <div className="text-center py-10 text-brand-gray-muted text-sm border border-dashed border-brand-black-border rounded-lg">
            No has registrado ningún jugador del rival.
          </div>
        ) : (
          players.map(player => (
            <div key={player.id} className="bg-brand-black border border-brand-black-border p-4 rounded-lg flex flex-col md:flex-row gap-4">
              
              {/* Photo Area */}
              <div className="shrink-0 w-16 h-16 rounded-lg bg-brand-black-card border border-brand-black-border flex items-center justify-center overflow-hidden">
                {player.photo_url ? (
                  <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-brand-gray-dark" />
                )}
              </div>

              <div className="flex flex-col gap-3 w-full md:w-1/3 shrink-0">
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={player.number || ''}
                    onChange={(e) => updatePlayer(player.id, { number: parseInt(e.target.value) || undefined })}
                    className="w-16 bg-brand-black-card border border-brand-black-border rounded-lg text-center text-sm text-brand-gray-light focus:border-brand-red-600 outline-none"
                    placeholder="Dorsal"
                  />
                  <input
                    type="text"
                    value={player.name}
                    onChange={(e) => updatePlayer(player.id, { name: e.target.value })}
                    className="flex-1 bg-brand-black-card border border-brand-black-border rounded-lg px-3 py-2 text-sm text-brand-gray-light focus:border-brand-red-600 outline-none"
                    placeholder="Nombre del jugador"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={player.position || ''}
                    onChange={(e) => updatePlayer(player.id, { position: e.target.value })}
                    className="flex-1 bg-brand-black-card border border-brand-black-border rounded-lg px-3 py-1.5 text-xs text-brand-gray-light focus:border-brand-red-600 outline-none"
                  >
                    <option value="">Posición...</option>
                    <option value="POR">Portero (POR)</option>
                    <option value="DF">Defensa (DF)</option>
                    <option value="MC">Centrocampista (MC)</option>
                    <option value="DL">Delantero (DL)</option>
                    <option value="Extremo">Extremo</option>
                    <option value="Lateral">Lateral</option>
                    <option value="Pivote">Pivote</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => updatePlayer(player.id, { is_featured: !player.is_featured })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 font-bold shrink-0 transition-colors ${player.is_featured ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' : 'bg-brand-black-card text-brand-gray-muted border border-brand-black-border hover:text-white'}`}
                    title="Marcar o desmarcar como Jugador Destacado"
                  >
                    <Star className={`w-3.5 h-3.5 ${player.is_featured ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                    {player.is_featured ? 'Destacado' : 'Destacar'}
                  </button>
                </div>

                {/* Fila de Estadísticas del Jugador Rival */}
                <div className="grid grid-cols-5 gap-1.5 bg-black/60 p-1.5 rounded-lg border border-brand-black-border text-[10px]">
                  <div>
                    <span className="text-[8px] text-brand-gray-muted block">PJ</span>
                    <input
                      type="number"
                      value={player.matches_played ?? ''}
                      onChange={(e) => updatePlayer(player.id, { matches_played: parseInt(e.target.value) || undefined })}
                      className="w-full bg-brand-black text-center font-bold text-white rounded border border-brand-black-border px-1 py-0.5"
                      placeholder="PJ"
                    />
                  </div>
                  <div>
                    <span className="text-[8px] text-brand-gray-muted block">Titular</span>
                    <input
                      type="number"
                      value={player.starter_count ?? ''}
                      onChange={(e) => updatePlayer(player.id, { starter_count: parseInt(e.target.value) || undefined })}
                      className="w-full bg-brand-black text-center font-bold text-emerald-400 rounded border border-brand-black-border px-1 py-0.5"
                      placeholder="Tit"
                    />
                  </div>
                  <div>
                    <span className="text-[8px] text-brand-gray-muted block">Min.</span>
                    <input
                      type="number"
                      value={player.minutes_played ?? ''}
                      onChange={(e) => updatePlayer(player.id, { minutes_played: parseInt(e.target.value) || undefined })}
                      className="w-full bg-brand-black text-center font-mono font-bold text-brand-gray-light rounded border border-brand-black-border px-1 py-0.5"
                      placeholder="Min"
                    />
                  </div>
                  <div>
                    <span className="text-[8px] text-brand-gray-muted block">Goles</span>
                    <input
                      type="number"
                      value={player.goals ?? ''}
                      onChange={(e) => updatePlayer(player.id, { goals: parseInt(e.target.value) || undefined })}
                      className="w-full bg-brand-black text-center font-bold text-emerald-400 rounded border border-brand-black-border px-1 py-0.5"
                      placeholder="Gol"
                    />
                  </div>
                  <div>
                    <span className="text-[8px] text-brand-gray-muted block">🟨 Amar</span>
                    <input
                      type="number"
                      value={player.yellow_cards ?? ''}
                      onChange={(e) => updatePlayer(player.id, { yellow_cards: parseInt(e.target.value) || undefined })}
                      className="w-full bg-brand-black text-center font-bold text-yellow-400 rounded border border-brand-black-border px-1 py-0.5"
                      placeholder="🟨"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-2 relative">
                <textarea
                  value={player.comments}
                  onChange={(e) => updatePlayer(player.id, { comments: e.target.value })}
                  className="w-full h-full min-h-[80px] bg-brand-black-card border border-brand-black-border rounded-lg px-3 py-2 text-sm text-brand-gray-light focus:border-brand-red-600 outline-none resize-none"
                  placeholder="Comentarios tácticos sobre este jugador (pierna buena, debilidades, rol en el sistema...)"
                />
                <button
                  type="button"
                  onClick={() => removePlayer(player.id)}
                  className="absolute -right-2 -top-2 bg-brand-black border border-brand-black-border p-1.5 rounded-full text-brand-gray-muted hover:text-brand-red-600 hover:border-brand-red-600 transition-colors shadow-premium"
                  title="Eliminar jugador"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
