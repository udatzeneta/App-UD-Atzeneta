import re

with open('/Users/victorzandal/Proyectos/App-UD-Atzeneta/src/utils/export.ts', 'r') as f:
    content = f.read()

start_str = "export const exportCalendarToPDF = async ("
end_str = "  doc.save(`${filename}.pdf`);\n};\n"

start_idx = content.find(start_str)
end_idx = content.find(end_str, start_idx) + len(end_str)

new_func = """export const exportCalendarToPDF = async (
  title: string,
  filename: string,
  grids: {
    title: string;
    days: { date: Date; isCurrentRange: boolean }[];
    year: number;
    month: number;
  }[],
  getEvents: (date: Date) => any[]
): Promise<void> => {
  const { jsPDF } = await import('jspdf');

  // Crear documento en formato horizontal (Landscape), A4 (297 mm x 210 mm)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Pre-cargar el escudo del club en memoria como Base64 para que se dibuje de forma idéntica en cada página
  let logoData: string | null = null;
  try {
    const logoResponse = await fetch('/club-logo.png');
    const logoBlob = await logoResponse.blob();
    const logoReader = new FileReader();

    logoData = await new Promise<string>((resolve, reject) => {
      logoReader.onload = () => resolve(logoReader.result as string);
      logoReader.onerror = reject;
      logoReader.readAsDataURL(logoBlob);
    });
  } catch (error) {
    console.warn('No se pudo cargar el logo del club para el PDF:', error);
  }

  // Generar cada cuadrícula en una página separada
  for (let gIdx = 0; gIdx < grids.length; gIdx++) {
    const grid = grids[gIdx];

    // Si no es la primera cuadrícula, añadir una nueva página al documento
    if (gIdx > 0) {
      doc.addPage();
    }

    // 1. Dibujar el banner superior de rayas rojas y negras
    const stripeWidth = 10;
    const bannerHeight = 5;
    const numStripes = Math.ceil(doc.internal.pageSize.width / stripeWidth);
    for (let i = 0; i < numStripes; i++) {
      const isRed = i % 2 === 0;
      doc.setFillColor(isRed ? 193 : 15, isRed ? 18 : 15, isRed ? 31 : 15);
      doc.rect(i * stripeWidth, 0, stripeWidth, bannerHeight, 'F');
    }

    // 2. Colocar el escudo del club
    if (logoData) {
      doc.addImage(logoData, 'PNG', doc.internal.pageSize.width - 25, 8, 16, 16, undefined, 'FAST');
    }

    // 3. Título e info general de la página actual
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(193, 18, 31); // Rojo UD Atzeneta
    doc.text(`Calendario - ${grid.title}`, 10, 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(110, 110, 110);
    doc.text(`UD Atzeneta · Generado el ${new Date().toLocaleDateString('es-ES')}`, 10, 21);

    // 4. Dibujar la leyenda de colores de eventos
    const legendY = 26;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');

    // Entrenamiento: Rojo
    doc.setFillColor(193, 18, 31);
    doc.rect(10, legendY - 3, 3, 3, 'F');
    doc.setTextColor(50, 50, 50);
    doc.text('Entrenamiento', 14, legendY - 0.7);

    // Partido: Amarillo/Dorado
    doc.setFillColor(234, 179, 8);
    doc.rect(42, legendY - 3, 3, 3, 'F');
    doc.text('Partido', 46, legendY - 0.7);

    // Evento Social: Morado
    doc.setFillColor(168, 85, 247);
    doc.rect(65, legendY - 3, 3, 3, 'F');
    doc.text('Ev. Social', 69, legendY - 0.7);

    // 5. Cabeceras de los días de la semana (Lunes a Domingo)
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const cellWidth = (doc.internal.pageSize.width - 20) / 7; // Márgenes de 10mm a cada lado
    const headerY = 30;
    const headerHeight = 5.5;

    dayNames.forEach((dName, i) => {
      const x = 10 + i * cellWidth;
      doc.setFillColor(15, 15, 15); // Negro
      doc.rect(x, headerY, cellWidth, headerHeight, 'F');
      
      doc.setDrawColor(60, 60, 60);
      doc.setLineWidth(0.15);
      doc.rect(x, headerY, cellWidth, headerHeight, 'D');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      const textWidth = doc.getTextWidth(dName);
      doc.text(dName, x + (cellWidth - textWidth) / 2, headerY + 3.8);
    });

    const topOffset = headerY + headerHeight; // y = 35.5
    const availableHeight = doc.internal.pageSize.height - topOffset - 10; // Dejar 10mm de margen inferior
    const numWeeks = Math.ceil(grid.days.length / 7);
    const cellHeight = availableHeight / numWeeks;

    grid.days.forEach((dayInfo, idx) => {
      const col = idx % 7;
      const row = Math.floor(idx / 7);
      const x = 10 + col * cellWidth;
      const y = topOffset + row * cellHeight;

      if (!dayInfo.isCurrentRange && grid.days.length > 14) {
        // Celda inactiva (desfase de mes), solo lo oscurecemos si la vista es mensual (> 14 dias)
        doc.setFillColor(245, 245, 245);
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.15);
        doc.rect(x, y, cellWidth, cellHeight, 'FD');
      } else {
        // Celda de día del mes activo o es vista semanal
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.15);
        doc.rect(x, y, cellWidth, cellHeight, 'FD');

        // Buscar eventos de este día
        const events = getEvents(dayInfo.date);

        // Si hay eventos, dibujar una barra superior gruesa según el tipo prioritario (Partido > Entrenamiento > Social)
        if (events.length > 0) {
          let accentColor = [193, 18, 31]; // Rojo por defecto (entrenamiento)
          if (events.some(e => e.type === 'match')) {
            accentColor = [234, 179, 8]; // Amarillo/Dorado
          } else if (events.some(e => e.type === 'training')) {
            accentColor = [193, 18, 31]; // Rojo
          } else if (events.some(e => e.type === 'social')) {
            accentColor = [168, 85, 247]; // Morado
          }

          doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
          doc.rect(x, y, cellWidth, 1.2, 'F');
        }

        // Dibujar número del día (arriba a la izquierda, optimizado)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 15, 15);
        doc.text(dayInfo.date.getDate().toString(), x + 2.5, y + 4.8);

        // Dibujar las insignias (badges) de los eventos
        let yOffset = y + 6.0;
        const badgeSpacing = 0.8;

        for (let eIdx = 0; eIdx < events.length; eIdx++) {
          const evt = events[eIdx];

          // Estructura para líneas del evento
          interface PrintLine {
            text: string;
            isBold: boolean;
          }
          const lines: PrintLine[] = [];
          const maxTextWidth = cellWidth - 5.0;

          // Función para envolver texto usando las métricas actuales del documento
          const addWrappedText = (text: string, isBold: boolean) => {
            doc.setFont('helvetica', isBold ? 'bold' : 'normal');
            doc.setFontSize(8.5);
            const splitLines: string[] = doc.splitTextToSize(text, maxTextWidth);
            splitLines.forEach(lText => {
              lines.push({ text: lText, isBold });
            });
          };

          // Formatear la hora de HH:mm:ss a HH:mmh
          let timeStr = '';
          if (evt.time) {
            const match = evt.time.match(/^(\\d{2}):(\\d{2})(:\\d{2})?$/);
            if (match) {
              timeStr = `${match[1]}:${match[2]}h`;
            } else {
              timeStr = evt.time.endsWith('h') ? evt.time : `${evt.time}h`;
            }
          }

          if (evt.type === 'training') {
            addWrappedText(timeStr ? `${timeStr} ${evt.title || 'Entrenamiento'}` : (evt.title || 'Entrenamiento'), true);
            if (evt.location) {
              addWrappedText(`@ ${evt.location}`, false);
            }
          } else if (evt.type === 'match') {
            const rivalName = evt.rival || evt.title || 'Partido';
            addWrappedText(timeStr ? `${timeStr} ${rivalName}` : rivalName, true);
            
            const matchdayStr = evt.matchday ? `J. ${evt.matchday}` : 'Partido';
            const localStr = evt.is_local ? 'Local' : 'Visitante';
            addWrappedText(`${matchdayStr} · ${localStr}`, false);

            if (evt.location) {
              addWrappedText(`@ ${evt.location}`, false);
            }
          } else if (evt.type === 'social') {
            addWrappedText(timeStr ? `${timeStr} ${evt.title || 'Evento Social'}` : (evt.title || 'Evento Social'), true);
            if (evt.location) {
              addWrappedText(`@ ${evt.location}`, false);
            }
          }

          // Calcular la altura requerida para esta insignia con texto envuelto de 8.5pt (más compacta)
          const numLines = lines.length;
          const currentBadgeHeight = numLines === 1 ? 4.5 : 4.5 + (numLines - 1) * 3.0;

          // Verificar si cabe el badge de forma precisa
          let canFit = false;
          const isLastEvent = eIdx === events.length - 1;

          if (isLastEvent) {
            // Si es el último evento, solo debe caber el badge dejando un margen de 0.8 mm del borde de la celda
            canFit = (yOffset + currentBadgeHeight <= y + cellHeight - 0.8);
          } else {
            // Si no es el último, debe caber este badge Y además caber el indicador de "+X más" (aprox 2.8 mm)
            canFit = (yOffset + currentBadgeHeight + badgeSpacing + 2.8 <= y + cellHeight);
          }

          if (!canFit) {
            const remaining = events.length - eIdx;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.0);
            doc.setTextColor(120, 120, 120);
            doc.text(`+${remaining} más`, x + 2.5, y + cellHeight - 1.6);
            break;
          }

          // Configurar colores de la insignia según el tipo de evento
          let badgeBg: [number, number, number] = [193, 18, 31];
          let textBg: [number, number, number] = [255, 255, 255];

          if (evt.type === 'training') {
            badgeBg = [193, 18, 31]; // Rojo
            textBg = [255, 255, 255]; // Blanco
          } else if (evt.type === 'match') {
            badgeBg = [234, 179, 8]; // Amarillo/Dorado
            textBg = [15, 15, 15]; // Negro
          } else if (evt.type === 'social') {
            badgeBg = [168, 85, 247]; // Morado
            textBg = [255, 255, 255]; // Blanco
          }

          // Dibujar insignia (rectángulo de fondo)
          doc.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2]);
          doc.rect(x + 1.2, yOffset, cellWidth - 2.4, currentBadgeHeight, 'F');

          // Escribir texto de insignia (8.5pt para mejor legibilidad y tamaño en la casilla)
          doc.setFontSize(8.5);
          doc.setTextColor(textBg[0], textBg[1], textBg[2]);

          lines.forEach((lineObj, lineIdx) => {
            doc.setFont('helvetica', lineObj.isBold ? 'bold' : 'normal');
            doc.text(lineObj.text, x + 2.5, yOffset + 3.4 + lineIdx * 3.0);
          });

          yOffset += currentBadgeHeight + badgeSpacing;
        }
      }
    });
  }

  // Guardar archivo PDF
  doc.save(`${filename}.pdf`);
};
"""

content = content[:start_idx] + new_func + content[end_idx:]

with open('/Users/victorzandal/Proyectos/App-UD-Atzeneta/src/utils/export.ts', 'w') as f:
    f.write(content)
