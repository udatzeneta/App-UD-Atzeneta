import re

with open('/Users/victorzandal/Proyectos/App-UD-Atzeneta/src/pages/Calendar.tsx', 'r') as f:
    content = f.read()

old_func = """  const getCustomRangeGrids = (startStr: string, endStr: string): CalendarGridData[] => {
    const startParts = startStr.split('-');
    const endParts = endStr.split('-');
    if (startParts.length !== 3 || endParts.length !== 3) return [];
    
    const start = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]));
    const end = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));
    
    if (start > end) return [];

    const grids: CalendarGridData[] = [];
    const currentMonth = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

    while (currentMonth <= endMonth) {
      const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const dayOfWeek = (firstDay.getDay() + 6) % 7;
      const startDay = new Date(firstDay);
      startDay.setDate(firstDay.getDate() - dayOfWeek);
      
      const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      const endDayOfWeek = (lastDay.getDay() + 6) % 7;
      const daysToAddAtEnd = 6 - endDayOfWeek;
      const totalDays = dayOfWeek + lastDay.getDate() + daysToAddAtEnd;
      
      grids.push({
        title: `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`,
        year: currentMonth.getFullYear(),
        month: currentMonth.getMonth(),
        days: getDaysArray(startDay, totalDays).map(d => ({
          date: d,
          isCurrentRange: d.getTime() >= start.getTime() && d.getTime() <= end.getTime()
        }))
      });
      
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }
    
    return grids;
  };"""

new_func = """  const getCustomRangeGrids = (startStr: string, endStr: string): CalendarGridData[] => {
    const startParts = startStr.split('-');
    const endParts = endStr.split('-');
    if (startParts.length !== 3 || endParts.length !== 3) return [];
    
    const start = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]));
    const end = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));
    
    if (start > end) return [];

    const firstGridDay = new Date(start);
    const startDayOfWeek = (firstGridDay.getDay() + 6) % 7;
    firstGridDay.setDate(firstGridDay.getDate() - startDayOfWeek);
    
    const lastGridDay = new Date(end);
    const endDayOfWeek = (lastGridDay.getDay() + 6) % 7;
    lastGridDay.setDate(lastGridDay.getDate() + (6 - endDayOfWeek));

    const totalDays = Math.round((lastGridDay.getTime() - firstGridDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const allDays = getDaysArray(firstGridDay, totalDays).map(d => ({
        date: d,
        isCurrentRange: d.getTime() >= start.getTime() && d.getTime() <= end.getTime()
    }));

    const grids: CalendarGridData[] = [];
    const MAX_DAYS_PER_PAGE = 42; // Max 6 weeks per page

    for (let i = 0; i < allDays.length; i += MAX_DAYS_PER_PAGE) {
      const chunk = allDays.slice(i, i + MAX_DAYS_PER_PAGE);
      const activeDays = chunk.filter(d => d.isCurrentRange);
      const firstDayInChunk = activeDays.length > 0 ? activeDays[0].date : chunk[0].date;
      
      // Calculate month title dynamically
      const monthsInChunk = Array.from(new Set(activeDays.map(d => monthNames[d.date.getMonth()])));
      let title = monthsInChunk.join(' - ');
      if (monthsInChunk.length === 0) title = monthNames[firstDayInChunk.getMonth()];
      title += ` ${firstDayInChunk.getFullYear()}`;

      grids.push({
        title: title,
        year: firstDayInChunk.getFullYear(),
        month: firstDayInChunk.getMonth(),
        days: chunk
      });
    }

    return grids;
  };"""

content = content.replace(old_func, new_func)

with open('/Users/victorzandal/Proyectos/App-UD-Atzeneta/src/pages/Calendar.tsx', 'w') as f:
    f.write(content)
