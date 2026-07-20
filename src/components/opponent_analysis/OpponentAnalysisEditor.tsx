import React, { useState, useEffect } from 'react';
import { OpponentAnalysis, OpponentAnalysisBlock, OpponentRosterPlayer } from '../../types';
import { Save, X, LayoutDashboard, Users, MoveRight, MoveLeft, Target } from 'lucide-react';
import { OpponentVideoClipper } from './OpponentVideoClipper';
import { TaskBoardEditor } from '../TaskBoardEditor';
import { OpponentRosterManager } from './OpponentRosterManager';

interface Props {
  initialData?: OpponentAnalysis | null;
  onSave: (data: Partial<OpponentAnalysis>, isManual: boolean, opponentSelect: string, opponentManual: string) => void;
  onCancel: () => void;
  ffcvTeams: string[];
  scoutingTeams: string[];
}

export const OpponentAnalysisEditor: React.FC<Props> = ({
  initialData, onSave, onCancel, ffcvTeams, scoutingTeams
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'plantilla' | 'con_balon' | 'sin_balon' | 'abp'>('general');

  // General state
  const [opponentSelect, setOpponentSelect] = useState('');
  const [opponentManual, setOpponentManual] = useState('');
  const [isManualOpponent, setIsManualOpponent] = useState(false);
  const [tacticalSystem, setTacticalSystem] = useState('1-4-3-3');
  const [strengthsText, setStrengthsText] = useState('');
  const [weaknessesText, setWeaknessesText] = useState('');
  const [keyPlayersText, setKeyPlayersText] = useState('');
  const [observations, setObservations] = useState('');
  const [generalBoard, setGeneralBoard] = useState('');

  // Blocks state
  const [withBallBlocks, setWithBallBlocks] = useState<OpponentAnalysisBlock[]>([]);
  const [withoutBallBlocks, setWithoutBallBlocks] = useState<OpponentAnalysisBlock[]>([]);
  const [abpBlocks, setAbpBlocks] = useState<OpponentAnalysisBlock[]>([]);
  
  const [rosterComments, setRosterComments] = useState<OpponentRosterPlayer[]>([]);

  useEffect(() => {
    if (initialData) {
      const isKnown = ffcvTeams.includes(initialData.opponent) || scoutingTeams.includes(initialData.opponent);
      if (isKnown) {
        setOpponentSelect(initialData.opponent);
        setIsManualOpponent(false);
      } else {
        setOpponentSelect('manual');
        setOpponentManual(initialData.opponent);
        setIsManualOpponent(true);
      }
      setTacticalSystem(initialData.tactical_system || '');
      setStrengthsText((initialData.strengths || []).join(', '));
      setWeaknessesText((initialData.weaknesses || []).join(', '));
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
    return text.split(',').map(x => x.trim()).filter(x => x.length > 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      tactical_system: tacticalSystem.trim(),
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
    // Solo usamos el primer bloque para toda la fase
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-[85vh]">
      {/* Tabs Header */}
      <div className="flex overflow-x-auto border-b border-brand-black-border shrink-0 no-scrollbar mb-4">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
                isActive ? 'border-brand-red-600 text-white' : 'border-transparent text-brand-gray-muted hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden min-h-0 relative">
        {activeTab === 'general' && (
          <div className="h-full overflow-y-auto no-scrollbar pr-2 space-y-4 max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Club Rival</label>
                {!isManualOpponent ? (
                  <select
                    className="form-input bg-brand-black border-brand-black-border text-brand-gray-light cursor-pointer"
                    value={opponentSelect}
                    onChange={(e) => {
                      if (e.target.value === 'manual') {
                        setIsManualOpponent(true);
                        setOpponentSelect('manual');
                      } else {
                        setOpponentSelect(e.target.value);
                      }
                    }}
                  >
                    <option value="">— Seleccionar Equipo —</option>
                    {ffcvTeams.length > 0 && (
                      <optgroup label="Equipos de la Liga (FFCV)">
                        {ffcvTeams.map(t => <option key={t} value={t}>{t}</option>)}
                      </optgroup>
                    )}
                    {scoutingTeams.length > 0 && (
                      <optgroup label="Equipos en Cartera de Scouting">
                        {scoutingTeams.map(t => <option key={t} value={t}>{t}</option>)}
                      </optgroup>
                    )}
                    <optgroup label="Otros">
                      <option value="manual">Añadir manualmente...</option>
                    </optgroup>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="form-input flex-1"
                      placeholder="Escribe el nombre del club..."
                      value={opponentManual}
                      onChange={(e) => setOpponentManual(e.target.value)}
                      autoFocus
                    />
                    <button 
                      type="button"
                      onClick={() => { setIsManualOpponent(false); setOpponentSelect(''); }}
                      className="btn-secondary px-3 py-2 text-xs"
                    >
                      Volver
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="form-label">Sistema Táctico</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="1-4-3-3"
                  value={tacticalSystem}
                  onChange={(e) => setTacticalSystem(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="form-label">Fortalezas del Rival (Separadas por comas)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Presión alta, Transiciones rápidas, Balón parado"
                value={strengthsText}
                onChange={(e) => setStrengthsText(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label">Puntos Débiles / Falencias (Separados por comas)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Espacio a la espalda de laterales, Lentitud de centrales"
                value={weaknessesText}
                onChange={(e) => setWeaknessesText(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label">Jugadores Destacados (Separados por comas)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Javi Llor (Nº 10), David Torres (Nº 9)"
                value={keyPlayersText}
                onChange={(e) => setKeyPlayersText(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label">Alineación / Campograma General</label>
              <div className="p-2 bg-brand-black border border-brand-black-border rounded-lg">
                <TaskBoardEditor
                  value={generalBoard}
                  onChange={setGeneralBoard}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'plantilla' && (
          <OpponentRosterManager 
            players={rosterComments} 
            onChange={setRosterComments} 
            opponentName={!isManualOpponent ? opponentSelect : opponentManual}
          />
        )}

        {activeTab === 'con_balon' && renderPhaseTab('Con Balón', withBallBlocks, setWithBallBlocks)}
        
        {activeTab === 'sin_balon' && renderPhaseTab('Sin Balón', withoutBallBlocks, setWithoutBallBlocks)}
        
        {activeTab === 'abp' && renderPhaseTab('Acciones a Balón Parado', abpBlocks, setAbpBlocks)}
      </div>

      {/* Footer Actions */}
      <div className="flex gap-3 justify-end pt-4 mt-4 border-t border-brand-black-border shrink-0">
        <button type="button" onClick={onCancel} className="btn-secondary py-2 text-sm px-6">
          <X className="w-4 h-4 mr-1" /> Cancelar
        </button>
        <button type="submit" className="btn-primary py-2 text-sm px-6 font-bold shadow-glow-red">
          <Save className="w-4 h-4 mr-1" /> Guardar Informe
        </button>
      </div>
    </form>
  );
};
