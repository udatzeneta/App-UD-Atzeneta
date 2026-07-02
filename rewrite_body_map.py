import os

file_path = "/Users/imac/Programas/App UD Atzeneta/src/components/BodyMap.tsx"

new_content = """import React from 'react';
import { PlayerInjury } from '../types';

// Frontal (Centro X ≈ 25%)
const BODY_ZONES_FRONT = [
  { key: 'cabeza', label: 'Cabeza', cx: 25, cy: 8 },
  { key: 'hombro_derecho', label: 'Hombro Derecho', cx: 16, cy: 20 },
  { key: 'hombro_izquierdo', label: 'Hombro Izquierdo', cx: 34, cy: 20 },
  { key: 'pectoral', label: 'Pectoral / Pecho', cx: 25, cy: 25 },
  { key: 'biceps_derecho', label: 'Bíceps Derecho', cx: 14, cy: 30 },
  { key: 'biceps_izquierdo', label: 'Bíceps Izquierdo', cx: 36, cy: 30 },
  { key: 'abdomen', label: 'Abdomen / Core', cx: 25, cy: 38 },
  { key: 'cadera_derecha', label: 'Cadera / Ingle Der.', cx: 18, cy: 48 },
  { key: 'cadera_izquierda', label: 'Cadera / Ingle Izq.', cx: 32, cy: 48 },
  { key: 'muslo_derecho', label: 'Cuádriceps Derecho', cx: 19, cy: 60 },
  { key: 'muslo_izquierdo', label: 'Cuádriceps Izquierdo', cx: 31, cy: 60 },
  { key: 'rodilla_derecha', label: 'Rodilla Derecha', cx: 20, cy: 72 },
  { key: 'rodilla_izquierda', label: 'Rodilla Izquierda', cx: 30, cy: 72 },
  { key: 'tibial_derecho', label: 'Tibial / Espinilla Der.', cx: 20, cy: 82 },
  { key: 'tibial_izquierdo', label: 'Tibial / Espinilla Izq.', cx: 30, cy: 82 },
  { key: 'tobillo_derecho', label: 'Tobillo Derecho', cx: 20, cy: 92 },
  { key: 'tobillo_izquierdo', label: 'Tobillo Izquierdo', cx: 30, cy: 92 },
];

// Posterior (Centro X ≈ 75%)
const BODY_ZONES_BACK = [
  { key: 'cervicales', label: 'Cervicales / Nuca', cx: 75, cy: 12 },
  { key: 'hombro_posterior_izquierdo', label: 'Hombro Post. Izq.', cx: 66, cy: 20 },
  { key: 'hombro_posterior_derecho', label: 'Hombro Post. Der.', cx: 84, cy: 20 },
  { key: 'espalda_alta', label: 'Espalda Alta / Trapecio', cx: 75, cy: 26 },
  { key: 'lumbar', label: 'Zona Lumbar', cx: 75, cy: 42 },
  { key: 'gluteo_izquierdo', label: 'Glúteo Izquierdo', cx: 68, cy: 50 },
  { key: 'gluteo_derecho', label: 'Glúteo Derecho', cx: 82, cy: 50 },
  { key: 'isquiotibial_izquierdo', label: 'Isquiotibial Izq.', cx: 69, cy: 60 },
  { key: 'isquiotibial_derecho', label: 'Isquiotibial Der.', cx: 81, cy: 60 },
  { key: 'gemelo_izquierdo', label: 'Gemelo / Sóleo Izq.', cx: 69, cy: 75 },
  { key: 'gemelo_derecho', label: 'Gemelo / Sóleo Der.', cx: 81, cy: 75 },
  { key: 'aquiles_izquierdo', label: 'T. Aquiles Izq.', cx: 69, cy: 88 },
  { key: 'aquiles_derecho', label: 'T. Aquiles Der.', cx: 81, cy: 88 },
];

export const ZONE_LABELS: Record<string, string> = {};
BODY_ZONES_FRONT.forEach(z => { ZONE_LABELS[z.key] = z.label; });
BODY_ZONES_BACK.forEach(z => { ZONE_LABELS[z.key] = z.label; });

interface BodyMapProps {
  injuries: PlayerInjury[];
  onZoneClick: (zone: string, side: 'frontal' | 'posterior') => void;
}

const severityColor = (severity: string) => {
  switch (severity) {
    case 'Grave': return 'bg-red-600';
    case 'Moderada': return 'bg-orange-500';
    case 'Leve': return 'bg-yellow-400';
    default: return 'bg-red-600';
  }
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year.slice(2)}`;
};

export const BodyMap: React.FC<BodyMapProps> = ({ injuries, onZoneClick }) => {
  // Vamos a mostrar lesiones activas y quizás las más recientes graves
  const activeInjuries = injuries.filter(i => i.status !== 'Recuperado');
  const allZones = [...BODY_ZONES_FRONT, ...BODY_ZONES_BACK];

  return (
    <div className="space-y-4">
      <div className="relative w-full max-w-[800px] mx-auto bg-white rounded-xl overflow-hidden shadow-inner border border-gray-200" style={{ minHeight: '400px' }}>
        
        {/* IMAGEN DEL SISTEMA MUSCULAR */}
        <img 
          src="/muscular_map.jpg" 
          alt="Anatomía Muscular" 
          className="w-full h-auto object-contain pointer-events-none select-none"
        />

        {/* MAPEO DE ZONAS Y LESIONES */}
        {allZones.map(zone => {
          const zoneInjuries = activeInjuries.filter(inj => inj.body_zone === zone.key);
          const hasInjury = zoneInjuries.length > 0;
          const side = BODY_ZONES_FRONT.includes(zone) ? 'frontal' : 'posterior';

          return (
            <div
              key={zone.key}
              className="absolute group cursor-pointer"
              style={{ left: `${zone.cx}%`, top: `${zone.cy}%`, transform: 'translate(-50%, -50%)', zIndex: hasInjury ? 20 : 10 }}
              onClick={() => onZoneClick(zone.key, side)}
              title={zone.label}
            >
              {/* Zona Clícable (Invisible por defecto) */}
              <div className={`w-8 h-8 md:w-12 md:h-12 rounded-full transition-all flex items-center justify-center ${!hasInjury && 'hover:bg-brand-red-600/20'}`}>
                
                {/* Sombreado de la Lesión */}
                {hasInjury && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 md:w-14 md:h-14 bg-red-600/50 rounded-full blur-[6px] animate-pulse mix-blend-multiply" />
                    <div className="w-4 h-4 md:w-6 md:h-6 bg-red-600/80 rounded-full blur-[2px] z-10 shadow-lg" />
                  </div>
                )}
              </div>

              {/* Etiquetas con las fechas de la lesión (Solo visibles si hay lesión) */}
              {hasInjury && (
                <div className="absolute top-1/2 left-full ml-1 md:ml-3 -translate-y-1/2 flex flex-col gap-1 pointer-events-none z-30">
                  {zoneInjuries.map(inj => (
                    <div key={inj.id} className="bg-black/85 border border-white/20 text-white text-[8px] md:text-[10px] px-1.5 py-1 rounded whitespace-nowrap shadow-xl flex items-center gap-1.5 backdrop-blur-sm">
                      <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${severityColor(inj.severity)} animate-pulse`} />
                      <span className="font-bold">{formatDate(inj.injury_date)}</span>
                      <span className="text-gray-400">-></span>
                      <span className="font-bold text-brand-red-600">{inj.actual_return ? formatDate(inj.actual_return) : 'Activa'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Resumen inferior */}
      <div className="flex items-center justify-between pt-2 border-t border-brand-black-border/40">
        <div className="flex items-center gap-4 text-[10px] md:text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-600 shadow"></span>
            <span className="text-brand-gray-muted font-bold">Grave</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-500 shadow"></span>
            <span className="text-brand-gray-muted font-bold">Moderada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-yellow-400 shadow"></span>
            <span className="text-brand-gray-muted font-bold">Leve</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] md:text-xs">
          <span className="text-brand-gray-muted font-medium">
            Activas: <span className="font-black text-brand-red-600">{activeInjuries.length}</span>
          </span>
          <span className="text-brand-gray-muted font-medium">
            Histórico: <span className="font-black text-white">{injuries.length}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
"""

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("BodyMap component rewritten successfully!")
