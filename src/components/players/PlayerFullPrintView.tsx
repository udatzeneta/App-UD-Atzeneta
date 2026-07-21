import React from 'react';
import { ZONE_LABELS } from '../BodyMap';

interface PlayerFullPrintViewProps {
  player: any;
  stats: {
    matchesPlayed: number;
    minutesPlayed: number;
    goals: number;
    assists: number;
    yellows: number;
    reds: number;
    attendanceRate: string;
  };
  injuries: any[];
  physioRecords: any[];
  weights: any[];
  gpsRecords: any[];
  topPositions: any[];
  filteredMatchStats?: any[];
  matches?: any[];
  filteredAttendance?: any[];
  trainings?: any[];
}

function formatDate(iso: string) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

export const PlayerFullPrintView: React.FC<PlayerFullPrintViewProps> = ({
  player, stats, injuries, physioRecords, weights, gpsRecords, topPositions,
  filteredMatchStats = [], matches = [], filteredAttendance = [], trainings = []
}) => {
  if (!player) return null;

  const activeInjuries = injuries.filter(i => i.status !== 'Recuperado');
  const pastInjuries = injuries.filter(i => i.status === 'Recuperado').slice(0, 5); // top 5 past injuries
  
  // BMI calculation
  const latestWeight = weights.length > 0 ? weights[weights.length - 1].weight : player?.weight;
  let bmi = 0;
  if (latestWeight && player.height) {
    let heightInMeters = parseFloat(player.height);
    if (heightInMeters > 3) heightInMeters = heightInMeters / 100;
    bmi = parseFloat(latestWeight) / (heightInMeters * heightInMeters);
  }

  // GPS Metrics
  const maxSprints = gpsRecords.length > 0 ? Math.max(...gpsRecords.map(r => parseFloat(r.sprints) || 0)) : 0;
  const maxAccel = gpsRecords.length > 0 ? Math.max(...gpsRecords.map(r => parseFloat(r.aceleraciones) || 0)) : 0;
  const maxSpeed = gpsRecords.length > 0 ? Math.max(...gpsRecords.map(r => parseFloat(r.velocidad_maxima) || 0)) : 0;
  const maxDist = gpsRecords.length > 0 ? Math.max(...gpsRecords.map(r => parseFloat(r.distancia_total) || 0)) : 0;

  return (
    <div id="pdf-player-full-report" className="bg-white text-black font-sans mx-auto" style={{ width: '794px' }}>
      
      {/* ======================= PÁGINA 1 ======================= */}
      <div className="p-8 flex flex-col" style={{ width: '794px', minHeight: '1122px', position: 'relative' }}>
        
        {/* Header */}
        <div className="flex justify-between items-start border-b-4 border-[#C1121F] pb-4 mb-6">
          <div className="flex items-center gap-6">
            <img src="/club-logo.png" alt="Escudo" className="w-20 h-20 object-contain" />
            <div>
              <h1 className="text-3xl font-black text-[#0f0f0f] uppercase tracking-tighter leading-none mb-1">Informe Individual</h1>
              <p className="text-[#C1121F] font-bold text-lg uppercase tracking-widest">
                U.D. ATZENETA DE CASTELLÓN
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Temporada 2026/2027</span>
            <div className="bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 inline-block">
              <span className="text-[10px] text-gray-500 uppercase font-bold block leading-none mb-1">Generado</span>
              <span className="text-sm font-black text-[#0f0f0f] leading-none block">{new Date().toLocaleDateString('es-ES')}</span>
            </div>
          </div>
        </div>

        {/* Perfil Biométrico */}
        <div className="flex gap-6 bg-gray-50 border border-gray-200 p-5 rounded-2xl mb-8">
          <div className="w-32 h-32 shrink-0 rounded-xl overflow-hidden border-2 border-[#C1121F] bg-white flex items-center justify-center relative">
            {player.photo_url ? (
              <img src={player.photo_url} alt={player.full_name} className="w-full h-full object-cover" crossOrigin="anonymous" />
            ) : (
              <div className="text-4xl font-black text-gray-300">{(player.nickname || player.full_name)[0]}</div>
            )}
            {player.dorsal && (
              <div className="absolute top-0 right-0 bg-[#C1121F] text-white text-xs font-black px-2 py-0.5 rounded-bl-lg">
                #{player.dorsal}
              </div>
            )}
          </div>
          
          <div className="flex-1 grid grid-cols-2 gap-y-3 gap-x-4">
            <div className="col-span-2 border-b border-gray-200 pb-2 mb-1">
              <h2 className="text-2xl font-black text-[#0f0f0f] leading-tight uppercase tracking-tight">{player.nickname || player.full_name}</h2>
              {player.nickname && <p className="text-xs text-gray-500 font-bold uppercase">{player.full_name}</p>}
            </div>
            
            <div>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Demarcación</span>
              <span className="text-sm font-bold text-gray-900">{player.position || '—'}</span>
            </div>
            <div>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Estado Físico</span>
              <span className={`text-xs font-black uppercase px-2 py-0.5 rounded-full inline-block mt-0.5 ${player.physical_status === 'Disponible' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {player.physical_status || 'Disponible'}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Estatura / Peso</span>
              <span className="text-sm font-bold text-gray-900">{player.height ? `${player.height} cm` : '—'} / {latestWeight ? `${latestWeight} kg` : '—'}</span>
            </div>
            <div>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Pie Dominante</span>
              <span className="text-sm font-bold text-gray-900">{player.dominant_foot || '—'}</span>
            </div>
          </div>
        </div>

        {/* Rendimiento Deportivo */}
        <div>
          <h3 className="text-sm font-black text-[#0f0f0f] bg-gray-100 py-1.5 px-3 rounded uppercase tracking-wider mb-4 border-l-4 border-[#C1121F]">
            Rendimiento Deportivo Global
          </h3>
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-white border border-gray-200 p-3 rounded-xl text-center shadow-sm">
              <span className="text-[9px] text-gray-500 uppercase font-black block mb-1">Partidos</span>
              <span className="text-2xl font-black text-gray-900">{stats.matchesPlayed}</span>
            </div>
            <div className="bg-white border border-gray-200 p-3 rounded-xl text-center shadow-sm">
              <span className="text-[9px] text-gray-500 uppercase font-black block mb-1">Minutos</span>
              <span className="text-2xl font-black text-gray-900">{stats.minutesPlayed}'</span>
            </div>
            <div className="bg-white border border-gray-200 p-3 rounded-xl text-center shadow-sm">
              <span className="text-[9px] text-gray-500 uppercase font-black block mb-1">Goles / Asist.</span>
              <span className="text-2xl font-black text-[#C1121F]">{stats.goals} / {stats.assists}</span>
            </div>
            <div className="bg-white border border-gray-200 p-3 rounded-xl text-center shadow-sm">
              <span className="text-[9px] text-gray-500 uppercase font-black block mb-1">% Asistencia</span>
              <span className="text-2xl font-black text-emerald-600">{stats.attendanceRate}%</span>
            </div>
          </div>

          {/* Posiciones */}
          {topPositions.length > 0 && (
            <div className="mb-6">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-3">Distribución de Posiciones</h4>
              <div className="flex gap-4">
                {topPositions.map(p => (
                  <div key={p.pos} className="flex-1 bg-gray-50 border border-gray-200 p-3 rounded-lg">
                    <div className="flex justify-between items-end mb-1.5">
                      <span className="text-xs font-black text-gray-900">{p.pos}</span>
                      <span className="text-[10px] font-bold text-gray-500">{p.percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                      <div className="h-full bg-[#C1121F]" style={{ width: `${p.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gráficas Evolución */}
          <div className="grid grid-cols-2 gap-4">
            {/* Gráfica Partidos */}
            {(() => {
              const sortedStats = [...filteredMatchStats].map(s => {
                const match = matches.find(m => m.id === s.match_id);
                return { ...s, date: match?.date || '?', matchday: match?.matchday || '?', rival: match?.rival || '?' };
              }).sort((a, b) => {
                if (a.date === '?' || b.date === '?') return 0;
                return new Date(a.date).getTime() - new Date(b.date).getTime();
              });
              
              if (sortedStats.length === 0) return null;

              const svgW = 350; const svgH = 140; const padX = 30; const padY = 20;
              const chartW = svgW - 2 * padX; const chartH = svgH - 2 * padY;
              const maxMins = 90;
              
              const points = sortedStats.map((s, idx) => {
                const x = padX + (idx / Math.max(sortedStats.length - 1, 1)) * chartW;
                const y = padY + chartH - ((s.minutes_played || 0) / maxMins) * chartH;
                return { x, y, minutes: s.minutes_played || 0, label: `J.${s.matchday}`, rival: s.rival, goals: s.goals || 0, assists: s.assists || 0, yellows: s.yellow_cards || 0, reds: s.red_card || 0 };
              });
              const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

              return (
                <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl overflow-hidden">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] text-gray-500 uppercase font-black">Evolución Rendimiento</span>
                  </div>
                  <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="overflow-visible">
                    {[0, 0.5, 1].map((ratio, i) => {
                      const y = padY + chartH * ratio;
                      const mVal = (maxMins - ratio * maxMins).toFixed(0);
                      return (
                        <g key={i} className="opacity-40">
                          <line x1={padX} y1={y} x2={padX + chartW} y2={y} stroke="#d1d5db" strokeDasharray="3,3" />
                          <text x={padX - 5} y={y + 3} fill="#6b7280" fontSize="8" textAnchor="end">{mVal}'</text>
                        </g>
                      );
                    })}
                    {points.map((p, idx) => {
                      const barW = 4; const pxPerUnit = 8;
                      return (
                        <g key={`bars-${idx}`}>
                          {p.goals > 0 && <rect x={p.x - 10} y={padY + chartH - (p.goals * pxPerUnit)} width={barW} height={p.goals * pxPerUnit} fill="#10b981" rx="1" />}
                          {p.assists > 0 && <rect x={p.x - 4} y={padY + chartH - (p.assists * pxPerUnit)} width={barW} height={p.assists * pxPerUnit} fill="#818cf8" rx="1" />}
                          {p.yellows > 0 && <rect x={p.x + 2} y={padY + chartH - (p.yellows * pxPerUnit)} width={barW} height={p.yellows * pxPerUnit} fill="#eab308" rx="1" />}
                          {p.reds > 0 && <rect x={p.x + 8} y={padY + chartH - (p.reds * pxPerUnit)} width={barW} height={p.reds * pxPerUnit} fill="#ef4444" rx="1" />}
                        </g>
                      );
                    })}
                    {points.length > 1 && <path d={pathData} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
                    {points.map((p, idx) => (
                      <g key={idx}>
                        <circle cx={p.x} cy={p.y} r="2.5" fill="#fff" stroke="#3b82f6" strokeWidth="1.5" />
                        <text x={p.x} y={padY + chartH + 10} fill="#6b7280" fontSize="7" textAnchor="middle">{p.label}</text>
                      </g>
                    ))}
                  </svg>
                </div>
              );
            })()}

            {/* Gráfica Asistencia */}
            {(() => {
              if (filteredAttendance.length === 0) return null;
              const attWithDate = filteredAttendance.map(a => {
                const t = trainings.find(tr => tr.id === a.training_id);
                return { ...a, date: t?.date || '?' };
              }).filter(a => a.date !== '?').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              if (attWithDate.length === 0) return null;

              const byMonth: Record<string, { total: number, attended: number }> = {};
              attWithDate.forEach(a => {
                const monthStr = a.date.substring(0, 7);
                if (!byMonth[monthStr]) byMonth[monthStr] = { total: 0, attended: 0 };
                byMonth[monthStr].total++;
                if (a.status === 'Entrena') byMonth[monthStr].attended++;
              });
              const months = Object.keys(byMonth).sort();
              if (months.length === 0) return null;

              const svgW = 350; const svgH = 140; const padX = 30; const padY = 20;
              const chartW = svgW - 2 * padX; const chartH = svgH - 2 * padY;

              const points = months.map((m, idx) => {
                const data = byMonth[m];
                const pct = data.total > 0 ? (data.attended / data.total) * 100 : 0;
                const x = padX + (idx / Math.max(months.length - 1, 1)) * chartW;
                const y = padY + chartH - (pct / 100) * chartH;
                const [yy, mm] = m.split('-');
                return { x, y, pct: Math.round(pct), label: `${mm}/${yy.substring(2)}` };
              });
              const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

              return (
                <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl overflow-hidden">
                  <span className="text-[9px] text-gray-500 uppercase font-black block mb-2">Evolución Asistencia (%)</span>
                  <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="overflow-visible">
                    {[0, 0.5, 1].map((ratio, i) => {
                      const y = padY + chartH * ratio;
                      const pct = (100 - ratio * 100).toFixed(0);
                      return (
                        <g key={i} className="opacity-40">
                          <line x1={padX} y1={y} x2={padX + chartW} y2={y} stroke="#d1d5db" strokeDasharray="3,3" />
                          <text x={padX - 5} y={y + 3} fill="#6b7280" fontSize="8" textAnchor="end">{pct}%</text>
                        </g>
                      );
                    })}
                    {points.length > 1 && <path d={pathData} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
                    {points.map((p, idx) => (
                      <g key={idx}>
                        <circle cx={p.x} cy={p.y} r="2.5" fill="#fff" stroke="#10b981" strokeWidth="1.5" />
                        <text x={p.x} y={p.y - 6} fill="#059669" fontSize="7" textAnchor="middle" fontWeight="bold">{p.pct}%</text>
                        <text x={p.x} y={padY + chartH + 10} fill="#6b7280" fontSize="7" textAnchor="middle">{p.label}</text>
                      </g>
                    ))}
                  </svg>
                </div>
              );
            })()}
          </div>
        </div>
        
        {/* Footer Pagina 1 */}
        <div className="absolute bottom-8 left-8 right-8 text-center border-t border-gray-200 pt-3">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Documento Interno y Confidencial — Página 1/2</span>
        </div>
      </div>

      {/* Salto de página */}
      <div className="html2pdf__page-break"></div>

      {/* ======================= PÁGINA 2 ======================= */}
      <div className="p-8 flex flex-col" style={{ width: '794px', minHeight: '1122px', position: 'relative', pageBreakBefore: 'always' }}>
        
        {/* Header Reducido */}
        <div className="flex justify-between items-center border-b-2 border-gray-200 pb-3 mb-6">
          <h2 className="text-lg font-black text-[#0f0f0f] uppercase tracking-wider">{player.nickname || player.full_name} — Salud y Prep. Física</h2>
          <span className="text-[10px] font-bold text-gray-400 uppercase">U.D. Atzeneta</span>
        </div>

        {/* Preparación Física GPS */}
        <div className="mb-8">
          <h3 className="text-sm font-black text-[#0f0f0f] bg-gray-100 py-1.5 px-3 rounded uppercase tracking-wider mb-4 border-l-4 border-[#C1121F]">
            Preparación Física (GPS Peaks)
          </h3>
          
          {gpsRecords.length > 0 ? (
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl text-center">
                <span className="text-[9px] text-indigo-800/60 uppercase font-black block mb-1">Distancia Max.</span>
                <span className="text-xl font-black text-indigo-700">{maxDist} <span className="text-xs">m</span></span>
              </div>
              <div className="bg-red-50 border border-red-100 p-3 rounded-xl text-center">
                <span className="text-[9px] text-red-800/60 uppercase font-black block mb-1">Velocidad Max.</span>
                <span className="text-xl font-black text-red-700">{maxSpeed} <span className="text-xs">km/h</span></span>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl text-center">
                <span className="text-[9px] text-emerald-800/60 uppercase font-black block mb-1">Sprints Max.</span>
                <span className="text-xl font-black text-emerald-700">{maxSprints}</span>
              </div>
              <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl text-center">
                <span className="text-[9px] text-amber-800/60 uppercase font-black block mb-1">Aceleraciones Max.</span>
                <span className="text-xl font-black text-amber-700">{maxAccel}</span>
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-gray-500 italic p-4 bg-gray-50 rounded text-center">Sin registros GPS en la base de datos.</div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          {/* Historial de Peso / IMC */}
          <div>
            <h3 className="text-sm font-black text-[#0f0f0f] bg-gray-100 py-1.5 px-3 rounded uppercase tracking-wider mb-4 border-l-4 border-[#C1121F]">
              Control de Peso / IMC
            </h3>
            {bmi > 0 ? (
              <div className="bg-white border border-gray-200 p-4 rounded-xl flex items-center gap-4 shadow-sm">
                <div className="w-16 h-16 rounded-full border-4 border-emerald-500 flex items-center justify-center flex-col shrink-0">
                  <span className="text-xl font-black text-gray-900 leading-none">{bmi.toFixed(1)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-gray-400 uppercase block">IMC Actual</span>
                  <span className="text-sm font-bold text-gray-900 block mb-1">
                    {bmi < 18.5 ? 'Bajo Peso' : bmi < 25 ? 'Peso Saludable' : bmi < 30 ? 'Sobrepeso' : 'Obesidad'}
                  </span>
                  <span className="text-[9px] text-gray-500">Estimación basada en el último peso ({latestWeight}kg).</span>
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-gray-500 italic">Faltan datos de estatura y/o peso para calcular el IMC.</div>
            )}
          </div>

          {/* Fisioterapia Reciente */}
          <div>
            <h3 className="text-sm font-black text-[#0f0f0f] bg-gray-100 py-1.5 px-3 rounded uppercase tracking-wider mb-4 border-l-4 border-[#C1121F]">
              Fisioterapia (Últimos)
            </h3>
            {physioRecords.length > 0 ? (
              <div className="space-y-2">
                {physioRecords.slice(0, 3).map((r, i) => (
                  <div key={i} className="bg-white border border-gray-200 p-2.5 rounded-lg">
                    <div className="flex justify-between mb-1">
                      <span className="text-[9px] font-black text-gray-500">{formatDate(r.date)}</span>
                      <span className="text-[8px] font-black uppercase text-amber-600">{r.status}</span>
                    </div>
                    <p className="text-[10px] font-medium text-gray-800">{r.notes}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[10px] text-gray-500 italic p-4 bg-gray-50 rounded text-center">Sin partes de fisioterapia recientes.</div>
            )}
          </div>
        </div>

        {/* Historial de Lesiones */}
        <div>
          <h3 className="text-sm font-black text-[#0f0f0f] bg-gray-100 py-1.5 px-3 rounded uppercase tracking-wider mb-4 border-l-4 border-[#C1121F]">
            Historial de Lesiones
          </h3>
          
          {injuries.length === 0 ? (
            <div className="text-[10px] text-gray-500 italic p-4 bg-gray-50 rounded text-center border border-dashed border-gray-300">
              Jugador sin historial de lesiones.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Lesiones Activas */}
              {activeInjuries.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black text-red-600 uppercase mb-2">Lesiones Activas</h4>
                  <div className="space-y-2">
                    {activeInjuries.map((inj, i) => (
                      <div key={i} className="bg-red-50 border border-red-200 p-3 rounded-lg">
                        <div className="flex justify-between mb-1">
                          <span className="text-[10px] font-black text-gray-900">{ZONE_LABELS[inj.body_zone] || inj.body_zone}</span>
                          <span className="text-[9px] font-black uppercase bg-red-200 text-red-800 px-1.5 rounded">{inj.severity}</span>
                        </div>
                        <p className="text-[10px] font-medium text-gray-800 mb-1">{inj.diagnosis}</p>
                        {inj.estimated_return && <p className="text-[9px] text-gray-500">Vuelta est.: {formatDate(inj.estimated_return)}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Histórico Reciente */}
              {pastInjuries.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black text-gray-500 uppercase mb-2">Histórico (Recuperadas)</h4>
                  <table className="w-full text-left text-[9px]">
                    <thead className="bg-gray-100 text-gray-600">
                      <tr>
                        <th className="p-2 border-b border-gray-200 font-black uppercase">Fecha</th>
                        <th className="p-2 border-b border-gray-200 font-black uppercase">Zona</th>
                        <th className="p-2 border-b border-gray-200 font-black uppercase">Diagnóstico</th>
                        <th className="p-2 border-b border-gray-200 font-black uppercase">Gravedad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pastInjuries.map((inj, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="p-2 font-bold text-gray-800">{formatDate(inj.injury_date)}</td>
                          <td className="p-2 text-gray-600">{ZONE_LABELS[inj.body_zone] || inj.body_zone}</td>
                          <td className="p-2 text-gray-600 truncate max-w-[200px]">{inj.diagnosis}</td>
                          <td className="p-2">
                            <span className="text-[8px] font-black uppercase text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{inj.severity}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Pagina 2 */}
        <div className="absolute bottom-8 left-8 right-8 text-center border-t border-gray-200 pt-3 mt-auto">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Documento Interno y Confidencial — Página 2/2</span>
        </div>
      </div>

    </div>
  );
};
