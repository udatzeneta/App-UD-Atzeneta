import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/Modal';
import { Training, Match } from '../types';
import {
  Dumbbell, Trophy, ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  Clock, MapPin, Plus, Target, Users
} from 'lucide-react';

type EventType = 'training' | 'match';

interface CalendarEvent {
  id: string;
  type: EventType;
  date: string;
  title: string;
  subtitle: string;
  time?: string;
  location?: string;
}

export const Calendar: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'select' | 'training' | 'match'>('select');

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

  const getEventsForDate = (day: number): CalendarEvent[] => {
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const targetDateStr = `${year}-${monthStr}-${dayStr}`;

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
        location: m.location || (m.is_local ? 'Local (El Porrejat)' : 'Visitante')
      }));

    return [...dateTrainings, ...dateMatches];
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

  const getMonthEvents = () => {
    const list: { day: number; events: CalendarEvent[] }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayEvts = getEventsForDate(d);
      if (dayEvts.length > 0) {
        list.push({ day: d, events: dayEvts });
      }
    }
    return list.sort((a, b) => a.day - b.day);
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
      observations: ''
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
      score_us: null,
      score_them: null
    });
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
      <div className="flex items-center gap-4 bg-brand-black border border-brand-black-border px-4 py-3 rounded-xl">
        <span className="text-xs font-semibold uppercase tracking-wider text-brand-gray-muted">Leyenda:</span>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-brand-red-600/20 border border-brand-red-600/30"></div>
          <span className="text-xs text-brand-gray-muted">Entrenamiento</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-yellow-500/20 border border-yellow-500/30"></div>
          <span className="text-xs text-brand-gray-muted">Partido</span>
        </div>
        {(canCreateTraining || canCreateMatch) && (
          <div className="flex items-center gap-2 ml-auto">
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
            const hasTraining = trainingCount > 0;
            const hasMatch = matchCount > 0;
            const hasToday = day && isToday(day);

            let cellClass = '';
            if (!day) {
              cellClass = 'bg-brand-black-bg/30 opacity-30 select-none min-h-[150px] p-2';
            } else {
              cellClass = 'min-h-[150px] p-2 flex flex-col gap-1.5 transition-all duration-200 border-t-4 relative ';
              
              if (hasMatch && hasTraining) {
                cellClass += 'bg-gradient-to-br from-yellow-600/30 to-brand-red-600/30 border-t-yellow-500 hover:from-yellow-600/40 hover:to-brand-red-600/40';
              } else if (hasMatch) {
                cellClass += 'bg-yellow-500/25 border-t-yellow-500 hover:bg-yellow-500/35';
              } else if (hasTraining) {
                cellClass += 'bg-brand-red-600/25 border-t-brand-red-600 hover:bg-brand-red-600/35';
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
                    return (
                      <div
                        key={eIdx}
                        className={`text-[10px] p-1.5 rounded-lg border flex flex-col gap-0.5 leading-tight ${
                          isTraining
                            ? 'bg-brand-red-600/40 text-brand-red-200 border-brand-red-500/40 font-medium'
                            : 'bg-yellow-600/40 text-yellow-200 border-yellow-500/40 font-medium'
                        }`}
                        title={`${evt.title} - ${evt.time || ''} - ${evt.location || ''}`}
                      >
                        <div className="flex items-center gap-1 font-bold truncate">
                          {isTraining ? <Dumbbell className="w-3 h-3 shrink-0 text-brand-red-400" /> : <Trophy className="w-3 h-3 shrink-0 text-yellow-400" />}
                          <span className="truncate">{evt.title}</span>
                        </div>
                        {evt.time && <div className="text-[9px] opacity-90 truncate font-semibold">🕒 {evt.time}</div>}
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
                    return (
                      <div
                        key={eIdx}
                        className="bg-brand-black-card border border-brand-black-border p-4 rounded-xl flex gap-3.5 items-start shadow-premium"
                      >
                        <div className={`p-2.5 rounded-lg shrink-0 ${
                          isTraining ? 'bg-brand-red-600/10 text-brand-red-600' : 'bg-yellow-500/10 text-yellow-500'
                        }`}>
                          {isTraining ? <Dumbbell className="w-5 h-5" /> : <Trophy className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-brand-gray-light leading-snug">
                            {evt.title}
                          </h4>
                          <p className="text-xs text-brand-gray-muted mt-0.5">{evt.subtitle}</p>

                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-xs text-brand-gray-muted">
                            {evt.time && (
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" /> {evt.time}
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
                  return (
                    <div 
                      key={eIdx}
                      className="bg-brand-black/40 border border-brand-black-border p-3 rounded-lg flex items-start gap-3"
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 ${
                        isTraining ? 'bg-brand-red-600/10 text-brand-red-600' : 'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {isTraining ? <Dumbbell className="w-4 h-4" /> : <Trophy className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h5 className="text-xs font-semibold text-brand-gray-light truncate">{evt.title}</h5>
                          {evt.time && (
                            <span className="text-[10px] text-brand-gray-muted flex items-center gap-1 shrink-0 font-medium">
                              <Clock className="w-3.5 h-3.5" /> {evt.time}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-brand-gray-muted mt-0.5">{evt.subtitle}</p>
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
              <div className="grid grid-cols-2 gap-3">
                {canCreateTraining && (
                  <button
                    onClick={handleOpenTrainingForm}
                    className="p-4 bg-brand-black-card border border-brand-black-border rounded-xl hover:border-brand-red-600/50 hover:bg-brand-red-600/5 transition-all group"
                  >
                    <Dumbbell className="w-8 h-8 text-brand-red-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-semibold text-brand-gray-light block">Entrenamiento</span>
                    <span className="text-xs text-brand-gray-muted">Sesión de entrenamiento</span>
                  </button>
                )}

                {canCreateMatch && (
                  <button
                    onClick={handleOpenMatchForm}
                    className="p-4 bg-brand-black-card border border-brand-black-border rounded-xl hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-all group"
                  >
                    <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-semibold text-brand-gray-light block">Partido</span>
                    <span className="text-xs text-brand-gray-muted">Competición oficial</span>
                  </button>
                )}
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
          <div className="grid grid-cols-2 gap-3">
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
            <input
              type="text"
              className="form-input"
              placeholder="Ej. CD Alcoyano, Ontinyent 1931 CF..."
              value={matchForm.rival}
              onChange={(e) => setMatchForm(prev => ({ ...prev, rival: e.target.value }))}
              required
            />
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
    </div>
  );
};
