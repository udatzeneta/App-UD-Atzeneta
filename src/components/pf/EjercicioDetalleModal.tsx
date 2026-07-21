import React from 'react';
import { Modal } from '../Modal';
import { Target, Calendar, BarChart3, Tag } from 'lucide-react';
import { GRUPO_LABEL } from '../../lib/fuerzaConstants';

function formatDate(iso: string) {
  if (!iso) return '-';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

interface EjercicioDetalleModalProps {
  isOpen: boolean;
  onClose: () => void;
  ejercicio: any;
  sesiones: any[]; // Todas las sesiones
  sesionEjercicios: any[]; // Todas las vinculaciones
}

export const EjercicioDetalleModal: React.FC<EjercicioDetalleModalProps> = ({ 
  isOpen, 
  onClose, 
  ejercicio, 
  sesiones, 
  sesionEjercicios 
}) => {
  if (!ejercicio) return null;

  // Filtrar las ocurrencias de este ejercicio
  const ocurrencias = sesionEjercicios.filter(se => se.ejercicio_id === ejercicio.id);
  
  // Cruzar con las sesiones para obtener fechas y datos
  const historial = ocurrencias.map(o => {
    const sesion = sesiones.find(s => s.id === o.sesion_id);
    return {
      ...o,
      fecha: sesion?.fecha,
      plantilla: sesion?.plantilla,
      tipo_sesion: sesion?.tipo,
    };
  }).filter(h => h.fecha).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  const vecesRealizado = historial.length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Análisis del Ejercicio" maxWidth="max-w-3xl">
      <div className="space-y-6 text-sm">
        
        {/* Cabecera */}
        <div className="flex flex-col md:flex-row gap-6 bg-brand-black border border-brand-black-border p-5 rounded-xl">
          {ejercicio.imagen_url ? (
            <img src={ejercicio.imagen_url} alt={ejercicio.nombre} className="w-32 h-32 object-contain bg-white/5 rounded-lg border border-brand-black-border" />
          ) : (
            <div className="w-32 h-32 bg-brand-black-card border border-brand-black-border rounded-lg flex items-center justify-center text-brand-gray-muted text-xs">
              Sin imagen
            </div>
          )}
          <div className="flex-1 space-y-3">
            <h2 className="text-xl font-bold text-white leading-tight">{ejercicio.nombre}</h2>
            
            {ejercicio.explicacion && (
              <p className="text-brand-gray-light italic text-xs leading-relaxed max-w-xl">
                "{ejercicio.explicacion}"
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-black-card border border-brand-black-border rounded-lg text-xs font-semibold text-white">
                <Target className="w-3.5 h-3.5 text-brand-red-500" />
                Tren {ejercicio.tren === 'full_body' ? 'Full Body' : ejercicio.tren === 'superior' ? 'Superior' : 'Inferior'}
              </span>
              
              {ejercicio.grupos && ejercicio.grupos.map((g: string) => (
                <span key={g} className="inline-flex items-center px-2.5 py-1 bg-[#15171A] border border-[#23262B] rounded-lg text-[11px] font-medium text-brand-gray-light">
                  {GRUPO_LABEL[g] || g}
                </span>
              ))}

              {ejercicio.tags && ejercicio.tags.map((t: string) => (
                <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-red-600/10 border border-brand-red-500/30 rounded-lg text-[11px] font-medium text-brand-red-400">
                  <Tag className="w-3 h-3" />
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Stats KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-brand-black-card border border-brand-black-border p-4 rounded-xl flex flex-col gap-1 items-center justify-center text-center">
            <BarChart3 className="w-5 h-5 text-brand-gray-muted mb-1" />
            <span className="text-2xl font-black text-white">{vecesRealizado}</span>
            <span className="text-[10px] text-brand-gray-muted uppercase font-bold tracking-wider">Total Ejecuciones</span>
          </div>
          <div className="bg-brand-black-card border border-brand-black-border p-4 rounded-xl flex flex-col gap-1 items-center justify-center text-center">
            <Calendar className="w-5 h-5 text-brand-gray-muted mb-1" />
            <span className="text-sm font-bold text-white mt-1">
              {historial.length > 0 ? formatDate(historial[0].fecha) : '-'}
            </span>
            <span className="text-[10px] text-brand-gray-muted uppercase font-bold tracking-wider">Última Vez</span>
          </div>
        </div>

        {/* Historial */}
        <div>
          <h3 className="text-sm font-bold text-white mb-3">Historial de Ejecuciones</h3>
          {historial.length > 0 ? (
            <div className="bg-brand-black-card border border-brand-black-border rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm text-brand-gray-light">
                <thead className="bg-brand-black/50 text-xs uppercase font-bold text-brand-gray-muted">
                  <tr>
                    <th className="px-4 py-3 border-b border-brand-black-border">Fecha</th>
                    <th className="px-4 py-3 border-b border-brand-black-border">Plantilla</th>
                    <th className="px-4 py-3 border-b border-brand-black-border">Reps/Series</th>
                    <th className="px-4 py-3 border-b border-brand-black-border">Tiempo</th>
                    <th className="px-4 py-3 border-b border-brand-black-border">Comentarios</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-black-border">
                  {historial.map(h => (
                    <tr key={h.id} className="hover:bg-brand-black-hover transition-colors">
                      <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">{formatDate(h.fecha)}</td>
                      <td className="px-4 py-3 capitalize">{h.plantilla?.replace('_', ' ')}</td>
                      <td className="px-4 py-3">{h.repeticiones || '-'}</td>
                      <td className="px-4 py-3">{h.tiempo || '-'}</td>
                      <td className="px-4 py-3 max-w-xs truncate" title={h.comentarios}>{h.comentarios || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center p-8 bg-brand-black-card border border-brand-black-border rounded-xl text-brand-gray-muted">
              No hay historial para este ejercicio aún.
            </div>
          )}
        </div>

      </div>
    </Modal>
  );
};
