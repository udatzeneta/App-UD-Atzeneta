import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface ComparadorPrintViewProps {
  selectedItems: { id: string; playerId: string; gpsRecordId: string }[];
  jugadores: any[];
  gpsRecords: any[];
  entrenamientos: any[];
  partidos: any[];
  comparisonData: { radar: any[]; bars: any[] };
  colors: string[];
}

export const ComparadorPrintView: React.FC<ComparadorPrintViewProps> = ({ 
  selectedItems, 
  jugadores, 
  gpsRecords, 
  entrenamientos, 
  partidos, 
  comparisonData, 
  colors 
}) => {
  if (selectedItems.length === 0) return null;

  const METRICS = [
    { key: 'distancia_total', label: 'Distancia total (m)' },
    { key: 'velocidad_maxima', label: 'Velocidad máxima (km/h)' },
    { key: 'sprints', label: 'Nº Sprints' },
    { key: 'hsr', label: 'HSR alta vel. (m)' },
    { key: 'distancia_alta_intensidad', label: 'Dist. alta intensidad (m)' },
    { key: 'aceleraciones', label: 'Aceleraciones' },
    { key: 'deceleraciones', label: 'Deceleraciones' },
    { key: 'distancia_por_minuto', label: 'Dist./min (m/min)' },
    { key: 'equilibrio_pasos', label: 'Equilibrio pasos (%)' }
  ];

  const getMetricValueStr = (item: typeof selectedItems[0], mKey: string) => {
    if (item.gpsRecordId === '') {
      const playerRecs = gpsRecords.filter(r => r.jugador_id?.toString() === item.playerId?.toString());
      const valid = playerRecs.filter(r => r[mKey] != null);
      if (valid.length === 0) return '—';
      const avg = valid.reduce((sum, r) => sum + Number(r[mKey] || 0), 0) / valid.length;
      return avg.toFixed(1);
    } else {
      const record = gpsRecords.find(r => r.id?.toString() === item.gpsRecordId?.toString());
      if (!record || record[mKey] == null) return '—';
      return Number(record[mKey]).toString();
    }
  };

  const getItemLabel = (item: typeof selectedItems[0]) => {
    const player = jugadores.find(j => j.id === item.playerId);
    if (!player) return 'Jugador';
    const playerNick = player.nickname || player.full_name;
    const dorsalStr = player.dorsal ? `${player.dorsal}. ` : '';
    
    if (item.gpsRecordId === '') {
      return `${dorsalStr}${playerNick} (Media)`;
    } else {
      const record = gpsRecords.find(r => r.id?.toString() === item.gpsRecordId?.toString());
      if (!record) return `${dorsalStr}${playerNick}`;
      
      const session = record.session_type === 'entrenamiento'
        ? entrenamientos.find(e => e.id?.toString() === record.session_id?.toString())
        : partidos.find(p => p.id?.toString() === record.session_id?.toString());
      
      const dateStr = session?.date || session?.fecha || '';
      const dateObj = new Date(dateStr);
      const formattedDate = !isNaN(dateObj.getTime())
        ? `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`
        : '';
        
      const typeStr = record.session_type === 'entrenamiento' ? 'Entr.' : 'Part.';
      const rivalStr = record.session_type === 'partido' && session?.rival ? ` vs ${session.rival}` : '';
      return `${dorsalStr}${playerNick} (${typeStr} ${formattedDate}${rivalStr})`;
    }
  };

  return (
    <div id="pdf-comparador" style={{ width: '1122px' }}>
      {/* PAGINA 1: GRAFICAS */}
      <div className="bg-white text-black p-8 flex flex-col justify-between" style={{ width: '1122px', height: '790px', boxSizing: 'border-box', overflow: 'hidden' }}>
        <div>
          {/* Header */}
          <div className="flex justify-between items-start border-b-4 border-[#C1121F] pb-4 mb-6">
            <div className="flex items-center gap-6">
              <img src="/club-logo.png" alt="Escudo" className="w-20 h-20 object-contain" />
              <div>
                <h1 className="text-3xl font-bold text-[#0f0f0f] uppercase tracking-wider">Reporte Comparativo GPS</h1>
                <p className="text-[#C1121F] font-semibold text-lg">{selectedItems.length} Elementos en Comparación</p>
                <p className="text-gray-500 text-sm">UD Atzeneta · {new Date().toLocaleDateString('es-ES')}</p>
              </div>
            </div>
            <div className="flex gap-4">
              {selectedItems.map((item, i) => {
                const p = jugadores.find(j => j.id === item.playerId);
                if (!p) return null;

                const record = gpsRecords.find(r => r.id?.toString() === item.gpsRecordId?.toString());
                let sessionLabel = 'Media Global';
                if (record) {
                  const session = record.session_type === 'entrenamiento'
                    ? entrenamientos.find(e => e.id?.toString() === record.session_id?.toString())
                    : partidos.find(p => p.id?.toString() === record.session_id?.toString());
                  const dateStr = session?.date || session?.fecha || '';
                  const dateObj = new Date(dateStr);
                  const formattedDate = !isNaN(dateObj.getTime())
                    ? `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`
                    : '';
                  const typeStr = record.session_type === 'entrenamiento' ? 'Entr.' : 'Part.';
                  sessionLabel = `${typeStr} ${formattedDate}`;
                }

                return (
                  <div key={item.id} className="flex flex-col items-center w-24 shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-4 shrink-0" style={{ borderColor: colors[i % colors.length] }}>
                      {p.photo_url ? (
                        <img src={p.photo_url} alt={p.nickname || p.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-400">
                          {p.dorsal || '-'}
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] font-bold mt-1 text-center leading-tight w-full pb-0.5 truncate">
                      {p.dorsal ? `${p.dorsal}. ` : ''}{p.nickname || p.full_name}
                    </div>
                    <div className="text-[9px] text-gray-500 font-bold text-center w-full mt-0.5 leading-none">
                      {sessionLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            {/* Radar Chart */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
              <h4 className="text-lg font-bold text-[#0f0f0f] mb-6 text-center uppercase tracking-wide">Balance Global (Radar)</h4>
              <div className="flex justify-center">
                <RadarChart width={450} height={400} cx="50%" cy="50%" outerRadius="70%" data={comparisonData.radar}>
                  <PolarGrid stroke="#d1d5db" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: '#4b5563', fontSize: 11, fontWeight: 'bold' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                  {selectedItems.map((item, i) => (
                    <Radar
                      isAnimationActive={false}
                      key={item.id}
                      name={getItemLabel(item)}
                      dataKey={`player_${i}`}
                      stroke={colors[i % colors.length]}
                      fill={colors[i % colors.length]}
                      fillOpacity={0.4}
                      strokeWidth={2}
                    />
                  ))}
                </RadarChart>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
              <h4 className="text-lg font-bold text-[#0f0f0f] mb-6 text-center uppercase tracking-wide">Métricas Detalladas</h4>
              <div>
                <BarChart width={450} height={400} data={comparisonData.bars} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={true} vertical={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#4b5563', fontSize: 11, fontWeight: 'bold' }} width={120} />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                  {selectedItems.map((item, i) => (
                    <Bar 
                      isAnimationActive={false} 
                      key={item.id} 
                      dataKey={`player_${i}`} 
                      name={getItemLabel(item)} 
                      fill={colors[i % colors.length]} 
                      radius={[0, 4, 4, 0]} 
                    />
                  ))}
                </BarChart>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center text-xs text-gray-400 font-semibold border-t pt-4">
          <span>UD Atzeneta — Departamento de Preparación Física</span>
          <span>Página 1 de 2</span>
        </div>
      </div>

      {/* PAGE BREAK */}
      <div style={{ pageBreakBefore: 'always' }}></div>

      {/* PAGINA 2: TABLA DE RESULTADOS DETALLADA */}
      <div className="bg-white text-black p-8 flex flex-col justify-between" style={{ width: '1122px', height: '790px', boxSizing: 'border-box', overflow: 'hidden' }}>
        <div>
          {/* Header */}
          <div className="flex justify-between items-start border-b-4 border-[#C1121F] pb-4 mb-8">
            <div className="flex items-center gap-6">
              <img src="/club-logo.png" alt="Escudo" className="w-20 h-20 object-contain" />
              <div>
                <h1 className="text-3xl font-bold text-[#0f0f0f] uppercase tracking-wider">Reporte Comparativo GPS</h1>
                <p className="text-[#C1121F] font-semibold text-lg">Tabla de Resultados Detallada</p>
                <p className="text-gray-500 text-sm">UD Atzeneta · {new Date().toLocaleDateString('es-ES')}</p>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300 text-gray-700 uppercase font-bold text-xs">
                  <th className="py-4 px-4 w-1/4">Métrica</th>
                  {selectedItems.map((item, i) => (
                    <th key={item.id} className="py-4 px-4 text-center">
                      <span className="inline-block px-3 py-1.5 rounded text-white text-xs font-bold tracking-wide shadow-sm" style={{ backgroundColor: colors[i % colors.length] }}>
                        {getItemLabel(item)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((m, idx) => (
                  <tr key={m.key} className={`border-b border-gray-200 font-medium ${idx % 2 === 1 ? 'bg-white' : 'bg-gray-100/50'}`}>
                    <td className="py-3 px-4">
                      <span className="text-sm font-bold text-gray-800 block">
                        {m.label.split(' (')[0]}
                      </span>
                      {m.label.includes('(') && (
                        <span className="text-[10px] text-gray-500 font-semibold block mt-0.5">
                          Unidad: {m.label.split('(')[1].replace(')', '')}
                        </span>
                      )}
                    </td>
                    {selectedItems.map((item, i) => (
                      <td key={item.id} className="py-3 px-4 text-center">
                        <span className="text-base font-extrabold text-black">
                          {getMetricValueStr(item, m.key)}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-between items-center text-xs text-gray-400 font-semibold border-t pt-4">
          <span>UD Atzeneta — Departamento de Preparación Física</span>
          <span>Página 2 de 2</span>
        </div>
      </div>
    </div>
  );
};
