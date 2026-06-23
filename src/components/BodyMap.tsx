import React from 'react';
import { PlayerInjury } from '../types';

// Zonas del cuerpo con sus coordenadas relativas sobre la silueta SVG
const BODY_ZONES_FRONT: { key: string; label: string; cx: number; cy: number }[] = [
  { key: 'cabeza', label: 'Cabeza', cx: 50, cy: 8 },
  { key: 'hombro_izquierdo', label: 'Hombro Izquierdo', cx: 30, cy: 18 },
  { key: 'hombro_derecho', label: 'Hombro Derecho', cx: 70, cy: 18 },
  { key: 'pectoral', label: 'Pectoral / Pecho', cx: 50, cy: 24 },
  { key: 'biceps_izquierdo', label: 'Bíceps Izquierdo', cx: 22, cy: 28 },
  { key: 'biceps_derecho', label: 'Bíceps Derecho', cx: 78, cy: 28 },
  { key: 'abdomen', label: 'Abdomen / Core', cx: 50, cy: 35 },
  { key: 'cadera_izquierda', label: 'Cadera / Ingle Izq.', cx: 38, cy: 44 },
  { key: 'cadera_derecha', label: 'Cadera / Ingle Der.', cx: 62, cy: 44 },
  { key: 'muslo_izquierdo', label: 'Cuádriceps Izquierdo', cx: 38, cy: 54 },
  { key: 'muslo_derecho', label: 'Cuádriceps Derecho', cx: 62, cy: 54 },
  { key: 'rodilla_izquierda', label: 'Rodilla Izquierda', cx: 40, cy: 65 },
  { key: 'rodilla_derecha', label: 'Rodilla Derecha', cx: 60, cy: 65 },
  { key: 'tibial_izquierdo', label: 'Tibial / Espinilla Izq.', cx: 40, cy: 76 },
  { key: 'tibial_derecho', label: 'Tibial / Espinilla Der.', cx: 60, cy: 76 },
  { key: 'tobillo_izquierdo', label: 'Tobillo Izquierdo', cx: 40, cy: 88 },
  { key: 'tobillo_derecho', label: 'Tobillo Derecho', cx: 60, cy: 88 },
];

const BODY_ZONES_BACK: { key: string; label: string; cx: number; cy: number }[] = [
  { key: 'cervicales', label: 'Cervicales / Nuca', cx: 50, cy: 10 },
  { key: 'hombro_posterior_izquierdo', label: 'Hombro Post. Izq.', cx: 30, cy: 18 },
  { key: 'hombro_posterior_derecho', label: 'Hombro Post. Der.', cx: 70, cy: 18 },
  { key: 'espalda_alta', label: 'Espalda Alta / Trapecio', cx: 50, cy: 24 },
  { key: 'lumbar', label: 'Zona Lumbar', cx: 50, cy: 38 },
  { key: 'gluteo_izquierdo', label: 'Glúteo Izquierdo', cx: 38, cy: 46 },
  { key: 'gluteo_derecho', label: 'Glúteo Derecho', cx: 62, cy: 46 },
  { key: 'isquiotibial_izquierdo', label: 'Isquiotibial Izq.', cx: 38, cy: 56 },
  { key: 'isquiotibial_derecho', label: 'Isquiotibial Der.', cx: 62, cy: 56 },
  { key: 'gemelo_izquierdo', label: 'Gemelo / Sóleo Izq.', cx: 40, cy: 72 },
  { key: 'gemelo_derecho', label: 'Gemelo / Sóleo Der.', cx: 60, cy: 72 },
  { key: 'aquiles_izquierdo', label: 'T. Aquiles Izq.', cx: 40, cy: 86 },
  { key: 'aquiles_derecho', label: 'T. Aquiles Der.', cx: 60, cy: 86 },
];

// Mapeo de zona a label legible
export const ZONE_LABELS: Record<string, string> = {};
BODY_ZONES_FRONT.forEach(z => { ZONE_LABELS[z.key] = z.label; });
BODY_ZONES_BACK.forEach(z => { ZONE_LABELS[z.key] = z.label; });

interface BodyMapProps {
  injuries: PlayerInjury[];
  onZoneClick: (zone: string, side: 'frontal' | 'posterior') => void;
}

// Silueta frontal como paths SVG
const FrontalSilhouette: React.FC = () => (
  <g fill="#2a3a30" fillOpacity="0.15" stroke="#4a7a5a" strokeWidth="0.6" strokeOpacity="0.4">
    {/* Cabeza */}
    <ellipse cx="50" cy="7" rx="7" ry="8" />
    {/* Detalles faciales (Frontal) */}
    <circle cx="47" cy="6" r="0.8" fill="#4a7a5a" fillOpacity="0.8" stroke="none" />
    <circle cx="53" cy="6" r="0.8" fill="#4a7a5a" fillOpacity="0.8" stroke="none" />
    <path d="M47 10.5 Q50 12 53 10.5" fill="none" stroke="#4a7a5a" strokeWidth="0.6" strokeOpacity="0.8" />
    <line x1="50" y1="7" x2="50" y2="8.5" stroke="#4a7a5a" strokeWidth="0.5" strokeOpacity="0.8" />
    {/* Cuello */}
    <rect x="46" y="14.5" width="8" height="4" rx="2" />
    {/* Torso */}
    <path d="M32 18 Q30 18 29 20 L27 28 Q26 32 28 34 L30 36 Q32 42 35 45 L42 47 Q48 48 50 48 Q52 48 58 47 L65 45 Q68 42 70 36 L72 34 Q74 32 73 28 L71 20 Q70 18 68 18 Z" />
    {/* Pecho (Pectorales) */}
    <path d="M40 24 Q50 28 60 24" fill="none" stroke="#4a7a5a" strokeWidth="0.4" strokeOpacity="0.3" />
    {/* Abdomen (Six pack sutil) */}
    <line x1="50" y1="28" x2="50" y2="40" stroke="#4a7a5a" strokeWidth="0.3" strokeOpacity="0.3" />
    <line x1="45" y1="32" x2="55" y2="32" stroke="#4a7a5a" strokeWidth="0.3" strokeOpacity="0.3" />
    <line x1="46" y1="36" x2="54" y2="36" stroke="#4a7a5a" strokeWidth="0.3" strokeOpacity="0.3" />
    {/* Brazo izquierdo */}
    <path d="M29 20 Q26 20 24 22 L18 34 Q16 38 17 40 L19 38 Q20 36 22 34 L28 22 Z" />
    {/* Brazo derecho */}
    <path d="M71 20 Q74 20 76 22 L82 34 Q84 38 83 40 L81 38 Q80 36 78 34 L72 22 Z" />
    {/* Cadera y pelvis */}
    <path d="M35 45 Q33 47 33 50 L36 52 Q42 54 50 54 Q58 54 64 52 L67 50 Q67 47 65 45 Z" />
    {/* Muslo izquierdo */}
    <path d="M36 52 Q34 54 34 58 L36 66 Q37 68 39 68 L42 66 Q44 62 44 58 L43 52 Z" />
    {/* Muslo derecho */}
    <path d="M57 52 Q56 54 56 58 L58 66 Q59 68 61 68 L64 66 Q66 62 66 58 L64 52 Z" />
    {/* Rodillas (Frontal) */}
    <circle cx="40.5" cy="67" r="1.5" fill="none" stroke="#4a7a5a" strokeWidth="0.3" strokeOpacity="0.4" />
    <circle cx="59.5" cy="67" r="1.5" fill="none" stroke="#4a7a5a" strokeWidth="0.3" strokeOpacity="0.4" />
    {/* Pierna izquierda */}
    <path d="M37 68 Q36 72 36 78 L37 86 Q38 90 40 92 L42 92 Q43 90 43 86 L42 78 Q42 72 41 68 Z" />
    {/* Pierna derecha */}
    <path d="M59 68 Q58 72 58 78 L59 86 Q60 90 62 92 L64 92 Q65 90 65 86 L64 78 Q64 72 63 68 Z" />
    {/* Pies (Apuntando adelante) */}
    <path d="M38 92 Q37 96 40 96 Q43 96 42 92 Z" fill="#2a3a30" fillOpacity="0.15" />
    <path d="M62 92 Q63 96 60 96 Q57 96 58 92 Z" fill="#2a3a30" fillOpacity="0.15" />
  </g>
);

// Silueta posterior como paths SVG
const PosteriorSilhouette: React.FC = () => (
  <g fill="#2a3a30" fillOpacity="0.15" stroke="#4a7a5a" strokeWidth="0.6" strokeOpacity="0.4">
    {/* Cabeza (Sin cara, solo contorno y pelo) */}
    <ellipse cx="50" cy="7" rx="7" ry="8" />
    <path d="M44 4 Q50 0 56 4 Q55 9 50 10 Q45 9 44 4 Z" fill="#4a7a5a" fillOpacity="0.3" stroke="none" />
    {/* Cuello */}
    <rect x="46" y="14.5" width="8" height="4" rx="2" />
    {/* Torso posterior */}
    <path d="M32 18 Q30 18 29 20 L27 28 Q26 32 28 35 L30 38 Q32 42 35 45 L42 47 Q48 48 50 48 Q52 48 58 47 L65 45 Q68 42 70 38 L72 35 Q74 32 73 28 L71 20 Q70 18 68 18 Z" />
    {/* Línea columna (Posterior) */}
    <line x1="50" y1="16" x2="50" y2="45" stroke="#4a7a5a" strokeWidth="0.4" strokeDasharray="1,1" strokeOpacity="0.6" />
    {/* Omoplatos */}
    <path d="M38 22 Q42 26 44 30" fill="none" stroke="#4a7a5a" strokeWidth="0.3" strokeOpacity="0.4" />
    <path d="M62 22 Q58 26 56 30" fill="none" stroke="#4a7a5a" strokeWidth="0.3" strokeOpacity="0.4" />
    {/* Brazo izquierdo */}
    <path d="M29 20 Q26 20 24 22 L18 34 Q16 38 17 40 L19 38 Q20 36 22 34 L28 22 Z" />
    {/* Brazo derecho */}
    <path d="M71 20 Q74 20 76 22 L82 34 Q84 38 83 40 L81 38 Q80 36 78 34 L72 22 Z" />
    {/* Cadera / Glúteos */}
    <path d="M35 45 Q33 47 33 50 L36 52 Q42 54 50 54 Q58 54 64 52 L67 50 Q67 47 65 45 Z" />
    <path d="M36 52 Q43 45 50 52 Q57 45 64 52" fill="none" stroke="#4a7a5a" strokeWidth="0.4" strokeOpacity="0.4" />
    {/* Muslo posterior izq */}
    <path d="M36 52 Q34 54 34 58 L36 66 Q37 68 39 68 L42 66 Q44 62 44 58 L43 52 Z" />
    {/* Muslo posterior der */}
    <path d="M57 52 Q56 54 56 58 L58 66 Q59 68 61 68 L64 66 Q66 62 66 58 L64 52 Z" />
    {/* Pliegue rodilla posterior (Corva) */}
    <line x1="38" y1="67" x2="43" y2="67" stroke="#4a7a5a" strokeWidth="0.3" strokeOpacity="0.4" />
    <line x1="57" y1="67" x2="62" y2="67" stroke="#4a7a5a" strokeWidth="0.3" strokeOpacity="0.4" />
    {/* Pierna posterior izq */}
    <path d="M37 68 Q36 72 36 78 L37 86 Q38 90 40 92 L42 92 Q43 90 43 86 L42 78 Q42 72 41 68 Z" />
    {/* Pierna posterior der */}
    <path d="M59 68 Q58 72 58 78 L59 86 Q60 90 62 92 L64 92 Q65 90 65 86 L64 78 Q64 72 63 68 Z" />
    {/* Pies (Talones) */}
    <ellipse cx="40" cy="92.5" rx="3.5" ry="1.5" />
    <ellipse cx="62" cy="92.5" rx="3.5" ry="1.5" />
  </g>
);

const severityColor = (severity: string) => {
  switch (severity) {
    case 'Grave': return '#ef4444';
    case 'Moderada': return '#f97316';
    case 'Leve': return '#eab308';
    default: return '#ef4444';
  }
};

const worstSeverity = (injuries: PlayerInjury[]) => {
  if (injuries.some(i => i.severity === 'Grave')) return 'Grave';
  if (injuries.some(i => i.severity === 'Moderada')) return 'Moderada';
  return 'Leve';
};

export const BodyMap: React.FC<BodyMapProps> = ({ injuries, onZoneClick }) => {
  // Agrupar lesiones activas por zona
  const activeInjuries = injuries.filter(i => i.status !== 'Recuperado');
  
  const frontInjuriesByZone: Record<string, PlayerInjury[]> = {};
  const backInjuriesByZone: Record<string, PlayerInjury[]> = {};

  activeInjuries.forEach(inj => {
    if (inj.body_side === 'frontal') {
      if (!frontInjuriesByZone[inj.body_zone]) frontInjuriesByZone[inj.body_zone] = [];
      frontInjuriesByZone[inj.body_zone].push(inj);
    } else {
      if (!backInjuriesByZone[inj.body_zone]) backInjuriesByZone[inj.body_zone] = [];
      backInjuriesByZone[inj.body_zone].push(inj);
    }
  });

  const totalActive = activeInjuries.length;
  const totalAll = injuries.length;

  const renderSilhouette = (
    zones: typeof BODY_ZONES_FRONT,
    injuriesByZone: Record<string, PlayerInjury[]>,
    side: 'frontal' | 'posterior',
    SilhouetteComponent: React.FC,
    title: string
  ) => (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] font-bold text-brand-gray-muted uppercase tracking-widest">{title}</span>
      <svg viewBox="0 0 100 100" className="w-full max-w-[200px] h-auto" style={{ minHeight: 260 }}>
        {/* Fondo */}
        <rect x="0" y="0" width="100" height="100" fill="transparent" />
        
        {/* Silueta */}
        <SilhouetteComponent />

        {/* Zonas clicables invisibles */}
        {zones.map(zone => {
          const zoneInjuries = injuriesByZone[zone.key] || [];
          const hasInjury = zoneInjuries.length > 0;
          return (
            <g key={zone.key}>
              {/* Área clicable */}
              <circle
                cx={zone.cx}
                cy={zone.cy}
                r="5"
                fill="transparent"
                className="cursor-pointer"
                onClick={() => onZoneClick(zone.key, side)}
              >
                <title>{zone.label}</title>
              </circle>

              {/* Marcador de lesión */}
              {hasInjury && (
                <>
                  {/* Pulso animado */}
                  <circle
                    cx={zone.cx}
                    cy={zone.cy}
                    r="4.5"
                    fill={severityColor(worstSeverity(zoneInjuries))}
                    fillOpacity="0.25"
                    className="animate-ping"
                    style={{ transformOrigin: `${zone.cx}px ${zone.cy}px`, animationDuration: '2s' }}
                  />
                  {/* Círculo principal */}
                  <circle
                    cx={zone.cx}
                    cy={zone.cy}
                    r="4"
                    fill={severityColor(worstSeverity(zoneInjuries))}
                    fillOpacity="0.85"
                    stroke="#fff"
                    strokeWidth="0.5"
                    className="cursor-pointer drop-shadow-lg"
                    onClick={() => onZoneClick(zone.key, side)}
                  />
                  {/* Número */}
                  <text
                    x={zone.cx}
                    y={zone.cy + 1.5}
                    fill="#fff"
                    fontSize="4.5"
                    fontWeight="800"
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                  >
                    {zoneInjuries.length}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        {renderSilhouette(BODY_ZONES_FRONT, frontInjuriesByZone, 'frontal', FrontalSilhouette, 'Vista Frontal')}
        {renderSilhouette(BODY_ZONES_BACK, backInjuriesByZone, 'posterior', PosteriorSilhouette, 'Vista Posterior')}
      </div>

      {/* Resumen inferior */}
      <div className="flex items-center justify-between pt-2 border-t border-brand-black-border/40">
        <div className="flex items-center gap-4 text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
            <span className="text-brand-gray-muted font-semibold">Grave</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span>
            <span className="text-brand-gray-muted font-semibold">Moderada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block"></span>
            <span className="text-brand-gray-muted font-semibold">Leve</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-brand-gray-muted">
            Activas: <span className="font-bold text-brand-red-600">{totalActive}</span>
          </span>
          <span className="text-brand-gray-muted">
            Total: <span className="font-bold text-brand-gray-light">{totalAll}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
