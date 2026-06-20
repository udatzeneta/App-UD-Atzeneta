// =====================================================================
// UTILIDAD DE EXPORTACIÓN REUTILIZABLE (CSV / PDF)
// Centraliza la lógica de exportación para evitar duplicación entre páginas.
// Cada página define una sola vez sus columnas y filas; ambos formatos las reutilizan.
// =====================================================================

export type ExportCell = string | number | null | undefined;

// Colores de marca UD Atzeneta para el PDF
const BRAND_RED: [number, number, number] = [193, 18, 31]; // #C1121F
const BRAND_BLACK: [number, number, number] = [15, 15, 15];

// Escudo del club (URL del logo oficial local para evitar problemas CORS)
const CLUB_LOGO_URL = '/club-logo.png';

// Normaliza una celda a texto plano
const toText = (value: ExportCell): string =>
  value === null || value === undefined ? '' : String(value);

// Escapa un valor para CSV (comillas dobles y entrecomillado RFC 4180)
const escapeCSV = (value: ExportCell): string => `"${toText(value).replace(/"/g, '""')}"`;

// Dispara la descarga de un blob en el navegador
const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Exporta datos a un archivo CSV (compatible con Excel gracias al BOM UTF-8).
 * @param filename Nombre del archivo sin extensión.
 * @param headers Cabeceras de columna.
 * @param rows Filas de datos (mismo orden que las cabeceras).
 */
export const exportToCSV = (filename: string, headers: string[], rows: ExportCell[][]): void => {
  const headerLine = headers.map(escapeCSV).join(',');
  const body = rows.map((row) => row.map(escapeCSV).join(',')).join('\n');
  // El BOM (﻿) hace que Excel respete los acentos en UTF-8
  const blob = new Blob([`﻿${headerLine}\n${body}`], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${filename}.csv`);
};

/**
 * Exporta datos a un PDF con tabla estilizada e identidad del club.
 * jsPDF se carga de forma diferida (import dinámico) para no engordar el bundle inicial.
 * @param title Título visible en el documento.
 * @param filename Nombre del archivo sin extensión.
 * @param headers Cabeceras de columna.
 * @param rows Filas de datos (mismo orden que las cabeceras).
 */
export const exportToPDF = async (
  title: string,
  filename: string,
  headers: string[],
  rows: ExportCell[][]
): Promise<void> => {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  // Más de 5 columnas → apaisado para que quepa la tabla
  const doc = new jsPDF({ orientation: headers.length > 5 ? 'landscape' : 'portrait' });

  // Añadir escudo del club en la esquina superior derecha con tonos rojos y negros
  try {
    const logoResponse = await fetch(CLUB_LOGO_URL);
    const logoBlob = await logoResponse.blob();
    const logoReader = new FileReader();

    await new Promise<void>((resolve, reject) => {
      logoReader.onload = () => {
        const logoData = logoReader.result as string;
        // Escudo de 20x20 mm en la esquina superior derecha
        doc.addImage(logoData, 'PNG', doc.internal.pageSize.width - 26, 10, 20, 20, undefined, 'FAST');

        // Añadir filtro de color rojo/negro sobre el escudo (rectángulo semitransparente)
        doc.setFillColor(BRAND_RED[0], BRAND_RED[1], BRAND_RED[2]);
        doc.setGState({ gs: { STRA: 0.3 } }); // Transparencia al 30%
        doc.rect(doc.internal.pageSize.width - 26, 10, 20, 20, 'F');
        resolve();
      };
      logoReader.onerror = reject;
      logoReader.readAsDataURL(logoBlob);
    });
  } catch (error) {
    // Si falla la carga del logo, continuar sin él
    console.warn('No se pudo cargar el logo del club para el PDF:', error);
  }

  // Línea decorativa roja debajo del header
  doc.setFillColor(...BRAND_RED);
  doc.rect(0, 8, doc.internal.pageSize.width, 4, 'F');

  doc.setFontSize(15);
  doc.setTextColor(...BRAND_RED);
  doc.text(title, 14, 22);

  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`UD Atzeneta · Generado el ${new Date().toLocaleDateString('es-ES')}`, 14, 28);

  autoTable(doc, {
    head: [headers],
    body: rows.map((row) => row.map(toText)),
    startY: 35,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: BRAND_RED, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    theme: 'grid',
    tableLineColor: BRAND_BLACK,
    tableLineWidth: 0.1,
  });

  doc.save(`${filename}.pdf`);
};

/**
 * Exporta el calendario deportivo de varios meses a un PDF estilizado en formato horizontal (Landscape)
 * representando una cuadrícula mensual real por página, con los eventos coloreados como en la web.
 * @param title Título del documento (ej. 'Calendario Deportivo').
 * @param filename Nombre del archivo sin extensión.
 * @param months Arreglo de meses a imprimir (con su nombre, año y listado de eventos).
 */
export const exportCalendarToPDF = async (
  title: string,
  filename: string,
  months: {
    monthName: string;
    year: number;
    eventsData: { day: number; events: any[] }[]
  }[]
): Promise<void> => {
  const { jsPDF } = await import('jspdf');

  // Crear documento en formato horizontal (Landscape), A4 (297 mm x 210 mm)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Ayudante de truncado de texto según el ancho máximo disponible
  const limitText = (text: string, maxWidth: number) => {
    if (doc.getTextWidth(text) <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 0 && doc.getTextWidth(truncated + '...') > maxWidth) {
      truncated = truncated.substring(0, truncated.length - 1);
    }
    return truncated.length > 0 ? truncated + '...' : '';
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Pre-cargar el escudo del club en memoria como Base64 para que se dibuje de forma idéntica en cada página
  let logoData: string | null = null;
  try {
    const logoResponse = await fetch(CLUB_LOGO_URL);
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

  // Generar cada mes en una página separada
  for (let mIdx = 0; mIdx < months.length; mIdx++) {
    const monthObj = months[mIdx];
    const { monthName, year, eventsData } = monthObj;

    // Si no es el primer mes, añadir una nueva página al documento
    if (mIdx > 0) {
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
    doc.text(`Calendario - ${monthName} ${year}`, 10, 16);

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

    // 6. Cuadrícula de días del calendario para el mes en cuestión
    const activeMonthIndex = monthNames.indexOf(monthName);
    const activeMonth = activeMonthIndex !== -1 ? activeMonthIndex : new Date().getMonth();
    const activeYear = year || new Date().getFullYear();

    const firstDayIndex = (new Date(activeYear, activeMonth, 1).getDay() + 6) % 7; // Lunes = 0, Domingo = 6
    const daysInMonth = new Date(activeYear, activeMonth + 1, 0).getDate();

    const calendarDays: (number | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
      calendarDays.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      calendarDays.push(i);
    }

    const topOffset = headerY + headerHeight; // y = 35.5
    const availableHeight = doc.internal.pageSize.height - topOffset - 10; // Dejar 10mm de margen inferior
    const numWeeks = Math.ceil(calendarDays.length / 7);
    const cellHeight = availableHeight / numWeeks;

    calendarDays.forEach((day, idx) => {
      const col = idx % 7;
      const row = Math.floor(idx / 7);
      const x = 10 + col * cellWidth;
      const y = topOffset + row * cellHeight;

      if (day === null) {
        // Celda inactiva (desfase de mes)
        doc.setFillColor(245, 245, 245);
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.15);
        doc.rect(x, y, cellWidth, cellHeight, 'FD');
      } else {
        // Celda de día del mes activo
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.15);
        doc.rect(x, y, cellWidth, cellHeight, 'FD');

        // Buscar eventos de este día
        const dayData = eventsData.find(item => item.day === day);
        const events = dayData ? dayData.events : [];

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
        doc.text(day.toString(), x + 2.5, y + 4.8);

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
            const match = evt.time.match(/^(\d{2}):(\d{2})(:\d{2})?$/);
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
