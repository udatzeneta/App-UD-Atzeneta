import React, { useState } from 'react';
import { Modal } from './Modal';
import { BodyMap, ZONE_LABELS } from './BodyMap';
import { Player, PlayerMatchStats } from '../types';
import { Check, ChevronLeft, ChevronRight, AlertCircle, Plus, Trash2 } from 'lucide-react';

export interface WizardEventPayload {
  type: 'goals' | 'assists' | 'yellow_cards' | 'red_card' | 'conceded_goals' | 'own_goals' | 'substitution' | 'penalty_goals' | 'conceded_penalty_goals' | 'opponent_goal' | 'opponent_yellow_card' | 'injury';
  minuteStr: string;
  playerId?: string;
  playerInId?: string;
  positionIn?: string;
  opponentDorsal?: string;
  injuryData?: {
    severity: string;
    zone: string;
    side: 'frontal' | 'posterior';
  };
}

interface MatchEventWizardProps {
  isOpen: boolean;
  onClose: () => void;
  calledUpPlayers: Player[];
  playerStats: Record<string, any>;
  onSave: (events: WizardEventPayload[]) => void;
}

const CATEGORIES = [
  { id: 'goals', label: 'Gol a Favor', icon: '⚽', color: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-800' },
  { id: 'cards', label: 'Tarjetas', icon: '🟨', color: 'text-yellow-400', bg: 'bg-yellow-950/40 border-yellow-800' },
  { id: 'substitution', label: 'Sustituciones', icon: '🔄', color: 'text-brand-gray-light', bg: 'bg-brand-black-hover border-brand-black-border' },
  { id: 'injury', label: 'Lesión', icon: '🏥', color: 'text-amber-500', bg: 'bg-amber-950/40 border-amber-800' },
  { id: 'conceded', label: 'Goles en Contra', icon: '🥅', color: 'text-cyan-400', bg: 'bg-cyan-950/40 border-cyan-800' },
  { id: 'own', label: 'Gol en Propia', icon: '💥', color: 'text-orange-400', bg: 'bg-orange-950/40 border-orange-800' },
  { id: 'opponent', label: 'Evento del Rival', icon: '👤', color: 'text-brand-red-500', bg: 'bg-brand-red-600/10 border-brand-red-600/30' },
];

export const MatchEventWizard: React.FC<MatchEventWizardProps> = ({ isOpen, onClose, calledUpPlayers, playerStats, onSave }) => {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<string>('');
  
  // Common details
  const [period, setPeriod] = useState<string>('1T');
  const [minute, setMinute] = useState<string>('1');

  // Specific state
  const [eventType, setEventType] = useState<string>(''); // For sub-types
  const [playerId, setPlayerId] = useState<string>('');
  const [assistId, setAssistId] = useState<string>('');
  const [opponentDorsal, setOpponentDorsal] = useState<string>('');
  
  // Substitutions
  const [substitutions, setSubstitutions] = useState<{playerOut: string, playerIn: string, position: string}[]>([{playerOut: '', playerIn: '', position: ''}]);

  // Injury
  const [injurySeverity, setInjurySeverity] = useState('Leve');
  const [injuryZone, setInjuryZone] = useState('No especificada');
  const [injurySide, setInjurySide] = useState<'frontal'|'posterior'>('frontal');
  const [isBodyMapOpen, setIsBodyMapOpen] = useState(false);

  const resetForm = () => {
    setStep(1);
    setCategory('');
    setEventType('');
    setPlayerId('');
    setAssistId('');
    setOpponentDorsal('');
    setSubstitutions([{playerOut: '', playerIn: '', position: ''}]);
    setInjurySeverity('Leve');
    setInjuryZone('No especificada');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleNext = () => {
    if (step === 1 && !category) return;
    if (step === 2) {
      // Basic validations before review
      if (category === 'opponent' && !eventType) return;
      if (category !== 'opponent' && category !== 'substitution' && !playerId) return;
      if (category === 'substitution') {
        const isValid = substitutions.every(s => s.playerOut && s.playerIn && s.position);
        if (!isValid) return;
      }
    }
    setStep(step + 1);
  };

  const handleSave = () => {
    const finalMinute = `${period} ${minute}`;
    const payloads: WizardEventPayload[] = [];

    if (category === 'substitution') {
      substitutions.forEach(sub => {
        payloads.push({
          type: 'substitution',
          minuteStr: finalMinute,
          playerId: sub.playerOut,
          playerInId: sub.playerIn,
          positionIn: sub.position
        });
      });
    } else if (category === 'opponent') {
      payloads.push({
        type: eventType as any,
        minuteStr: finalMinute,
        opponentDorsal: opponentDorsal || '?'
      });
    } else if (category === 'injury') {
      payloads.push({
        type: 'injury',
        minuteStr: finalMinute,
        playerId,
        injuryData: {
          severity: injurySeverity,
          zone: injuryZone,
          side: injurySide
        }
      });
    } else {
      let finalType = category;
      if (category === 'goals') {
        finalType = eventType || 'goals';
        if (assistId) {
          payloads.push({
            type: 'assists',
            minuteStr: finalMinute,
            playerId: assistId
          });
        }
      }
      if (category === 'cards') finalType = eventType || 'yellow_cards';
      if (category === 'conceded') finalType = eventType || 'conceded_goals';
      if (category === 'own') finalType = 'own_goals';

      payloads.push({
        type: finalType as any,
        minuteStr: finalMinute,
        playerId
      });
    }

    onSave(payloads);
    handleClose();
  };

  // Render Step 1: Category Selection
  const renderStep1 = () => (
    <div className="space-y-4 animate-fadeIn">
      <p className="text-xs text-brand-gray-muted text-center mb-6">¿Qué tipo de incidencia deseas registrar?</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              setCategory(cat.id);
              setStep(2);
            }}
            className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
              category === cat.id 
                ? `${cat.bg} scale-[1.02] shadow-premium ring-1 ring-brand-gray-light/20` 
                : 'bg-brand-black-card border-brand-black-border hover:bg-brand-black-hover hover:border-brand-gray-dark text-brand-gray-light opacity-70 hover:opacity-100'
            }`}
          >
            <span className="text-2xl">{cat.icon}</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider text-center ${category === cat.id ? cat.color : ''}`}>
              {cat.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  // Helper selectors
  const renderMinuteSelector = () => (
    <div className="flex items-center gap-3 bg-brand-black/40 p-4 rounded-xl border border-brand-black-border mb-6">
      <div className="flex-1">
        <label className="text-[10px] font-bold text-brand-gray-muted uppercase block mb-1">Periodo</label>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="form-input bg-brand-black-bg text-sm py-2 px-3 w-full border-brand-black-border">
          <option value="1T">1T</option>
          <option value="2T">2T</option>
          <option value="PR1">Prórroga 1</option>
          <option value="PR2">Prórroga 2</option>
        </select>
      </div>
      <div className="flex-1">
        <label className="text-[10px] font-bold text-brand-gray-muted uppercase block mb-1">Minuto</label>
        <div className="flex items-center gap-2">
          <input type="number" min="1" max="60" value={minute} onChange={(e) => setMinute(e.target.value)} className="form-input bg-brand-black-bg text-sm py-2 px-3 w-full border-brand-black-border text-center font-bold font-mono" />
          <span className="text-brand-gray-muted text-sm">'</span>
        </div>
      </div>
    </div>
  );

  const renderPlayerSelector = (label: string, value: string, onChange: (val: string) => void, filterStarter?: boolean) => {
    return (
      <div>
        <label className="text-[10px] font-bold text-brand-gray-muted uppercase block mb-1">{label}</label>
        <select value={value} onChange={(e) => onChange(e.target.value)} className="form-input bg-brand-black-bg text-sm py-2 px-3 w-full border-brand-black-border">
          <option value="">-- Seleccionar --</option>
          {calledUpPlayers
            .filter(p => filterStarter === undefined ? true : !!playerStats[p.id]?.is_starter === filterStarter)
            .map(p => (
            <option key={p.id} value={p.id}>{p.dorsal ? `(${p.dorsal}) ` : ''}{p.nickname || p.full_name}</option>
          ))}
        </select>
      </div>
    );
  };

  // Render Step 2: Details
  const renderStep2 = () => {
    return (
      <div className="space-y-6 animate-fadeIn">
        {renderMinuteSelector()}

        {category === 'substitution' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-brand-black-border pb-2">
              <h4 className="text-xs font-bold text-brand-gray-light uppercase">Cambios a realizar</h4>
              <button 
                type="button" 
                onClick={() => setSubstitutions([...substitutions, {playerOut: '', playerIn: '', position: ''}])}
                className="bg-brand-red-600 hover:bg-brand-red-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-glow-red animate-pulse"
              >
                <Plus className="w-3 h-3" /> Añadir otro cambio
              </button>
            </div>
            
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
              {substitutions.map((sub, idx) => (
                <div key={idx} className="bg-brand-black/30 p-3 rounded-xl border border-brand-black-border relative group">
                  {substitutions.length > 1 && (
                    <button 
                      onClick={() => setSubstitutions(substitutions.filter((_, i) => i !== idx))}
                      className="absolute -top-2 -right-2 bg-brand-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {renderPlayerSelector('🔴 Sale', sub.playerOut, (val) => {
                      const newSubs = [...substitutions]; newSubs[idx].playerOut = val; setSubstitutions(newSubs);
                    })}
                    {renderPlayerSelector('🟢 Entra', sub.playerIn, (val) => {
                      const newSubs = [...substitutions]; newSubs[idx].playerIn = val; setSubstitutions(newSubs);
                    }, false)}
                    <div>
                      <label className="text-[10px] font-bold text-brand-gray-muted uppercase block mb-1">📍 Posición</label>
                      <select 
                        value={sub.position} 
                        onChange={(e) => { const newSubs = [...substitutions]; newSubs[idx].position = e.target.value; setSubstitutions(newSubs); }}
                        className="form-input bg-brand-black-bg text-sm py-2 px-3 w-full border-brand-black-border"
                      >
                        <option value="">Selecciona...</option>
                        <option value="Portero">Portero</option>
                        <option value="Lateral Derecho">Lateral Derecho</option>
                        <option value="Central Derecho">Central Derecho</option>
                        <option value="Central">Central</option>
                        <option value="Central Izquierdo">Central Izquierdo</option>
                        <option value="Lateral Izquierdo">Lateral Izquierdo</option>
                        <option value="Pivote">Pivote</option>
                        <option value="Interior Derecho">Interior Derecho</option>
                        <option value="Interior">Interior</option>
                        <option value="Interior Izquierdo">Interior Izquierdo</option>
                        <option value="Extremo Derecho">Extremo Derecho</option>
                        <option value="Extremo Izquierdo">Extremo Izquierdo</option>
                        <option value="Mediapunta">Mediapunta</option>
                        <option value="Delantero Centro">Delantero Centro</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {category === 'goals' && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-brand-gray-muted uppercase block mb-1">Tipo de Gol</label>
              <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="form-input bg-brand-black-bg text-sm py-2 px-3 w-full border-brand-black-border">
                <option value="goals">Gol Normal</option>
                <option value="penalty_goals">Gol de Penalti</option>
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderPlayerSelector('Goleador', playerId, setPlayerId)}
              {renderPlayerSelector('Asistente (Opcional)', assistId, setAssistId)}
            </div>
          </div>
        )}

        {category === 'cards' && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-brand-gray-muted uppercase block mb-1">Color de Tarjeta</label>
              <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="form-input bg-brand-black-bg text-sm py-2 px-3 w-full border-brand-black-border">
                <option value="yellow_cards">🟨 Amarilla</option>
                <option value="red_card">🟥 Roja</option>
              </select>
            </div>
            {renderPlayerSelector('Sancionado', playerId, setPlayerId)}
          </div>
        )}

        {category === 'conceded' && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-brand-gray-muted uppercase block mb-1">Tipo de Gol Recibido</label>
              <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="form-input bg-brand-black-bg text-sm py-2 px-3 w-full border-brand-black-border">
                <option value="conceded_goals">Gol Normal</option>
                <option value="conceded_penalty_goals">Gol de Penalti</option>
              </select>
            </div>
            {renderPlayerSelector('Portero Afectado', playerId, setPlayerId)}
          </div>
        )}

        {category === 'own' && renderPlayerSelector('Jugador (Gol en Propia)', playerId, setPlayerId)}

        {category === 'opponent' && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-brand-gray-muted uppercase block mb-1">Tipo de Evento Rival</label>
              <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="form-input bg-brand-black-bg text-sm py-2 px-3 w-full border-brand-black-border">
                <option value="">-- Seleccionar --</option>
                <option value="opponent_goal">⚽ Gol</option>
                <option value="opponent_yellow_card">🟨 Tarjeta Amarilla</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-brand-gray-muted uppercase block mb-1">Dorsal del Rival</label>
              <input type="text" placeholder="Ej: 9" value={opponentDorsal} onChange={(e) => setOpponentDorsal(e.target.value)} className="form-input bg-brand-black-bg text-sm py-2 px-3 w-full border-brand-black-border" />
            </div>
          </div>
        )}

        {category === 'injury' && (
          <div className="space-y-4">
            {renderPlayerSelector('Jugador Lesionado', playerId, setPlayerId)}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-brand-gray-muted uppercase block mb-1">Gravedad</label>
                <select value={injurySeverity} onChange={(e) => setInjurySeverity(e.target.value)} className="form-input bg-brand-black-bg text-sm py-2 px-3 w-full border-brand-black-border">
                  <option value="Leve">Leve</option>
                  <option value="Moderada">Moderada</option>
                  <option value="Grave">Grave</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-brand-gray-muted uppercase block mb-1">Zona Afectada</label>
                <button
                  type="button"
                  onClick={() => setIsBodyMapOpen(true)}
                  className="form-input bg-brand-black-bg text-sm py-2 px-3 w-full border-brand-black-border text-left hover:border-brand-red-600/50 transition-colors flex justify-between items-center"
                >
                  <span className={injuryZone === 'No especificada' ? 'text-brand-gray-dark' : 'text-brand-gray-light'}>
                    {injuryZone !== 'No especificada' ? ZONE_LABELS[injuryZone] || injuryZone : 'Seleccionar zona...'}
                  </span>
                  {injuryZone !== 'No especificada' && (
                    <span className="text-[9px] text-brand-gray-muted uppercase ml-2">({injurySide})</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="space-y-6 animate-fadeIn text-center">
      <div className="w-16 h-16 bg-emerald-950/50 border border-emerald-800 rounded-full flex items-center justify-center mx-auto mb-4">
        <Check className="w-8 h-8 text-emerald-400" />
      </div>
      <h3 className="text-lg font-bold text-brand-gray-light">Resumen de Incidencia</h3>
      <div className="bg-brand-black/40 p-4 rounded-xl border border-brand-black-border inline-block text-left min-w-[250px]">
        <p className="text-sm text-brand-gray-light mb-2"><span className="text-brand-gray-muted">Minuto:</span> {period} {minute}'</p>
        <p className="text-sm text-brand-gray-light mb-2"><span className="text-brand-gray-muted">Categoría:</span> {CATEGORIES.find(c => c.id === category)?.label}</p>
        {category === 'substitution' && (
          <div>
            <p className="text-sm text-brand-gray-muted mb-1 mt-3 border-t border-brand-black-border pt-2">Cambios ({substitutions.length}):</p>
            {substitutions.map((s, i) => {
              const outP = calledUpPlayers.find(p => p.id === s.playerOut);
              const inP = calledUpPlayers.find(p => p.id === s.playerIn);
              return (
                <div key={i} className="text-xs text-brand-gray-light ml-2 mb-1">
                  🔴 Sale {outP?.nickname} <br/> 🟢 Entra {inP?.nickname} ({s.position})
                </div>
              );
            })}
          </div>
        )}
        {(category === 'goals' || category === 'cards' || category === 'own' || category === 'conceded' || category === 'injury') && (
          <p className="text-sm text-brand-gray-light border-t border-brand-black-border pt-2 mt-2">
            <span className="text-brand-gray-muted">Jugador:</span> {calledUpPlayers.find(p => p.id === playerId)?.nickname}
          </p>
        )}
        {category === 'goals' && assistId && (
          <p className="text-sm text-brand-gray-light mt-1">
            <span className="text-brand-gray-muted">Asistente:</span> {calledUpPlayers.find(p => p.id === assistId)?.nickname}
          </p>
        )}
        {category === 'injury' && (
          <p className="text-xs text-brand-gray-muted mt-1">({injurySeverity} - {ZONE_LABELS[injuryZone] || injuryZone})</p>
        )}
      </div>
      <p className="text-xs text-brand-gray-muted mt-4 flex items-center justify-center gap-1.5">
        <AlertCircle className="w-4 h-4" /> Verifica los datos antes de guardar.
      </p>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Asistente de Incidencias" maxWidth="max-w-2xl">
      {/* Stepper Progress */}
      <div className="flex items-center justify-center mb-8 relative px-10">
        <div className="absolute left-10 right-10 top-1/2 h-0.5 bg-brand-black-border -z-10 -translate-y-1/2"></div>
        <div className="absolute left-10 right-10 top-1/2 h-0.5 bg-brand-red-600 -z-10 -translate-y-1/2 transition-all duration-300" style={{ width: `${((step - 1) / 2) * 100}%` }}></div>
        
        <div className="flex justify-between w-full relative z-10">
          {[1, 2, 3].map(num => (
            <div key={num} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              step >= num ? 'bg-brand-red-600 text-white shadow-glow-red' : 'bg-brand-black border border-brand-black-border text-brand-gray-muted'
            }`}>
              {step > num ? <Check className="w-4 h-4" /> : num}
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-[300px]">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>

      <div className="flex items-center justify-between mt-8 pt-4 border-t border-brand-black-border">
        <button
          onClick={() => step > 1 ? setStep(step - 1) : handleClose()}
          className="btn-secondary text-sm px-4 py-2 flex items-center gap-2"
        >
          {step === 1 ? 'Cancelar' : <><ChevronLeft className="w-4 h-4" /> Atrás</>}
        </button>
        
        {step < 3 ? (
          <button
            onClick={handleNext}
            disabled={step === 1 && !category}
            className="btn-primary text-sm px-6 py-2 flex items-center gap-2 disabled:opacity-50"
          >
            Siguiente <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold px-6 py-2 transition-colors flex items-center gap-2 shadow-glow-emerald"
          >
            <Check className="w-4 h-4" /> Confirmar y Guardar
          </button>
        )}
      </div>

      {/* Sub-Modal BodyMap para Lesión */}
      {isBodyMapOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsBodyMapOpen(false)} />
          <div className="bg-brand-black-card border border-brand-black-border w-full max-w-lg rounded-xl shadow-premium overflow-hidden z-10 p-6 flex flex-col max-h-[90vh]">
            <h4 className="text-center font-bold text-brand-gray-light mb-4 text-sm uppercase">Seleccionar Zona Afectada</h4>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <BodyMap 
                injuries={[]} 
                onZoneClick={(zone, side) => {
                  setInjuryZone(zone);
                  setInjurySide(side);
                  setIsBodyMapOpen(false);
                }} 
              />
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
