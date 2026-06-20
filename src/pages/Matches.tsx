import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dataService } from '../services/data';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../context/ToastContext';
import { TableSkeleton } from '../components/Skeletons';
import { Modal } from '../components/Modal';
import { Match } from '../types';
import { exportToCSV, exportToPDF, ExportCell } from '../utils/export';
import {
  Trophy, Search, Download, FileText, Plus, Edit2, Trash2,
  Calendar, CheckCircle, HelpCircle, XCircle, RefreshCw
} from 'lucide-react';
import logos from '../assets/logos.json';

const getTeamLogo = (teamName: string): string => {
  const normalize = (str: string) => str.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
  const target = normalize(teamName);
  
  const matchKey = Object.keys(logos).find(key => normalize(key) === target);
  if (matchKey) {
    return (logos as Record<string, string>)[matchKey];
  }
  return 'https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png';
};

export const Matches: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();

  // Permisos específicos
  const canCreate = hasPermission('matches', 'crear');
  const canEdit = hasPermission('matches', 'editar');
  const canDelete = hasPermission('matches', 'eliminar');
  const canExport = hasPermission('matches', 'exportar');

  // Estados locales
  const [search, setSearch] = useState('');
  const [filterCompetition, setFilterCompetition] = useState('Todas');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Modal de formulario
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  // Campos de formulario
  const [rival, setRival] = useState('');
  const [date, setDate] = useState('');
  const [isLocal, setIsLocal] = useState(true);
  const [competition, setCompetition] = useState<'Liga' | 'Copa' | 'Amistoso' | 'Promoción'>('Liga');
  const [scoreUs, setScoreUs] = useState<string>('');
  const [scoreThem, setScoreThem] = useState<string>('');
  const [status, setStatus] = useState<'Programado' | 'Jugado' | 'Suspendido'>('Programado');
  const [time, setTime] = useState('18:00');
  const [location, setLocation] = useState('');
  const [objective, setObjective] = useState('');
  const [observations, setObservations] = useState('');

  // Estados para sincronización FFCV
  const [ffcvCompeticion, setFfcvCompeticion] = useState('29509167'); // Primera FFCV por defecto
  const [isSyncing, setIsSyncing] = useState(false);

  // Consultar partidos
  const { data: matches = [], isLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: () => dataService.getMatches()
  });

  // Mutaciones
  const createMutation = useMutation({
    mutationFn: (newMatch: Omit<Match, 'id'>) => dataService.createMatch(newMatch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      showToast('success', 'Partido creado', 'El partido se ha programado correctamente.');
      handleCloseModal();
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, item }: { id: string; item: Partial<Match> }) => dataService.updateMatch(id, item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      showToast('success', 'Partido actualizado', 'Los datos del partido se han modificado correctamente.');
      handleCloseModal();
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dataService.deleteMatch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      showToast('success', 'Partido eliminado', 'El partido ha sido eliminado del sistema.');
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const upsertMatchesMutation = useMutation({
    mutationFn: (items: Omit<Match, 'id'>[]) => dataService.upsertMatches(items),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['trainings'] });
      showToast('success', 'Sincronización completada', `Se han sincronizado e importado/actualizado ${data.length} partidos desde la FFCV.`);
    },
    onError: (err) => showToast('error', 'Error al sincronizar', err.message)
  });

  const parseSpanishDate = (dateStr: string): string | null => {
    const cleanStr = dateStr.toLowerCase().replace(/de\s+/g, '').replace(/·.*/, '').trim();
    const parts = cleanStr.split(/\s+/);
    let day = '';
    let monthName = '';
    let year = '';
    
    const monthsMap: { [key: string]: string } = {
      'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
      'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
      'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
    };

    for (const part of parts) {
      if (/^\d{4}$/.test(part)) {
        year = part;
      } else if (/^\d{1,2}$/.test(part)) {
        day = part.padStart(2, '0');
      } else if (monthsMap[part]) {
        monthName = monthsMap[part];
      }
    }

    if (day && monthName && year) {
      return `${year}-${monthName}-${day}`;
    }
    return null;
  };

  const handleSyncFFCV = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/sync-matches');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al ejecutar la sincronización.');
      }
      
      const result = await response.json();
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['matches'] });
        showToast('success', 'Sincronización completada', 'Los partidos de todas las competiciones se han sincronizado con Supabase.');
      } else {
        throw new Error('No se recibió confirmación de éxito.');
      }
    } catch (error: any) {
      showToast('error', 'Error al sincronizar', error.message || 'Error desconocido.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Manejo del formulario
  const handleOpenCreateModal = () => {
    setEditingMatch(null);
    setRival('');
    setDate(new Date().toISOString().split('T')[0]);
    setIsLocal(true);
    setCompetition('Liga');
    setScoreUs('');
    setScoreThem('');
    setStatus('Programado');
    setTime('18:00');
    setLocation('');
    setObjective('');
    setObservations('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (match: Match) => {
    setEditingMatch(match);
    setRival(match.rival);
    setDate(match.date);
    setIsLocal(match.is_local);
    setCompetition(match.competition);
    setScoreUs(match.score_us !== null ? String(match.score_us) : '');
    setScoreThem(match.score_them !== null ? String(match.score_them) : '');
    setStatus(match.status);
    setTime(match.time || '18:00');
    setLocation(match.location || '');
    setObjective(match.objective || '');
    setObservations(match.observations || '');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingMatch(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rival.trim()) {
      showToast('error', 'Validación', 'El nombre del rival es obligatorio.');
      return;
    }
    if (!date) {
      showToast('error', 'Validación', 'La fecha del partido es obligatoria.');
      return;
    }

    const payload = {
      rival: rival.trim(),
      date,
      is_local: isLocal,
      competition,
      score_us: status === 'Jugado' && scoreUs !== '' ? Number(scoreUs) : null,
      score_them: status === 'Jugado' && scoreThem !== '' ? Number(scoreThem) : null,
      status,
      time,
      location: location.trim() || (isLocal ? 'Campo Municipal El Porrejat' : 'Visitante'),
      objective: objective.trim(),
      observations: observations.trim()
    };

    if (editingMatch) {
      updateMutation.mutate({ id: editingMatch.id, item: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este partido?')) {
      deleteMutation.mutate(id);
    }
  };

  // Cálculo de estadísticas
  const computeStats = (items: Match[]) => {
    const total = items.length;
    const played = items.filter(m => m.status === 'Jugado');
    const wins = played.filter(m => m.score_us !== null && m.score_them !== null && m.score_us > m.score_them).length;
    const draws = played.filter(m => m.score_us !== null && m.score_them !== null && m.score_us === m.score_them).length;
    const losses = played.filter(m => m.score_us !== null && m.score_them !== null && m.score_us < m.score_them).length;
    
    return { total, wins, draws, losses };
  };

  // 1. Estadísticas acumuladas generales
  const generalStats = computeStats(matches);

  // 2. Estadísticas acumuladas mensuales
  const monthlyMatches = matches.filter(m => {
    const d = new Date(m.date);
    return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
  });
  const monthlyStats = computeStats(monthlyMatches);

  // Filtrado de la lista en pantalla
  const filteredMatches = matches.filter(m => {
    const matchesSearch = m.rival.toLowerCase().includes(search.toLowerCase());
    const matchesCompetition = filterCompetition === 'Todas' || m.competition === filterCompetition;
    const matchesStatus = filterStatus === 'Todos' || m.status === filterStatus;
    return matchesSearch && matchesCompetition && matchesStatus;
  });

  // Datos de exportación (definidos una sola vez, reutilizados por CSV y PDF)
  const exportHeaders = ['Fecha', 'Rival', 'Ubicación', 'Competición', 'Goles Propios', 'Goles Rival', 'Estado'];
  const buildExportRows = (): ExportCell[][] =>
    filteredMatches.map(m => [
      m.date,
      m.rival,
      m.is_local ? 'Local' : 'Visitante',
      m.competition,
      m.score_us ?? '',
      m.score_them ?? '',
      m.status,
    ]);

  const handleExportCSV = () => {
    if (filteredMatches.length === 0) {
      showToast('info', 'Exportar', 'No hay partidos en la lista para exportar.');
      return;
    }
    exportToCSV(`partidos_ud_atzeneta_${Date.now()}`, exportHeaders, buildExportRows());
    showToast('success', 'CSV Descargado', 'Se ha exportado el archivo con los filtros aplicados.');
  };

  const handleExportPDF = async () => {
    if (filteredMatches.length === 0) {
      showToast('info', 'Exportar', 'No hay partidos en la lista para exportar.');
      return;
    }
    await exportToPDF('Partidos UD Atzeneta', `partidos_ud_atzeneta_${Date.now()}`, exportHeaders, buildExportRows());
    showToast('success', 'PDF Descargado', 'Se ha generado el informe con los filtros aplicados.');
  };

  const months = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
  ];

  return (
    <div className="space-y-6">
      {/* Cabecera de Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-gray-light">Gestión de Partidos</h2>
          <p className="text-sm text-brand-gray-muted mt-1">
            Programación de enfrentamientos y control del récord de la temporada.
          </p>
        </div>

        {/* Botonera de acciones superiores */}
        <div className="flex items-center gap-2 shrink-0">
          <Link to="/matches/stats" className="btn-secondary py-2 text-xs font-semibold flex items-center gap-1.5 hover:bg-brand-black-hover">
            <Trophy className="w-3.5 h-3.5 text-yellow-500" /> Estadísticas
          </Link>
          {canExport && (
            <>
              <button onClick={handleExportCSV} className="btn-secondary py-2 text-xs">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={handleExportPDF} className="btn-secondary py-2 text-xs">
                <FileText className="w-3.5 h-3.5" /> PDF
              </button>
            </>
          )}
          {canCreate && (
            <button onClick={handleOpenCreateModal} className="btn-primary py-2 text-xs font-semibold">
              <Plus className="w-3.5 h-3.5" /> Registrar Partido
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          BLOQUES DE ESTADÍSTICAS (General vs Mensual vs Sincronización)
          ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Acumulado General */}
        <div className="dashboard-card flex flex-col justify-between p-5">
          <div className="border-b border-brand-black-border pb-3 flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-gray-muted">Acumulado General</span>
            <Trophy className="w-4 h-4 text-brand-red-600" />
          </div>
          <div className="grid grid-cols-4 gap-2 text-center mt-4">
            <div>
              <div className="text-xl font-bold text-brand-gray-light">{generalStats.total}</div>
              <div className="text-[10px] text-brand-gray-muted mt-1">Partidos</div>
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-500">{generalStats.wins}</div>
              <div className="text-[10px] text-brand-gray-muted mt-1">Victorias</div>
            </div>
            <div>
              <div className="text-xl font-bold text-brand-gray-light">{generalStats.draws}</div>
              <div className="text-[10px] text-brand-gray-muted mt-1">Empates</div>
            </div>
            <div>
              <div className="text-xl font-bold text-brand-red-600">{generalStats.losses}</div>
              <div className="text-[10px] text-brand-gray-muted mt-1">Derrotas</div>
            </div>
          </div>
        </div>

        {/* Acumulado Mensual */}
        <div className="dashboard-card flex flex-col justify-between p-5">
          <div className="border-b border-brand-black-border pb-3 flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-gray-muted">Histórico Mensual</span>
            
            {/* Selectores de fecha para el bloque acumulado */}
            <div className="flex gap-1.5 bg-brand-black border border-brand-black-border px-2 py-0.5 rounded">
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent text-[10px] text-brand-gray-light border-none p-0 focus:ring-0 cursor-pointer"
              >
                {months.map(m => <option key={m.value} value={m.value} className="bg-brand-black-card text-brand-gray-light">{m.label}</option>)}
              </select>
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-[10px] text-brand-gray-light border-none p-0 focus:ring-0 cursor-pointer"
              >
                <option value={2026} className="bg-brand-black-card text-brand-gray-light">2026</option>
                <option value={2025} className="bg-brand-black-card text-brand-gray-light">2025</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center mt-4">
            <div>
              <div className="text-xl font-bold text-brand-gray-light">{monthlyStats.total}</div>
              <div className="text-[10px] text-brand-gray-muted mt-1">Partidos</div>
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-500">{monthlyStats.wins}</div>
              <div className="text-[10px] text-brand-gray-muted mt-1">Victorias</div>
            </div>
            <div>
              <div className="text-xl font-bold text-brand-gray-light">{monthlyStats.draws}</div>
              <div className="text-[10px] text-brand-gray-muted mt-1">Empates</div>
            </div>
            <div>
              <div className="text-xl font-bold text-brand-red-600">{monthlyStats.losses}</div>
              <div className="text-[10px] text-brand-gray-muted mt-1">Derrotas</div>
            </div>
          </div>
        </div>

        {/* Sincronizador FFCV */}
        <div className="dashboard-card flex flex-col justify-between p-5">
          <div className="border-b border-brand-black-border pb-3 flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-gray-muted">Sincronización FFCV</span>
            <RefreshCw className={`w-4 h-4 text-brand-red-600 ${isSyncing ? 'animate-spin' : ''}`} />
          </div>
          <div className="flex flex-col gap-3 mt-4 justify-between h-full">
            <button
              onClick={handleSyncFFCV}
              disabled={isSyncing || (!canCreate && !canEdit)}
              className="btn-primary py-2.5 px-4 w-full text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSyncing ? 'Ejecutando sync_matches_supabase.cjs...' : 'Sincronizar con FFCV'}
            </button>
            <p className="text-[10px] text-brand-gray-muted leading-tight">
              Ejecuta el script de raspado del servidor para actualizar todos los partidos oficiales en Supabase desde la web de la FFCV.
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================================
          SECCIÓN DE BÚSQUEDA Y FILTROS
          ===================================================================== */}
      <div className="flex flex-col sm:flex-row gap-3 bg-brand-black border border-brand-black-border p-4 rounded-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-brand-gray-dark" />
          <input
            type="text"
            className="form-input pl-10 w-full"
            placeholder="Buscar por rival (ej. CD Alcoyano)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2.5 w-full sm:w-auto">
          <div className="flex-1 sm:flex-initial">
            <select
              value={filterCompetition}
              onChange={(e) => setFilterCompetition(e.target.value)}
              className="form-input bg-brand-black-bg"
            >
              <option value="Todas">Todas las Competiciones</option>
              <option value="Liga">Liga</option>
              <option value="Copa">Copa</option>
              <option value="Amistoso">Amistoso</option>
              <option value="Promoción">Promoción</option>
            </select>
          </div>
          <div className="flex-1 sm:flex-initial">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="form-input bg-brand-black-bg"
            >
              <option value="Todos">Todos los Estados</option>
              <option value="Programado">Programados</option>
              <option value="Jugado">Jugados</option>
              <option value="Suspendido">Suspendidos</option>
            </select>
          </div>
        </div>
      </div>

      {/* =====================================================================
          TABLA / CONTENEDOR DE JUEGOS
          =======================================      {/* =====================================================================
          TABLA / CONTENEDOR DE JUEGOS (VISTA COMPLETA)
          ===================================================================== */}
      {isLoading ? (
        <TableSkeleton />
      ) : filteredMatches.length === 0 ? (
        <div className="bg-brand-black border border-brand-black-border p-12 rounded-xl text-center">
          <p className="text-sm text-brand-gray-muted">No se encontraron partidos con los filtros seleccionados.</p>
        </div>
      ) : (
        <>
          {/* Tabla para Escritorio */}
          <div className="hidden md:block bg-brand-black border border-brand-black-border rounded-xl overflow-hidden shadow-premium">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="table-th">Fecha</th>
                  <th className="table-th">Rival</th>
                  <th className="table-th text-center">Ubicación</th>
                  <th className="table-th">Competición</th>
                  <th className="table-th text-center">Resultado</th>
                  <th className="table-th">Estado</th>
                  {(canEdit || canDelete) && <th className="table-th text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-black-border bg-brand-black-card/10">
                {filteredMatches.map((match) => {
                  const hasPlayed = match.status === 'Jugado';
                  return (
                    <tr key={match.id} className="hover:bg-brand-black-hover/20 transition-colors">
                      <td className="table-td">
                        <div className="flex flex-col">
                          <span className="font-semibold text-brand-gray-light">{match.date}</span>
                          {match.time && <span className="text-[11px] text-brand-gray-muted mt-0.5">{match.time} hs</span>}
                        </div>
                      </td>
                      <td className="table-td font-semibold text-brand-gray-light">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center p-1 shrink-0 border border-brand-black-border/10 shadow-sm">
                            <img 
                              src={getTeamLogo(match.rival)} 
                              alt={match.rival} 
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png';
                              }}
                            />
                          </div>
                          <span>{match.rival}</span>
                        </div>
                      </td>
                      <td className="table-td text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            match.is_local ? 'bg-indigo-950/30 text-indigo-300 border border-indigo-900/30' : 'bg-orange-950/30 text-orange-300 border border-orange-900/30'
                          }`}>
                            {match.is_local ? 'Local' : 'Visitante'}
                          </span>
                          {match.location && <span className="text-[11px] text-brand-gray-muted text-center truncate max-w-[150px]" title={match.location}>{match.location}</span>}
                        </div>
                      </td>
                      <td className="table-td text-brand-gray-muted">{match.competition}</td>
                      <td className="table-td text-center font-bold text-base">
                        {hasPlayed ? (
                          <span className={match.score_us! > match.score_them! ? 'text-emerald-500' : match.score_us! < match.score_them! ? 'text-brand-red-600' : 'text-brand-gray-light'}>
                            {match.score_us} - {match.score_them}
                          </span>
                        ) : (
                          <span className="text-brand-gray-dark font-normal text-xs">-</span>
                        )}
                      </td>
                      <td className="table-td">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          match.status === 'Jugado' 
                            ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30' 
                            : match.status === 'Suspendido'
                            ? 'bg-red-950/20 text-red-400 border border-red-900/30'
                            : 'bg-brand-black-border text-brand-gray-muted border border-brand-black-border'
                        }`}>
                          {match.status === 'Jugado' && <CheckCircle className="w-3 h-3" />}
                          {match.status === 'Suspendido' && <XCircle className="w-3 h-3" />}
                          {match.status === 'Programado' && <HelpCircle className="w-3 h-3" />}
                          {match.status}
                        </span>
                      </td>
                      {(canEdit || canDelete) && (
                        <td className="table-td text-right">
                          <div className="flex gap-2 justify-end">
                            {canEdit && (
                              <button 
                                onClick={() => handleOpenEditModal(match)}
                                className="text-brand-gray-muted hover:text-brand-gray-light p-1.5 rounded bg-brand-black-hover hover:bg-brand-black-border border border-brand-black-border transition-all"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canDelete && (
                              <button 
                                onClick={() => handleDelete(match.id)}
                                className="text-brand-gray-muted hover:text-brand-red-600 p-1.5 rounded bg-brand-black-hover hover:bg-brand-red-600/10 border border-brand-black-border hover:border-brand-red-600/20 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards responsivas para móviles */}
          <div className="md:hidden space-y-3.5">
            {filteredMatches.map((match) => {
              const hasPlayed = match.status === 'Jugado';
              return (
                <div key={match.id} className="bg-brand-black-card border border-brand-black-border rounded-xl p-4 shadow-premium space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center p-0.5 shrink-0 border border-brand-black-border/10 shadow-sm">
                        <img 
                          src={getTeamLogo(match.rival)} 
                          alt={match.rival} 
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png';
                          }}
                        />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-brand-gray-light">{match.rival}</h4>
                        <span className="text-[11px] text-brand-gray-muted flex items-center gap-1 mt-1">
                          <Calendar className="w-3.5 h-3.5" /> {match.date} {match.time && `| ${match.time} hs`}
                        </span>
                        {match.location && (
                          <span className="text-[11px] text-brand-gray-muted block mt-1">
                            📍 {match.location}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      match.is_local ? 'bg-indigo-950/30 text-indigo-300' : 'bg-orange-950/30 text-orange-300'
                    }`}>
                      {match.is_local ? 'Local' : 'Visitante'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-t border-brand-black-border pt-3">
                    <div className="text-xs text-brand-gray-muted">
                      Competición: <span className="text-brand-gray-light font-medium">{match.competition}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-medium text-brand-gray-muted">Resultado:</span>
                      <span className="text-sm font-bold bg-brand-black px-2.5 py-1 rounded border border-brand-black-border">
                        {hasPlayed ? `${match.score_us} - ${match.score_them}` : '-'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-brand-black-border/50 pt-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      match.status === 'Jugado' 
                        ? 'bg-emerald-950/20 text-emerald-400' 
                        : match.status === 'Suspendido'
                        ? 'bg-red-950/20 text-red-400'
                        : 'bg-brand-black-border text-brand-gray-muted'
                    }`}>
                      {match.status}
                    </span>

                    <div className="flex gap-2">
                      {canEdit && (
                        <button 
                          onClick={() => handleOpenEditModal(match)}
                          className="text-xs text-brand-gray-muted bg-brand-black px-3 py-1.5 rounded border border-brand-black-border hover:text-brand-gray-light flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" /> Editar
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={() => handleDelete(match.id)}
                          className="text-xs text-brand-gray-muted bg-brand-black px-3 py-1.5 rounded border border-brand-black-border hover:text-brand-red-600 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Borrar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* =====================================================================
          MODAL DE CREAR / EDITAR PARTIDO
          ===================================================================== */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal}
        title={editingMatch ? 'Editar Datos del Partido' : 'Programar Nuevo Partido'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="form-label">Nombre del Club Rival</label>
            <input
              type="text"
              className="form-input"
              placeholder="CD Alcoyano"
              value={rival}
              onChange={(e) => setRival(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="form-label">Fecha del Encuentro</label>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Hora</label>
              <input
                type="time"
                className="form-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Competición</label>
              <select
                value={competition}
                onChange={(e) => setCompetition(e.target.value as any)}
                className="form-input bg-brand-black-bg"
              >
                <option value="Liga">Liga</option>
                <option value="Copa">Copa</option>
                <option value="Amistoso">Amistoso</option>
                <option value="Promoción">Promoción</option>
              </select>
            </div>
            <div>
              <label className="form-label">Estado del Partido</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="form-input bg-brand-black-bg"
              >
                <option value="Programado">Programado</option>
                <option value="Jugado">Jugado</option>
                <option value="Suspendido">Suspendido</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Ubicación (Tipo)</label>
              <select
                value={isLocal ? 'true' : 'false'}
                onChange={(e) => setIsLocal(e.target.value === 'true')}
                className="form-input bg-brand-black-bg"
              >
                <option value="true">Local (El Porrejat)</option>
                <option value="false">Visitante</option>
              </select>
            </div>
            <div>
              <label className="form-label">Estadio / Lugar</label>
              <input
                type="text"
                className="form-input"
                placeholder={isLocal ? 'Campo Municipal El Porrejat' : 'Lugar / Estadio visitante'}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Objetivo del Partido (Opcional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. Fase defensiva, contragolpes, balón parado..."
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Observaciones (Opcional)</label>
            <textarea
              className="form-input h-20 resize-none"
              placeholder="Detalles sobre convocatoria, indumentaria, autobús..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
            />
          </div>

          {status === 'Jugado' && (
            <div className="bg-brand-black p-4 rounded-lg border border-brand-black-border space-y-3">
              <span className="text-xs font-semibold text-brand-red-600 block uppercase tracking-wider">Marcador / Resultado</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Goles UD Atzeneta</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    placeholder="0"
                    value={scoreUs}
                    onChange={(e) => setScoreUs(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Goles Rival</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    placeholder="0"
                    value={scoreThem}
                    onChange={(e) => setScoreThem(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4 justify-end">
            <button type="button" onClick={handleCloseModal} className="btn-secondary py-2 text-xs">
              Cancelar
            </button>
            <button type="submit" className="btn-primary py-2 text-xs font-semibold">
              Guardar Partido
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
