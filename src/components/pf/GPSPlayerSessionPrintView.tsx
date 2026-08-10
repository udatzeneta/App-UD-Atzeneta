import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend } from 'recharts';

interface GPSPlayerSessionPrintViewProps {
  jugador: any;
  record: any;
  sessionLabel: string;
  metrics: { key: string; label: string; color: string }[];
  radarData: any[];
}

export const GPSPlayerSessionPrintView: React.FC<GPSPlayerSessionPrintViewProps> = ({
  jugador,
  record,
  sessionLabel,
  metrics,
  radarData
}) => {
  if (!jugador || !record) return null;

  return (
    <div id="pdf-gps-player-session" className="bg-white text-black p-8" style={{ width: '1122px', height: '790px', overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex justify-between items-start border-b-4 border-[#C1121F] pb-4 mb-6">
        <div className="flex items-center gap-6">
          <img src="/club-logo.png" alt="Escudo" className="w-20 h-20 object-contain" />
          <div>
            <h1 className="text-2xl font-bold text-[#0f0f0f] uppercase tracking-wider">Reporte GPS Individual</h1>
            <p className="text-[#C1121F] font-semibold text-lg">{sessionLabel}</p>
            <p className="text-gray-500 text-sm">UD Atzeneta · Generado el {new Date().toLocaleDateString('es-ES')}</p>
          </div>
        </div>
        
        {/* Ficha del jugador */}
        <div className="flex items-center gap-4 bg-gray-50 border border-gray-200 p-3 rounded-xl">
          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#C1121F] shrink-0">
            {jugador.photo_url ? (
              <img src={jugador.photo_url} alt={jugador.nickname || jugador.full_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-500">
                {jugador.dorsal || '-'}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-black leading-tight">
              {jugador.dorsal ? `${jugador.dorsal}. ` : ''}{jugador.nickname || jugador.full_name}
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">{jugador.posicion || 'Jugador'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Grid de Métricas */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
          <h4 className="text-sm font-bold text-[#0f0f0f] uppercase tracking-wide border-b pb-2 mb-2">
            Métricas Registradas
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {metrics.map(m => {
              const val = record[m.key];
              return (
                <div key={m.key} className="bg-white border border-gray-200 p-2.5 rounded-lg">
                  <span className="text-[10px] text-gray-500 font-bold block truncate" title={m.label}>
                    {m.label.split(' (')[0]}
                  </span>
                  <span className="text-base font-extrabold text-black block mt-0.5">
                    {val != null ? val : '—'}
                  </span>
                  {m.label.includes('(') && (
                    <span className="text-[9px] text-gray-400 font-semibold block mt-0.5">
                      {m.label.split('(')[1].replace(')', '')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Radar Comparativo con su Media */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex flex-col items-center">
          <h4 className="text-sm font-bold text-[#0f0f0f] uppercase tracking-wide mb-4">
            Comparativa vs Media Histórica
          </h4>
          <div className="w-full h-[320px] flex justify-center">
            <RadarChart width={400} height={320} cx="50%" cy="50%" outerRadius="70%" data={radarData}>
              <PolarGrid stroke="#d1d5db" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#4b5563', fontSize: 10, fontWeight: 'bold' }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 9 }} />
              <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
              <Radar
                isAnimationActive={false}
                name="Sesión Actual"
                dataKey="Sesión Actual"
                stroke="#C1121F"
                fill="#C1121F"
                fillOpacity={0.4}
                strokeWidth={2}
              />
              <Radar
                isAnimationActive={false}
                name="Media Histórica"
                dataKey="Media Histórica"
                stroke="#2563EB"
                fill="#2563EB"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </RadarChart>
          </div>
        </div>
      </div>
    </div>
  );
};
