import React from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';

interface GPSPlayerPrintViewProps {
  jugador: any;
  jugadorData: any[];
  metrics: { key: string; label: string; color: string }[];
  selectedMetric: { key: string; label: string; color: string } | undefined;
}

export const GPSPlayerPrintView: React.FC<GPSPlayerPrintViewProps> = ({ jugador, jugadorData, metrics }) => {
  if (!jugador) return null;

  const hasData = jugadorData.length > 0;

  // Normalizar datos para la gráfica evolutiva global (0-100%)
  const normalizedData = jugadorData.map(d => {
    const nd: any = { label: d.label };
    metrics.forEach(m => {
      // Find max for this metric across all data
      const max = Math.max(...jugadorData.map(row => Number(row[m.key]) || 0));
      const val = Number(d[m.key]) || 0;
      // Normalize to 0-100% of the player's maximum
      nd[m.key] = max > 0 ? (val / max) * 100 : 0;
    });
    return nd;
  });

  return (
    <div id="pdf-gps-player" className="bg-white text-black p-8" style={{ width: '1122px', height: '790px', overflow: 'hidden' }}>
      {/* Header (aprox 80px) */}
      <div className="flex justify-between items-start border-b-4 border-[#C1121F] pb-3 mb-4">
        <div className="flex items-center gap-6">
          <img src="/club-logo.png" alt="Escudo" className="w-16 h-16 object-contain" />
          <div>
            <h1 className="text-2xl font-bold text-[#0f0f0f] uppercase tracking-wider">Reporte GPS Individual</h1>
            <p className="text-[#C1121F] font-semibold text-base">{jugador.full_name} {jugador.dorsal ? `(#${jugador.dorsal})` : ''}</p>
            <p className="text-gray-500 text-xs">UD Atzeneta · {new Date().toLocaleDateString('es-ES')}</p>
          </div>
        </div>
        <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-[#C1121F]">
          {jugador.photo_url ? (
            <img src={jugador.photo_url} alt={jugador.full_name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-400">
              {jugador.dorsal || '-'}
            </div>
          )}
        </div>
      </div>

      {hasData ? (
        <>
          {/* Gráfico de Evolución Principal (Todas las líneas normalizadas) */}
          <div className="mb-2">
            <h3 className="text-sm font-bold text-[#0f0f0f] mb-1">Evolución Global Normalizada (% respecto al máximo personal)</h3>
            <div>
              <LineChart width={1050} height={180} data={normalizedData} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} domain={[0, 100]} />
                <Legend wrapperStyle={{ fontSize: '10px' }} iconSize={8} />
                {metrics.map(m => (
                  <Line
                    key={m.key}
                    name={m.label.split('(')[0].trim()} // Nombre corto para la leyenda
                    isAnimationActive={false}
                    type="monotone"
                    dataKey={m.key}
                    stroke={m.color}
                    strokeWidth={2}
                    dot={{ fill: m.color, r: 2 }}
                    activeDot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </div>
          </div>

          {/* 9 Mini Gráficos Secundarios (3x3) */}
          <div className="grid grid-cols-3 gap-x-6 gap-y-3">
            {metrics.map(m => {
              const validDataCount = jugadorData.filter(d => d[m.key] != null).length;
              const lastValue = jugadorData[jugadorData.length - 1][m.key] as number;
              const maxValue = Math.max(...jugadorData.map(d => (d[m.key] as number) || 0));
              const avgValue = validDataCount > 0
                ? (jugadorData.reduce((s, d) => s + ((d[m.key] as number) || 0), 0) / validDataCount).toFixed(1)
                : 0;

              return (
                <div key={m.key} className="bg-gray-50 border border-gray-200 rounded-lg p-2 flex flex-col justify-between">
                  <h4 className="text-[11px] font-bold text-[#0f0f0f] mb-1 leading-normal pt-0.5" style={{ color: m.color }}>{m.label}</h4>
                  <div>
                    <BarChart width={320} height={65} data={jugadorData} margin={{ top: 0, right: 0, left: -30, bottom: -5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 8 }} hide />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 8 }} />
                      <Bar isAnimationActive={false} dataKey={m.key} fill={m.color} radius={[1, 1, 0, 0]} />
                    </BarChart>
                  </div>
                  <div className="flex justify-between items-center mt-1 pt-1 border-t border-gray-200">
                    <div className="text-[9px] text-gray-500">Últ: <span className="font-bold text-gray-800">{lastValue ?? '-'}</span></div>
                    <div className="text-[9px] text-gray-500">Máx: <span className="font-bold text-gray-800">{maxValue ?? '-'}</span></div>
                    <div className="text-[9px] text-gray-500">Med: <span className="font-bold text-gray-800">{avgValue ?? '-'}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="text-center p-12 text-gray-500">
          No hay datos suficientes para generar el reporte.
        </div>
      )}
    </div>
  );
};
