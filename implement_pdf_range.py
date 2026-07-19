import re

with open('/Users/victorzandal/Proyectos/App-UD-Atzeneta/src/pages/Calendar.tsx', 'r') as f:
    content = f.read()

# 1. State
state_search = "const [eventFilter, setEventFilter] = useState<'all' | 'trainings' | 'matches' | 'social'>('all');"
state_replace = """const [eventFilter, setEventFilter] = useState<'all' | 'trainings' | 'matches' | 'social'>('all');

  const formatDateToYMD = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [pdfStartDate, setPdfStartDate] = useState<string>(formatDateToYMD(new Date()));
  const [pdfEndDate, setPdfEndDate] = useState<string>(formatDateToYMD(new Date(new Date().setDate(new Date().getDate() + 30))));"""
content = content.replace(state_search, state_replace)

# 2. Add custom range grid logic
custom_grid_search = "const prevRange = () => {"
custom_grid_replace = """const getCustomRangeGrids = (startStr: string, endStr: string): CalendarGridData[] => {
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
  };

  const prevRange = () => {"""
content = content.replace(custom_grid_search, custom_grid_replace)

# 3. Replace handleExportPDF
export_pdf_search = """  const handleExportPDF = async () => {
    showToast('info', 'Generando PDF', 'Estamos preparando tu vista actual, por favor espera...');

    try {
      const { exportCalendarToPDF } = await import('../utils/export');
      
      const filename = `Calendario_${displayTitle.replace(/\s+/g, '_')}`;

      await exportCalendarToPDF(
        `Calendario Deportivo`,
        filename,
        calendarGrids,
        getEventsForDateObj
      );
      showToast('success', 'PDF Descargado', 'Se ha descargado el archivo PDF con éxito.');
    } catch (error: any) {
      showToast('error', 'Error al exportar', error.message || 'Ocurrió un error al generar el PDF.');
    }
  };"""
export_pdf_replace = """  const handleExportPDF = () => {
    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    calendarGrids.forEach(g => g.days.forEach(d => {
       if (d.isCurrentRange) {
         if (!minDate || d.date < minDate) minDate = d.date;
         if (!maxDate || d.date > maxDate) maxDate = d.date;
       }
    }));
    
    setPdfStartDate(minDate ? formatDateToYMD(minDate) : formatDateToYMD(new Date()));
    setPdfEndDate(maxDate ? formatDateToYMD(maxDate) : formatDateToYMD(new Date()));
    setIsPDFModalOpen(true);
  };

  const handleExportPDFSubmit = async () => {
    if (!pdfStartDate || !pdfEndDate) {
      showToast('error', 'Faltan fechas', 'Por favor selecciona la fecha de inicio y fin.');
      return;
    }
    if (new Date(pdfStartDate) > new Date(pdfEndDate)) {
      showToast('error', 'Fechas inválidas', 'La fecha final debe ser igual o posterior a la inicial.');
      return;
    }

    setIsPDFModalOpen(false);
    showToast('info', 'Generando PDF', 'Estamos preparando el rango seleccionado...');

    try {
      const { exportCalendarToPDF } = await import('../utils/export');
      
      const customGrids = getCustomRangeGrids(pdfStartDate, pdfEndDate);
      const filename = `Calendario_${pdfStartDate}_al_${pdfEndDate}`;

      await exportCalendarToPDF(
        `Calendario Deportivo`,
        filename,
        customGrids,
        getEventsForDateObj
      );
      showToast('success', 'PDF Descargado', 'Se ha descargado el archivo PDF con éxito.');
    } catch (error: any) {
      showToast('error', 'Error al exportar', error.message || 'Ocurrió un error al generar el PDF.');
    }
  };"""
content = content.replace(export_pdf_search, export_pdf_replace)

# 4. Add the Modal UI
modal_ui = """      {/* MODAL DE SELECCIÓN DE EXPORTACIÓN PDF */}
      <Modal
        isOpen={isPDFModalOpen}
        onClose={() => setIsPDFModalOpen(false)}
        title="Exportar Calendario a PDF"
      >
        <div className="flex flex-col gap-5 text-brand-gray-light">
          <p className="text-xs text-brand-gray-muted leading-relaxed">
            Selecciona el rango exacto de fechas que deseas exportar. El sistema agrupará el PDF automáticamente por meses, atenuando los días que queden fuera de tu selección.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-brand-gray-muted">Fecha Desde</label>
              <input
                type="date"
                value={pdfStartDate}
                onChange={(e) => setPdfStartDate(e.target.value)}
                className="input-base"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-brand-gray-muted">Fecha Hasta</label>
              <input
                type="date"
                value={pdfEndDate}
                onChange={(e) => setPdfEndDate(e.target.value)}
                className="input-base"
                min={pdfStartDate}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-brand-black-border">
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
              Generar y Descargar PDF
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};"""
content = content.replace("    </div>\n  );\n};\n", modal_ui)

with open('/Users/victorzandal/Proyectos/App-UD-Atzeneta/src/pages/Calendar.tsx', 'w') as f:
    f.write(content)
