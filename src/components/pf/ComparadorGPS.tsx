import React, { useState, useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Download } from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { ComparadorPrintView } from './ComparadorPrintView';

interface ComparadorGPSProps {
  jugadores: any[];
  gpsRecords: any[];
  metrics: { key: string; label: string; color: string }[];
}

const COLORS = ['#CC0000', '#2563EB', '#16A34A', '#D97706', '#7C3AED'];

export const ComparadorGPS: React.FC<ComparadorGPSProps> = ({ jugadores, gpsRecords, metrics }) => {
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [plantilla, setPlantilla] = useState<'Primer Equipo' | 'Juvenil'>('Primer Equipo');
  
  const filteredJugadores = useMemo(() => 
    jugadores.filter(j => (j.team_category || 'Primer Equipo') === plantilla),
  [jugadores, plantilla]);

  // Toggle selection
  const handlePlayerToggle = (id: string) => {
    if (selectedPlayerIds.includes(id)) {
      setSelectedPlayerIds(prev => prev.filter(pId => pId !== id));
    } else {
      if (selectedPlayerIds.length < 5) {
        setSelectedPlayerIds(prev => [...prev, id]);
      }
    }
  };

  const selectedPlayers = useMemo(() => 
    jugadores.filter(j => selectedPlayerIds.includes(j.id)),
  [jugadores, selectedPlayerIds]);

  const comparisonData = useMemo(() => {
    if (selectedPlayers.length === 0) return { radar: [], bars: [] };

    // Calcular los máximos globales de TODO el equipo para tener una referencia absoluta
    const globalMax: Record<string, number> = {};
    metrics.forEach(m => {
      const allVals = gpsRecords.map(r => Number(r[m.key] || 0));
      globalMax[m.key] = Math.max(...allVals, 0);
    });

    const computeAverages = (m: any) => {
      return selectedPlayers.map(player => {
        const playerRecords = gpsRecords.filter(r => r.jugador_id === player.id && r[m.key] != null);
        return playerRecords.length > 0 
          ? playerRecords.reduce((sum, r) => sum + Number(r[m.key] || 0), 0) / playerRecords.length
          : 0;
      });
    };

    const radarData = metrics.map(m => {
      const dataPoint: any = { metric: m.label, fullMark: 100 };
      const averages = computeAverages(m);
      const maxVal = globalMax[m.key];
      const reference = maxVal > 0 ? maxVal : 1;
      
      selectedPlayers.forEach((player, index) => {
        const raw = averages[index];
        dataPoint[`player_${index}`] = Number(((raw / reference) * 100).toFixed(1));
        dataPoint[`raw_player_${index}`] = Number(raw.toFixed(2));
      });
      return dataPoint;
    });

    const barsData = metrics.map(m => {
      const dataPoint: any = { name: m.label };
      const averages = computeAverages(m);
      const maxVal = globalMax[m.key];
      const reference = maxVal > 0 ? maxVal : 1;

      selectedPlayers.forEach((player, index) => {
        const raw = averages[index];
        dataPoint[`player_${index}`] = Number(((raw / reference) * 100).toFixed(1));
        dataPoint[`raw_player_${index}`] = Number(raw.toFixed(2));
      });
      return dataPoint;
    });

    return { radar: radarData, bars: barsData };
  }, [selectedPlayers, gpsRecords, metrics]);

  const handleDownloadPDF = () => {
    const element = document.getElementById('pdf-comparador-container');
    if (!element) return;

    const filename = `Comparador_GPS_${new Date().toISOString().split('T')[0]}.pdf`;

    const opt = {
      margin:       0,
      filename:     filename,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' as const }
    };

    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="space-y-6">
      <div className="bg-brand-black-card border border-brand-black-border p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
            <h3 className="text-sm font-bold text-white">Seleccionar Jugadores (Máx 5)</h3>
            <select
              className="bg-brand-black border border-brand-black-border text-brand-gray-light text-sm rounded-lg focus:ring-brand-red-600 focus:border-brand-red-600 p-2 outline-none"
              value={plantilla}
              onChange={(e) => setPlantilla(e.target.value as any)}
            >
              <option value="Primer Equipo">Primer Equipo</option>
              <option value="Juvenil">Juvenil</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
          {filteredJugadores.map(j => (
            <button
              key={j.id}
              onClick={() => handlePlayerToggle(j.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                selectedPlayerIds.includes(j.id) 
                  ? 'bg-brand-red-600 border-brand-red-600 text-white shadow-glow-red' 
                  : 'bg-brand-black border-brand-black-border text-brand-gray-muted hover:text-white'
              }`}
            >
              {j.dorsal ? `${j.dorsal}. ` : ''}{j.nickname || j.full_name}
            </button>
          ))}
          </div>
        </div>
        {selectedPlayers.length > 0 && (
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 bg-brand-red-600 hover:bg-brand-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-glow-red transition-colors shrink-0"
          >
            <Download className="w-4 h-4" />
            Exportar PDF
          </button>
        )}
      </div>

      {selectedPlayers.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {selectedPlayers.map((p, i) => (
              <div key={p.id} className="bg-brand-black-card border border-brand-black-border rounded-xl p-4 flex flex-col items-center text-center">
                <div className="relative w-16 h-16 rounded-full overflow-hidden mb-3 border-2" style={{ borderColor: COLORS[i % COLORS.length] }}>
                  {p.photo_url ? (
                    <img src={p.photo_url} alt={p.nickname || p.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-brand-black flex items-center justify-center text-xl font-bold text-brand-gray-muted">
                      {p.dorsal || '-'}
                    </div>
                  )}
                </div>
                <div className="text-sm font-bold text-white leading-tight">{p.dorsal ? `${p.dorsal}. ` : ''}{p.nickname || p.full_name}</div>
                <div className="text-xs text-brand-gray-muted">{p.posicion || 'Jugador'}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-4">
              <h4 className="text-sm font-bold text-brand-gray-light mb-4 text-center">Radar Comparativo (Medias)</h4>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={comparisonData.radar}>
                    <PolarGrid stroke="#333" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#888', fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#888', fontSize: 10 }} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff', fontSize: 12, borderRadius: 8 }} 
                      formatter={(value, name, props) => {
                        const dataKey = props.dataKey as string;
                        if (dataKey && dataKey.startsWith('player_')) {
                          const rawKey = `raw_${dataKey}`;
                          const rawValue = props.payload[rawKey];
                          return [`${rawValue} (${value}%)`, name];
                        }
                        return [value, name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    {selectedPlayers.map((p, i) => (
                      <Radar
                        key={p.id}
                        name={`${p.dorsal ? `${p.dorsal}. ` : ''}${p.nickname || p.full_name}`}
                        dataKey={`player_${i}`}
                        stroke={COLORS[i % COLORS.length]}
                        fill={COLORS[i % COLORS.length]}
                        fillOpacity={0.3}
                      />
                    ))}
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-4">
              <h4 className="text-sm font-bold text-brand-gray-light mb-4 text-center">Barras Comparativas</h4>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData.bars} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={true} vertical={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#888', fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#888', fontSize: 10 }} width={100} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff', fontSize: 12, borderRadius: 8 }} 
                      formatter={(value, name, props) => {
                        const dataKey = props.dataKey as string;
                        if (dataKey && dataKey.startsWith('player_')) {
                          const rawKey = `raw_${dataKey}`;
                          const rawValue = props.payload[rawKey];
                          return [`${rawValue} (${value}%)`, name];
                        }
                        return [value, name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    {selectedPlayers.map((p, i) => (
                      <Bar key={p.id} dataKey={`player_${i}`} name={`${p.dorsal ? `${p.dorsal}. ` : ''}${p.nickname || p.full_name}`} fill={COLORS[i % COLORS.length]} radius={[0, 4, 4, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-12 text-center">
          <p className="text-brand-gray-muted">Selecciona al menos un jugador para empezar a comparar.</p>
        </div>
      )}

      {/* Hidden Print View */}
      {selectedPlayers.length > 0 && (
        <div style={{ position: 'absolute', top: '-10000px', left: 0, zIndex: -1 }}>
          <div id="pdf-comparador-container">
            <ComparadorPrintView
              selectedPlayers={selectedPlayers}
              comparisonData={comparisonData}
              colors={COLORS}
            />
          </div>
        </div>
      )}
    </div>
  );
};
