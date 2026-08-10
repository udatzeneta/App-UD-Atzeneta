import React, { useState, useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Download } from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { ComparadorPrintView } from './ComparadorPrintView';

interface ComparadorGPSProps {
  jugadores: any[];
  gpsRecords: any[];
  entrenamientos: any[];
  partidos: any[];
  metrics: { key: string; label: string; color: string }[];
}

const COLORS = ['#CC0000', '#2563EB', '#16A34A', '#D97706', '#7C3AED'];

export const ComparadorGPS: React.FC<ComparadorGPSProps> = ({ jugadores, gpsRecords, entrenamientos, partidos, metrics }) => {
  const [selectedItems, setSelectedItems] = useState<{
    id: string;
    playerId: string;
    gpsRecordId: string;
  }[]>([
    { id: '1', playerId: '', gpsRecordId: '' },
    { id: '2', playerId: '', gpsRecordId: '' }
  ]);
  const [plantilla, setPlantilla] = useState<'Primer Equipo' | 'Juvenil'>('Primer Equipo');
  
  const filteredJugadores = useMemo(() => 
    jugadores.filter(j => (j.team_category || 'Primer Equipo') === plantilla),
  [jugadores, plantilla]);

  const activeItems = useMemo(() => 
    selectedItems.filter(item => item.playerId !== ''),
  [selectedItems]);

  const getItemLabel = (item: typeof selectedItems[0]) => {
    const player = jugadores.find(j => j.id === item.playerId);
    if (!player) return 'Jugador';
    const playerNick = player.nickname || player.full_name;
    const dorsalStr = player.dorsal ? `${player.dorsal}. ` : '';
    
    if (item.gpsRecordId === '') {
      return `${dorsalStr}${playerNick} (Media)`;
    } else {
      const record = gpsRecords.find(r => r.id === item.gpsRecordId);
      if (!record) return `${dorsalStr}${playerNick}`;
      
      const session = record.session_type === 'entrenamiento'
        ? entrenamientos.find(e => e.id === record.session_id)
        : partidos.find(p => p.id === record.session_id);
      
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

  const getPlayerSessions = (playerId: string) => {
    if (!playerId) return [];
    return gpsRecords
      .filter(r => r.jugador_id === playerId)
      .map(r => {
        const session = r.session_type === 'entrenamiento'
          ? entrenamientos.find(e => e.id === r.session_id)
          : partidos.find(p => p.id === r.session_id);
        const dateStr = session?.date || session?.fecha || '';
        return { ...r, dateStr, session };
      })
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return dateStr;
    return `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;
  };

  const comparisonData = useMemo(() => {
    if (activeItems.length === 0) return { radar: [], bars: [] };

    // Calcular los máximos globales de TODO el equipo para tener una referencia absoluta
    const globalMax: Record<string, number> = {};
    metrics.forEach(m => {
      const allVals = gpsRecords.map(r => Number(r[m.key] || 0));
      globalMax[m.key] = Math.max(...allVals, 0);
    });

    const computeValues = (m: any) => {
      return activeItems.map(item => {
        if (item.gpsRecordId === '') {
          // Media global
          const playerRecords = gpsRecords.filter(r => r.jugador_id === item.playerId && r[m.key] != null);
          return playerRecords.length > 0 
            ? playerRecords.reduce((sum, r) => sum + Number(r[m.key] || 0), 0) / playerRecords.length
            : 0;
        } else {
          // Sesión específica
          const record = gpsRecords.find(r => r.id === item.gpsRecordId);
          return record ? Number(record[m.key] || 0) : 0;
        }
      });
    };

    const radarData = metrics.map(m => {
      const dataPoint: any = { metric: m.label, fullMark: 100 };
      const values = computeValues(m);
      const maxVal = globalMax[m.key];
      const reference = maxVal > 0 ? maxVal : 1;
      
      activeItems.forEach((item, index) => {
        const raw = values[index];
        dataPoint[`player_${index}`] = Number(((raw / reference) * 100).toFixed(1));
        dataPoint[`raw_player_${index}`] = Number(raw.toFixed(2));
      });
      return dataPoint;
    });

    const barsData = metrics.map(m => {
      const dataPoint: any = { name: m.label };
      const values = computeValues(m);
      const maxVal = globalMax[m.key];
      const reference = maxVal > 0 ? maxVal : 1;

      activeItems.forEach((item, index) => {
        const raw = values[index];
        dataPoint[`player_${index}`] = Number(((raw / reference) * 100).toFixed(1));
        dataPoint[`raw_player_${index}`] = Number(raw.toFixed(2));
      });
      return dataPoint;
    });

    return { radar: radarData, bars: barsData };
  }, [activeItems, gpsRecords, metrics]);

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
      <div className="bg-brand-black-card border border-brand-black-border p-5 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-brand-black-border pb-3 gap-4">
          <div>
            <h3 className="text-sm font-bold text-white">Configuración del Comparador GPS</h3>
            <p className="text-[11px] text-brand-gray-muted mt-0.5 font-medium">Añade hasta 5 jugadores y selecciona una sesión específica o su media global</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              className="bg-brand-black border border-brand-black-border text-brand-gray-light text-xs rounded-lg focus:ring-brand-red-600 focus:border-brand-red-600 p-2 outline-none"
              value={plantilla}
              onChange={(e) => setPlantilla(e.target.value as any)}
            >
              <option value="Primer Equipo">Primer Equipo</option>
              <option value="Juvenil">Juvenil</option>
            </select>
            {activeItems.length > 0 && (
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 bg-brand-red-600 hover:bg-brand-red-700 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-glow-red transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar PDF
              </button>
            )}
          </div>
        </div>

        {/* List of items */}
        <div className="space-y-3">
          {selectedItems.map((item, index) => {
            const playerSessions = getPlayerSessions(item.playerId);
            return (
              <div 
                key={item.id} 
                className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-brand-black/20 p-3 rounded-lg border border-brand-black-border/60"
              >
                {/* Indicador de Color */}
                <div 
                  className="w-1.5 rounded-full shrink-0 hidden md:block" 
                  style={{ backgroundColor: COLORS[index % COLORS.length], height: '38px' }} 
                />
                
                {/* Selector de Jugador */}
                <div className="flex-1">
                  <label className="text-[9px] font-bold text-brand-gray-muted uppercase block mb-1">Futbolista</label>
                  <select
                    value={item.playerId}
                    onChange={(e) => {
                      const newItems = [...selectedItems];
                      newItems[index].playerId = e.target.value;
                      newItems[index].gpsRecordId = ''; // reset session
                      setSelectedItems(newItems);
                    }}
                    className="bg-brand-black border border-brand-black-border text-white text-xs rounded-lg focus:ring-brand-red-600 focus:border-brand-red-600 p-2 outline-none w-full"
                  >
                    <option value="">-- Seleccionar Jugador --</option>
                    {filteredJugadores.map(j => (
                      <option key={j.id} value={j.id}>
                        {j.dorsal ? `(${j.dorsal}) ` : ''}{j.nickname || j.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selector de Sesión */}
                <div className="flex-1">
                  <label className="text-[9px] font-bold text-brand-gray-muted uppercase block mb-1">Sesión / Tipo de dato</label>
                  <select
                    disabled={!item.playerId}
                    value={item.gpsRecordId}
                    onChange={(e) => {
                      const newItems = [...selectedItems];
                      newItems[index].gpsRecordId = e.target.value;
                      setSelectedItems(newItems);
                    }}
                    className="bg-brand-black border border-brand-black-border text-white text-xs rounded-lg focus:ring-brand-red-600 focus:border-brand-red-600 p-2 outline-none w-full disabled:opacity-50"
                  >
                    <option value="">Media de todas las sesiones</option>
                    {playerSessions.map(r => {
                      const typeStr = r.session_type === 'entrenamiento' ? 'Entrenamiento' : 'Partido';
                      const rivalStr = r.session_type === 'partido' && r.session?.rival ? `vs ${r.session.rival}` : '';
                      return (
                        <option key={r.id} value={r.id}>
                          {formatDate(r.dateStr)} - {typeStr} {rivalStr}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Botón Eliminar */}
                <div className="flex items-end shrink-0 pt-3 md:pt-0">
                  <button
                    type="button"
                    disabled={selectedItems.length <= 1}
                    onClick={() => {
                      setSelectedItems(selectedItems.filter(x => x.id !== item.id));
                    }}
                    className="p-2 text-brand-gray-muted hover:text-brand-red-600 bg-brand-black border border-brand-black-border rounded-lg transition-colors hover:border-brand-red-600/40 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Eliminar de la comparación"
                  >
                    <span className="text-xs font-bold px-1">Quitar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add more button */}
        {selectedItems.length < 5 && (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => setSelectedItems([...selectedItems, { id: Math.random().toString(36).substr(2, 9), playerId: '', gpsRecordId: '' }])}
              className="bg-brand-black border border-brand-black-border hover:border-brand-gray-dark text-brand-gray-light hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            >
              + Añadir Jugador / Sesión
            </button>
          </div>
        )}
      </div>

      {activeItems.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {activeItems.map((item, i) => {
              const p = jugadores.find(j => j.id === item.playerId);
              if (!p) return null;
              
              const record = gpsRecords.find(r => r.id === item.gpsRecordId);
              let sessionLabel = 'Media de todas las sesiones';
              if (record) {
                const session = record.session_type === 'entrenamiento'
                  ? entrenamientos.find(e => e.id === record.session_id)
                  : partidos.find(p => p.id === record.session_id);
                const typeStr = record.session_type === 'entrenamiento' ? 'Entrenamiento' : 'Partido';
                const rivalStr = record.session_type === 'partido' && session?.rival ? ` vs ${session.rival}` : '';
                sessionLabel = `${typeStr} - ${formatDate(session?.date || session?.fecha || '')} ${rivalStr}`;
              }

              return (
                <div key={item.id} className="bg-brand-black-card border border-brand-black-border rounded-xl p-4 flex flex-col items-center text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  
                  <div className="relative w-14 h-14 rounded-full overflow-hidden mb-3 border-2 mt-2" style={{ borderColor: COLORS[i % COLORS.length] }}>
                    {p.photo_url ? (
                      <img src={p.photo_url} alt={p.nickname || p.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-brand-black flex items-center justify-center text-lg font-bold text-brand-gray-muted">
                        {p.dorsal || '-'}
                      </div>
                    )}
                  </div>
                  <div className="text-xs font-bold text-white leading-tight">{p.dorsal ? `${p.dorsal}. ` : ''}{p.nickname || p.full_name}</div>
                  <div className="text-[10px] text-brand-gray-muted font-medium mt-1 truncate max-w-full" title={sessionLabel}>
                    {sessionLabel}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-4">
              <h4 className="text-sm font-bold text-brand-gray-light mb-4 text-center">Radar Comparativo</h4>
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
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    {activeItems.map((item, i) => (
                      <Radar
                        key={item.id}
                        name={getItemLabel(item)}
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
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    {activeItems.map((item, i) => (
                      <Bar 
                        key={item.id} 
                        dataKey={`player_${i}`} 
                        name={getItemLabel(item)} 
                        fill={COLORS[i % COLORS.length]} 
                        radius={[0, 4, 4, 0]} 
                      />
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
      {activeItems.length > 0 && (
        <div style={{ position: 'absolute', top: '-10000px', left: 0, zIndex: -1 }}>
          <div id="pdf-comparador-container">
            <ComparadorPrintView
              selectedItems={activeItems}
              jugadores={jugadores}
              gpsRecords={gpsRecords}
              entrenamientos={entrenamientos}
              partidos={partidos}
              comparisonData={comparisonData}
              colors={COLORS}
            />
          </div>
        </div>
      )}
    </div>
  );
};
