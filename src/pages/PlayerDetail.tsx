import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/Modal';
import { BodyMap, ZONE_LABELS } from '../components/BodyMap';
import { TableSkeleton } from '../components/Skeletons';
import {
  ArrowLeft, Users, Edit2, Trash2, Scale, HeartPulse, Activity, Calendar,
  TrendingUp, Ruler, UserCheck, Phone, Mail, Trophy, AlertTriangle,
  FileText, ChevronRight, ShieldCheck, ShieldAlert, Plus, X, Check
} from 'lucide-react';
import { Player, PlayerWeight, PlayerPhysioRecord, PlayerInjury, TrainingAttendance, Match, Training } from '../types';
import { exportToCSV, exportToPDF } from '../utils/export';

type DetailTab = 'ficha' | 'stats' | 'lesiones' | 'peso' | 'fisio';

export const PlayerDetail: React.FC = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const canEdit = hasPermission('players', 'editar');

  const [detailTab, setDetailTab] = useState<DetailTab>('ficha');
  const [statsMonthFilter, setStatsMonthFilter] = useState<string>('General');

  // ---- Modales ----
  const [isInjuryModalOpen, setIsInjuryModalOpen] = useState(false);
  const [editingInjury, setEditingInjury] = useState<PlayerInjury | null>(null);
  const [injuryZone, setInjuryZone] = useState('');
  const [injurySide, setInjurySide] = useState<'frontal' | 'posterior'>('frontal');
  const [injurySeverity, setInjurySeverity] = useState<'Leve' | 'Moderada' | 'Grave'>('Moderada');
  const [injuryStatus, setInjuryStatus] = useState<'Activa' | 'En tratamiento' | 'Recuperado' | 'Baja'>('Activa');
  const [injuryDiagnosis, setInjuryDiagnosis] = useState('');
  const [injuryTreatment, setInjuryTreatment] = useState('');
  const [injuryDate, setInjuryDate] = useState(new Date().toISOString().split('T')[0]);
  const [injuryEstReturn, setInjuryEstReturn] = useState('');
  const [injuryActReturn, setInjuryActReturn] = useState('');
  const [injuryFollowUp, setInjuryFollowUp] = useState('');

  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [weightDate, setWeightDate] = useState(new Date().toISOString().split('T')[0]);

  const [isPhysioModalOpen, setIsPhysioModalOpen] = useState(false);
  const [physioStatus, setPhysioStatus] = useState<'Disponible' | 'Lesionado' | 'En duda' | 'Baja'>('Disponible');
  const [physioNotes, setPhysioNotes] = useState('');
  const [physioTreatment, setPhysioTreatment] = useState('');
  const [physioDate, setPhysioDate] = useState(new Date().toISOString().split('T')[0]);

  // ---- Queries ----
  const { data: players = [], isLoading: isLoadingPlayers } = useQuery({
    queryKey: ['players'],
    queryFn: () => dataService.getPlayers()
  });

  const player = players.find((p: Player) => p.id === playerId) || null;

  const { data: weights = [], isLoading: isLoadingWeights } = useQuery({
    queryKey: ['playerWeights', playerId],
    queryFn: () => playerId ? dataService.getPlayerWeights(playerId) : Promise.resolve([]),
    enabled: !!playerId && detailTab === 'peso'
  });

  const { data: physioRecords = [], isLoading: isLoadingPhysio } = useQuery({
    queryKey: ['playerPhysio', playerId],
    queryFn: () => playerId ? dataService.getPlayerPhysioRecords(playerId) : Promise.resolve([]),
    enabled: !!playerId && detailTab === 'fisio'
  });

  const { data: injuries = [], isLoading: isLoadingInjuries } = useQuery<PlayerInjury[]>({
    queryKey: ['playerInjuries', playerId],
    queryFn: () => playerId ? dataService.getPlayerInjuries(playerId) : Promise.resolve([]),
    enabled: !!playerId
  });

  const { data: attendanceRecords = [] } = useQuery<TrainingAttendance[]>({
    queryKey: ['playerAttendance', playerId],
    queryFn: async () => {
      if (!playerId) return [];
      const allAtt = await dataService.getTrainingAttendance();
      return allAtt.filter((a: TrainingAttendance) => a.player_id === playerId);
    },
    enabled: !!playerId && detailTab === 'stats'
  });

  const { data: trainings = [] } = useQuery({
    queryKey: ['trainings'],
    queryFn: () => dataService.getTrainings(),
    enabled: detailTab === 'stats'
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: () => dataService.getMatches(),
    enabled: detailTab === 'stats'
  });

  const { data: matchStats = [], isLoading: isLoadingStats } = useQuery({
    queryKey: ['playerMatchStatsAll', playerId],
    queryFn: () => playerId ? dataService.getAllPlayerMatchStatsByPlayer(playerId) : Promise.resolve([]),
    enabled: !!playerId && detailTab === 'stats'
  });

  // ---- Dynamic Stats Computation based on Filter ----
  const availableMonths = React.useMemo(() => {
    const months = new Set<string>();
    matchStats.forEach(s => {
      const match = matches.find((m: Match) => m.id === s.match_id);
      if (match?.date) months.add(match.date.substring(0, 7)); // YYYY-MM
    });
    attendanceRecords.forEach(a => {
      const t = trainings.find((tr: Training) => tr.id === a.training_id);
      if (t?.date) months.add(t.date.substring(0, 7));
    });
    return Array.from(months).sort().reverse();
  }, [matchStats, matches, attendanceRecords, trainings]);

  const filteredMatchStats = React.useMemo(() => {
    if (statsMonthFilter === 'General') return matchStats;
    return matchStats.filter(s => {
      const match = matches.find((m: Match) => m.id === s.match_id);
      return match?.date?.startsWith(statsMonthFilter);
    });
  }, [matchStats, matches, statsMonthFilter]);

  const filteredAttendance = React.useMemo(() => {
    if (statsMonthFilter === 'General') return attendanceRecords;
    return attendanceRecords.filter(a => {
      const t = trainings.find((tr: Training) => tr.id === a.training_id);
      return t?.date?.startsWith(statsMonthFilter);
    });
  }, [attendanceRecords, trainings, statsMonthFilter]);

  const dynMatchesPlayed = filteredMatchStats.filter(s => s.minutes_played > 0).length;
  const dynMinutesPlayed = filteredMatchStats.reduce((acc, s) => acc + (s.minutes_played || 0), 0);
  const dynGoals = filteredMatchStats.reduce((acc, s) => acc + (s.goals || 0), 0);
  const dynAssists = filteredMatchStats.reduce((acc, s) => acc + (s.assists || 0), 0);
  const dynYellows = filteredMatchStats.reduce((acc, s) => acc + (s.yellow_cards || 0), 0);
  const dynReds = filteredMatchStats.filter(s => s.red_card).length;

  // ---- Mutations ----
  const createInjuryMutation = useMutation({
    mutationFn: (item: Omit<PlayerInjury, 'id'>) => dataService.createPlayerInjury(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerInjuries', playerId] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      showToast('success', 'Lesión Registrada', 'La lesión se ha añadido correctamente al historial.');
      handleCloseInjuryModal();
    },
    onError: (err: any) => showToast('error', 'Error', err.message || 'No se pudo registrar la lesión.')
  });

  const updateInjuryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PlayerInjury> }) => dataService.updatePlayerInjury(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerInjuries', playerId] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      showToast('success', 'Lesión Actualizada', 'Los datos de la lesión se han actualizado.');
      handleCloseInjuryModal();
    },
    onError: (err: any) => showToast('error', 'Error', err.message || 'No se pudo actualizar la lesión.')
  });

  const deleteInjuryMutation = useMutation({
    mutationFn: (id: string) => dataService.deletePlayerInjury(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerInjuries', playerId] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      showToast('success', 'Lesión Eliminada', 'El registro se ha eliminado.');
    },
    onError: (err: any) => showToast('error', 'Error', err.message || 'No se pudo eliminar la lesión.')
  });

  const addWeightMutation = useMutation({
    mutationFn: (item: Omit<PlayerWeight, 'id'>) => dataService.createPlayerWeight(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerWeights', playerId] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      showToast('success', 'Peso Registrado', 'Nuevo control de peso añadido.');
      setIsWeightModalOpen(false);
      setNewWeight('');
    },
    onError: (err: any) => showToast('error', 'Error', err.message)
  });

  const addPhysioMutation = useMutation({
    mutationFn: (item: Omit<PlayerPhysioRecord, 'id'>) => dataService.createPlayerPhysioRecord(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerPhysio', playerId] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      showToast('success', 'Parte Fisio Registrado', 'Nueva nota de fisioterapia añadida.');
      setIsPhysioModalOpen(false);
      setPhysioNotes('');
      setPhysioTreatment('');
    },
    onError: (err: any) => showToast('error', 'Error', err.message)
  });

  // ---- Handlers ----
  const handleZoneClick = (zone: string, side: 'frontal' | 'posterior') => {
    setEditingInjury(null);
    setInjuryZone(zone);
    setInjurySide(side);
    setInjurySeverity('Moderada');
    setInjuryStatus('Activa');
    setInjuryDiagnosis('');
    setInjuryTreatment('');
    setInjuryDate(new Date().toISOString().split('T')[0]);
    setInjuryEstReturn('');
    setInjuryActReturn('');
    setInjuryFollowUp('');
    setIsInjuryModalOpen(true);
  };

  const handleEditInjury = (inj: PlayerInjury) => {
    setEditingInjury(inj);
    setInjuryZone(inj.body_zone);
    setInjurySide(inj.body_side);
    setInjurySeverity(inj.severity);
    setInjuryStatus(inj.status);
    setInjuryDiagnosis(inj.diagnosis);
    setInjuryTreatment(inj.treatment || '');
    setInjuryDate(inj.injury_date);
    setInjuryEstReturn(inj.estimated_return || '');
    setInjuryActReturn(inj.actual_return || '');
    setInjuryFollowUp(inj.follow_up_notes || '');
    setIsInjuryModalOpen(true);
  };

  const handleCloseInjuryModal = () => {
    setIsInjuryModalOpen(false);
    setEditingInjury(null);
  };

  const handleSaveInjury = (e: React.FormEvent) => {
    e.preventDefault();
    if (!injuryDiagnosis.trim() || !playerId) return;

    const payload = {
      player_id: playerId,
      body_zone: injuryZone,
      body_side: injurySide,
      severity: injurySeverity,
      status: injuryStatus,
      diagnosis: injuryDiagnosis,
      treatment: injuryTreatment || undefined,
      injury_date: injuryDate,
      estimated_return: injuryEstReturn || undefined,
      actual_return: injuryActReturn || undefined,
      follow_up_notes: injuryFollowUp || undefined,
    };

    if (editingInjury) {
      updateInjuryMutation.mutate({ id: editingInjury.id, data: payload });
    } else {
      createInjuryMutation.mutate(payload);
    }
  };

  const handleDeleteInjury = (id: string) => {
    if (window.confirm('¿Eliminar este registro de lesión?')) {
      deleteInjuryMutation.mutate(id);
    }
  };

  const handleExportPlayerReport = async () => {
    if (!player) return;
    showToast('info', 'Generando Reporte', 'Preparando el informe PDF...');

    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const reportEl = document.createElement('div');
      reportEl.style.position = 'fixed';
      reportEl.style.left = '-9999px';
      reportEl.style.top = '-9999px';
      reportEl.style.width = '700px';
      reportEl.style.padding = '35px';
      reportEl.style.background = '#ffffff';
      reportEl.style.color = '#1f2937';
      reportEl.style.fontFamily = 'system-ui, sans-serif';

      const totalSessions = attendanceRecords.length;
      const sessionsTrained = attendanceRecords.filter((a: TrainingAttendance) => a.status === 'Entrena').length;
      const attendanceRate = totalSessions > 0 ? ((sessionsTrained / totalSessions) * 100).toFixed(0) : '0';
      const activeInjuries = injuries.filter(i => i.status !== 'Recuperado');

      reportEl.innerHTML = `
        <div style="border: 2px solid #C1121F; padding: 25px; border-radius: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 15px; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 15px;">
              <img src="https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png" style="width: 55px; height: 55px; object-fit: contain;" crossorigin="anonymous" />
              <div>
                <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #C1121F;">U.D. ATZENETA DE CASTELLÓN</h1>
                <span style="font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Informe de Rendimiento y Ficha Técnica</span>
              </div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 10px; color: #9ca3af; font-weight: bold;">TEMPORADA 2025/2026</span>
              <p style="margin: 3px 0 0 0; font-size: 9px; color: #6b7280;">Generado: ${new Date().toLocaleDateString('es-ES')}</p>
            </div>
          </div>

          <div style="display: flex; gap: 25px; background: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <div style="width: 100px; height: 100px; border-radius: 50%; overflow: hidden; border: 2px solid #C1121F; background: #fff; display: flex; align-items: center; justify-content: center;">
              ${player.photo_url
                ? `<img src="${player.photo_url}" style="width: 100%; height: 100%; object-fit: cover;" crossorigin="anonymous" />`
                : `<div style="font-size: 32px; color: #9ca3af; font-weight: bold; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #e5e7eb;">${(player.nickname || player.full_name)[0]}</div>`}
            </div>
            <div style="flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div style="grid-column: span 2;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 800;">${player.nickname || player.full_name} ${player.dorsal ? `<span style="color: #C1121F;">#${player.dorsal}</span>` : ''}</h2>
                ${player.nickname ? `<p style="margin: 3px 0 0 0; font-size: 11px; color: #6b7280;">Nombre: <strong>${player.full_name}</strong></p>` : ''}
              </div>
              <div><span style="font-size: 8px; color: #9ca3af; font-weight: bold; text-transform: uppercase; display: block;">Posición</span><strong style="font-size: 11px;">${player.position || '-'}</strong></div>
              <div><span style="font-size: 8px; color: #9ca3af; font-weight: bold; text-transform: uppercase; display: block;">Pie</span><strong style="font-size: 11px;">${player.dominant_foot || '-'}</strong></div>
              <div><span style="font-size: 8px; color: #9ca3af; font-weight: bold; text-transform: uppercase; display: block;">Estatura / Peso</span><strong style="font-size: 11px;">${player.height ? `${player.height} cm` : '-'} / ${player.weight ? `${player.weight} kg` : '-'}</strong></div>
              <div><span style="font-size: 8px; color: #9ca3af; font-weight: bold; text-transform: uppercase; display: block;">Estado</span><strong style="font-size: 11px; color: ${player.physical_status === 'Disponible' ? '#10b981' : '#ef4444'};">${player.physical_status || 'Disponible'}</strong></div>
            </div>
          </div>

          <div style="margin-bottom: 20px;">
            <h3 style="margin: 0 0 10px 0; font-size: 12px; font-weight: 700; color: #C1121F; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Rendimiento Deportivo</h3>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 10px; border-radius: 6px; text-align: center;">
                <span style="font-size: 8px; color: #6b7280; font-weight: bold; text-transform: uppercase; display: block;">Partidos</span>
                <strong style="font-size: 15px; display: block; margin-top: 3px;">${player.matches_played}</strong>
              </div>
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 10px; border-radius: 6px; text-align: center;">
                <span style="font-size: 8px; color: #6b7280; font-weight: bold; text-transform: uppercase; display: block;">Minutos</span>
                <strong style="font-size: 15px; display: block; margin-top: 3px;">${player.minutes_played}'</strong>
              </div>
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 10px; border-radius: 6px; text-align: center;">
                <span style="font-size: 8px; color: #6b7280; font-weight: bold; text-transform: uppercase; display: block;">Goles / Asist.</span>
                <strong style="font-size: 15px; display: block; margin-top: 3px; color: #10b981;">${player.goals} / ${player.assists}</strong>
              </div>
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 10px; border-radius: 6px; text-align: center;">
                <span style="font-size: 8px; color: #6b7280; font-weight: bold; text-transform: uppercase; display: block;">Asistencia</span>
                <strong style="font-size: 15px; display: block; margin-top: 3px; color: #3b82f6;">${attendanceRate}%</strong>
              </div>
            </div>
          </div>

          ${activeInjuries.length > 0 ? `
          <div>
            <h3 style="margin: 0 0 10px 0; font-size: 12px; font-weight: 700; color: #C1121F; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Lesiones Activas (${activeInjuries.length})</h3>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${activeInjuries.map(inj => `
                <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 8px; border-radius: 6px;">
                  <div style="display: flex; justify-content: space-between; font-size: 9px; font-weight: bold; margin-bottom: 3px;">
                    <span style="color: #374151;">${ZONE_LABELS[inj.body_zone] || inj.body_zone}</span>
                    <span style="color: ${inj.severity === 'Grave' ? '#ef4444' : inj.severity === 'Moderada' ? '#f97316' : '#eab308'};">${inj.severity} — ${inj.status}</span>
                  </div>
                  <p style="margin: 0; font-size: 9px; color: #374151;">${inj.diagnosis}</p>
                  ${inj.treatment ? `<p style="margin: 2px 0 0 0; font-size: 8px; color: #059669;">Tto: ${inj.treatment}</p>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
        </div>
      `;

      document.body.appendChild(reportEl);

      const canvas = await html2canvas(reportEl, { useCORS: true, allowTaint: false, scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const margin = 10;
      const imgW = pdfW - 2 * margin;
      const imgH = (canvas.height * imgW) / canvas.width;
      pdf.addImage(imgData, 'PNG', margin, margin, imgW, imgH);
      pdf.save(`ficha_${player.nickname || player.full_name.replace(/\s+/g, '_')}.pdf`);

      document.body.removeChild(reportEl);
      showToast('success', 'PDF Generado', 'La ficha se ha descargado correctamente.');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Error al exportar', 'No se pudo generar el informe en PDF.');
    }
  };

  // ---- Chart & Stats Helpers ----
  const renderMatchStatsChart = () => {
    if (isLoadingStats) return <div className="text-center py-8 text-brand-gray-muted text-xs">Cargando progreso...</div>;
    const sortedStats = [...filteredMatchStats].map(s => {
      const match = matches.find((m: Match) => m.id === s.match_id);
      return {
        ...s,
        date: match?.date || '?',
        matchday: match?.matchday || '?',
        rival: match?.rival || '?'
      };
    }).sort((a, b) => {
      if (a.date === '?' || b.date === '?') return 0;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    if (sortedStats.length === 0) {
      return <div className="text-center py-8 text-brand-gray-muted italic text-xs">No hay registros de partidos.</div>;
    }
    
    const svgW = 600; const svgH = 200; const padX = 40; const padY = 30;
    const chartW = svgW - 2 * padX; const chartH = svgH - 2 * padY;
    const maxMins = 90;
    
    const points = sortedStats.map((s, idx) => {
      const x = padX + (idx / (Math.max(sortedStats.length - 1, 1))) * chartW;
      const y = padY + chartH - ((s.minutes_played || 0) / maxMins) * chartH;
      return { x, y, minutes: s.minutes_played || 0, label: `J.${s.matchday}`, rival: s.rival };
    });
    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
      <div className="bg-brand-black/30 border border-brand-black-border p-4 rounded-xl overflow-x-auto space-y-2">
        <span className="text-[10px] text-brand-gray-muted uppercase font-bold block">Evolución: Minutos Jugados</span>
        <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="min-w-[500px] overflow-visible">
          {[0, 0.5, 1].map((ratio, i) => {
            const y = padY + chartH * ratio;
            const mVal = (maxMins - ratio * maxMins).toFixed(0);
            return (
              <g key={i} className="opacity-20">
                <line x1={padX} y1={y} x2={padX + chartW} y2={y} stroke="#4b5563" strokeDasharray="3,3" />
                <text x={padX - 8} y={y + 3} fill="#9ca3af" fontSize="10" textAnchor="end">{mVal}'</text>
              </g>
            );
          })}
          {points.length > 1 && <path d={pathData} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
          {points.map((p, idx) => (
            <g key={idx}>
              <circle cx={p.x} cy={p.y} r="4" fill="#1f2937" stroke="#3b82f6" strokeWidth="2" />
              <text x={p.x} y={p.y - 10} fill="#60a5fa" fontSize="10" textAnchor="middle" fontWeight="bold">{p.minutes}'</text>
              <text x={p.x} y={padY + chartH + 15} fill="#9ca3af" fontSize="9" textAnchor="middle">{p.label}</text>
              <text x={p.x} y={padY + chartH + 26} fill="#6b7280" fontSize="8" textAnchor="middle">{p.rival.substring(0, 10)}</text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  // ---- Weight Chart ----
  const renderWeightChart = () => {
    if (weights.length === 0) {
      return <div className="text-center py-8 text-brand-gray-muted italic text-xs">No hay registros de peso suficientes.</div>;
    }
    const svgW = 500; const svgH = 180; const padX = 40; const padY = 20;
    const chartW = svgW - 2 * padX; const chartH = svgH - 2 * padY;
    const values = weights.map((w: PlayerWeight) => w.weight);
    const minWeight = Math.min(...values) - 2; const maxWeight = Math.max(...values) + 2;
    const range = maxWeight - minWeight || 4;
    const points = weights.map((w: PlayerWeight, idx: number) => {
      const x = padX + (idx / (weights.length - 1 || 1)) * chartW;
      const y = padY + chartH - ((w.weight - minWeight) / range) * chartH;
      return { x, y, weight: w.weight, date: w.date };
    });
    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
      <div className="bg-brand-black border border-brand-black-border p-3 rounded-lg overflow-x-auto">
        <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="min-w-[400px] overflow-visible">
          {[0, 0.5, 1].map((ratio, i) => {
            const y = padY + chartH * ratio;
            const wVal = (maxWeight - ratio * range).toFixed(1);
            return (
              <g key={i} className="opacity-20">
                <line x1={padX} y1={y} x2={padX + chartW} y2={y} stroke="#4b5563" strokeDasharray="3,3" />
                <text x={padX - 8} y={y + 3} fill="#9ca3af" fontSize="8" textAnchor="end">{wVal} kg</text>
              </g>
            );
          })}
          {points.length > 1 && <path d={pathData} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
          {points.map((p, idx) => (
            <g key={idx}>
              <circle cx={p.x} cy={p.y} r="4" fill="#1f2937" stroke="#10b981" strokeWidth="2" />
              <text x={p.x} y={p.y - 8} fill="#e5e7eb" fontSize="8" textAnchor="middle" fontWeight="bold">{p.weight}</text>
              <text x={p.x} y={padY + chartH + 12} fill="#9ca3af" fontSize="7" textAnchor="middle">{p.date.split('-').slice(1).join('/')}</text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  // ---- Severity helpers ----
  const severityBadge = (severity: string) => {
    const cls = severity === 'Grave' ? 'bg-red-950/30 text-red-400 border-red-900/40' :
      severity === 'Moderada' ? 'bg-orange-950/30 text-orange-400 border-orange-900/40' :
      'bg-yellow-950/30 text-yellow-400 border-yellow-900/40';
    return `text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${cls}`;
  };

  const statusBadge = (status: string) => {
    const cls = status === 'Recuperado' ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/40' :
      status === 'Baja' ? 'bg-red-950/30 text-red-400 border-red-900/40' :
      status === 'En tratamiento' ? 'bg-amber-950/30 text-amber-400 border-amber-900/40' :
      'bg-blue-950/30 text-blue-400 border-blue-900/40';
    return `text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${cls}`;
  };

  // ---- Loading / Not found ----
  if (isLoadingPlayers) {
    return (
      <div className="space-y-6">
        <TableSkeleton />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate('/players')} className="btn-secondary py-2 text-xs flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Volver a la Plantilla
        </button>
        <div className="bg-brand-black border border-brand-black-border p-12 rounded-xl text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <p className="text-sm text-brand-gray-muted">Jugador no encontrado.</p>
        </div>
      </div>
    );
  }

  const physicalStatusColor =
    player.physical_status === 'Disponible' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30' :
    player.physical_status === 'En duda' ? 'bg-amber-950/20 text-amber-500 border-amber-900/30' :
    'bg-red-950/20 text-red-400 border-red-900/30';

  const activeInjuryCount = injuries.filter(i => i.status !== 'Recuperado').length;

  const tabs: { key: DetailTab; label: string; icon?: React.ReactNode }[] = [
    { key: 'ficha', label: 'Ficha Técnica' },
    { key: 'stats', label: 'Estadísticas' },
    { key: 'lesiones', label: `Lesiones${activeInjuryCount > 0 ? ` (${activeInjuryCount})` : ''}` },
    { key: 'peso', label: 'Control de Peso' },
    { key: 'fisio', label: 'Fisioterapia' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <button onClick={() => navigate('/players')} className="btn-secondary py-2 text-xs flex items-center gap-1.5 w-fit">
          <ArrowLeft className="w-4 h-4" /> Volver a Plantilla
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPlayerReport}
            className="px-3 py-2 bg-brand-red-600/10 hover:bg-brand-red-600 text-brand-gray-light hover:text-white border border-brand-red-600/25 hover:border-brand-red-600 rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold"
          >
            <FileText className="w-3.5 h-3.5" /> Exportar PDF
          </button>
        </div>
      </div>

      {/* Perfil del Jugador */}
      <div className="dashboard-card p-6 border border-brand-black-border">
        <div className="flex flex-col sm:flex-row gap-5">
          {/* Foto */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-brand-red-600/30 bg-brand-black overflow-hidden flex items-center justify-center shrink-0 mx-auto sm:mx-0">
            {player.photo_url ? (
              <img src={player.photo_url} alt={player.full_name} className="w-full h-full object-cover" />
            ) : (
              <Users className="w-12 h-12 text-brand-gray-dark" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
              {player.dorsal && (
                <span className="text-sm font-black text-brand-red-600 bg-brand-red-600/10 px-2.5 py-1 rounded-lg leading-none w-fit mx-auto sm:mx-0">
                  #{player.dorsal}
                </span>
              )}
              <h2 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">
                {player.nickname || player.full_name}
              </h2>
            </div>
            {player.nickname && (
              <p className="text-xs text-brand-gray-muted mb-1">
                Nombre completo: <span className="text-brand-gray-light font-medium">{player.full_name}</span>
              </p>
            )}
            <p className="text-xs text-brand-gray-muted uppercase font-bold tracking-wider mb-3">
              {player.position || 'Sin Demarcación'}
            </p>

            <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
              <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${physicalStatusColor}`}>
                {player.physical_status || 'Disponible'}
              </span>
              {activeInjuryCount > 0 && (
                <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border bg-red-950/30 text-red-400 border-red-900/40 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {activeInjuryCount} Lesión{activeInjuryCount > 1 ? 'es' : ''} Activa{activeInjuryCount > 1 ? 's' : ''}
                </span>
              )}
              {player.birth_date && (
                <span className="text-[10px] text-brand-gray-muted flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {player.birth_date}
                </span>
              )}
            </div>
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-3 gap-3 sm:gap-2 shrink-0">
            <div className="text-center">
              <span className="text-[8px] text-brand-gray-muted uppercase font-bold block">PJ</span>
              <span className="text-lg font-extrabold text-brand-gray-light block">{player.matches_played}</span>
            </div>
            <div className="text-center">
              <span className="text-[8px] text-brand-gray-muted uppercase font-bold block">Goles</span>
              <span className="text-lg font-extrabold text-emerald-500 block">{player.goals}</span>
            </div>
            <div className="text-center">
              <span className="text-[8px] text-brand-gray-muted uppercase font-bold block">Asist.</span>
              <span className="text-lg font-extrabold text-indigo-400 block">{player.assists}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pestañas */}
      <div className="flex overflow-x-auto border-b border-brand-black-border/60 no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setDetailTab(tab.key)}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              detailTab === tab.key
                ? 'border-brand-red-600 text-brand-gray-light'
                : 'border-transparent text-brand-gray-muted hover:text-brand-gray-light'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido de Pestañas */}
      <div className="dashboard-card p-6 border border-brand-black-border min-h-[300px]">

        {/* ===== FICHA TÉCNICA ===== */}
        {detailTab === 'ficha' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-left">
            {[
              { label: 'Pie Dominante', value: player.dominant_foot || 'No definido', icon: <Activity className="w-4 h-4 text-brand-red-600" /> },
              { label: 'Estatura', value: player.height ? `${player.height} cm` : 'No definido', icon: <Ruler className="w-4 h-4 text-brand-red-600" /> },
              { label: 'Peso Actual', value: player.weight ? `${player.weight} kg` : 'No definido', icon: <Scale className="w-4 h-4 text-brand-red-600" /> },
              { label: 'Fecha Nacimiento', value: player.birth_date || 'No definido', icon: <Calendar className="w-4 h-4 text-brand-red-600" /> },
              { label: 'Teléfono', value: player.phone || 'No definido', icon: <Phone className="w-4 h-4 text-brand-red-600" /> },
              { label: 'Email', value: player.email || 'No definido', icon: <Mail className="w-4 h-4 text-brand-red-600" /> },
            ].map((item, i) => (
              <div key={i} className="bg-brand-black/30 border border-brand-black-border p-4 rounded-lg">
                <span className="text-[9px] text-brand-gray-muted uppercase font-bold block mb-1">{item.label}</span>
                <span className="text-sm font-semibold text-brand-gray-light flex items-center gap-2">
                  {item.icon} {item.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ===== ESTADÍSTICAS ===== */}
        {detailTab === 'stats' && (
          <div className="space-y-6" id="stats-export-container">
            {/* Header del Filtro */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-brand-black/30 border border-brand-black-border p-4 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-brand-red-600 bg-brand-black shrink-0 flex items-center justify-center">
                  {player.photo_url ? (
                    <img src={player.photo_url} alt={player.nickname || player.full_name} className="w-full h-full object-cover" crossOrigin="anonymous" />
                  ) : (
                    <span className="text-xl font-bold text-brand-gray-dark">{(player.nickname || player.full_name).charAt(0)}</span>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-brand-gray-light uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-brand-red-600" /> Rendimiento Deportivo
                  </h3>
                  <p className="text-[10px] text-brand-gray-light font-bold">
                    {player.full_name} {player.dorsal ? `(#${player.dorsal})` : ''}
                  </p>
                  <p className="text-[10px] text-brand-gray-muted mt-0.5">
                    Estadísticas dinámicas según el periodo seleccionado.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <select
                  className="form-input py-1.5 text-xs w-auto bg-brand-black font-semibold text-brand-gray-light"
                  value={statsMonthFilter}
                  onChange={(e) => setStatsMonthFilter(e.target.value)}
                >
                  <option value="General">Temporada Completa (General)</option>
                  {availableMonths.map(month => {
                    const [yyyy, mm] = month.split('-');
                    const date = new Date(parseInt(yyyy), parseInt(mm) - 1, 1);
                    const label = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                    return <option key={month} value={month}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>;
                  })}
                </select>
                <button
                  onClick={async () => {
                    if (!player) return;
                    showToast('info', 'Generando Reporte', 'Preparando el informe PDF de estadísticas...');
                    try {
                      const { jsPDF } = await import('jspdf');
                      const html2canvas = (await import('html2canvas')).default;
                      const element = document.getElementById('stats-export-container');
                      if (!element) throw new Error("Contenedor no encontrado");
                      
                      const canvas = await html2canvas(element, { useCORS: true, scale: 2, backgroundColor: '#0f172a' });
                      const imgData = canvas.toDataURL('image/png');
                      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                      
                      const pdfW = pdf.internal.pageSize.getWidth();
                      const margin = 10;
                      const imgW = pdfW - 2 * margin;
                      const imgH = (canvas.height * imgW) / canvas.width;
                      
                      pdf.text(`Rendimiento Deportivo: ${player.full_name} - ${statsMonthFilter === 'General' ? 'Temporada Completa' : statsMonthFilter}`, margin, margin + 5);
                      pdf.addImage(imgData, 'PNG', margin, margin + 10, imgW, imgH);
                      pdf.save(`estadisticas_${player.nickname || player.full_name.replace(/\s+/g, '_')}_${statsMonthFilter}.pdf`);
                      showToast('success', 'PDF Generado', 'El informe se ha descargado.');
                    } catch (err: any) {
                      console.error(err);
                      showToast('error', 'Error', 'No se pudo generar el informe en PDF.');
                    }
                  }}
                  className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5" /> Imprimir Informe
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-left">
              {[
                { label: 'Partidos Jugados', value: dynMatchesPlayed, color: 'text-brand-gray-light' },
                { label: 'Minutos Jugados', value: `${dynMinutesPlayed}'`, color: 'text-brand-gray-light' },
                { label: 'Goles Anotados', value: `+${dynGoals}`, color: 'text-emerald-500' },
                { label: 'Asistencias Clave', value: `+${dynAssists}`, color: 'text-indigo-400' },
                { label: 'Tarjetas Amarillas', value: dynYellows, color: 'text-yellow-500' },
                { label: 'Tarjetas Rojas', value: dynReds, color: 'text-brand-red-600' },
              ].map((item, i) => (
                <div key={i} className="bg-brand-black/30 border border-brand-black-border p-4 rounded-lg text-center">
                  <span className="text-[9px] text-brand-gray-muted uppercase font-bold block">{item.label}</span>
                  <span className={`text-2xl font-extrabold ${item.color} mt-1 block`}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Gráfica de Minutos */}
            {renderMatchStatsChart()}

            {/* Bloque Entrenamientos */}
            <div className="bg-brand-black/30 border border-brand-black-border p-4 rounded-xl text-left space-y-4">
              <h3 className="text-xs font-bold text-brand-gray-light uppercase tracking-wider flex items-center gap-1.5 border-b border-brand-black-border pb-2">
                <Users className="w-4 h-4 text-emerald-500" /> Asistencia a Entrenamientos
              </h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-brand-black/40 p-3 rounded-lg text-center border border-brand-black-border">
                  <span className="text-[9px] text-brand-gray-muted uppercase font-bold block">Sesiones</span>
                  <span className="text-xl font-extrabold text-brand-gray-light">{filteredAttendance.length}</span>
                </div>
                <div className="bg-emerald-950/20 p-3 rounded-lg text-center border border-emerald-900/30">
                  <span className="text-[9px] text-emerald-600/80 uppercase font-bold block">Asiste</span>
                  <span className="text-xl font-extrabold text-emerald-500">
                    {filteredAttendance.filter(a => a.status === 'Entrena').length}
                  </span>
                </div>
                <div className="bg-brand-red-600/10 p-3 rounded-lg text-center border border-brand-red-600/20">
                  <span className="text-[9px] text-brand-red-600/80 uppercase font-bold block">Falta</span>
                  <span className="text-xl font-extrabold text-brand-red-600">
                    {filteredAttendance.filter(a => a.status !== 'Entrena').length}
                  </span>
                </div>
              </div>

              {filteredAttendance.filter(a => a.status !== 'Entrena').length > 0 && (
                <div className="mt-4">
                  <span className="text-[10px] text-brand-gray-muted uppercase font-bold block mb-2">Desglose de Ausencias</span>
                  <div className="max-h-[250px] overflow-y-auto space-y-2 pr-1 no-scrollbar">
                    {filteredAttendance.filter(a => a.status !== 'Entrena')
                      .sort((a, b) => {
                        const tA = trainings.find((tr: Training) => tr.id === a.training_id)?.date || '';
                        const tB = trainings.find((tr: Training) => tr.id === b.training_id)?.date || '';
                        return new Date(tB).getTime() - new Date(tA).getTime();
                      })
                      .map((att) => {
                        const t = trainings.find((tr: Training) => tr.id === att.training_id);
                        const isLesionado = att.status === 'L' || att.status === 'ED';
                        return (
                          <div key={att.id} className="bg-brand-black/40 border border-brand-black-border p-3 rounded-lg flex items-center justify-between">
                            <div>
                              <span className="text-[10px] text-brand-gray-muted flex items-center gap-1 mb-0.5">
                                <Calendar className="w-3 h-3" /> {t?.date || 'Fecha desconocida'}
                              </span>
                              <p className="text-xs text-brand-gray-light leading-normal mt-1">{att.observations || 'Sin observaciones'}</p>
                            </div>
                            <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${isLesionado ? 'bg-amber-950/30 text-amber-500 border-amber-900/40' : 'bg-red-950/30 text-red-400 border-red-900/40'}`}>
                              {att.status}
                            </span>
                          </div>
                        );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== LESIONES Y MAPA CORPORAL ===== */}
        {detailTab === 'lesiones' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Mapa Corporal */}
              <div className="bg-brand-black/30 border border-brand-black-border p-4 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-brand-gray-light uppercase tracking-wider flex items-center gap-1.5">
                    <HeartPulse className="w-4 h-4 text-brand-red-600" /> Mapa Corporal
                  </h4>
                  <span className="text-[9px] text-brand-gray-muted italic">Haz clic en una zona para registrar lesión</span>
                </div>
                {isLoadingInjuries ? (
                  <div className="text-center py-12 text-brand-gray-muted text-xs">Cargando mapa...</div>
                ) : (
                  <BodyMap injuries={injuries} onZoneClick={handleZoneClick} />
                )}
              </div>

              {/* Listado de Lesiones */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-brand-gray-light uppercase tracking-wider">Historial de Lesiones</h4>
                  {canEdit && (
                    <button
                      onClick={() => handleZoneClick('abdomen', 'frontal')}
                      className="btn-primary py-1 px-2.5 text-[10px] flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Nueva Lesión
                    </button>
                  )}
                </div>

                {injuries.length === 0 ? (
                  <div className="bg-brand-black/20 border border-dashed border-brand-black-border p-8 rounded-lg text-center text-xs text-brand-gray-muted italic">
                    No hay registros de lesiones para este jugador.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 no-scrollbar">
                    {injuries.map((inj) => (
                      <div
                        key={inj.id}
                        className={`bg-brand-black/30 border rounded-lg p-4 space-y-2 transition-all ${
                          inj.status === 'Recuperado'
                            ? 'border-brand-black-border/40 opacity-60'
                            : inj.status === 'Baja'
                            ? 'border-red-900/40'
                            : 'border-brand-black-border'
                        }`}
                      >
                        {/* Cabecera */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={severityBadge(inj.severity)}>{inj.severity}</span>
                            <span className={statusBadge(inj.status)}>{inj.status}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => handleEditInjury(inj)}
                                  className="p-1 hover:bg-brand-black-hover border border-brand-black-border text-brand-gray-muted hover:text-brand-gray-light rounded transition-all"
                                  title="Editar"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteInjury(inj.id)}
                                  className="p-1 hover:bg-brand-red-600/10 border border-brand-black-border hover:border-brand-red-600/30 text-brand-gray-muted hover:text-brand-red-600 rounded transition-all"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Zona y Fecha */}
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-brand-gray-light font-semibold flex items-center gap-1">
                            📍 {ZONE_LABELS[inj.body_zone] || inj.body_zone}
                            <span className="text-brand-gray-muted">({inj.body_side === 'frontal' ? 'Frontal' : 'Posterior'})</span>
                          </span>
                          <span className="text-brand-gray-muted flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {inj.injury_date}
                          </span>
                        </div>

                        {/* Diagnóstico */}
                        <p className="text-xs text-brand-gray-light leading-relaxed">{inj.diagnosis}</p>

                        {/* Tratamiento */}
                        {inj.treatment && (
                          <p className="text-[10px] text-emerald-400 leading-normal">
                            🩺 <span className="font-semibold">Tratamiento:</span>{' '}
                            <span className="text-brand-gray-muted">{inj.treatment}</span>
                          </p>
                        )}

                        {/* Fechas de retorno */}
                        <div className="flex flex-wrap gap-3 text-[10px]">
                          {inj.estimated_return && (
                            <span className="text-brand-gray-muted">
                              🗓️ Vuelta estimada: <span className="text-amber-400 font-semibold">{inj.estimated_return}</span>
                            </span>
                          )}
                          {inj.actual_return && (
                            <span className="text-brand-gray-muted">
                              ✅ Vuelta real: <span className="text-emerald-400 font-semibold">{inj.actual_return}</span>
                            </span>
                          )}
                        </div>

                        {/* Seguimiento */}
                        {inj.follow_up_notes && (
                          <div className="bg-brand-black/40 border border-brand-black-border/40 rounded p-2.5 mt-1">
                            <span className="text-[9px] text-brand-gray-muted uppercase font-bold block mb-1">Notas de Seguimiento</span>
                            <p className="text-[10px] text-brand-gray-light leading-relaxed whitespace-pre-line">{inj.follow_up_notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== CONTROL DE PESO ===== */}
        {detailTab === 'peso' && (
          <div className="space-y-4 text-left">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-brand-gray-light">Evolución del Peso</span>
              {canEdit && (
                <button onClick={() => setIsWeightModalOpen(true)} className="btn-primary py-1 px-2.5 text-[10px] flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5" /> Registrar Control
                </button>
              )}
            </div>
            {isLoadingWeights ? (
              <div className="text-center py-8 text-brand-gray-muted text-xs">Cargando historial de peso...</div>
            ) : (
              renderWeightChart()
            )}
          </div>
        )}

        {/* ===== FISIOTERAPIA ===== */}
        {detailTab === 'fisio' && (
          <div className="space-y-4 text-left">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-brand-gray-light">Historial de Partes Médicos</span>
              {canEdit && (
                <button onClick={() => setIsPhysioModalOpen(true)} className="btn-primary py-1 px-2.5 text-[10px] flex items-center gap-1">
                  <HeartPulse className="w-3.5 h-3.5" /> Nuevo Parte Fisio
                </button>
              )}
            </div>
            {isLoadingPhysio ? (
              <div className="text-center py-8 text-brand-gray-muted text-xs">Cargando historial médico...</div>
            ) : physioRecords.length === 0 ? (
              <div className="bg-brand-black/20 border border-dashed border-brand-black-border p-6 rounded-lg text-center text-xs text-brand-gray-muted italic">
                No hay registros de fisioterapia.
              </div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 no-scrollbar">
                {physioRecords.map((rec) => {
                  const stBadge =
                    rec.status === 'Disponible' ? 'bg-emerald-950/20 text-emerald-400' :
                    rec.status === 'En duda' ? 'bg-amber-950/20 text-amber-500' :
                    'bg-red-950/20 text-red-400';
                  return (
                    <div key={rec.id} className="bg-brand-black/30 border border-brand-black-border p-3 rounded-lg space-y-1">
                      <div className="flex justify-between items-center border-b border-brand-black-border/30 pb-1.5 mb-1.5">
                        <span className="text-[10px] text-brand-gray-muted font-bold flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {rec.date}
                        </span>
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${stBadge}`}>
                          {rec.status}
                        </span>
                      </div>
                      <p className="text-xs text-brand-gray-light leading-normal">{rec.notes}</p>
                      {rec.treatment && (
                        <p className="text-[10px] text-emerald-400 mt-1 leading-normal italic">
                          🩺 Tratamiento: <span className="text-brand-gray-muted not-italic">{rec.treatment}</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================= MODALES ======================= */}

      {/* Modal Lesión */}
      <Modal
        isOpen={isInjuryModalOpen}
        onClose={handleCloseInjuryModal}
        title={editingInjury ? 'Editar Lesión' : `Nueva Lesión — ${ZONE_LABELS[injuryZone] || injuryZone}`}
      >
        <form onSubmit={handleSaveInjury} className="space-y-4 text-left">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Zona del Cuerpo</label>
              <select className="form-input bg-brand-black" value={injuryZone} onChange={e => setInjuryZone(e.target.value)}>
                <optgroup label="Vista Frontal">
                  <option value="cabeza">Cabeza</option>
                  <option value="hombro_izquierdo">Hombro Izquierdo</option>
                  <option value="hombro_derecho">Hombro Derecho</option>
                  <option value="pectoral">Pectoral / Pecho</option>
                  <option value="biceps_izquierdo">Bíceps Izquierdo</option>
                  <option value="biceps_derecho">Bíceps Derecho</option>
                  <option value="abdomen">Abdomen / Core</option>
                  <option value="cadera_izquierda">Cadera / Ingle Izq.</option>
                  <option value="cadera_derecha">Cadera / Ingle Der.</option>
                  <option value="muslo_izquierdo">Cuádriceps Izquierdo</option>
                  <option value="muslo_derecho">Cuádriceps Derecho</option>
                  <option value="rodilla_izquierda">Rodilla Izquierda</option>
                  <option value="rodilla_derecha">Rodilla Derecha</option>
                  <option value="tibial_izquierdo">Tibial / Espinilla Izq.</option>
                  <option value="tibial_derecho">Tibial / Espinilla Der.</option>
                  <option value="tobillo_izquierdo">Tobillo Izquierdo</option>
                  <option value="tobillo_derecho">Tobillo Derecho</option>
                </optgroup>
                <optgroup label="Vista Posterior">
                  <option value="cervicales">Cervicales / Nuca</option>
                  <option value="hombro_posterior_izquierdo">Hombro Post. Izq.</option>
                  <option value="hombro_posterior_derecho">Hombro Post. Der.</option>
                  <option value="espalda_alta">Espalda Alta / Trapecio</option>
                  <option value="lumbar">Zona Lumbar</option>
                  <option value="gluteo_izquierdo">Glúteo Izquierdo</option>
                  <option value="gluteo_derecho">Glúteo Derecho</option>
                  <option value="isquiotibial_izquierdo">Isquiotibial Izq.</option>
                  <option value="isquiotibial_derecho">Isquiotibial Der.</option>
                  <option value="gemelo_izquierdo">Gemelo / Sóleo Izq.</option>
                  <option value="gemelo_derecho">Gemelo / Sóleo Der.</option>
                  <option value="aquiles_izquierdo">T. Aquiles Izq.</option>
                  <option value="aquiles_derecho">T. Aquiles Der.</option>
                </optgroup>
              </select>
            </div>
            <div>
              <label className="form-label">Vista</label>
              <select className="form-input bg-brand-black" value={injurySide} onChange={e => setInjurySide(e.target.value as any)}>
                <option value="frontal">Frontal (Delante)</option>
                <option value="posterior">Posterior (Detrás)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Severidad</label>
              <select className="form-input bg-brand-black" value={injurySeverity} onChange={e => setInjurySeverity(e.target.value as any)}>
                <option value="Leve">🟡 Leve</option>
                <option value="Moderada">🟠 Moderada</option>
                <option value="Grave">🔴 Grave</option>
              </select>
            </div>
            <div>
              <label className="form-label">Estado</label>
              <select className="form-input bg-brand-black" value={injuryStatus} onChange={e => setInjuryStatus(e.target.value as any)}>
                <option value="Activa">Activa</option>
                <option value="En tratamiento">En tratamiento</option>
                <option value="Baja">Baja</option>
                <option value="Recuperado">Recuperado</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Diagnóstico</label>
            <textarea
              required
              rows={2}
              className="form-input"
              placeholder="Ej. Rotura fibrilar grado I en gemelo derecho..."
              value={injuryDiagnosis}
              onChange={e => setInjuryDiagnosis(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Tratamiento</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. Reposo, crioterapia, readaptación..."
              value={injuryTreatment}
              onChange={e => setInjuryTreatment(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="form-label">Fecha Lesión</label>
              <input type="date" required className="form-input" value={injuryDate} onChange={e => setInjuryDate(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Vuelta Estimada</label>
              <input type="date" className="form-input" value={injuryEstReturn} onChange={e => setInjuryEstReturn(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Vuelta Real</label>
              <input type="date" className="form-input" value={injuryActReturn} onChange={e => setInjuryActReturn(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="form-label">Notas de Seguimiento</label>
            <textarea
              rows={3}
              className="form-input"
              placeholder="Ej. 15/06: Mejora notable. Empieza carrera suave..."
              value={injuryFollowUp}
              onChange={e => setInjuryFollowUp(e.target.value)}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-brand-black-border">
            <button type="button" onClick={handleCloseInjuryModal} className="btn-secondary py-2 text-xs">Cancelar</button>
            <button type="submit" className="btn-primary py-2 text-xs font-semibold">
              {editingInjury ? 'Guardar Cambios' : 'Registrar Lesión'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Peso */}
      <Modal isOpen={isWeightModalOpen} onClose={() => setIsWeightModalOpen(false)} title="Registrar Control de Peso">
        <form onSubmit={e => { e.preventDefault(); if (!newWeight || !playerId) return; addWeightMutation.mutate({ player_id: playerId, weight: parseFloat(newWeight), date: weightDate }); }} className="space-y-4 text-left">
          <div>
            <label className="form-label">Fecha del Control</label>
            <input type="date" required className="form-input" value={weightDate} onChange={e => setWeightDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Peso (kg)</label>
            <input type="number" step="0.1" required min="30" max="150" className="form-input" placeholder="72.5" value={newWeight} onChange={e => setNewWeight(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end pt-4 border-t border-brand-black-border">
            <button type="button" onClick={() => setIsWeightModalOpen(false)} className="btn-secondary py-2 text-xs">Cancelar</button>
            <button type="submit" className="btn-primary py-2 text-xs font-semibold">Registrar</button>
          </div>
        </form>
      </Modal>

      {/* Modal Fisio */}
      <Modal isOpen={isPhysioModalOpen} onClose={() => setIsPhysioModalOpen(false)} title="Nuevo Parte de Fisioterapia">
        <form onSubmit={e => { e.preventDefault(); if (!physioNotes.trim() || !playerId) return; addPhysioMutation.mutate({ player_id: playerId, status: physioStatus, notes: physioNotes, treatment: physioTreatment || undefined, date: physioDate }); }} className="space-y-4 text-left">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Fecha</label>
              <input type="date" required className="form-input" value={physioDate} onChange={e => setPhysioDate(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Estado Físico</label>
              <select className="form-input bg-brand-black" value={physioStatus} onChange={e => setPhysioStatus(e.target.value as any)}>
                <option value="Disponible">Disponible</option>
                <option value="En duda">En duda</option>
                <option value="Lesionado">Lesionado</option>
                <option value="Baja">Baja</option>
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Observaciones / Diagnóstico</label>
            <textarea required rows={3} className="form-input" placeholder="Ej. Sobrecarga muscular en el sóleo..." value={physioNotes} onChange={e => setPhysioNotes(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Tratamiento</label>
            <input type="text" className="form-input" placeholder="Ej. Crioterapia, readaptación..." value={physioTreatment} onChange={e => setPhysioTreatment(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end pt-4 border-t border-brand-black-border">
            <button type="button" onClick={() => setIsPhysioModalOpen(false)} className="btn-secondary py-2 text-xs">Cancelar</button>
            <button type="submit" className="btn-primary py-2 text-xs font-semibold">Guardar Parte</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
