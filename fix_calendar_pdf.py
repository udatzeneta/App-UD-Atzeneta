import re

with open('/Users/victorzandal/Proyectos/App-UD-Atzeneta/src/pages/Calendar.tsx', 'r') as f:
    content = f.read()

# Replace the handleExportPDF
export_logic_to_replace = """  const handleExportPDF = () => {
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

      const startMonth = monthNames[sortedMonths[0]];
      const endMonth = monthNames[sortedMonths[sortedMonths.length - 1]];
      const filename = sortedMonths.length > 1 
        ? `Calendario_${startMonth}_a_${endMonth}_${pdfSelectedYear}`
        : `Calendario_${startMonth}_${pdfSelectedYear}`;

      await exportCalendarToPDF(
        `Calendario Deportivo ${pdfSelectedYear}`,
        filename,
        monthsPayload
      );
      showToast('success', 'PDF Descargado', 'Se ha descargado el archivo PDF con éxito.');
    } catch (error: any) {
      showToast('error', 'Error al exportar', error.message || 'Ocurrió un error al generar el PDF.');
    }
  };"""

new_export_logic = """  const handleExportPDF = async () => {
    showToast('info', 'Generando PDF', 'Estamos preparando tu vista actual, por favor espera...');

    try {
      const { exportCalendarToPDF } = await import('../utils/export');
      
      const filename = `Calendario_${displayTitle.replace(/\\s+/g, '_')}`;

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

content = content.replace(export_logic_to_replace, new_export_logic)

# Remove the Modal for PDF export
modal_start = """      {/* Modal para Exportación PDF Múltiple */}"""
modal_end = """              </div>
            </div>
          </div>
        </div>
      )}"""

start_idx = content.find(modal_start)
if start_idx != -1:
    end_idx = content.find(modal_end, start_idx) + len(modal_end)
    content = content[:start_idx] + content[end_idx:]

with open('/Users/victorzandal/Proyectos/App-UD-Atzeneta/src/pages/Calendar.tsx', 'w') as f:
    f.write(content)
