import re

with open('/Users/victorzandal/Proyectos/App-UD-Atzeneta/src/pages/Calendar.tsx', 'r') as f:
    content = f.read()

# 1. State changes
content = content.replace("const [selectedDay, setSelectedDay] = useState<number | null>(null);", 
"const [selectedDate, setSelectedDate] = useState<Date | null>(null);\n  const [viewMode, setViewMode] = useState<'1_week' | '2_weeks' | '1_month' | '2_months'>('1_month');")

# 2. Logic changes
logic_to_replace = """  const year = currentDate.getFullYear();
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
  
  const filteredMonthEventsList = monthEventsList.map(item => ({
    day: item.day,
    events: item.events.filter(e => eventFilter === 'all' || e.type === (eventFilter === 'trainings' ? 'training' : eventFilter === 'matches' ? 'match' : 'social'))
  })).filter(item => item.events.length > 0);

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year
    );
  };"""

new_logic = """  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const getDaysArray = (start: Date, daysCount: number) => {
    return Array.from({ length: daysCount }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  type CalendarGridData = {
    title: string;
    days: { date: Date; isCurrentRange: boolean }[];
    year: number;
    month: number;
  };

  const getMonthGrid = (date: Date): CalendarGridData => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfWeek = (firstDay.getDay() + 6) % 7;
    const startDay = new Date(firstDay);
    startDay.setDate(firstDay.getDate() - dayOfWeek);
    
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const endDayOfWeek = (lastDay.getDay() + 6) % 7;
    const daysToAddAtEnd = 6 - endDayOfWeek;
    const totalDays = dayOfWeek + lastDay.getDate() + daysToAddAtEnd;
    
    return {
      title: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
      year: date.getFullYear(),
      month: date.getMonth(),
      days: getDaysArray(startDay, totalDays).map(d => ({
        date: d,
        isCurrentRange: d.getMonth() === date.getMonth()
      }))
    };
  };

  let calendarGrids: CalendarGridData[] = [];
  let displayTitle = '';

  if (viewMode === '1_month') {
    const grid = getMonthGrid(currentDate);
    calendarGrids = [grid];
    displayTitle = grid.title;
  } else if (viewMode === '2_months') {
    const grid1 = getMonthGrid(currentDate);
    const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    const grid2 = getMonthGrid(nextDate);
    calendarGrids = [grid1, grid2];
    displayTitle = `${monthNames[currentDate.getMonth()]} - ${monthNames[nextDate.getMonth()]} ${currentDate.getFullYear()}`;
  } else if (viewMode === '1_week') {
    const dayOfWeek = (currentDate.getDay() + 6) % 7;
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - dayOfWeek);
    const days = getDaysArray(startOfWeek, 7).map(date => ({ date, isCurrentRange: true }));
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
       displayTitle = `${startOfWeek.getDate()} - ${endOfWeek.getDate()} ${monthNames[startOfWeek.getMonth()]} ${startOfWeek.getFullYear()}`;
    } else {
       displayTitle = `${startOfWeek.getDate()} ${monthNames[startOfWeek.getMonth()].substring(0,3)} - ${endOfWeek.getDate()} ${monthNames[endOfWeek.getMonth()].substring(0,3)} ${endOfWeek.getFullYear()}`;
    }
    calendarGrids = [{ title: displayTitle, days, year: currentDate.getFullYear(), month: currentDate.getMonth() }];
  } else if (viewMode === '2_weeks') {
    const dayOfWeek = (currentDate.getDay() + 6) % 7;
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - dayOfWeek);
    const days = getDaysArray(startOfWeek, 14).map(date => ({ date, isCurrentRange: true }));
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 13);
    if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
       displayTitle = `${startOfWeek.getDate()} - ${endOfWeek.getDate()} ${monthNames[startOfWeek.getMonth()]} ${startOfWeek.getFullYear()}`;
    } else {
       displayTitle = `${startOfWeek.getDate()} ${monthNames[startOfWeek.getMonth()].substring(0,3)} - ${endOfWeek.getDate()} ${monthNames[endOfWeek.getMonth()].substring(0,3)} ${endOfWeek.getFullYear()}`;
    }
    calendarGrids = [{ title: displayTitle, days, year: currentDate.getFullYear(), month: currentDate.getMonth() }];
  }

  const prevRange = () => {
    const newDate = new Date(currentDate);
    if (viewMode === '1_week') newDate.setDate(newDate.getDate() - 7);
    else if (viewMode === '2_weeks') newDate.setDate(newDate.getDate() - 14);
    else if (viewMode === '1_month') newDate.setMonth(newDate.getMonth() - 1);
    else if (viewMode === '2_months') newDate.setMonth(newDate.getMonth() - 2);
    setCurrentDate(newDate);
  };

  const nextRange = () => {
    const newDate = new Date(currentDate);
    if (viewMode === '1_week') newDate.setDate(newDate.getDate() + 7);
    else if (viewMode === '2_weeks') newDate.setDate(newDate.getDate() + 14);
    else if (viewMode === '1_month') newDate.setMonth(newDate.getMonth() + 1);
    else if (viewMode === '2_months') newDate.setMonth(newDate.getMonth() + 2);
    setCurrentDate(newDate);
  };

  const getEventsForDateObj = (date: Date): CalendarEvent[] => {
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth() + 1;
    const day = date.getDate();
    const monthStr = String(targetMonth).padStart(2, '0');
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

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setModalType('select');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDate(null);
    setModalType('select');
  };

  const getEventsListForGrid = (grid: CalendarGridData) => {
    const list: { date: Date; events: CalendarEvent[] }[] = [];
    grid.days.forEach(dayInfo => {
       if (!dayInfo.isCurrentRange && viewMode.includes('month')) return;
       const dayEvts = getEventsForDateObj(dayInfo.date);
       if (dayEvts.length > 0) {
         list.push({ date: dayInfo.date, events: dayEvts });
       }
    });
    return list;
  };

  const allEventsList = calendarGrids.flatMap(grid => getEventsListForGrid(grid));
  const filteredEventsList = allEventsList.map(item => ({
    date: item.date,
    events: item.events.filter(e => eventFilter === 'all' || e.type === (eventFilter === 'trainings' ? 'training' : eventFilter === 'matches' ? 'match' : 'social'))
  })).filter(item => item.events.length > 0);

  const isTodayObj = (date: Date) => {
    const today = new Date();
    return (
      today.getDate() === date.getDate() &&
      today.getMonth() === date.getMonth() &&
      today.getFullYear() === date.getFullYear()
    );
  };"""

content = content.replace(logic_to_replace, new_logic)

# Replace targetDay calculation in handleSubmit
content = content.replace("const targetDay = selectedDay || defaultDay;", "const targetDate = selectedDate || currentDate;\n    const targetDay = targetDate.getDate();\n    const targetMonth = targetDate.getMonth() + 1;\n    const targetYear = targetDate.getFullYear();")
content = content.replace("const targetDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;", "const targetDateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;")

# Replace prevMonth/nextMonth with prevRange/nextRange
content = content.replace("onClick={prevMonth}", "onClick={prevRange}")
content = content.replace("onClick={nextMonth}", "onClick={nextRange}")
content = content.replace("{monthNames[month]} {year}", "{displayTitle}")

# Now fix the Desktop Grid rendering
desktop_grid_to_replace = """      <div className="hidden md:block bg-brand-black border border-brand-black-border rounded-xl overflow-hidden shadow-premium">
        {/* Días de la semana */}
        <div className="grid grid-cols-7 border-b border-brand-black-border bg-brand-black-hover/40 text-center font-semibold text-xs py-3 text-brand-gray-muted">
          {dayNames.map(d => <div key={d}>{d}</div>)}
        </div>

        {/* Cuadrícula de días */}
        <div className="grid grid-cols-7 gap-[1px] bg-brand-black-border border-l border-t border-r border-b border-brand-black-border">
          {calendarDays.map((day, idx) => {
            const events = day ? getEventsForDate(day) : [];
            const filteredEvents = events.filter(e => eventFilter === 'all' || e.type === (eventFilter === 'trainings' ? 'training' : eventFilter === 'matches' ? 'match' : 'social'));
            const trainingCount = filteredEvents.filter(e => e.type === 'training').length;
            const matchCount = filteredEvents.filter(e => e.type === 'match').length;
            const socialCount = filteredEvents.filter(e => e.type === 'social').length;
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
                  {day && filteredEvents.slice(0, 3).map((evt, eIdx) => {"""

desktop_grid_new = """      {calendarGrids.map((grid, gIdx) => (
        <div key={gIdx} className="hidden md:block bg-brand-black border border-brand-black-border rounded-xl overflow-hidden shadow-premium mb-6">
          {viewMode === '2_months' && (
            <div className="bg-brand-black-hover/50 border-b border-brand-black-border px-4 py-3 text-center font-bold text-sm text-brand-gray-light">
              {grid.title}
            </div>
          )}
          {/* Días de la semana */}
          <div className="grid grid-cols-7 border-b border-brand-black-border bg-brand-black-hover/40 text-center font-semibold text-xs py-3 text-brand-gray-muted">
            {dayNames.map(d => <div key={d}>{d}</div>)}
          </div>

          {/* Cuadrícula de días */}
          <div className="grid grid-cols-7 gap-[1px] bg-brand-black-border border-l border-t border-r border-b border-brand-black-border">
            {grid.days.map((dayInfo, idx) => {
              const dayDate = dayInfo.date;
              const events = getEventsForDateObj(dayDate);
              const filteredEvents = events.filter(e => eventFilter === 'all' || e.type === (eventFilter === 'trainings' ? 'training' : eventFilter === 'matches' ? 'match' : 'social'));
              const trainingCount = filteredEvents.filter(e => e.type === 'training').length;
              const matchCount = filteredEvents.filter(e => e.type === 'match').length;
              const socialCount = filteredEvents.filter(e => e.type === 'social').length;
              const hasTraining = trainingCount > 0;
              const hasMatch = matchCount > 0;
              const hasSocial = socialCount > 0;
              const hasToday = isTodayObj(dayDate);

              let cellClass = 'min-h-[150px] p-2 flex flex-col gap-1.5 transition-all duration-200 border-t-4 relative ';
              
              if (!dayInfo.isCurrentRange && viewMode.includes('month')) {
                cellClass += 'bg-brand-black-bg/40 opacity-50 border-t-brand-black-border';
              } else {
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
                  onClick={() => (canCreateTraining || canCreateMatch) && handleDayClick(dayDate)}
                  className={cellClass}
                >
                  {/* Número del día */}
                  <div className="flex justify-between items-center">
                    <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                      hasToday
                        ? 'bg-brand-red-600 text-white shadow-glow-red'
                        : !dayInfo.isCurrentRange && viewMode.includes('month')
                        ? 'text-brand-gray-muted'
                        : 'text-brand-gray-light font-extrabold'
                    }`}>
                      {dayDate.getDate()}
                    </span>
                    {(canCreateTraining || canCreateMatch) && (
                      <Plus className="w-3.5 h-3.5 text-brand-gray-muted hover:text-brand-gray-light" />
                    )}
                  </div>

                  {/* Eventos */}
                  <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
                    {filteredEvents.slice(0, 3).map((evt, eIdx) => {"""

content = content.replace(desktop_grid_to_replace, desktop_grid_new)

# Fix remaining `day &&` in desktop grid
content = content.replace("              </div>\n            );\n          })}\n        </div>\n      </div>", "              </div>\n            );\n          })}\n        </div>\n      </div>\n      ))}")

content = content.replace("{/* Contadores */}\n                {day && filteredEvents.length > 0 && (", "{/* Contadores */}\n                {filteredEvents.length > 0 && (")

# Now Mobile list replacement
mobile_list_replace = """        {filteredMonthEventsList.length === 0 ? ("""
mobile_list_new = """        {filteredEventsList.length === 0 ? ("""
content = content.replace(mobile_list_replace, mobile_list_new)

mobile_list_replace2 = """            {filteredMonthEventsList.map(({ day, events }) => ("""
mobile_list_new2 = """            {filteredEventsList.map(({ date, events }, idx) => (
              <div key={idx} className="space-y-2">
                <div className="sticky top-0 bg-brand-black-bg/90 backdrop-blur-sm py-1.5 flex items-center gap-2 border-b border-brand-black-border z-10">
                  <span className="text-xs font-bold text-brand-red-600 bg-brand-red-600/10 px-2.5 py-0.5 rounded-full">
                    {date.getDate()} {monthNames[date.getMonth()].substring(0,3)}
                  </span>
                  <div className="h-px bg-brand-black-border flex-1" />
                </div>

                <div className="space-y-2.5">"""
content = content.replace("""            {filteredMonthEventsList.map(({ day, events }) => (
              <div key={day} className="space-y-2">
                <div className="sticky top-0 bg-brand-black-bg/90 backdrop-blur-sm py-1.5 flex items-center gap-2 border-b border-brand-black-border z-10">
                  <span className="text-xs font-bold text-brand-red-600 bg-brand-red-600/10 px-2.5 py-0.5 rounded-full">
                    Día {day}
                  </span>
                  <div className="h-px bg-brand-black-border flex-1" />
                </div>

                <div className="space-y-2.5">""", mobile_list_new2)

# Fix adding event default
content = content.replace("setSelectedDay(1);", "setSelectedDate(new Date(year, month, 1));")
content = content.replace("setSelectedDay(null);", "setSelectedDate(null);")

# Fix PDF modal
content = content.replace("title={selectedDay ? `Eventos del Día ${selectedDay} de ${monthNames[month]}` : `Añadir Evento - ${monthNames[month]}`}",
"title={selectedDate ? `Eventos del Día ${selectedDate.getDate()} de ${monthNames[selectedDate.getMonth()]}` : `Añadir Evento`}")
content = content.replace("          {selectedDay && getEventsForDate(selectedDay).length > 0 && (",
"          {selectedDate && getEventsForDateObj(selectedDate).length > 0 && (")
content = content.replace("                {getEventsForDate(selectedDay).map((evt, eIdx) => {",
"                {getEventsForDateObj(selectedDate).map((evt, eIdx) => {")
content = content.replace("{selectedDay && getEventsForDate(selectedDay).length > 0 ? 'Añadir otro evento:' : 'Selecciona el tipo de evento:'}",
"{selectedDate && getEventsForDateObj(selectedDate).length > 0 ? 'Añadir otro evento:' : 'Selecciona el tipo de evento:'}")

# Add ViewMode selector
view_mode_ui = """            <button
              onClick={() => setCurrentDate(new Date())}
              className="ml-2 px-3 py-1.5 text-xs font-medium bg-brand-red-600 hover:bg-brand-red-700 text-white rounded-lg transition-colors"
            >
              Hoy
            </button>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as '1_week' | '2_weeks' | '1_month' | '2_months')}
              className="ml-2 bg-brand-black-card text-brand-gray-light text-xs font-semibold px-2 py-1.5 rounded-lg border border-brand-black-border outline-none"
            >
              <option value="1_week">1 Semana</option>
              <option value="2_weeks">2 Semanas</option>
              <option value="1_month">1 Mes</option>
              <option value="2_months">2 Meses</option>
            </select>"""
content = content.replace("""            <button
              onClick={() => setCurrentDate(new Date())}
              className="ml-2 px-3 py-1.5 text-xs font-medium bg-brand-red-600 hover:bg-brand-red-700 text-white rounded-lg transition-colors"
            >
              Hoy
            </button>""", view_mode_ui)


with open('/Users/victorzandal/Proyectos/App-UD-Atzeneta/src/pages/Calendar.tsx', 'w') as f:
    f.write(content)
