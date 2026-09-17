import React, { useState, useEffect } from 'react';
import { OpponentAnalysis, OpponentAnalysisBlock, OpponentRosterPlayer, Team } from '../../types';
import { Save, X, LayoutDashboard, Users, MoveRight, MoveLeft, Target, Search, Check } from 'lucide-react';
import { OpponentVideoClipper } from './OpponentVideoClipper';
import { TaskBoardEditor } from '../TaskBoardEditor';
import { OpponentRosterManager } from './OpponentRosterManager';
import { isSameTeam } from '../../utils/teamUtils';

interface Props {
  initialData?: OpponentAnalysis | null;
  onSave: (data: Partial<OpponentAnalysis>, isManual: boolean, opponentSelect: string, opponentManual: string) => void;
  onCancel: () => void;
  ffcvTeams: string[];
  scoutingTeams: string[];
  teamsByLeague?: Record<string, string[]>;
  teamsObjectsByLeague?: Record<string, Team[]>;
}

const TeamShieldBadge: React.FC<{ url?: string | null; name: string; size?: string }> = ({ url, name, size = 'w-10 h-10' }) => {
  const [error, setError] = useState(false);

  if (!url || error) {
    return (
      <div className={`${size} rounded-full bg-brand-black-border flex items-center justify-center text-brand-red-500 font-extrabold text-xs shrink-0 border border-white/10 shadow-inner uppercase`}>
        {name.slice(0, 2)}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      onError={() => setError(true)}
      className={`${size} object-contain shrink-0 filter drop-shadow-md`}
    />
  );
};

export const OpponentAnalysisEditor: React.FC<Props> = ({
  initialData, onSave, onCancel, ffcvTeams, scoutingTeams, teamsByLeague, teamsObjectsByLeague
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'plantilla' | 'con_balon' | 'sin_balon' | 'abp'>('general');

  // General state
  const [selectedLeague, setSelectedLeague] = useState<string>('Primera FFCV');
  const [opponentSelect, setOpponentSelect] = useState('');
  const [opponentManual, setOpponentManual] = useState('');
  const [isManualOpponent, setIsManualOpponent] = useState(false);
  const [tacticalSystem, setTacticalSystem] = useState('1-4-3-3');
  const [strengthsText, setStrengthsText] = useState('');
  const [weaknessesText, setWeaknessesText] = useState('');
  const [keyPlayersText, setKeyPlayersText] = useState('');
  const [observations, setObservations] = useState('');
  const [generalBoard, setGeneralBoard] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Blocks state
  const [withBallBlocks, setWithBallBlocks] = useState<OpponentAnalysisBlock[]>([]);
  const [withoutBallBlocks, setWithoutBallBlocks] = useState<OpponentAnalysisBlock[]>([]);
  const [abpBlocks, setAbpBlocks] = useState<OpponentAnalysisBlock[]>([]);
  
  const [rosterComments, setRosterComments] = useState<OpponentRosterPlayer[]>([]);

  // Calculate teams list filtered by selected league
  const leagueTeams = React.useMemo(() => {
    if (teamsByLeague) {
      if (selectedLeague === 'Todas') {
        return Array.from(new Set(Object.values(teamsByLeague).flat())).sort();
      }
      const list = teamsByLeague[selectedLeague];
      if (list && list.length > 0) return list;
    }
    return ffcvTeams;
  }, [teamsByLeague, selectedLeague, ffcvTeams]);

  // Lista de objetos de equipos visibles para el grid con escudo
  const visibleTeamObjects = React.useMemo(() => {
    let teams: { name: string; shield_url?: string | null; competition?: string }[] = [];

    if (teamsObjectsByLeague) {
      if (selectedLeague === 'Todas') {
        teams = Object.values(teamsObjectsByLeague).flat();
      } else if (teamsObjectsByLeague[selectedLeague]) {
        teams = teamsObjectsByLeague[selectedLeague];
      }
    }

    if (teams.length === 0) {
      teams = leagueTeams.map(name => ({ name, competition: selectedLeague }));
    }

    // Deduplicar por nombre
    const map = new Map<string, { name: string; shield_url?: string | null; competition?: string }>();
    teams.forEach(t => {
      if (!map.has(t.name)) map.set(t.name, t);
    });

    let list = Array.from(map.values());

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      list = list.filter(t => t.name.toLowerCase().includes(q));
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [teamsObjectsByLeague, selectedLeague, leagueTeams, searchFilter]);

  useEffect(() => {
    if (initialData) {
      const matchFFCV = ffcvTeams.find(t => isSameTeam(t, initialData.opponent));
      const matchScouting = scoutingTeams.find(t => isSameTeam(t, initialData.opponent));
      const matchedName = matchFFCV || matchScouting;
      if (matchedName) {
        setOpponentSelect(matchedName);
        setIsManualOpponent(false);
      } else {
        setOpponentSelect('manual');
        setOpponentManual(initialData.opponent);
        setIsManualOpponent(true);
      }
      setTacticalSystem(initialData.tactical_system || '');
      setStrengthsText((initialData.strengths || []).join('\n'));
      setWeaknessesText((initialData.weaknesses || []).join('\n'));
      setKeyPlayersText((initialData.key_players || []).join(', '));
      setObservations(initialData.observations || '');
      setGeneralBoard(initialData.general_board || '');
      
      setWithBallBlocks(initialData.with_ball_blocks || []);
      setWithoutBallBlocks(initialData.without_ball_blocks || []);
      setAbpBlocks(initialData.abp_blocks || []);
      
      setRosterComments(initialData.roster_comments || []);
    }
  }, [initialData, ffcvTeams, scoutingTeams]);

  const parseTags = (text: string) => {
    if (text.includes('\n')) {
      return text.split('\n').map(x => x.replace(/^[•\-\d.\s]+/, '').trim()).filter(x => x.length > 0);
    }
    return text.split(',').map(x => x.trim()).filter(x => x.length > 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      tactical_system: tacticalSystem.trim() || '1-4-3-3',
      strengths: parseTags(strengthsText),
      weaknesses: parseTags(weaknessesText),
      key_players: parseTags(keyPlayersText),
      observations: observations.trim(),
      general_board: generalBoard,
      with_ball_blocks: withBallBlocks,
      without_ball_blocks: withoutBallBlocks,
      abp_blocks: abpBlocks,
      roster_comments: rosterComments
    }, isManualOpponent, opponentSelect, opponentManual);
  };

  const tabs = [
    { id: 'general', label: 'General', icon: LayoutDashboard },
    { id: 'plantilla', label: 'Plantilla', icon: Users },
    { id: 'con_balon', label: 'Con Balón', icon: MoveRight },
    { id: 'sin_balon', label: 'Sin Balón', icon: MoveLeft },
    { id: 'abp', label: 'ABP', icon: Target }
  ] as const;

  const renderPhaseTab = (
    title: string,
    blocks: OpponentAnalysisBlock[],
    setBlocks: (b: OpponentAnalysisBlock[]) => void
  ) => {
    const block = blocks[0] || {
      id: `phase-${Date.now()}`,
      title: title,
      description: '',
      board: '',
      videos: []
    };

    const updateBlock = (updates: Partial<OpponentAnalysisBlock>) => {
      setBlocks([{ ...block, ...updates }]);
    };

    return (
      <div className="flex flex-col h-full overflow-y-auto pr-2 no-scrollbar pb-10">
        <h3 className="text-sm font-bold text-white mb-4">{title}</h3>
        
        <div className="space-y-6 max-w-4xl">
          <div>
            <label className="form-label">Comentario general de esta parte del juego</label>
            <textarea
              className="form-input h-24 resize-none"
              placeholder="Añade un breve resumen general..."
              value={block.description}
              onChange={(e) => updateBlock({ description: e.target.value })}
            />
          </div>

          <div>
            <label className="form-label">Campograma General de la fase (Opcional)</label>
            <div className="p-2 bg-brand-black border border-brand-black-border rounded-lg">
              <TaskBoardEditor
                value={block.board}
                onChange={(board) => updateBlock({ board })}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Clips de Vídeo</label>
            <div className="p-4 bg-brand-black-card border border-brand-black-border rounded-xl">
              <OpponentVideoClipper
                videos={block.videos}
                onChange={(videos) => updateBlock({ videos })}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Formulario visual con tarjetas para MODO CREACIÓN (nuevo rival 2026/2027)
  if (!initialData) {
    return (
      <form onSubmit={handleSubmit} className="p-2 space-y-5">
        <div>
          <h3 className="text-base font-bold text-white mb-1">Registrar Nuevo Análisis del Rival</h3>
          <p className="text-xs text-brand-gray-muted">
            Selecciona la liga y haz clic en la tarjeta del club rival para crear su ficha táctica.
          </p>
        </div>

        {/* 1. Selector de Liga / Competición */}
        <div className="space-y-2">
          <label className="form-label font-bold text-white flex items-center justify-between">
            <span>🏆 1. Seleccionar Liga (Temporada 2026/2027)</span>
            <span className="text-xs text-brand-gray-muted font-normal">{visibleTeamObjects.length} equipos</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {['Primera FFCV', 'Lliga Comunitat', 'Tercera Federación', 'Segona FFCV', 'Tercera FFCV', 'VI La Nostra Copa', 'Todas'].map((league) => {
              const isActive = selectedLeague === league;
              const count = teamsObjectsByLeague && teamsObjectsByLeague[league] ? teamsObjectsByLeague[league].length : 0;
              return (
                <button
                  key={league}
                  type="button"
                  onClick={() => {
                    setSelectedLeague(league);
                    setOpponentSelect('');
                    setIsManualOpponent(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-brand-red-600 text-white border-brand-red-500 shadow-glow-red'
                      : 'bg-brand-black-card text-brand-gray-muted border-brand-black-border hover:border-white/20 hover:text-white'
                  }`}
                >
                  {league === 'Todas' ? 'Todas las ligas' : league}
                  {count > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-brand-black-border text-brand-gray-muted'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Buscador de equipo */}
        <div className="relative">
          <Search className="w-4 h-4 text-brand-gray-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            className="form-input pl-9 text-xs py-2"
            placeholder={`Buscar club por nombre en ${selectedLeague === 'Todas' ? 'todas las ligas' : selectedLeague}...`}
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>

        {/* 2. Tarjetas de Equipos con Escudo y Nombre */}
        <div className="space-y-2">
          <label className="form-label font-bold text-white flex items-center justify-between">
            <span>🛡️ 2. Elige el Club Rival</span>
            {opponentSelect && (
              <span className="text-xs text-brand-red-500 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Seleccionado: {opponentSelect}
              </span>
            )}
          </label>

          {!isManualOpponent ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto p-1 custom-scrollbar">
              {visibleTeamObjects.map(t => {
                const isSelected = opponentSelect === t.name;
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => setOpponentSelect(t.name)}
                    className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all relative group cursor-pointer ${
                      isSelected
                        ? 'bg-brand-red-600/15 border-brand-red-600 shadow-glow-red text-white ring-1 ring-brand-red-600'
                        : 'bg-brand-black-card border-brand-black-border hover:border-brand-red-600/50 hover:bg-brand-black/80 text-brand-gray-light'
                    }`}
                  >
                    <TeamShieldBadge url={t.shield_url} name={t.name} />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold block truncate group-hover:text-white transition-colors" title={t.name}>
                        {t.name}
                      </span>
                      <span className="text-[10px] text-brand-gray-muted block truncate">
                        {t.competition || selectedLeague}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-brand-red-600 text-white flex items-center justify-center shrink-0 shadow-glow-red">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                );
              })}

              {visibleTeamObjects.length === 0 && (
                <div className="col-span-full py-8 text-center text-brand-gray-muted text-xs bg-brand-black-card rounded-xl border border-brand-black-border">
                  No se encontraron equipos para la búsqueda actual.
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                className="form-input flex-1 py-2.5 text-sm"
                placeholder="Escribe el nombre del club rival..."
                value={opponentManual}
                onChange={(e) => setOpponentManual(e.target.value)}
                autoFocus
                required
              />
              <button 
                type="button"
                onClick={() => { setIsManualOpponent(false); setOpponentSelect(''); }}
                className="btn-secondary px-3 py-2 text-xs"
              >
                Volver a Tarjetas
              </button>
            </div>
          )}

          {!isManualOpponent && (
            <div className="pt-1 text-right">
              <button
                type="button"
                onClick={() => {
                  setIsManualOpponent(true);
                  setOpponentSelect('manual');
                }}
                className="text-xs text-brand-red-500 hover:text-brand-red-400 font-medium underline cursor-pointer"
              >
                ¿No encuentras el club? Escribir nombre manualmente...
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-brand-black-border shrink-0">
          <button type="button" onClick={onCancel} className="btn-secondary py-2 text-sm px-5">
            <X className="w-4 h-4 mr-1" /> Cancelar
          </button>
          <button 
            type="submit" 
            disabled={!opponentSelect && (!isManualOpponent || !opponentManual.trim())}
            className="btn-primary py-2 text-sm px-6 font-bold shadow-glow-red disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4 mr-1" /> Crear Ficha del Rival
          </button>
        </div>
      </form>
    );
  }
};

