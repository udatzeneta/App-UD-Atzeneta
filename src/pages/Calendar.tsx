import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/Modal';
import { Training, Match, SocialEvent, Team } from '../types';
import {
  Dumbbell, Trophy, ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  Clock, MapPin, Plus, Target, Users, Sparkles, Trash2, FileText
} from 'lucide-react';
import logos from '../assets/logos.json';

const getTeamLogo = (teamName: string): string => {
  const cleanName = teamName.replace('vs ', '').trim();
  const normalize = (str: string) => str.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
  const target = normalize(cleanName);
  
  const matchKey = Object.keys(logos).find(key => normalize(key) === target);
  if (matchKey) {
    return (logos as Record<string, string>)[matchKey];
  }
  return '/club-logo.png';
};

const formatTime = (timeStr?: string): string => {
  if (!timeStr) return '';
  const match = timeStr.match(/^(\d{2}):(\d{2})(:\d{2})?$/);
  if (match) {
    return `${match[1]}:${match[2]}h`;
  }
  return timeStr.endsWith('h') ? timeStr : `${timeStr}h`;
};

type EventType = 'training' | 'match' | 'social';

interface CalendarEvent {
  id: string;
  type: EventType;
  date: string;
  title: string;
  subtitle: string;
  time?: string;
  location?: string;
  is_local?: boolean;
  rival?: string;
  matchday?: string | null;
  eventType?: 'Cena' | 'Comida' | 'Fiesta' | 'Otro';
}

export const Calendar: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'select' | 'training' | 'match' | 'social'>('select');

  // Estados para exportación por lotes PDF
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [pdfSelectedMonths, setPdfSelectedMonths] = useState<number[]>([]);
  const [pdfSelectedYear, setPdfSelectedYear] = useState<number>(new Date().getFullYear());

  // Permisos
  const canCreateTraining = hasPermission('trainings', 'crear');
  const canCreateMatch = hasPermission('matches', 'crear');

  // Queries
  const { data: trainings = [] } = useQuery({
    queryKey: ['trainings'],
    queryFn: () => dataService.getTrainings()
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: () => dataService.getMatches()
  });

  const { data: dbTeams = [] } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => dataService.getTeams()
  });

  const [isCustomRival, setIsCustomRival] = useState(false);

  // Redefinición local de getTeamLogo para usar los escudos de la base de datos
  const getTeamLogo = (teamName: string): string => {
    const cleanName = teamName.replace('vs ', '').trim();
    const normalize = (str: string) => str.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
    const target = normalize(cleanName);
    
    // 1. Buscar en los equipos de la base de datos
    const dbTeam = dbTeams.find(t => normalize(t.name) === target);
    if (dbTeam?.shield_url) {
      return dbTeam.shield_url;
    }
    
    // 2. Buscar en logos.json
    const matchKey = Object.keys(logos).find(key => normalize(key) === target);
    if (matchKey) {
      return (logos as Record<string, string>)[matchKey];
    }
    return '/club-logo.png';
  };

  const { data: socialEvents = [] } = useQuery({
    queryKey: ['socialEvents'],
    queryFn: () => dataService.getSocialEvents()
  });

  // Mutaciones
  const createTrainingMutation = useMutation({
    mutationFn: (item: Omit<Training, 'id'>) => dataService.createTraining(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainings'] });
      showToast('success', 'Entrenamiento creado', 'Se ha añadido la sesión al calendario.');
      handleCloseModal();
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const createMatchMutation = useMutation({
    mutationFn: (item: Omit<Match, 'id'>) => dataService.createMatch(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      showToast('success', 'Partido creado', 'Se ha añadido el partido al calendario.');
      handleCloseModal();
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const createSocialEventMutation = useMutation({
    mutationFn: (item: Omit<SocialEvent, 'id'>) => dataService.createSocialEvent(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['socialEvents'] });
      showToast('success', 'Evento creado', 'Se ha añadido el evento social al calendario.');
      handleCloseModal();
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const deleteSocialEventMutation = useMutation({
    mutationFn: (id: string) => dataService.deleteSocialEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['socialEvents'] });
      showToast('success', 'Evento eliminado', 'El evento social ha sido eliminado.');
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const handleDeleteSocial = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('¿Estás seguro de que deseas eliminar este evento social?')) {
      deleteSocialEventMutation.mutate(id);
    }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getEventsForMonthAndDate = (targetYear: number, targetMonth: number, day: number): CalendarEvent[] => {
    const monthStr = String(targetMonth + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const targetDateStr = `${targetYear}-${monthStr}-${dayStr}`;

    const dateTrainings: CalendarEvent[] = trainings
      .filter(t => t.date === targetDateStr)
      .map(t => ({
        id: t.id,
        type: 'training' as EventType,
        date: t.date,
        title: t.objective || 'Entrenamiento',
        subtitle: t.location,
        time: t.time,
        location: t.location
      }));

    const dateMatches: CalendarEvent[] = matches
      .filter(m => m.date === targetDateStr)
      .map(m => ({
        id: m.id,
        type: 'match' as EventType,
        date: m.date,
        title: `vs ${m.rival}`,
        subtitle: m.competition,
        time: m.time,
        location: m.location || (m.is_local ? 'Campo Municipal El Porrejat' : 'Visitante'),
        is_local: m.is_local,
        rival: m.rival,
        matchday: m.matchday
      }));

    const dateSocialEvents: CalendarEvent[] = socialEvents
      .filter(se => se.date === targetDateStr)
      .map(se => ({
        id: se.id,
        type: 'social' as EventType,
        date: se.date,
        title: `${se.type}: ${se.location}`,
        subtitle: se.observations || 'Evento Social',
        time: se.time,
        location: se.location,
        eventType: se.type
      }));

    return [...dateTrainings, ...dateMatches, ...dateSocialEvents];
  };

  const getEventsForDate = (day: number): CalendarEvent[] => {
    return getEventsForMonthAndDate(year, month, day);
  };

  const handleDayClick = (day: number) => {
    setSelectedDay(day);
    setModalType('select');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDay(null);
    setModalType('select');
  };

  const getEventsListForMonth = (targetYear: number, targetMonth: number) => {
    const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const list: { day: number; events: CalendarEvent[] }[] = [];
    for (let d = 1; d <= daysInTargetMonth; d++) {
      const dayEvts = getEventsForMonthAndDate(targetYear, targetMonth, d);
      if (dayEvts.length > 0) {
        list.push({ day: d, events: dayEvts });
      }
    }
    return list.sort((a, b) => a.day - b.day);
  };

  const getMonthEvents = () => {
    return getEventsListForMonth(year, month);
  };

  const monthEventsList = getMonthEvents();
  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year
    );
  };

  // Formulario de entrenamiento
  const [trainingForm, setTrainingForm] = useState({
    date: '',
    time: '18:00',
    location: 'Campo Municipal El Porrejat',
    duration: 90,
    objective: '',
    observations: '',
    status: 'Programado' as const
  });

  // Formulario de partido
  const [matchForm, setMatchForm] = useState({
    date: '',
    time: '18:00',
    location: '',
    rival: '',
    is_local: true,
    competition: 'Liga' as const,
    status: 'Programado' as const,
    objective: '',
    observations: '',
    matchday: ''
  });

  // Formulario de evento social
  const [socialForm, setSocialForm] = useState({
    date: '',
    time: '21:00',
    type: 'Cena' as 'Cena' | 'Comida' | 'Fiesta' | 'Otro',
    location: '',
    observations: ''
  });

  const handleOpenTrainingForm = () => {
    setModalType('training');
    const today = new Date();
    const defaultDay = today.getMonth() === month && today.getFullYear() === year ? today.getDate() : 1;
    const targetDay = selectedDay || defaultDay;
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(targetDay).padStart(2, '0');
    setTrainingForm({
      date: `${year}-${monthStr}-${dayStr}`,
      time: '18:00',
      location: 'Campo Municipal El Porrejat',
      duration: 90,
      objective: '',
      observations: '',
      status: 'Programado'
    });
  };

  const handleOpenMatchForm = () => {
    setModalType('match');
    setIsCustomRival(false);
    const today = new Date();
    const defaultDay = today.getMonth() === month && today.getFullYear() === year ? today.getDate() : 1;
    const targetDay = selectedDay || defaultDay;
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(targetDay).padStart(2, '0');
    setMatchForm({
      date: `${year}-${monthStr}-${dayStr}`,
      time: '18:00',
      location: '',
      rival: '',
      is_local: true,
      competition: 'Liga',
      status: 'Programado',
      objective: '',
      observations: '',
      matchday: ''
    });
  };

  const handleSaveTraining = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainingForm.objective.trim()) {
      showToast('error', 'Validación', 'El objetivo del entrenamiento es obligatorio.');
      return;
    }
    createTrainingMutation.mutate(trainingForm);
  };

  const handleSaveMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchForm.rival.trim()) {
      showToast('error', 'Validación', 'El nombre del rival es obligatorio.');
      return;
    }
    createMatchMutation.mutate({
      ...matchForm,
      rival: matchForm.rival.trim(),
      location: matchForm.location.trim() || (matchForm.is_local ? 'Campo Municipal El Porrejat' : 'Visitante'),
      matchday: matchForm.matchday.trim() || null,
      score_us: null,
      score_them: null
    });
  };

  const handleOpenSocialForm = () => {
    setModalType('social');
    const today = new Date();
    const defaultDay = today.getMonth() === month && today.getFullYear() === year ? today.getDate() : 1;
    const targetDay = selectedDay || defaultDay;
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(targetDay).padStart(2, '0');
    setSocialForm({
      date: `${year}-${monthStr}-${dayStr}`,
      time: '21:00',
      type: 'Cena',
      location: '',
      observations: ''
    });
  };

  const handleSaveSocial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socialForm.location.trim()) {
      showToast('error', 'Validación', 'El lugar del evento es obligatorio.');
      return;
    }
    createSocialEventMutation.mutate(socialForm);
  };

  const handleExportPDF = () => {
    setPdfSelectedMonths([month]);
    setPdfSelectedYear(year);
    setIsPDFModalOpen(true);
  };

  const handleExportPDFSubmit = async () => {
    if (pdfSelectedMonths.length === 0) {
      showToast('error', 'Selección vacía', 'Por favor, selecciona al menos un mes para exportar.');
      return;
    }

    setIsPDFModalOpen(false);
    showToast('info', 'Generando PDF', 'Estamos preparando tu calendario, por favor espera...');

    try {
      const { exportCalendarToPDF } = await import('../utils/export');
      
      const sortedMonths = [...pdfSelectedMonths].sort((a, b) => a - b);
      const monthsPayload = sortedMonths.map((mIdx) => {
        const eventsList = getEventsListForMonth(pdfSelectedYear, mIdx);
        return {
          monthName: monthNames[mIdx],
          year: pdfSelectedYear,
          eventsData: eventsList
        };
      });

      const filename = sortedMonths.length === 1
        ? `calendario_${monthNames[sortedMonths[0]].toLowerCase()}_${pdfSelectedYear}`
        : `calendario_deportivo_${pdfSelectedYear}`;

      await exportCalendarToPDF(
        `Calendario Deportivo ${pdfSelectedYear}`,
        filename,
        monthsPayload
      );
      showToast('success', 'PDF Descargado', 'Se ha descargado el archivo PDF con éxito.');
    } catch (error: any) {
      showToast('error', 'Error al exportar', error.message || 'Ocurrió un error al generar el PDF.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera de Página */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-gray-light">Calendario Deportivo</h2>
          <p className="text-sm text-brand-gray-muted mt-1">
            Gestiona partidos y entrenamientos del club en una vista mensual interactiva.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          <div className="flex items-center gap-3 bg-brand-black border border-brand-black-border px-3 py-1.5 rounded-lg shrink-0">
            <button
              onClick={prevMonth}
              className="p-1.5 hover:bg-brand-black-hover text-brand-gray-muted hover:text-brand-gray-light rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-brand-gray-light min-w-[140px] text-center">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 hover:bg-brand-black-hover text-brand-gray-muted hover:text-brand-gray-light rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="ml-2 px-3 py-1.5 text-xs font-medium bg-brand-red-600 hover:bg-brand-red-700 text-white rounded-lg transition-colors"
            >
              Hoy
            </button>
          </div>

          <button
            onClick={handleExportPDF}
            className="px-4 py-2 text-xs font-semibold bg-brand-black border border-brand-black-border hover:bg-brand-black-hover text-brand-gray-light rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
            title="Exportar calendario del mes a PDF"
          >
            <FileText className="w-4 h-4 text-brand-red-600" />
            PDF
          </button>

          {(canCreateTraining || canCreateMatch) && (
            <button
              onClick={() => {
                setSelectedDay(null);
                setModalType('select');
                setIsModalOpen(true);
              }}
              className="px-4 py-2 text-xs font-semibold bg-brand-red-600 hover:bg-brand-red-700 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-glow-red shrink-0"
            >
              <Plus className="w-4 h-4" />
              Añadir Evento
            </button>
          )}
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-4 bg-brand-black border border-brand-black-border px-4 py-3 rounded-xl">
        <span className="text-xs font-semibold uppercase tracking-wider text-brand-gray-muted">Leyenda:</span>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-brand-red-600/20 border border-brand-red-600/30"></div>
          <span className="text-xs text-brand-gray-muted">Entrenamiento</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-yellow-500/20 border border-yellow-500/30"></div>
          <span className="text-xs text-brand-gray-muted">Partido</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-purple-600/20 border border-purple-600/30"></div>
          <span className="text-xs text-brand-gray-muted">Evento Social</span>
        </div>
        {(canCreateTraining || canCreateMatch) && (
          <div className="flex items-center gap-2 md:ml-auto">
            <Plus className="w-3.5 h-3.5 text-brand-gray-muted" />
            <span className="text-xs text-brand-gray-muted">Click en un día para añadir</span>
          </div>
        )}
      </div>

      {/* =====================================================================
          VISTA CALENDARIO - ESCRITORIO & TABLET
          ===================================================================== */}
      <div className="hidden md:block bg-brand-black border border-brand-black-border rounded-xl overflow-hidden shadow-premium">
        {/* Días de la semana */}
        <div className="grid grid-cols-7 border-b border-brand-black-border bg-brand-black-hover/40 text-center font-semibold text-xs py-3 text-brand-gray-muted">
          {dayNames.map(d => <div key={d}>{d}</div>)}
        </div>

        {/* Cuadrícula de días */}
        <div className="grid grid-cols-7 gap-[1px] bg-brand-black-border border-l border-t border-r border-b border-brand-black-border">
          {calendarDays.map((day, idx) => {
            const events = day ? getEventsForDate(day) : [];
            const trainingCount = events.filter(e => e.type === 'training').length;
            const matchCount = events.filter(e => e.type === 'match').length;
            const socialCount = events.filter(e => e.type === 'social').length;
            const hasTraining = trainingCount > 0;
            const hasMatch = matchCount > 0;
            const hasSocial = socialCount > 0;
            const hasToday = day && isToday(day);

            let cellClass = '';
            if (!day) {
              cellClass = 'bg-brand-black-bg/30 opacity-30 select-none min-h-[150px] p-2';
            } else {
              cellClass = 'min-h-[150px] p-2 flex flex-col gap-1.5 transition-all duration-200 border-t-4 relative ';
              
              if (hasMatch) {
                cellClass += 'bg-yellow-500/15 border-t-yellow-500 hover:bg-yellow-500/25';
              } else if (hasTraining) {
                cellClass += 'bg-brand-red-600/15 border-t-brand-red-600 hover:bg-brand-red-600/25';
              } else if (hasSocial) {
                cellClass += 'bg-purple-600/15 border-t-purple-500 hover:bg-purple-600/25';
              } else {
                cellClass += 'bg-brand-black-card border-t-brand-black-border hover:bg-brand-black-hover/50';
              }

              if (hasToday) {
                cellClass += ' ring-2 ring-inset ring-brand-red-600 bg-brand-red-600/10';
              }
              
              if (canCreateTraining || canCreateMatch) {
                cellClass += ' cursor-pointer';
              }
            }

            return (
              <div
                key={idx}
                onClick={() => day && (canCreateTraining || canCreateMatch) && handleDayClick(day)}
                className={cellClass}
              >
                {/* Número del día */}
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                    hasToday
                      ? 'bg-brand-red-600 text-white shadow-glow-red'
                      : 'text-brand-gray-light font-extrabold'
                  }`}>
                    {day}
                  </span>
                  {(canCreateTraining || canCreateMatch) && day && (
                    <Plus className="w-3.5 h-3.5 text-brand-gray-muted hover:text-brand-gray-light" />
                  )}
                </div>

                {/* Eventos */}
                <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
                  {day && events.slice(0, 3).map((evt, eIdx) => {
                    const isTraining = evt.type === 'training';
                    const isMatch = evt.type === 'match';
                    const isSocial = evt.type === 'social';
                    return (
                      <div
                        key={eIdx}
                        className={`text-[10px] p-1.5 rounded-lg border flex flex-col gap-0.5 leading-tight ${
                          isTraining
                            ? 'bg-brand-red-600/40 text-brand-red-200 border-brand-red-500/40 font-medium'
                            : isMatch
                            ? 'bg-yellow-600/40 text-yellow-200 border-yellow-500/40 font-medium'
                            : 'bg-purple-600/40 text-purple-200 border-purple-500/40 font-medium shadow-[0_0_8px_rgba(168,85,247,0.2)]'
                        }`}
                        title={`${evt.title} - ${formatTime(evt.time)} - ${evt.location || ''}`}
                      >
                        <div className="flex items-center gap-1.5 font-bold">
                          {isTraining ? (
                            <>
                              <Dumbbell className="w-3 h-3 shrink-0 text-brand-red-400" />
                              <span className="truncate text-brand-red-200">{evt.title}</span>
                            </>
                          ) : isMatch ? (
                            <>
                              <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center p-0.5 shrink-0 border border-brand-black-border/10 shadow-sm">
                                <img
                                  src={getTeamLogo(evt.rival || evt.title)}
                                  alt="Escudo rival"
                                  className="w-full h-full object-contain"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/club-logo.png';
                                  }}
                                />
                              </div>
                              <span className="text-[10px] text-white font-extrabold truncate" title={evt.rival}>
                                {evt.rival}
                              </span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3 shrink-0 text-purple-400" />
                              <span className="truncate text-white font-extrabold">{evt.title}</span>
                            </>
                          )}
                        </div>
                        {isMatch && (
                          <div className="text-[9px] font-semibold flex flex-wrap items-center gap-1">
                            {evt.subtitle && (
                              <span className="text-yellow-400">🏆 {evt.subtitle}</span>
                            )}
                            {evt.matchday && (
                              <span className="text-[9px] font-extrabold text-cyan-400 bg-cyan-950/80 px-1 py-0.2 rounded border border-cyan-400/40 shadow-[0_0_8px_rgba(34,211,238,0.25)]">
                                J. {evt.matchday}
                              </span>
                            )}
                          </div>
                        )}
                        {evt.time && <div className="text-[9px] opacity-90 truncate font-semibold">🕒 {formatTime(evt.time)}</div>}
                        {evt.location && <div className="text-[9px] opacity-90 truncate italic">📍 {evt.location}</div>}
                      </div>
                    );
                  })}
                  {events.length > 3 && (
                    <span className="text-[9px] text-brand-gray-light font-bold text-center">
                      +{events.length - 3} más
                    </span>
                  )}
                </div>

                {/* Contadores */}
                {day && events.length > 0 && (
                  <div className="flex items-center gap-2 text-[9px] mt-auto pt-1">
                    {trainingCount > 0 && (
                      <span className="text-brand-red-400 flex items-center gap-0.5 font-bold">
                        <Dumbbell className="w-2.5 h-2.5" /> {trainingCount}
                      </span>
                    )}
                    {matchCount > 0 && (
                      <span className="text-yellow-400 flex items-center gap-0.5 font-bold">
                        <Trophy className="w-2.5 h-2.5" /> {matchCount}
                      </span>
                    )}
                    {socialCount > 0 && (
                      <span className="text-purple-400 flex items-center gap-0.5 font-bold">
                        <Sparkles className="w-2.5 h-2.5" /> {socialCount}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          VISTA MÓVIL - LISTA DE EVENTOS
          ===================================================================== */}
      <div className="md:hidden space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarIcon className="w-4 h-4 text-brand-red-600" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-gray-muted">Eventos del mes</h3>
        </div>

        {monthEventsList.length === 0 ? (
          <div className="bg-brand-black-card border border-brand-black-border p-8 rounded-xl text-center">
            <CalendarIcon className="w-12 h-12 text-brand-gray-dark mx-auto mb-3" />
            <p className="text-sm text-brand-gray-muted">No hay eventos planificados para este mes.</p>
            {(canCreateTraining || canCreateMatch) && (
              <button
                onClick={() => {
                  setSelectedDay(1);
                  setModalType('select');
                  setIsModalOpen(true);
                }}
                className="mt-4 text-xs font-medium text-brand-red-600 hover:text-brand-red-500"
              >
                + Añadir primer evento
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {monthEventsList.map(({ day, events }) => (
              <div key={day} className="space-y-2">
                <div className="sticky top-0 bg-brand-black-bg/90 backdrop-blur-sm py-1.5 flex items-center gap-2 border-b border-brand-black-border">
                  <span className="text-xs font-bold text-brand-red-600 bg-brand-red-600/10 px-2.5 py-0.5 rounded-full">
                    Día {day}
                  </span>
                  <div className="h-px bg-brand-black-border flex-1" />
                </div>

                <div className="space-y-2.5">
                  {events.map((evt, eIdx) => {
                    const isTraining = evt.type === 'training';
                    const isMatch = evt.type === 'match';
                    const isSocial = evt.type === 'social';
                    return (
                      <div
                        key={eIdx}
                        className="bg-brand-black-card border border-brand-black-border p-4 rounded-xl flex gap-3.5 items-start shadow-premium"
                      >
                        <div className="shrink-0">
                          {isTraining ? (
                            <div className="p-2.5 rounded-lg bg-brand-red-600/10 text-brand-red-600">
                              <Dumbbell className="w-5 h-5" />
                            </div>
                          ) : isMatch ? (
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center p-1 border border-brand-black-border/10 shadow-sm">
                              <img
                                src={getTeamLogo(evt.rival || evt.title)}
                                alt="Escudo rival"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png';
                                }}
                              />
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-lg bg-purple-600/10 text-purple-400 border border-purple-500/20 shadow-[0_0_8px_rgba(168,85,247,0.15)]">
                              <Sparkles className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <h4 className="text-sm font-semibold text-brand-gray-light leading-snug">
                              {evt.title}
                            </h4>
                            {isSocial && (canCreateTraining || canCreateMatch) && (
                              <button
                                onClick={(e) => handleDeleteSocial(e, evt.id)}
                                className="text-brand-gray-muted hover:text-brand-red-600 p-1.5 rounded hover:bg-brand-red-600/10 transition-colors"
                                title="Eliminar evento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-brand-gray-muted mt-0.5">{evt.subtitle}</p>

                          {isMatch && (
                            <div className="flex items-center gap-2 mt-1.5">
                              {evt.is_local ? (
                                <span className="text-[10px] font-semibold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">
                                  🏟️ Local
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full border border-blue-400/20">
                                  ✈️ Visitante
                                </span>
                              )}
                              {evt.matchday && (
                                <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-400/30 shadow-[0_0_8px_rgba(34,211,238,0.15)]">
                                  Jornada {evt.matchday}
                                </span>
                              )}
                            </div>
                          )}

                          {isSocial && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[10px] font-semibold text-purple-300 bg-purple-950/40 px-2.5 py-0.5 rounded-full border border-purple-800/30 shadow-[0_0_8px_rgba(168,85,247,0.15)]">
                                🎉 Evento Social
                              </span>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-xs text-brand-gray-muted">
                            {evt.time && (
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" /> {formatTime(evt.time)}
                              </span>
                            )}
                            {evt.location && (
                              <a
                                href={evt.location.startsWith('http') ? evt.location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evt.location)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-brand-red-600 hover:text-brand-red-500 hover:underline"
                                title="Ver ubicación en Google Maps"
                              >
                                <MapPin className="w-3.5 h-3.5 shrink-0" /> {evt.location}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* =====================================================================
          MODAL - SELECCIÓN DE TIPO DE EVENTO
          ===================================================================== */}
      <Modal
        isOpen={isModalOpen && modalType === 'select'}
        onClose={handleCloseModal}
        title={selectedDay ? `Eventos del Día ${selectedDay} de ${monthNames[month]}` : `Añadir Evento - ${monthNames[month]}`}
      >
        <div className="space-y-5">
          {/* Listado de eventos del día seleccionado */}
          {selectedDay && getEventsForDate(selectedDay).length > 0 && (
            <div className="space-y-3 pb-3 border-b border-brand-black-border">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted">Eventos programados para este día:</h4>
              <div className="space-y-2">
                {getEventsForDate(selectedDay).map((evt, eIdx) => {
                  const isTraining = evt.type === 'training';
                  const isMatch = evt.type === 'match';
                  const isSocial = evt.type === 'social';
                  return (
                    <div
                      key={eIdx}
                      className="bg-brand-black/40 border border-brand-black-border p-3 rounded-lg flex items-start gap-3"
                    >
                      <div className="shrink-0">
                        {isTraining ? (
                          <div className="p-1.5 rounded-lg bg-brand-red-600/10 text-brand-red-600">
                            <Dumbbell className="w-4 h-4" />
                          </div>
                        ) : isMatch ? (
                          <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center p-0.5 border border-brand-black-border/10 shadow-sm">
                            <img
                              src={getTeamLogo(evt.rival || evt.title)}
                              alt="Escudo rival"
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="p-1.5 rounded-lg bg-purple-600/10 text-purple-400 border border-purple-500/20">
                            <Sparkles className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h5 className="text-xs font-semibold text-brand-gray-light truncate">{evt.title}</h5>
                          <div className="flex items-center gap-1.5">
                            {evt.time && (
                              <span className="text-[10px] text-brand-gray-muted flex items-center gap-1 shrink-0 font-medium">
                                <Clock className="w-3.5 h-3.5" /> {formatTime(evt.time)}
                              </span>
                            )}
                            {isSocial && (canCreateTraining || canCreateMatch) && (
                              <button
                                onClick={(e) => handleDeleteSocial(e, evt.id)}
                                className="text-brand-gray-muted hover:text-brand-red-600 p-1 rounded hover:bg-brand-red-600/10 transition-colors"
                                title="Eliminar evento social"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-brand-gray-muted mt-0.5">{evt.subtitle}</p>
                        {isMatch && (
                          <div className="mt-1 flex items-center gap-2">
                            {evt.is_local ? (
                              <span className="text-[10px] font-semibold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">
                                🏟️ Local
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full border border-blue-400/20">
                                ✈️ Visitante
                              </span>
                            )}
                            {evt.matchday && (
                              <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-400/30 shadow-[0_0_8px_rgba(34,211,238,0.15)]">
                                Jornada {evt.matchday}
                              </span>
                            )}
                          </div>
                        )}
                        {isSocial && (
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-purple-300 bg-purple-950/40 px-2.5 py-0.5 rounded-full border border-purple-800/30 shadow-[0_0_8px_rgba(168,85,247,0.15)]">
                              🎉 Evento Social
                            </span>
                          </div>
                        )}
                        {evt.location && (
                          <div className="mt-2">
                            <a
                              href={evt.location.startsWith('http') ? evt.location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evt.location)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-brand-red-600 hover:text-brand-red-500 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span>Ubicación: {evt.location}</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Opciones de creación */}
          {(canCreateTraining || canCreateMatch) ? (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted text-center">
                {selectedDay && getEventsForDate(selectedDay).length > 0 ? 'Añadir otro evento:' : 'Selecciona el tipo de evento:'}
              </h4>
              <div className="grid grid-cols-3 gap-3">
                {canCreateTraining && (
                  <button
                    onClick={handleOpenTrainingForm}
                    className="p-3 bg-brand-black-card border border-brand-black-border rounded-xl hover:border-brand-red-600/50 hover:bg-brand-red-600/5 transition-all group"
                  >
                    <Dumbbell className="w-6 h-6 text-brand-red-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-[11px] font-semibold text-brand-gray-light block text-center">Entrenamiento</span>
                  </button>
                )}

                {canCreateMatch && (
                  <button
                    onClick={handleOpenMatchForm}
                    className="p-3 bg-brand-black-card border border-brand-black-border rounded-xl hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-all group"
                  >
                    <Trophy className="w-6 h-6 text-yellow-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-[11px] font-semibold text-brand-gray-light block text-center">Partido</span>
                  </button>
                )}

                <button
                  onClick={handleOpenSocialForm}
                  className="p-3 bg-brand-black-card border border-brand-black-border rounded-xl hover:border-purple-500/50 hover:bg-purple-500/5 transition-all group"
                >
                  <Sparkles className="w-6 h-6 text-purple-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-semibold text-brand-gray-light block text-center">Ev. Social</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-brand-gray-muted text-center py-4">
              No tienes permisos para añadir eventos al calendario.
            </p>
          )}
        </div>
      </Modal>

      {/* =====================================================================
          MODAL - FORMULARIO DE ENTRENAMIENTO
          ===================================================================== */}
      <Modal
        isOpen={isModalOpen && modalType === 'training'}
        onClose={handleCloseModal}
        title="Programar Entrenamiento"
      >
        <form onSubmit={handleSaveTraining} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Fecha</label>
              <input
                type="date"
                className="form-input"
                value={trainingForm.date}
                onChange={(e) => setTrainingForm(prev => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="form-label">Hora</label>
              <input
                type="time"
                className="form-input"
                value={trainingForm.time}
                onChange={(e) => setTrainingForm(prev => ({ ...prev, time: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <label className="form-label">Lugar / Campo</label>
            <input
              type="text"
              className="form-input"
              placeholder="Campo Municipal El Porrejat"
              value={trainingForm.location}
              onChange={(e) => setTrainingForm(prev => ({ ...prev, location: e.target.value }))}
              required
            />
            <p className="text-[10px] text-brand-gray-muted mt-1 leading-snug">
              📍 Introduce la ubicación o una dirección. Los jugadores verán un enlace para verla en Google Maps.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Duración (minutos)</label>
              <input
                type="number"
                min="30"
                step="15"
                className="form-input"
                value={trainingForm.duration}
                onChange={(e) => setTrainingForm(prev => ({ ...prev, duration: Number(e.target.value) }))}
                required
              />
            </div>
            <div>
              <label className="form-label">Estado</label>
              <select
                className="form-input bg-brand-black-bg"
                value={trainingForm.status}
                onChange={(e) => setTrainingForm(prev => ({ ...prev, status: e.target.value as any }))}
              >
                <option value="Programado">Programado</option>
                <option value="Realizado">Realizado</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">
              <Target className="w-3.5 h-3.5 inline mr-1" />
              Objetivo Principal
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. Fase defensiva, presión alta, balón parado..."
              value={trainingForm.objective}
              onChange={(e) => setTrainingForm(prev => ({ ...prev, objective: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="form-label">
              <Users className="w-3.5 h-3.5 inline mr-1" />
              Observaciones (Opcional)
            </label>
            <textarea
              className="form-input h-20 resize-none"
              placeholder="Material necesario, instrucciones especiales..."
              value={trainingForm.observations}
              onChange={(e) => setTrainingForm(prev => ({ ...prev, observations: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-4 justify-end">
            <button type="button" onClick={handleCloseModal} className="btn-secondary py-2 text-xs">
              Cancelar
            </button>
            <button type="submit" className="btn-primary py-2 text-xs font-semibold">
              Guardar Entrenamiento
            </button>
          </div>
        </form>
      </Modal>

      {/* =====================================================================
          MODAL - FORMULARIO DE PARTIDO
          ===================================================================== */}
      <Modal
        isOpen={isModalOpen && modalType === 'match'}
        onClose={handleCloseModal}
        title="Programar Partido"
      >
        <form onSubmit={handleSaveMatch} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="form-label">Fecha</label>
              <input
                type="date"
                className="form-input"
                value={matchForm.date}
                onChange={(e) => setMatchForm(prev => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="form-label">Hora</label>
              <input
                type="time"
                className="form-input"
                value={matchForm.time}
                onChange={(e) => setMatchForm(prev => ({ ...prev, time: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="form-label">Jornada</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej. 1"
                value={matchForm.matchday}
                onChange={(e) => setMatchForm(prev => ({ ...prev, matchday: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Competición</label>
              <select
                className="form-input bg-brand-black-bg"
                value={matchForm.competition}
                onChange={(e) => setMatchForm(prev => ({ ...prev, competition: e.target.value as any }))}
              >
                <option value="Liga">Liga</option>
                <option value="Copa">Copa</option>
                <option value="Amistoso">Amistoso</option>
                <option value="Promoción">Promoción</option>
              </select>
            </div>
            <div>
              <label className="form-label">Estado</label>
              <select
                className="form-input bg-brand-black-bg"
                value={matchForm.status}
                onChange={(e) => setMatchForm(prev => ({ ...prev, status: e.target.value as any }))}
              >
                <option value="Programado">Programado</option>
                <option value="Jugado">Jugado</option>
                <option value="Suspendido">Suspendido</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">
              <Users className="w-3.5 h-3.5 inline mr-1" />
              Equipo Rival
            </label>
            {!isCustomRival ? (
              <div className="flex gap-2">
                <select
                  className="form-input bg-brand-black-bg flex-1"
                  value={matchForm.rival}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "custom") {
                      setIsCustomRival(true);
                      setMatchForm(prev => ({ ...prev, rival: "" }));
                    } else {
                      setMatchForm(prev => ({ ...prev, rival: val }));
                    }
                  }}
                  required
                >
                  <option value="">-- Selecciona un rival --</option>
                  {dbTeams.map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                  <option value="custom">✍️ Otro (Escribir nombre)...</option>
                </select>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  className="form-input flex-1"
                  placeholder="Escribe el nombre del rival"
                  value={matchForm.rival}
                  onChange={(e) => setMatchForm(prev => ({ ...prev, rival: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomRival(false);
                    setMatchForm(prev => ({ ...prev, rival: "" }));
                  }}
                  className="btn-secondary px-3.5 py-2 text-xs font-semibold hover:bg-brand-black-hover border border-brand-black-border"
                  title="Volver a la lista de equipos"
                >
                  Lista
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="form-label">Ubicación</label>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <button
                type="button"
                onClick={() => setMatchForm(prev => ({ ...prev, is_local: true, location: prev.location || 'Campo Municipal El Porrejat' }))}
                className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                  matchForm.is_local
                    ? 'bg-brand-red-600 text-white border-brand-red-600'
                    : 'bg-brand-black-card text-brand-gray-muted border-brand-black-border hover:border-brand-gray-dark'
                }`}
              >
                🏟️ Local (El Porrejat)
              </button>
              <button
                type="button"
                onClick={() => setMatchForm(prev => ({ ...prev, is_local: false }))}
                className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                  !matchForm.is_local
                    ? 'bg-brand-red-600 text-white border-brand-red-600'
                    : 'bg-brand-black-card text-brand-gray-muted border-brand-black-border hover:border-brand-gray-dark'
                }`}
              >
                ✈️ Visitante
              </button>
            </div>
            <input
              type="text"
              className="form-input"
              placeholder={matchForm.is_local ? 'Campo Municipal El Porrejat' : 'Lugar / Estadio visitante'}
              value={matchForm.location}
              onChange={(e) => setMatchForm(prev => ({ ...prev, location: e.target.value }))}
            />
          </div>

          <div>
            <label className="form-label">
              <Target className="w-3.5 h-3.5 inline mr-1" />
              Objetivo del Partido (Opcional)
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. Presión alta, transiciones rápidas..."
              value={matchForm.objective}
              onChange={(e) => setMatchForm(prev => ({ ...prev, objective: e.target.value }))}
            />
          </div>

          <div>
            <label className="form-label">
              <Users className="w-3.5 h-3.5 inline mr-1" />
              Observaciones (Opcional)
            </label>
            <textarea
              className="form-input h-20 resize-none"
              placeholder="Convocatoria, uniforme, detalles de viaje..."
              value={matchForm.observations}
              onChange={(e) => setMatchForm(prev => ({ ...prev, observations: e.target.value }))}
            />
          </div>

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

      {/* =====================================================================
          MODAL - FORMULARIO DE EVENTO SOCIAL
          ===================================================================== */}
      <Modal
        isOpen={isModalOpen && modalType === 'social'}
        onClose={handleCloseModal}
        title="Programar Evento Social"
      >
        <form onSubmit={handleSaveSocial} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Fecha</label>
              <input
                type="date"
                className="form-input"
                value={socialForm.date}
                onChange={(e) => setSocialForm(prev => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="form-label">Hora</label>
              <input
                type="time"
                className="form-input"
                value={socialForm.time}
                onChange={(e) => setSocialForm(prev => ({ ...prev, time: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Tipo de Evento</label>
              <select
                className="form-input bg-brand-black-bg"
                value={socialForm.type}
                onChange={(e) => setSocialForm(prev => ({ ...prev, type: e.target.value as any }))}
              >
                <option value="Cena">Cena 🍽️</option>
                <option value="Comida">Comida 🍲</option>
                <option value="Fiesta">Fiesta 🎉</option>
                <option value="Otro">Otro 🎈</option>
              </select>
            </div>
            <div>
              <label className="form-label">Lugar / Establecimiento</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej. Restaurante El Racó"
                value={socialForm.location}
                onChange={(e) => setSocialForm(prev => ({ ...prev, location: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <label className="form-label">
              Observaciones / Detalles (Opcional)
            </label>
            <textarea
              className="form-input h-20 resize-none"
              placeholder="Detalles sobre precio, menú, reservas o vestimenta..."
              value={socialForm.observations}
              onChange={(e) => setSocialForm(prev => ({ ...prev, observations: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-4 justify-end">
            <button type="button" onClick={handleCloseModal} className="btn-secondary py-2 text-xs">
              Cancelar
            </button>
            <button type="submit" className="btn-primary py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-glow-purple border-none">
              Guardar Evento
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL DE SELECCIÓN DE EXPORTACIÓN PDF */}
      <Modal
        isOpen={isPDFModalOpen}
        onClose={() => setIsPDFModalOpen(false)}
        title="Exportar Calendario a PDF"
      >
        <div className="flex flex-col gap-4 text-brand-gray-light">
          <p className="text-xs text-brand-gray-muted leading-relaxed">
            Selecciona el año y los meses que deseas exportar. Cada mes se generará en una página individual (formato horizontal A4) dentro del archivo PDF.
          </p>

          {/* Selector de Año */}
          <div className="flex items-center gap-3 bg-brand-black-hover/40 p-3 rounded-lg border border-brand-black-border">
            <label className="text-xs font-semibold text-brand-gray-muted">Año a exportar:</label>
            <select
              value={pdfSelectedYear}
              onChange={(e) => setPdfSelectedYear(Number(e.target.value))}
              className="bg-brand-black border border-brand-black-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-red-600"
            >
              {[year - 1, year, year + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Acciones Rápidas */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPdfSelectedMonths([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])}
              className="px-2.5 py-1 text-[11px] font-semibold bg-brand-black border border-brand-black-border hover:bg-brand-black-hover rounded text-brand-gray-light transition-colors"
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setPdfSelectedMonths([])}
              className="px-2.5 py-1 text-[11px] font-semibold bg-brand-black border border-brand-black-border hover:bg-brand-black-hover rounded text-brand-gray-light transition-colors"
            >
              Ninguno
            </button>
            <button
              type="button"
              onClick={() => setPdfSelectedMonths([month])}
              className="px-2.5 py-1 text-[11px] font-semibold bg-brand-black border border-brand-black-border hover:bg-brand-black-hover rounded text-brand-gray-light transition-colors"
            >
              Solo mes actual ({monthNames[month]})
            </button>
          </div>

          {/* Cuadrícula de Meses */}
          <div className="grid grid-cols-3 gap-2">
            {monthNames.map((mName, mIdx) => {
              const isSelected = pdfSelectedMonths.includes(mIdx);
              return (
                <label
                  key={mIdx}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all select-none ${
                    isSelected
                      ? 'bg-brand-red-600/10 border-brand-red-600 text-white shadow-glow-red'
                      : 'bg-brand-black-card border-brand-black-border text-brand-gray-muted hover:border-brand-gray-light/30 hover:text-brand-gray-light'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {
                      if (isSelected) {
                        setPdfSelectedMonths(pdfSelectedMonths.filter((m) => m !== mIdx));
                      } else {
                        setPdfSelectedMonths([...pdfSelectedMonths, mIdx]);
                      }
                    }}
                    className="sr-only"
                  />
                  <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] font-bold ${
                    isSelected ? 'border-brand-red-500 bg-brand-red-600 text-white' : 'border-brand-black-border bg-brand-black text-transparent'
                  }`}>
                    {isSelected && '✓'}
                  </div>
                  {mName}
                </label>
              );
            })}
          </div>

          {/* Acciones del Modal */}
          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-brand-black-border">
            <button
              type="button"
              onClick={() => setIsPDFModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold bg-brand-black border border-brand-black-border hover:bg-brand-black-hover rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleExportPDFSubmit}
              className="px-4 py-2 text-xs font-semibold bg-brand-red-600 hover:bg-brand-red-700 text-white rounded-lg transition-colors shadow-glow-red"
            >
              Descargar PDF
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
