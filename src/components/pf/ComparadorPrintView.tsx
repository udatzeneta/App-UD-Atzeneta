import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface ComparadorPrintViewProps {
  selectedPlayers: any[];
  comparisonData: { radar: any[]; bars: any[] };
  colors: string[];
}

export const ComparadorPrintView: React.FC<ComparadorPrintViewProps> = ({ selectedPlayers, comparisonData, colors }) => {
  if (selectedPlayers.length === 0) return null;

  return (
    <div id="pdf-comparador" className="bg-white text-black p-8" style={{ width: '1122px', height: '790px', overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex justify-between items-start border-b-4 border-[#C1121F] pb-4 mb-8">
        <div className="flex items-center gap-6">
          <img src="/club-logo.png" alt="Escudo" className="w-20 h-20 object-contain" />
          <div>
            <h1 className="text-3xl font-bold text-[#0f0f0f] uppercase tracking-wider">Reporte Comparativo GPS</h1>
            <p className="text-[#C1121F] font-semibold text-lg">{selectedPlayers.length} Jugadores Seleccionados</p>
            <p className="text-gray-500 text-sm">UD Atzeneta · {new Date().toLocaleDateString('es-ES')}</p>
          </div>
        </div>
        <div className="flex gap-4">
          {selectedPlayers.map((p, i) => (
            <div key={p.id} className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full overflow-hidden border-4 shrink-0" style={{ borderColor: colors[i % colors.length] }}>
                {p.photo_url ? (
                  <img src={p.photo_url} alt={p.nickname || p.full_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-400">
                    {p.dorsal || '-'}
                  </div>
                )}
              </div>
              <div className="text-[11px] font-bold mt-2 w-24 text-center leading-tight pb-1">
                {p.dorsal ? `${p.dorsal}. ` : ''}{p.nickname || p.full_name}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Radar Chart */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <h4 className="text-lg font-bold text-[#0f0f0f] mb-6 text-center uppercase tracking-wide">Balance Global (Medias)</h4>
          <div className="flex justify-center">
            <RadarChart width={450} height={400} cx="50%" cy="50%" outerRadius="70%" data={comparisonData.radar}>
              <PolarGrid stroke="#d1d5db" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#4b5563', fontSize: 11, fontWeight: 'bold' }} />
              <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Legend wrapperStyle={{ fontSize: '13px', fontWeight: 'bold' }} formatter={(value, entry, index) => {
                const p = selectedPlayers[index];
                return p ? `${p.dorsal || '-'}. ${p.nickname || p.full_name}` : value;
              }} />
              {selectedPlayers.map((p, i) => (
                <Radar
                  isAnimationActive={false}
                  key={p.id}
                  name={p.nickname || p.full_name}
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
              <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#4b5563', fontSize: 11, fontWeight: 'bold' }} width={120} />
              <Legend wrapperStyle={{ fontSize: '13px', fontWeight: 'bold' }} formatter={(value, entry, index) => {
                const p = selectedPlayers[index];
                return p ? `${p.dorsal || '-'}. ${p.nickname || p.full_name}` : value;
              }} />
              {selectedPlayers.map((p, i) => (
                <Bar isAnimationActive={false} key={p.id} dataKey={`player_${i}`} name={p.nickname || p.full_name} fill={colors[i % colors.length]} radius={[0, 4, 4, 0]} />
              ))}
            </BarChart>
          </div>
        </div>
      </div>
    </div>
  );
};
