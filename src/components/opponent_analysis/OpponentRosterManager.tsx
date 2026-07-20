import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { OpponentRosterPlayer } from '../../types';
import { dataService } from '../../services/data';
import { Plus, Trash2, DownloadCloud, User } from 'lucide-react';

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

  const importFromScouting = () => {
    if (!opponentName) return;
    const teamPlayers = scoutingPlayers.filter(p => p.team?.toLowerCase() === opponentName.toLowerCase());
    
    if (teamPlayers.length === 0) return;

    // Evitar duplicados por nombre
    const existingNames = new Set(players.map(p => p.name.toLowerCase()));
    
    const newRosterPlayers: OpponentRosterPlayer[] = teamPlayers
      .filter(sp => !existingNames.has(sp.player_name.toLowerCase()))
      .map(sp => ({
        id: `player-${Date.now()}-${Math.random()}`,
        name: sp.player_name,
        number: sp.dorsal || undefined,
        position: sp.position || 'DF',
        comments: sp.notes || '',
        photo_url: sp.photo_url
      }));

    if (newRosterPlayers.length > 0) {
      onChange([...players, ...newRosterPlayers]);
    }
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

  const teamHasScoutingData = opponentName && scoutingPlayers.some(p => p.team?.toLowerCase() === opponentName.toLowerCase());

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-white">Plantilla Rival</h3>
          <p className="text-xs text-brand-gray-muted">Añade los jugadores destacados y sus comentarios tácticos.</p>
        </div>
        <div className="flex gap-2">
          {teamHasScoutingData && (
            <button
              type="button"
              onClick={importFromScouting}
              className="btn-secondary py-2 px-4 text-xs bg-brand-red-600/10 text-brand-red-500 border-brand-red-600/30 hover:bg-brand-red-600 hover:text-white transition-colors"
            >
              <DownloadCloud className="w-4 h-4 mr-1" />
              Importar de Scouting
            </button>
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
                <select
                  value={player.position || ''}
                  onChange={(e) => updatePlayer(player.id, { position: e.target.value })}
                  className="w-full bg-brand-black-card border border-brand-black-border rounded-lg px-3 py-2 text-sm text-brand-gray-light focus:border-brand-red-600 outline-none"
                >
                  <option value="">Posición...</option>
                  <option value="POR">Portero (POR)</option>
                  <option value="DF">Defensa (DF)</option>
                  <option value="MC">Centrocampista (MC)</option>
                  <option value="DL">Delantero (DL)</option>
                </select>
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
