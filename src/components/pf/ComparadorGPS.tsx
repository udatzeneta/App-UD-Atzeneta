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

  // Aggregate metrics (average) for each selected player to compare
  const comparisonData = useMemo(() => {
    if (selectedPlayers.length === 0) return { radar: [], bars: [] };

    const radarData = metrics.map(m => {
      const dataPoint: any = { metric: m.label, fullMark: 100 };
      
      // Calculate max for normalization if needed, but for simple radar, just raw values or scaled
      // We will use raw averages
      selectedPlayers.forEach((player, index) => {
        const playerRecords = gpsRecords.filter(r => r.jugador_id === player.id && r[m.key] != null);
        const avg = playerRecords.length > 0 
          ? playerRecords.reduce((sum, r) => sum + Number(r[m.key] || 0), 0) / playerRecords.length
          : 0;
        dataPoint[`player_${index}`] = Number(avg.toFixed(2));
      });
      return dataPoint;
    });

    const barsData = metrics.map(m => {
      const dataPoint: any = { name: m.label };
      selectedPlayers.forEach((player, index) => {
        const playerRecords = gpsRecords.filter(r => r.jugador_id === player.id && r[m.key] != null);
        const avg = playerRecords.length > 0 
          ? playerRecords.reduce((sum, r) => sum + Number(r[m.key] || 0), 0) / playerRecords.length
          : 0;
        dataPoint[`player_${index}`] = Number(avg.toFixed(2));
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
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="space-y-6">
      <div className="bg-brand-black-card border border-brand-black-border p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-sm font-bold text-white mb-4">Seleccionar Jugadores (Máx 5)</h3>
          <div className="flex flex-wrap gap-2">
          {jugadores.map(j => (
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
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: '#888', fontSize: 10 }} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff', fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} formatter={(value, entry, index) => {
                      const p = selectedPlayers[index];
                      return p ? `${p.dorsal || '-'}. ${p.nickname || p.full_name}` : value;
                    }} />
                    {selectedPlayers.map((p, i) => (
                      <Radar
                        key={p.id}
                        name={p.nickname || p.full_name}
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
                    <XAxis type="number" tick={{ fill: '#888', fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#888', fontSize: 10 }} width={100} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff', fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} formatter={(value, entry, index) => {
                      const p = selectedPlayers[index];
                      return p ? `${p.dorsal || '-'}. ${p.nickname || p.full_name}` : value;
                    }} />
                    {selectedPlayers.map((p, i) => (
                      <Bar key={p.id} dataKey={`player_${i}`} name={p.nickname || p.full_name} fill={COLORS[i % COLORS.length]} radius={[0, 4, 4, 0]} />
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
