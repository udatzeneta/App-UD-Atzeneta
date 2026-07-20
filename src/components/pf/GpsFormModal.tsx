import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Modal } from '../Modal';
import { useToast } from '../../context/ToastContext';
import { PlayerSelect } from './PlayerSelect';

interface GpsFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  jugadores: any[];
  entrenamientos: any[];
  partidos: any[];
}

export const GpsFormModal: React.FC<GpsFormModalProps> = ({ isOpen, onClose, jugadores, entrenamientos, partidos }) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [jugadorId, setJugadorId] = useState('');
  const [sessionType, setSessionType] = useState<'entrenamiento' | 'partido'>('entrenamiento');
  const [sessionId, setSessionId] = useState('');
  
  const [metrics, setMetrics] = useState({
    distancia_total: '',
    velocidad_maxima: '',
    sprints: '',
    hsr: '',
    distancia_alta_intensidad: '',
    aceleraciones: '',
    deceleraciones: '',
    distancia_por_minuto: '',
    equilibrio_pasos: ''
  });

  const availableSessions = sessionType === 'entrenamiento' ? entrenamientos : partidos;

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('gps_records').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gps_records'] });
      showToast('success', 'Registro GPS guardado correctamente');
      onClose();
      // Reset form
      setJugadorId('');
      setSessionId('');
      setMetrics({
        distancia_total: '', velocidad_maxima: '', sprints: '', hsr: '',
        distancia_alta_intensidad: '', aceleraciones: '', deceleraciones: '',
        distancia_por_minuto: '', equilibrio_pasos: ''
      });
    },
    onError: (error: any) => {
      console.error(error);
      showToast('error', `Error al guardar: ${error.message || 'Error desconocido'}`);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jugadorId || !sessionId) return;

    mutation.mutate({
      jugador_id: jugadorId,
      session_type: sessionType,
      session_id: sessionId,
      distancia_total: metrics.distancia_total ? Number(metrics.distancia_total) : null,
      velocidad_maxima: metrics.velocidad_maxima ? Number(metrics.velocidad_maxima) : null,
      sprints: metrics.sprints ? Number(metrics.sprints) : null,
      hsr: metrics.hsr ? Number(metrics.hsr) : null,
      distancia_alta_intensidad: metrics.distancia_alta_intensidad ? Number(metrics.distancia_alta_intensidad) : null,
      aceleraciones: metrics.aceleraciones ? Number(metrics.aceleraciones) : null,
      deceleraciones: metrics.deceleraciones ? Number(metrics.deceleraciones) : null,
      distancia_por_minuto: metrics.distancia_por_minuto ? Number(metrics.distancia_por_minuto) : null,
      equilibrio_pasos: metrics.equilibrio_pasos ? Number(metrics.equilibrio_pasos) : null
    });
  };

  const handleMetricChange = (field: keyof typeof metrics, value: string) => {
    setMetrics(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Añadir Registro GPS" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-brand-gray-light mb-1">Jugador *</label>
            <PlayerSelect 
              jugadores={jugadores} 
              value={jugadorId} 
              onChange={setJugadorId} 
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-brand-gray-light mb-1">Tipo de Sesión *</label>
            <select
              required
              className="w-full bg-brand-black border border-brand-black-border text-brand-gray-light rounded-lg px-3 py-2 text-sm focus:border-brand-red-600 focus:ring-1 focus:ring-brand-red-600 outline-none"
              value={sessionType}
              onChange={(e) => {
                setSessionType(e.target.value as 'entrenamiento' | 'partido');
                setSessionId('');
              }}
            >
              <option value="entrenamiento">Entrenamiento</option>
              <option value="partido">Partido</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-brand-gray-light mb-1">Sesión ({sessionType}) *</label>
            <select
              required
              className="w-full bg-brand-black border border-brand-black-border text-brand-gray-light rounded-lg px-3 py-2 text-sm focus:border-brand-red-600 focus:ring-1 focus:ring-brand-red-600 outline-none"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            >
              <option value="">-- Seleccionar --</option>
              {availableSessions.map(s => {
                const isTraining = sessionType === 'entrenamiento';
                const dateStr = s.date || s.fecha;
                const dateParts = dateStr ? dateStr.split('T')[0].split('-') : [];
                const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : dateStr;
                return (
                  <option key={s.id} value={s.id}>
                    {isTraining ? `Entrenamiento: ${formattedDate}` : `Partido vs ${s.rival} (${formattedDate})`}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-brand-black-border mt-4">
          <h4 className="text-sm font-semibold text-brand-gray-light mb-4">Métricas</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] text-brand-gray-muted mb-1">Distancia Total (m)</label>
              <input type="number" step="0.1" className="w-full bg-brand-black border border-brand-black-border text-white text-sm rounded-lg p-2" value={metrics.distancia_total} onChange={e => handleMetricChange('distancia_total', e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] text-brand-gray-muted mb-1">Velocidad Máxima (km/h)</label>
              <input type="number" step="0.1" className="w-full bg-brand-black border border-brand-black-border text-white text-sm rounded-lg p-2" value={metrics.velocidad_maxima} onChange={e => handleMetricChange('velocidad_maxima', e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] text-brand-gray-muted mb-1">Nº Sprints</label>
              <input type="number" className="w-full bg-brand-black border border-brand-black-border text-white text-sm rounded-lg p-2" value={metrics.sprints} onChange={e => handleMetricChange('sprints', e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] text-brand-gray-muted mb-1">HSR (m)</label>
              <input type="number" step="0.1" className="w-full bg-brand-black border border-brand-black-border text-white text-sm rounded-lg p-2" value={metrics.hsr} onChange={e => handleMetricChange('hsr', e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] text-brand-gray-muted mb-1">Dist. Alta Int. (m)</label>
              <input type="number" step="0.1" className="w-full bg-brand-black border border-brand-black-border text-white text-sm rounded-lg p-2" value={metrics.distancia_alta_intensidad} onChange={e => handleMetricChange('distancia_alta_intensidad', e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] text-brand-gray-muted mb-1">Aceleraciones</label>
              <input type="number" className="w-full bg-brand-black border border-brand-black-border text-white text-sm rounded-lg p-2" value={metrics.aceleraciones} onChange={e => handleMetricChange('aceleraciones', e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] text-brand-gray-muted mb-1">Deceleraciones</label>
              <input type="number" className="w-full bg-brand-black border border-brand-black-border text-white text-sm rounded-lg p-2" value={metrics.deceleraciones} onChange={e => handleMetricChange('deceleraciones', e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] text-brand-gray-muted mb-1">Dist./min (m/min)</label>
              <input type="number" step="0.1" className="w-full bg-brand-black border border-brand-black-border text-white text-sm rounded-lg p-2" value={metrics.distancia_por_minuto} onChange={e => handleMetricChange('distancia_por_minuto', e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] text-brand-gray-muted mb-1">Equilibrio Pasos (%)</label>
              <input type="number" step="0.1" className="w-full bg-brand-black border border-brand-black-border text-white text-sm rounded-lg p-2" value={metrics.equilibrio_pasos} onChange={e => handleMetricChange('equilibrio_pasos', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="pt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-brand-gray-muted hover:text-white transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={mutation.isPending} className="px-6 py-2 bg-brand-red-600 hover:bg-brand-red-700 text-white rounded-lg text-sm font-semibold shadow-glow-red disabled:opacity-50">
            {mutation.isPending ? 'Guardando...' : 'Guardar Registro'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
