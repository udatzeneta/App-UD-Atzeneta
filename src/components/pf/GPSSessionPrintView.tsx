import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface GPSSessionPrintViewProps {
  session: { label: string; id: string; date: string; type: string } | null;
  records: any[];
  metrics: { key: string; label: string; color: string }[];
  selectedMetric: { key: string; label: string; color: string } | null;
}

export const GPSSessionPrintView: React.FC<GPSSessionPrintViewProps> = ({ 
  session, 
  records, 
  metrics, 
  selectedMetric 
}) => {
  if (!session || records.length === 0) return null;

  const metricKey = selectedMetric?.key || 'distancia_total';

  return (
    <div id="pdf-gps-session" className="bg-white text-black p-8" style={{ width: '1122px', height: '790px', overflow: 'hidden' }}>
      <div className="flex justify-between items-start border-b-4 border-[#C1121F] pb-4 mb-6">
        <div className="flex items-center gap-6">
          <img src="/club-logo.png" alt="Escudo" className="w-16 h-16 object-contain" />
          <div>
            <h1 className="text-2xl font-bold text-[#0f0f0f] uppercase tracking-wider">Reporte GPS por Sesión</h1>
            <p className="text-[#C1121F] font-semibold text-base">{session.label}</p>
            <p className="text-gray-500 text-xs">UD Atzeneta · Generado el {new Date().toLocaleDateString('es-ES')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Bar Chart comparing metric */}
        <div className="col-span-2 bg-gray-50 border border-gray-200 rounded-xl p-5">
          <h4 className="text-sm font-bold text-[#0f0f0f] mb-4 uppercase tracking-wide">
            Comparativa de {selectedMetric?.label}
          </h4>
          <div className="h-80 w-full flex justify-center">
            <BarChart width={650} height={300} data={records} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="playerName" tick={{ fill: '#4b5563', fontSize: 9, fontWeight: 'bold' }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} />
              <Bar isAnimationActive={false} dataKey={metricKey} fill="#C1121F" radius={[3, 3, 0, 0]} />
            </BarChart>
          </div>
        </div>

        {/* Resumen de la sesión */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
          <h4 className="text-sm font-bold text-[#0f0f0f] uppercase tracking-wide">Resumen General</h4>
          <div className="border-b pb-2">
            <span className="text-xs text-gray-500 block">Total Jugadores</span>
            <span className="text-xl font-bold text-black">{records.length}</span>
          </div>
          <div className="border-b pb-2">
            <span className="text-xs text-gray-500 block">Media de {selectedMetric?.label}</span>
            <span className="text-xl font-bold text-[#C1121F]">
              {(records.reduce((sum, r) => sum + (Number(r[metricKey]) || 0), 0) / (records.length || 1)).toFixed(1)}
            </span>
          </div>
          <div>
            <span className="text-xs text-gray-500 block">Valor Máximo</span>
            <span className="text-xl font-bold text-black">
              {Math.max(...records.map(r => Number(r[metricKey]) || 0))}
            </span>
          </div>
        </div>

        {/* Tabla simplificada */}
        <div className="col-span-3 overflow-x-auto bg-gray-50 border border-gray-200 rounded-xl p-4">
          <table className="w-full text-left text-[10px] border-collapse">
            <thead>
              <tr className="border-b border-gray-300 text-gray-700 uppercase font-bold">
                <th className="py-1 px-2">Dorsal</th>
                <th className="py-1 px-2">Jugador</th>
                {metrics.map(m => (
                  <th key={m.key} className="py-1 px-2 text-right text-[8px]">{m.label.split(' (')[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 12).map(r => (
                <tr key={r.id} className="border-b border-gray-200 text-gray-800 font-medium">
                  <td className="py-1 px-2">{r.dorsal ?? '-'}</td>
                  <td className="py-1 px-2 font-bold">{r.playerName}</td>
                  {metrics.map(m => (
                    <td key={m.key} className="py-1 px-2 text-right">
                      {r[m.key] != null ? r[m.key] : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {records.length > 12 && (
            <p className="text-[9px] text-gray-400 mt-2 text-center">
              Mostrando los primeros 12 de {records.length} jugadores en la vista simplificada de impresión.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
