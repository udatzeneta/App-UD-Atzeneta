// =====================================================================
// UTILIDAD DE EXPORTACIÓN REUTILIZABLE (CSV / PDF)
// Centraliza la lógica de exportación para evitar duplicación entre páginas.
// Cada página define una sola vez sus columnas y filas; ambos formatos las reutilizan.
// =====================================================================

export type ExportCell = string | number | null | undefined;

import { FORMATIONS_SLOTS } from './formations';

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

/**
 * Exporta una convocatoria a PDF, incluyendo los equipos, jornada, fecha, hora, lugar y los jugadores convocados.
 */
export const exportCallupToPDF = async (
  match: import('../types').Match,
  players: import('../types').Player[]
): Promise<void> => {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Escudo
  try {
    const logoResponse = await fetch(CLUB_LOGO_URL);
    const logoBlob = await logoResponse.blob();
    const logoReader = new FileReader();
    await new Promise<void>((resolve, reject) => {
      logoReader.onload = () => {
        // x=14, y=12 (más abajo), w=18 (más estrecho), h=20
        doc.addImage(logoReader.result as string, 'PNG', 14, 12, 18, 20, undefined, 'FAST');
        resolve();
      };
      logoReader.onerror = reject;
      logoReader.readAsDataURL(logoBlob);
    });
  } catch (e) {
    console.warn('No se pudo cargar el logo del club para el PDF:', e);
  }

  doc.setFillColor(...BRAND_RED);
  doc.rect(0, 8, doc.internal.pageSize.width, 4, 'F');

  doc.setFontSize(16);
  doc.setTextColor(...BRAND_RED);
  doc.text('CONVOCATORIA OFICIAL', 40, 18);

  doc.setFontSize(12);
  doc.setTextColor(50);
  const title = match.is_local ? `UD Atzeneta vs ${match.rival}` : `${match.rival} vs UD Atzeneta`;
  doc.text(title, 40, 25);

  if (match.matchday) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Jornada ${match.matchday}`, 40, 31);
  }

  doc.setFontSize(10);
  doc.setTextColor(30);
  doc.text(`Fecha del Partido: ${match.date} ${match.time ? '| ' + match.time + ' hs' : ''}`, 14, 45);
  if (match.location) doc.text(`Lugar del Partido: ${match.location}`, 14, 51);
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Hora de Convocatoria: ${match.callup_time || '--:--'} hs`, 14, 60);
  doc.text(`Lugar de Reunión: ${match.callup_location || 'No especificado'}`, 14, 66);
  doc.setFont('helvetica', 'normal');

  // --- DIBUJAR MANIQUÍ (EQUIPACIÓN) ---
  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0];
  };

  const drawMannequin = (d: any, x: number, y: number, w: number, h: number, shirtHex: string, shortsHex: string, socksHex: string) => {
    const sw = w / 160;
    const sh = h / 250;

    const drawPoly = (pts: number[][], color: [number, number, number]) => {
      d.setFillColor(...color);
      d.setDrawColor(30, 41, 55);
      d.setLineWidth(0.3);
      
      const vectors = [];
      for (let i = 1; i < pts.length; i++) {
        vectors.push([
          (pts[i][0] - pts[i-1][0]) * sw,
          (pts[i][1] - pts[i-1][1]) * sh
        ]);
      }
      // vectors, x, y, scale, style, closed
      d.lines(vectors, x + pts[0][0] * sw, y + pts[0][1] * sh, [1, 1], 'FD', true);
    };

    const shirt = hexToRgb(shirtHex);
    const shorts = hexToRgb(shortsHex);
    const socks = hexToRgb(socksHex);

    // Manga izquierda
    drawPoly([[50,50], [30,75], [42,82], [55,65]], shirt);
    // Manga derecha
    drawPoly([[110,50], [130,75], [118,82], [105,65]], shirt);
    // Cuerpo
    drawPoly([[50,50], [110,50], [110,125], [50,125]], shirt);
    // Pantalón
    drawPoly([[50,125], [110,125], [112,160], [83,160], [80,145], [77,160], [48,160]], shorts);
    // Calcetín 1
    drawPoly([[54,175], [66,175], [66,225], [54,225]], socks);
    // Calcetín 2
    drawPoly([[94,175], [106,175], [106,225], [94,225]], socks);
  };

  const shirtColor = match.kit_shirt_color || '#C1121F';
  const shortsColor = match.kit_shorts_color || '#000000';
  const socksColor = match.kit_socks_color || '#000000';

  drawMannequin(doc, doc.internal.pageSize.width - 30, 16, 16, 25, shirtColor, shortsColor, socksColor);
  // ------------------------------------

  // Pre-cargar fotos de los jugadores
  const playerPhotos = await Promise.all(
    players.map(async (p) => {
      if (!p.photo_url) return null;
      try {
        const res = await fetch(p.photo_url);
        const blob = await res.blob();
        return await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        return null;
      }
    })
  );

  // Tabla de jugadores
  const headers = ['Foto', 'Dorsal', 'Nombre'];
  const rows = players.map(p => [
    '', // Espacio para la foto
    p.dorsal?.toString() || '-',
    p.full_name
  ]);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 75,
    styles: { fontSize: 10, cellPadding: 3, minCellHeight: 15, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 20, halign: 'center' },
      2: { halign: 'left' }
    },
    headStyles: { fillColor: BRAND_RED, textColor: 255, fontStyle: 'bold', minCellHeight: 8 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    theme: 'grid',
    tableLineColor: BRAND_BLACK,
    tableLineWidth: 0.1,
    didDrawCell: (data: any) => {
      if (data.column.index === 0 && data.cell.section === 'body') {
        const photoData = playerPhotos[data.row.index];
        if (photoData) {
          // Extraemos el tipo de la data URI si es posible, por defecto PNG
          const match = photoData.match(/^data:image\/(png|jpeg|jpg);/);
          const format = match ? match[1].toUpperCase() : 'PNG';
          
          doc.addImage(photoData, format, data.cell.x + 4, data.cell.y + 1.5, 12, 12, undefined, 'FAST');
        }
      }
    }
  });

  const filename = `Convocatoria_${match.date}_vs_${match.rival.replace(/\s+/g, '_')}`;
  doc.save(`${filename}.pdf`);
};



export const exportMatchReportToPDF = async (
  match: import('../types').Match,
  players: import('../types').Player[],
  stats: import('../types').PlayerMatchStats[]
): Promise<void> => {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // 1. Cabecera Decorativa
  doc.setFillColor(...BRAND_RED);
  doc.rect(0, 8, doc.internal.pageSize.width, 4, 'F');

  // Intentar cargar el escudo
  try {
    const logoResponse = await fetch(CLUB_LOGO_URL);
    const logoBlob = await logoResponse.blob();
    const logoReader = new FileReader();
    await new Promise<void>((resolve, reject) => {
      logoReader.onload = () => {
        doc.addImage(logoReader.result as string, 'PNG', 14, 14, 16, 18, undefined, 'FAST');
        resolve();
      };
      logoReader.onerror = reject;
      logoReader.readAsDataURL(logoBlob);
    });
  } catch (e) {
    console.warn('No se pudo cargar el logo del club para el PDF:', e);
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND_RED);
  doc.text('INFORME DE RENDIMIENTO DE PARTIDO', 36, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('UD Atzeneta · Portal de Gestión Interna', 36, 25);

  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 36, 29);

  // 2. Información General del Partido
  doc.setFillColor(245, 245, 245);
  doc.rect(14, 34, 182, 18, 'F');
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.15);
  doc.rect(14, 34, 182, 18, 'D');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  const localStr = match.is_local ? 'Local' : 'Visitante';
  const matchupText = match.is_local 
    ? `UD Atzeneta ${match.score_us !== null ? match.score_us : '-'} - ${match.score_them !== null ? match.score_them : '-'} ${match.rival}`
    : `${match.rival} ${match.score_them !== null ? match.score_them : '-'} - ${match.score_us !== null ? match.score_us : '-'} UD Atzeneta`;
  
  doc.text(matchupText, 18, 41);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text(`Fecha: ${match.date} ${match.time ? '| Hora: ' + match.time : ''} | Competición: ${match.competition} (${localStr})`, 18, 47);
  if (match.matchday) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Jornada: ${match.matchday}`, 150, 41);
  }
  doc.text(`Sistema: ${match.tactical_system || '4-3-3'}`, 150, 47);

  // 3. Campo de Fútbol e XI Inicial (Lado Izquierdo, y = 57, w = 90, h = 120)
  const pitchX = 14;
  const pitchY = 56;
  const pitchW = 86;
  const pitchH = 118;

  // Fondo Verde del Campo
  doc.setFillColor(34, 110, 68); // Verde césped
  doc.rect(pitchX, pitchY, pitchW, pitchH, 'F');
  doc.setDrawColor(255, 255, 255, 0.4); // Blanco semi-transparente
  doc.setLineWidth(0.35);
  doc.rect(pitchX, pitchY, pitchW, pitchH, 'D');

  // Líneas del Campo
  doc.line(pitchX, pitchY + pitchH / 2, pitchX + pitchW, pitchY + pitchH / 2); // Línea central
  doc.circle(pitchX + pitchW / 2, pitchY + pitchH / 2, pitchW * 0.15, 'D'); // Círculo central
  doc.circle(pitchX + pitchW / 2, pitchY + pitchH / 2, 0.8, 'FD'); // Punto central

  // Área Grande Arriba
  doc.rect(pitchX + pitchW * 0.2, pitchY, pitchW * 0.6, pitchH * 0.15, 'D');
  // Área Pequeña Arriba
  doc.rect(pitchX + pitchW * 0.35, pitchY, pitchW * 0.3, pitchH * 0.05, 'D');
  // Semiarco Arriba
  doc.ellipse(pitchX + pitchW / 2, pitchY + pitchH * 0.15, pitchW * 0.1, pitchH * 0.05, 'D');
  doc.setFillColor(34, 110, 68);
  doc.rect(pitchX + pitchW * 0.2, pitchY, pitchW * 0.6, pitchH * 0.15 - 0.1, 'F'); // Limpiar fondo del semiarco
  doc.rect(pitchX + pitchW * 0.2, pitchY, pitchW * 0.6, pitchH * 0.15, 'D'); // Redibujar bordes
  doc.rect(pitchX + pitchW * 0.35, pitchY, pitchW * 0.3, pitchH * 0.05, 'D');
  doc.circle(pitchX + pitchW / 2, pitchY + pitchH * 0.1, 0.5, 'FD'); // Punto penal

  // Área Grande Abajo
  doc.rect(pitchX + pitchW * 0.2, pitchY + pitchH - pitchH * 0.15, pitchW * 0.6, pitchH * 0.15, 'D');
  // Área Pequeña Abajo
  doc.rect(pitchX + pitchW * 0.35, pitchY + pitchH - pitchH * 0.05, pitchW * 0.3, pitchH * 0.05, 'D');
  // Semiarco Abajo
  doc.ellipse(pitchX + pitchW / 2, pitchY + pitchH - pitchH * 0.15, pitchW * 0.1, pitchH * 0.05, 'D');
  doc.rect(pitchX + pitchW * 0.2, pitchY + pitchH - pitchH * 0.15 + 0.1, pitchW * 0.6, pitchH * 0.15 - 0.1, 'F'); // Limpiar fondo
  doc.rect(pitchX + pitchW * 0.2, pitchY + pitchH - pitchH * 0.15, pitchW * 0.6, pitchH * 0.15, 'D'); // Redibujar
  doc.rect(pitchX + pitchW * 0.35, pitchY + pitchH - pitchH * 0.05, pitchW * 0.3, pitchH * 0.05, 'D');
  doc.circle(pitchX + pitchW / 2, pitchY + pitchH - pitchH * 0.1, 0.5, 'FD'); // Punto penal

  // Coordenadas Tácticas
  const system = match.tactical_system || '4-3-3';
  const slots = FORMATIONS_SLOTS[system] || FORMATIONS_SLOTS['4-3-3'];

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');

  const placedPlayerIds = new Set<string>();

  slots.forEach((slot: { role: string; x: number; y: number }) => {
    // Buscar jugador inicial en esta demarcación
    const playerStat = stats.find(s => 
      s.is_called_up && 
      s.is_starter && 
      s.position === slot.role && 
      !placedPlayerIds.has(s.player_id)
    );
    if (playerStat) placedPlayerIds.add(playerStat.player_id);

    const playerObj = playerStat ? players.find(p => p.id === playerStat.player_id) : null;

    const px = pitchX + (slot.x / 100) * pitchW;
    const py = pitchY + (slot.y / 100) * pitchH;

    if (playerObj) {
      // Dibujar Círculo de Camiseta
      doc.setFillColor(193, 18, 31); // Rojo
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.4);
      doc.circle(px, py, 3.8, 'FD');

      // Dorsal
      doc.setTextColor(255, 255, 255);
      doc.text(playerObj.dorsal?.toString() || '?', px, py + 1.1, { align: 'center' });

      // Nombre
      doc.setFillColor(15, 15, 15, 0.8);
      doc.rect(px - 9, py + 4.5, 18, 3.5, 'F');
      doc.setDrawColor(50, 50, 50);
      doc.setLineWidth(0.1);
      doc.rect(px - 9, py + 4.5, 18, 3.5, 'D');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      const nameStr = playerObj.nickname || playerObj.full_name.split(' ')[0];
      doc.text(nameStr.substring(0, 11), px, py + 7, { align: 'center' });
      doc.setFontSize(7.5);
    } else {
      // Slot vacío
      doc.setFillColor(100, 100, 100, 0.4);
      doc.setDrawColor(255, 255, 255, 0.6);
      doc.circle(px, py, 3.2, 'FD');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6.5);
      doc.text(slot.role, px, py + 0.9, { align: 'center' });
      doc.setFontSize(7.5);
    }
  });

  // 4. Tabla de Estadísticas de Jugadores (Lado Derecho, x = 105, y = 56, w = 91)
  // Cabecera compacta: Dorsal, Jugador, Min, G, A, Tarjetas
  const headers = ['Nº', 'Jugador', 'Rol', 'Min', 'G', 'A', 'TA', 'TR'];
  const tableRows = stats.map(s => {
    const p = players.find(x => x.id === s.player_id);
    const name = p ? (p.nickname || p.full_name.split(' ')[0]) : 'Jugador';
    const roleStr = s.is_starter ? (s.position || 'Tit') : 'Sup';
    return [
      p?.dorsal?.toString() || '-',
      name,
      roleStr,
      s.minutes_played?.toString() || '0',
      s.goals?.toString() || '0',
      s.assists?.toString() || '0',
      s.yellow_cards?.toString() || '0',
      s.red_card ? 'S' : '-'
    ];
  });

  autoTable(doc, {
    head: [headers],
    body: tableRows,
    startY: pitchY - 1,
    margin: { left: 105, right: 14 },
    styles: { fontSize: 7.5, cellPadding: 1.8, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { halign: 'left', cellWidth: 24 },
      2: { cellWidth: 12 },
      3: { cellWidth: 10 },
      4: { cellWidth: 8 },
      5: { cellWidth: 8 },
      6: { cellWidth: 8 },
      7: { cellWidth: 8 }
    },
    headStyles: { fillColor: BRAND_RED, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    theme: 'grid',
    tableLineColor: [220, 220, 220],
    tableLineWidth: 0.1
  });

  // 5. Cajas Cualitativas del Equipo (Colectivo) en la parte inferior (y = 178)
  const aspectY = 180;
  const aspectH = 22;
  const aspectW = 86;

  // Caja Aspectos Positivos
  doc.setFillColor(235, 247, 240); // Verde suave
  doc.rect(14, aspectY, aspectW, aspectH, 'F');
  doc.setFillColor(...BRAND_RED);
  doc.rect(14, aspectY, aspectW, 4.5, 'F'); // Cabecera roja
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('ASPECTOS POSITIVOS (EQUIPO)', 18, aspectY + 3.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);
  const posLines = doc.splitTextToSize(match.team_positive_aspects || 'Sin registrar.', aspectW - 8);
  doc.text(posLines, 18, aspectY + 8);

  // Caja Aspectos a Mejorar
  doc.setFillColor(254, 242, 230); // Naranja suave
  doc.rect(110, aspectY, aspectW, aspectH, 'F');
  doc.setFillColor(15, 15, 15); // Cabecera negra
  doc.rect(110, aspectY, aspectW, 4.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('ASPECTOS A MEJORAR (EQUIPO)', 114, aspectY + 3.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);
  const impLines = doc.splitTextToSize(match.team_improve_aspects || 'Sin registrar.', aspectW - 8);
  doc.text(impLines, 114, aspectY + 8);

  // 6. VALORACIONES INDIVIDUALES (Página 2)
  const playersWithAspects = stats.filter(s => {
    if (!s.is_called_up) return false;
    if (s.positive_aspects || s.improve_aspects) return true;
    if (s.event_minutes) {
      const em = s.event_minutes;
      return (
        (em.goals && em.goals.length > 0) ||
        (em.assists && em.assists.length > 0) ||
        (em.yellow_cards && em.yellow_cards.length > 0) ||
        (em.red_card !== null && em.red_card !== undefined) ||
        (em.conceded_goals && em.conceded_goals.length > 0) ||
        (em.own_goals && em.own_goals.length > 0)
      );
    }
    return false;
  });

  if (playersWithAspects.length > 0) {
    doc.addPage();
    
    // Cabecera Página 2
    doc.setFillColor(...BRAND_RED);
    doc.rect(0, 8, doc.internal.pageSize.width, 4, 'F');

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND_RED);
    doc.text('ANÁLISIS INDIVIDUAL DE JUGADORES', 14, 20);
    
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110, 110, 110);
    doc.text('Detalles técnicos y minutos de eventos registrados por futbolista.', 14, 25);

    let currY = 32;

    playersWithAspects.forEach(s => {
      const p = players.find(x => x.id === s.player_id);
      if (!p) return;

      // Mantener control de página
      if (currY > 260) {
        doc.addPage();
        doc.setFillColor(...BRAND_RED);
        doc.rect(0, 8, doc.internal.pageSize.width, 4, 'F');
        currY = 20;
      }

      // Nombre y Demarcación del Jugador
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 15, 15);
      const headerStr = `${p.dorsal ? '(' + p.dorsal + ') ' : ''}${p.full_name} - ${s.is_starter ? 'Titular (' + s.position + ')' : 'Suplente'}`;
      doc.text(headerStr, 14, currY);
      currY += 4.5;

      // Eventos específicos
      const events: string[] = [];
      if (s.event_minutes) {
        if (s.event_minutes.goals && s.event_minutes.goals.length > 0) {
          events.push(`Goles: ${s.event_minutes.goals.map(m => m + "'").join(', ')}`);
        }
        if (s.event_minutes.conceded_goals && s.event_minutes.conceded_goals.length > 0) {
          events.push(`Goles Encajados: ${s.event_minutes.conceded_goals.map(m => m + "'").join(', ')}`);
        }
        if (s.event_minutes.own_goals && s.event_minutes.own_goals.length > 0) {
          events.push(`Goles en Propia: ${s.event_minutes.own_goals.map(m => m + "'").join(', ')}`);
        }
        if (s.event_minutes.assists && s.event_minutes.assists.length > 0) {
          events.push(`Asistencias: ${s.event_minutes.assists.map(m => m + "'").join(', ')}`);
        }
        if (s.event_minutes.yellow_cards && s.event_minutes.yellow_cards.length > 0) {
          events.push(`Tarjetas Amarillas: ${s.event_minutes.yellow_cards.map(m => m + "'").join(', ')}`);
        }
        if (s.event_minutes.red_card !== null && s.event_minutes.red_card !== undefined) {
          events.push(`Tarjeta Roja: ${s.event_minutes.red_card}'`);
        }
      }

      if (events.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...BRAND_RED);
        doc.text(`Minutos de Incidencias: ${events.join(' | ')}`, 16, currY);
        currY += 4;
      }

      // Aspectos del Jugador
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);

      if (s.positive_aspects) {
        const lines = doc.splitTextToSize(`+ Aspectos Positivos: ${s.positive_aspects}`, 175);
        doc.text(lines, 16, currY);
        currY += (lines.length * 3.2) + 1;
      }
      if (s.improve_aspects) {
        const lines = doc.splitTextToSize(`- Aspectos a Mejorar: ${s.improve_aspects}`, 175);
        doc.text(lines, 16, currY);
        currY += (lines.length * 3.2) + 1;
      }

      // Línea separadora
      doc.setDrawColor(235, 235, 235);
      doc.setLineWidth(0.15);
      doc.line(14, currY + 1, 196, currY + 1);
      currY += 5;
    });
  }

  const filename = `Informe_Partido_${match.date}_vs_${match.rival.replace(/\s+/g, '_')}`;
  doc.save(`${filename}.pdf`);
};

export const exportSquadToPDF = async (
  players: import('../types').Player[]
): Promise<void> => {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Escudo
  try {
    const logoResponse = await fetch(CLUB_LOGO_URL);
    const logoBlob = await logoResponse.blob();
    const logoReader = new FileReader();
    await new Promise<void>((resolve, reject) => {
      logoReader.onload = () => {
        doc.addImage(logoReader.result as string, 'PNG', 14, 12, 18, 20, undefined, 'FAST');
        resolve();
      };
      logoReader.onerror = reject;
      logoReader.readAsDataURL(logoBlob);
    });
  } catch (e) {
    console.warn('No se pudo cargar el logo del club para el PDF:', e);
  }

  doc.setFillColor(...BRAND_RED);
  doc.rect(0, 8, doc.internal.pageSize.width, 4, 'F');

  doc.setFontSize(16);
  doc.setTextColor(...BRAND_RED);
  doc.text('PLANTILLA UD ATZENETA', 40, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 40, 26);

  // Pre-cargar fotos de los jugadores
  const playerPhotos = await Promise.all(
    players.map(async (p) => {
      if (!p.photo_url) return null;
      try {
        const res = await fetch(p.photo_url);
        const blob = await res.blob();
        return await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        return null;
      }
    })
  );

  // Tabla de jugadores
  const headers = ['Foto', 'Dorsal', 'Nombre', 'Posición', 'Estado Físico'];
  const rows = players.map(p => [
    '', // Espacio para la foto
    p.dorsal?.toString() || '-',
    p.full_name,
    p.position || '-',
    p.physical_status || 'Disponible'
  ]);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 40,
    styles: { fontSize: 10, cellPadding: 3, minCellHeight: 15, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 20, halign: 'center' },
      2: { halign: 'left' },
      3: { halign: 'left' },
      4: { halign: 'center' }
    },
    headStyles: { fillColor: BRAND_RED, textColor: 255, fontStyle: 'bold', minCellHeight: 8 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    theme: 'grid',
    tableLineColor: BRAND_BLACK,
    tableLineWidth: 0.1,
    didDrawCell: (data: any) => {
      if (data.column.index === 0 && data.cell.section === 'body') {
        const photoData = playerPhotos[data.row.index];
        if (photoData) {
          const match = photoData.match(/^data:image\/(png|jpeg|jpg);/);
          const format = match ? match[1].toUpperCase() : 'PNG';
          
          doc.addImage(photoData, format, data.cell.x + 4, data.cell.y + 1.5, 12, 12, undefined, 'FAST');
        }
      }
    }
  });

  const filename = `Plantilla_UD_Atzeneta_${new Date().toISOString().split('T')[0]}`;
  doc.save(`${filename}.pdf`);
};

export const exportAttendanceToPDF = async (
  title: string,
  filename: string,
  monthsToExport: number[],
  allMonths: { value: number; label: string }[],
  players: any[],
  targetTrainings: any[],
  allAttendanceData: any[]
): Promise<void> => {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  // Horizontal format
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Load logo
  let logoData: string | null = null;
  try {
    const res = await fetch(CLUB_LOGO_URL);
    const blob = await res.blob();
    const reader = new FileReader();
    logoData = await new Promise((resolve) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('No logo found');
  }

  // Load player photos
  const playerPhotos = await Promise.all(
    players.map(async (p) => {
      if (!p.photo_url) return null;
      try {
        const res = await fetch(p.photo_url);
        const blob = await res.blob();
        return await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      } catch (e) { return null; }
    })
  );

  const drawHeader = (pageTitle: string) => {
    doc.setFillColor(...BRAND_RED);
    doc.rect(0, 8, doc.internal.pageSize.width, 4, 'F');
    if (logoData) {
      doc.addImage(logoData, 'PNG', 14, 14, 16, 18, undefined, 'FAST');
    }
    doc.setFontSize(16);
    doc.setTextColor(...BRAND_RED);
    doc.text(title, 36, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(pageTitle, 36, 26);
  };

  const getShortStatus = (s: string) => {
    const map: Record<string, string> = {
      ENT: 'ENT', 'Entrena': 'ENT', ED: 'ED',
      L: 'L', E: 'E',
      A: 'A', AA: 'AA', AO: 'AO', V: 'V', P: 'P', LJ: 'LJ', D: 'D'
    };
    return map[s] || s.substring(0, 3).toUpperCase();
  };

  // ----- PAGE 1: ACCUMULATIVE -----
  drawHeader(`Resumen Acumulativo - ${new Date().toLocaleDateString('es-ES')}`);

  const cumulHeaders = ['Foto', 'Dorsal', 'Jugador', '% ENT', 'ENT', 'AUS', 'ED', 'L', 'E'];
  const cumulRows = players.map(p => [
    '',
    p.dorsal?.toString() || '-',
    p.nickname || p.full_name,
    `${p.cumulStats.pctEnt}%`,
    p.cumulStats.ent.toString(),
    p.cumulStats.aus.toString(),
    p.cumulStats.ed.toString(),
    p.cumulStats.les.toString(),
    p.cumulStats.enf.toString()
  ]);

  // Calculate dynamic cell height to fit all players in one page
  const availableHeight = 165; // Landscape height (210) - top margin (38) - bottom margin (7)
  const maxCellHeight = availableHeight / Math.max(1, players.length);
  const cellHeight = Math.min(10, Math.floor(maxCellHeight * 10) / 10); // keep 1 decimal
  const photoSize = Math.max(3, cellHeight - 1.5);
  const paddingY = Math.max(0.2, (cellHeight - 5) / 2);
  const fontSize = cellHeight < 5 ? 5 : 7;

  autoTable(doc, {
    head: [cumulHeaders],
    body: cumulRows,
    startY: 38,
    margin: { top: 38, bottom: 7, left: 14, right: 14 },
    styles: { fontSize: fontSize, cellPadding: { top: paddingY, bottom: paddingY, left: 1.5, right: 1.5 }, minCellHeight: cellHeight, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 16, halign: 'center' },
      1: { cellWidth: 16, halign: 'center' },
      2: { halign: 'left' },
      3: { halign: 'center', fontStyle: 'bold' },
      4: { halign: 'center', textColor: [52, 211, 153] }, // emerald
      5: { halign: 'center', textColor: [251, 113, 133] }, // rose
      6: { halign: 'center', textColor: [251, 191, 36] }, // amber
      7: { halign: 'center', textColor: [248, 113, 113] }, // red
      8: { halign: 'center', textColor: [250, 204, 21] } // yellow
    },
    headStyles: { fillColor: BRAND_RED, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    theme: 'grid',
    tableLineColor: BRAND_BLACK,
    tableLineWidth: 0.1,
    didDrawCell: (data: any) => {
      if (data.column.index === 0 && data.cell.section === 'body') {
        const photoData = playerPhotos[data.row.index];
        if (photoData) {
          const match = photoData.match(/^data:image\/(png|jpeg|jpg);/);
          const format = match ? match[1].toUpperCase() : 'PNG';
          // Center photo vertically and horizontally
          const imgX = data.cell.x + (data.cell.width - photoSize) / 2;
          const imgY = data.cell.y + (data.cell.height - photoSize) / 2;
          doc.addImage(photoData, format, imgX, imgY, photoSize, photoSize, undefined, 'FAST');
        }
      }
    }
  });

  // ----- PAGES 2+: MATRIX PER MONTH -----
  for (const month of monthsToExport) {
    const monthTrainings = targetTrainings.filter((t: any) => new Date(t.date).getMonth() + 1 === month);
    if (monthTrainings.length === 0) continue; // Skip months with no trainings

    doc.addPage();
    const monthLabel = allMonths.find(m => m.value === month)?.label || `Mes ${month}`;
    drawHeader(`Matriz de Asistencia - ${monthLabel}`);

    const matrixHeaders = ['Foto', 'Jugador', ...monthTrainings.map((t: any) => {
      const parts = t.date.split('-');
      return `${parts[2]}/${parts[1]}`;
    })];

    const matrixRows = players.map(p => {
      const row = ['', p.nickname || p.full_name];
      monthTrainings.forEach((t: any) => {
        const log = allAttendanceData.find((a: any) => a.training_id === t.id && a.player_id === p.id);
        row.push(log?.status ? getShortStatus(log.status) : '-');
      });
      return row;
    });

    autoTable(doc, {
      head: [matrixHeaders],
      body: matrixRows,
      startY: 38,
      margin: { top: 38, bottom: 7, left: 14, right: 14 },
      styles: { fontSize: fontSize, cellPadding: { top: paddingY, bottom: paddingY, left: 1.5, right: 1.5 }, minCellHeight: cellHeight, valign: 'middle', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 16, halign: 'center' },
        1: { halign: 'left', cellWidth: 40 }
      },
      headStyles: { fillColor: BRAND_RED, textColor: 255, fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      theme: 'grid',
      tableLineColor: BRAND_BLACK,
      tableLineWidth: 0.1,
      didDrawCell: (data: any) => {
        if (data.column.index === 0 && data.cell.section === 'body') {
          const photoData = playerPhotos[data.row.index];
          if (photoData) {
            const match = photoData.match(/^data:image\/(png|jpeg|jpg);/);
            const format = match ? match[1].toUpperCase() : 'PNG';
            const imgX = data.cell.x + (data.cell.width - photoSize) / 2;
            const imgY = data.cell.y + (data.cell.height - photoSize) / 2;
            doc.addImage(photoData, format, imgX, imgY, photoSize, photoSize, undefined, 'FAST');
          }
        }
        if (data.column.index > 1 && data.cell.section === 'body') {
          doc.setFont('helvetica', 'bold');
          if (['ENT', 'ED'].includes(String(data.cell.raw))) doc.setTextColor(52, 211, 153);
          else if (['A', 'AA', 'AO', 'V', 'P', 'LJ'].includes(String(data.cell.raw))) doc.setTextColor(251, 113, 133);
          else if (['L', 'E'].includes(String(data.cell.raw))) doc.setTextColor(250, 204, 21);
          else doc.setTextColor(150, 150, 150);
        }
      }
    });
  }

  doc.save(`${filename}.pdf`);
};
