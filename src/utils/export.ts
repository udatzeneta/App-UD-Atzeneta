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
    if (logoResponse.ok) {
      const logoBlob = await logoResponse.blob();
      const logoReader = new FileReader();

      await new Promise<void>((resolve, reject) => {
        logoReader.onload = () => {
          try {
            const logoData = logoReader.result as string;
            if (logoData.startsWith('data:image/')) {
              // Escudo de 20x20 mm en la esquina superior derecha
              doc.addImage(logoData, 'PNG', doc.internal.pageSize.width - 26, 10, 20, 20, undefined, 'FAST');

              // Añadir filtro de color rojo/negro sobre el escudo (rectángulo semitransparente)
              doc.setFillColor(BRAND_RED[0], BRAND_RED[1], BRAND_RED[2]);
              doc.setGState({ gs: { STRA: 0.3 } }); // Transparencia al 30%
              doc.rect(doc.internal.pageSize.width - 26, 10, 20, 20, 'F');
            }
            resolve();
          } catch (err) {
            reject(err);
          }
        };
        logoReader.onerror = reject;
        logoReader.readAsDataURL(logoBlob);
      });
    }
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

      if (!dayInfo.isCurrentRange) {
        // Celda inactiva (fuera del rango seleccionado)
        // No dibujamos nada, solo el contorno de la celda vacía
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(230, 230, 230); // Gris más clarito para que resalte menos
        doc.setLineWidth(0.15);
        doc.rect(x, y, cellWidth, cellHeight, 'FD');
      } else {
        // Celda de día activa
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
 * Convierte un SVG de maniquí en Base64 PNG
 */
const generateMannequinPng = async (
  shirtColor: string,
  shortsColor: string,
  socksColor: string,
  logoBase64: string
): Promise<string> => {
  return new Promise((resolve) => {
    const logoHref = logoBase64 ? `href="${logoBase64}"` : '';

    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="440" viewBox="0 0 160 240">
      <defs>
        <filter id="fabric-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" flood-opacity="0.3" flood-color="#000" />
        </filter>
        <linearGradient id="glossy-plastic" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#9ca3af" />
          <stop offset="15%" stop-color="#f3f4f6" />
          <stop offset="35%" stop-color="#d1d5db" />
          <stop offset="65%" stop-color="#e5e7eb" />
          <stop offset="85%" stop-color="#9ca3af" />
          <stop offset="100%" stop-color="#4b5563" />
        </linearGradient>
        <linearGradient id="shirt-shading" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#000" stop-opacity="0.4" />
          <stop offset="15%" stop-color="#fff" stop-opacity="0.25" />
          <stop offset="40%" stop-color="#fff" stop-opacity="0.0" />
          <stop offset="70%" stop-color="#fff" stop-opacity="0.1" />
          <stop offset="90%" stop-color="#000" stop-opacity="0.2" />
          <stop offset="100%" stop-color="#000" stop-opacity="0.6" />
        </linearGradient>
      </defs>

      <g fill="url(#glossy-plastic)">
        <ellipse cx="80" cy="22" rx="14" ry="18" />
        <path d="M 74 38 Q 80 44 86 38 L 84 48 L 76 48 Z" />
        <path d="M 46 48 Q 80 42 114 48 C 116 60, 110 70, 110 75 C 108 95, 108 115, 110 135 C 100 145, 90 155, 80 155 C 70 155, 60 145, 50 135 C 52 115, 52 95, 50 75 C 50 70, 44 60, 46 48 Z" />
        <path d="M 46 48 C 30 65, 20 90, 18 125 C 16 135, 24 140, 28 132 C 34 115, 44 85, 50 75 Z" />
        <path d="M 114 48 C 130 65, 140 90, 142 125 C 144 135, 136 140, 132 132 C 126 115, 116 85, 110 75 Z" />
        <path d="M 50 135 C 45 160, 50 195, 52 230 C 62 230, 68 190, 68 150 C 68 145, 75 145, 80 155 Z" />
        <path d="M 110 135 C 115 160, 110 195, 108 230 C 98 230, 92 190, 92 150 C 92 145, 85 145, 80 155 Z" />
      </g>

      <g filter="url(#fabric-shadow)">
        <path d="M 46 48 C 34 60, 24 75, 22 85 L 36 88 L 50 75 Z" fill="${shirtColor}" />
        <path d="M 46 48 C 34 60, 24 75, 22 85 L 36 88 L 50 75 Z" fill="url(#shirt-shading)" />
        <path d="M 114 48 C 126 60, 136 75, 138 85 L 124 88 L 110 75 Z" fill="${shirtColor}" />
        <path d="M 114 48 C 126 60, 136 75, 138 85 L 124 88 L 110 75 Z" fill="url(#shirt-shading)" />
        <path d="M 46 48 Q 80 42 114 48 C 116 60, 110 70, 110 75 C 108 95, 106 115, 106 130 Q 80 136 54 130 C 54 115, 52 95, 50 75 C 50 70, 44 60, 46 48 Z" fill="${shirtColor}" />
        <path d="M 46 48 Q 80 42 114 48 C 116 60, 110 70, 110 75 C 108 95, 106 115, 106 130 Q 80 136 54 130 C 54 115, 52 95, 50 75 C 50 70, 44 60, 46 48 Z" fill="url(#shirt-shading)" />
        <path d="M 60 130 C 65 100, 62 80, 58 60" stroke="#000" stroke-width="2" stroke-opacity="0.15" fill="none" />
        <path d="M 100 130 C 95 100, 98 80, 102 60" stroke="#000" stroke-width="2" stroke-opacity="0.15" fill="none" />
        <path d="M 80 132 L 80 70" stroke="#000" stroke-width="1.5" stroke-opacity="0.08" fill="none" />
        <path d="M 54 95 Q 65 110 70 130" stroke="#000" stroke-width="1.5" stroke-opacity="0.1" fill="none" />
        <path d="M 106 95 Q 95 110 90 130" stroke="#000" stroke-width="1.5" stroke-opacity="0.1" fill="none" />
        <path d="M 70 47 Q 80 60 90 47 Q 80 49 70 47 Z" fill="url(#glossy-plastic)" />
        <path d="M 68 46 Q 80 62 92 46" stroke="${shirtColor}" stroke-width="3" fill="none" />
      </g>

      ${logoHref ? `<image ${logoHref} x="88" y="58" width="18" height="18" />` : ''}

      <g filter="url(#fabric-shadow)">
        <path d="M 54 130 Q 80 136 106 130 C 108 140, 112 165, 112 170 L 80 155 L 48 170 C 48 165, 52 140, 54 130 Z" fill="${shortsColor}" />
        <path d="M 54 130 Q 80 136 106 130 C 108 140, 112 165, 112 170 L 80 155 L 48 170 C 48 165, 52 140, 54 130 Z" fill="url(#shirt-shading)" />
        <path d="M 58 132 Q 60 150 54 167" stroke="#000" stroke-width="2" stroke-opacity="0.2" fill="none" />
        <path d="M 102 132 Q 100 150 106 167" stroke="#000" stroke-width="2" stroke-opacity="0.2" fill="none" />
        <path d="M 80 132 L 80 155" stroke="#000" stroke-width="2" stroke-opacity="0.15" fill="none" />
        <path d="M 68 132 Q 72 145 68 158" stroke="#000" stroke-width="1" stroke-opacity="0.1" fill="none" />
        <path d="M 92 132 Q 88 145 92 158" stroke="#000" stroke-width="1" stroke-opacity="0.1" fill="none" />
      </g>

      <g filter="url(#fabric-shadow)">
        <path d="M 51 190 C 46 205, 48 225, 50 230 C 62 230, 64 205, 65 190 Q 58 193 51 190 Z" fill="${socksColor}" />
        <path d="M 51 190 C 46 205, 48 225, 50 230 C 62 230, 64 205, 65 190 Q 58 193 51 190 Z" fill="url(#leg-gradient)" />
        <path d="M 109 190 C 114 205, 112 225, 110 230 C 98 230, 96 205, 95 190 Q 102 193 109 190 Z" fill="${socksColor}" />
        <path d="M 109 190 C 114 205, 112 225, 110 230 C 98 230, 96 205, 95 190 Q 102 193 109 190 Z" fill="url(#leg-gradient)" />
        <path d="M 50 195 Q 58 198 66 195" stroke="#000" stroke-width="2" stroke-opacity="0.2" fill="none" />
        <path d="M 110 195 Q 102 198 94 195" stroke="#000" stroke-width="2" stroke-opacity="0.2" fill="none" />
      </g>

      <g filter="url(#fabric-shadow)">
        <path d="M 50 230 C 42 232, 38 238, 44 242 L 60 242 C 63 242, 64 235, 62 230 Z" fill="#111827" />
        <path d="M 46 238 L 56 238" stroke="#fff" stroke-width="1" stroke-opacity="0.4" fill="none" />
        <path d="M 110 230 C 118 232, 122 238, 116 242 L 100 242 C 97 242, 96 235, 98 230 Z" fill="#111827" />
        <path d="M 114 238 L 104 238" stroke="#fff" stroke-width="1" stroke-opacity="0.4" fill="none" />
      </g>
    </svg>`;

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 260;
      canvas.height = 440;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve('');
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve('');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
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
  const pageWidth = doc.internal.pageSize.width;

  // Intentar cargar el escudo
  let logoBase64 = '';
  try {
    const logoResponse = await fetch(CLUB_LOGO_URL);
    const logoBlob = await logoResponse.blob();
    const logoReader = new FileReader();
    await new Promise<void>((resolve, reject) => {
      logoReader.onload = () => {
        logoBase64 = logoReader.result as string;
        doc.addImage(logoBase64, 'PNG', 10, 8, 14, 16, undefined, 'FAST');
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
  doc.setTextColor(0, 0, 0); // Texto Negro
  doc.text('CONVOCATORIA OFICIAL', 28, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0); // Texto Negro
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 28, 19);

  // --- EQUIPACIÓN OFICIAL (Movida a la derecha superior para ahorrar espacio) ---
  const kitBoxW = 45;
  const kitBoxH = 26; 
  const kitBoxX = pageWidth - 10 - kitBoxW;
  const kitBoxY = 8;

  // Fondo blanco, borde negro
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.rect(kitBoxX, kitBoxY, kitBoxW, kitBoxH, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('EQUIPACIÓN OFICIAL', kitBoxX + kitBoxW / 2, kitBoxY + 5, { align: 'center' });

  const shirtColor = match.kit_shirt_color || '#C1121F';
  const shortsColor = match.kit_shorts_color || '#000000';
  const socksColor = match.kit_socks_color || '#000000';

  const mannequinPng = await generateMannequinPng(shirtColor, shortsColor, socksColor, logoBase64);
  if (mannequinPng) {
    const imgW = 12;
    const imgH = 20;
    const imgX = kitBoxX + (kitBoxW - imgW) / 2;
    const imgY = kitBoxY + 5.5;
    doc.addImage(mannequinPng, 'PNG', imgX, imgY, imgW, imgH, undefined, 'FAST');
  } else {
    doc.setTextColor(0, 0, 0);
    doc.text('No disponible', kitBoxX + kitBoxW / 2, kitBoxY + 16, { align: 'center' });
  }

  // 2. Información General del Partido
  const infoBoxW = pageWidth - 20 - kitBoxW - 4; // Ancho restante menos margen
  const infoBoxX = 10;
  const infoBoxY = 25;
  const infoBoxH = 14;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.rect(infoBoxX, infoBoxY, infoBoxW, infoBoxH, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  
  const localStr = match.is_local ? 'Local' : 'Visitante';
  const matchupText = match.is_local 
    ? `UD Atzeneta vs ${match.rival}`
    : `${match.rival} vs UD Atzeneta`;
  
  doc.text(matchupText, infoBoxX + 4, infoBoxY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Fecha: ${match.date} ${match.time ? '| Hora Partido: ' + match.time + 'h' : ''} | ${match.competition} (${localStr})`, infoBoxX + 4, infoBoxY + 9);
  
  if (match.location) {
    doc.text(`Lugar: ${match.location}`, infoBoxX + 4, infoBoxY + 13);
  }
  
  if (match.matchday) {
    doc.setFont('helvetica', 'bold');
    doc.text(`J. ${match.matchday}`, infoBoxX + infoBoxW - 4, infoBoxY + 5, { align: 'right' });
  }

  // Info específica de convocatoria (Lugar y Hora de reunión)
  doc.setFillColor(255, 255, 255);
  doc.rect(infoBoxX, infoBoxY + infoBoxH + 2, pageWidth - 20, 8, 'FD');
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Cita Jugadores:`, infoBoxX + 4, infoBoxY + infoBoxH + 7.5);
  
  doc.setFont('helvetica', 'normal');
  const callupText = match.callup_location || '';
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = callupText.match(urlRegex);
  let linkUrl = urls ? urls[0] : null;
  
  let textWithoutUrl = callupText;
  if (linkUrl) {
    textWithoutUrl = textWithoutUrl.replace(linkUrl, '').trim();
  }
  
  const stadiumName = match.location || '';
  let finalLugarText = stadiumName;
  if (textWithoutUrl) {
     finalLugarText += finalLugarText ? ` - ${textWithoutUrl}` : textWithoutUrl;
  }
  if (!finalLugarText && !linkUrl) {
     finalLugarText = 'No especificado';
  }

  if (!linkUrl && finalLugarText !== 'No especificado') {
     linkUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(finalLugarText);
  }

  const baseText = `${match.callup_time || '--:--'} hs  |  Lugar: ${finalLugarText}`;
  doc.text(baseText, infoBoxX + 28, infoBoxY + infoBoxH + 7.5);
  
  if (linkUrl) {
     const textWidth = doc.getTextWidth(baseText + ' ');
     const mapStr = '(Ver Mapa)';
     doc.setTextColor(29, 78, 216); // azul
     const linkX = infoBoxX + 28 + textWidth;
     const linkY = infoBoxY + infoBoxH + 7.5;
     doc.text(mapStr, linkX, linkY);
     const linkW = doc.getTextWidth(mapStr);
     doc.link(linkX, linkY - 3, linkW, 4, { url: linkUrl });
     doc.setTextColor(0, 0, 0); // reset
  }

  // Pre-cargar fotos
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

  const toTitleCase = (str: string) => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const headers = ['Foto', 'Dorsal', 'Nombre del Jugador', 'Firma / Observaciones'];
  const rows = players.map(p => [
    '', // Foto
    p.dorsal?.toString() || '-',
    toTitleCase(p.full_name),
    '' // Espacio para firmar
  ]);

  const startY = 53;
  const bottomMargin = 8;
  const headerHeight = 8;
  const availableHeight = doc.internal.pageSize.height - startY - bottomMargin - headerHeight; 
  
  let rowHeight = Math.floor(availableHeight / Math.max(players.length, 1));
  if (rowHeight > 14) rowHeight = 14; 
  if (rowHeight < 6) rowHeight = 6; 

  const imageSize = rowHeight - 1.5;

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: startY,
    margin: { left: 10, right: 10, bottom: bottomMargin },
    styles: { fontSize: rowHeight < 9 ? 8 : 10, cellPadding: 1, minCellHeight: rowHeight, valign: 'middle', textColor: [0, 0, 0] },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
      2: { halign: 'left' },
      3: { cellWidth: 80 }
    },
    headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', minCellHeight: 8, lineWidth: 0.1, lineColor: [0, 0, 0] },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    theme: 'grid',
    tableLineColor: [0, 0, 0], // Bordes siempre negros
    tableLineWidth: 0.1,
    didDrawCell: (data: any) => {
      if (data.column.index === 0 && data.cell.section === 'body') {
        const photoData = playerPhotos[data.row.index];
        if (photoData) {
          const matchRegex = photoData.match(/^data:image\/(png|jpeg|jpg);/);
          const format = matchRegex ? matchRegex[1].toUpperCase() : 'PNG';
          
          const imgX = data.cell.x + (data.cell.width - imageSize) / 2;
          const imgY = data.cell.y + (rowHeight - imageSize) / 2;
          
          doc.addImage(photoData, format, imgX, imgY, imageSize, imageSize, undefined, 'FAST');
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
  stats: import('../types').PlayerMatchStats[],
  matchEvents: any[] = [],
  campogramaImage: string | null = null
): Promise<void> => {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  // Horizontal A4
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width; // 297
  const pageHeight = doc.internal.pageSize.height; // 210

  // 1. Cabecera Decorativa
  doc.setFillColor(...BRAND_RED);
  doc.rect(0, 8, pageWidth, 4, 'F');

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
  doc.text('ACTA DE PARTIDO', 36, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('UD Atzeneta · Portal de Gestión Interna', 36, 25);

  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 36, 29);

  // 2. Información General del Partido
  doc.setFillColor(245, 245, 245);
  doc.rect(120, 14, pageWidth - 134, 18, 'F');
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.15);
  doc.rect(120, 14, pageWidth - 134, 18, 'D');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  const localStr = match.is_local ? 'Local' : 'Visitante';
  const matchupText = match.is_local 
    ? `UD Atzeneta ${match.score_us !== null ? match.score_us : '-'} - ${match.score_them !== null ? match.score_them : '-'} ${match.rival}`
    : `${match.rival} ${match.score_them !== null ? match.score_them : '-'} - ${match.score_us !== null ? match.score_us : '-'} UD Atzeneta`;
  
  doc.text(matchupText, 124, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text(`Fecha: ${match.date} ${match.time ? '| Hora: ' + match.time : ''} | Competición: ${match.competition} (${localStr})`, 124, 27);
  if (match.matchday) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Jornada: ${match.matchday}`, pageWidth - 45, 21);
  }
  doc.text(`Sistema: ${match.tactical_system || '4-3-3'}`, pageWidth - 45, 27);

  // Layout:
  // Left side: Campograma (x=14, w=90)
  // Middle: Tables (Titulares y Suplentes) (x=110, w=100)
  // Right side: Timeline (x=215, w=70)

  // 3. Campograma
  const campX = 14;
  const campY = 38;
  const campW = 85;
  const campH = campW * 1.5; // aspect-[2/3]

  if (campogramaImage) {
    // Fill background so it's not fully transparent if html2canvas missed it
    doc.setFillColor(6, 78, 59); // emerald-900 approx
    doc.rect(campX, campY, campW, campH, 'F');
    // Add image
    doc.addImage(campogramaImage, 'PNG', campX, campY, campW, campH, undefined, 'FAST');
    // Add border
    doc.setDrawColor(15, 23, 42); // slate-900
    doc.setLineWidth(0.5);
    doc.rect(campX, campY, campW, campH, 'D');
  } else {
    // Fallback if image failed
    doc.setFillColor(200, 200, 200);
    doc.rect(campX, campY, campW, campH, 'F');
    doc.setTextColor(100);
    doc.text('Imagen del campo no disponible', campX + 15, campY + campH/2);
  }

  // 4. Tablas de Jugadores (Centro)
  const tableX = 105;
  const tableW = 100;
  
  const getSortScore = (pos: string | undefined | null) => {
    if (!pos) return 99;
    const p = pos.toLowerCase();
    if (p.includes('portero')) return 1;
    if (p.includes('lateral') || p.includes('central') || p.includes('defensa') || p.includes('carrilero')) return 2;
    if (p.includes('pivote') || p.includes('medio') || p.includes('interior') || p.includes('mediocentro') || p.includes('mediapunta')) return 3;
    if (p.includes('delantero') || p.includes('extremo') || p.includes('punta')) return 4;
    return 5;
  };

  const starters = stats.filter(s => s.is_called_up && s.is_starter).sort((a, b) => getSortScore(a.position) - getSortScore(b.position));
  const subs = stats.filter(s => s.is_called_up && !s.is_starter);

  const getRowData = (s: any) => {
    const p = players.find(x => x.id === s.player_id);
    const name = p ? (p.nickname || p.full_name.split(' ')[0]) : 'Jugador';
    const roleStr = s.position || '-';
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
  };

  const headers = ['Nº', 'Jugador', 'Posición', 'Min', 'G', 'A', 'TA', 'TR'];
  
  // Titulares
  autoTable(doc, {
    head: [headers],
    body: starters.map(getRowData),
    startY: 38,
    margin: { left: tableX },
    tableWidth: tableW,
    styles: { fontSize: 7, cellPadding: 1.5, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 7 },
      1: { halign: 'left', cellWidth: 26 },
      2: { cellWidth: 23 },
      3: { cellWidth: 8 },
      4: { cellWidth: 7 },
      5: { cellWidth: 7 },
      6: { cellWidth: 7 },
      7: { cellWidth: 7 }
    },
    headStyles: { fillColor: BRAND_RED, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    theme: 'grid',
    tableLineColor: [220, 220, 220],
    tableLineWidth: 0.1,
    showHead: 'firstPage'
  });

  const finalYTitulares = (doc as any).lastAutoTable.finalY || 38;

  // Suplentes
  if (subs.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('SUPLENTES', tableX, finalYTitulares + 6);

    autoTable(doc, {
      head: [headers],
      body: subs.map(getRowData),
      startY: finalYTitulares + 8,
      margin: { left: tableX },
      tableWidth: tableW,
      styles: { fontSize: 7, cellPadding: 1.5, halign: 'center' },
      columnStyles: {
        0: { cellWidth: 7 },
        1: { halign: 'left', cellWidth: 26 },
        2: { cellWidth: 23 },
        3: { cellWidth: 8 },
        4: { cellWidth: 7 },
        5: { cellWidth: 7 },
        6: { cellWidth: 7 },
        7: { cellWidth: 7 }
      },
      headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      theme: 'grid',
      tableLineColor: [220, 220, 220],
      tableLineWidth: 0.1,
      showHead: 'firstPage'
    });
  }

  // 5. Cronología de Eventos (Derecha)
  const timelineX = 212;
  const timelineW = 75;
  let timelineY = 38;

  doc.setFillColor(...BRAND_RED);
  doc.rect(timelineX, timelineY, timelineW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('CRONOLOGÍA DE INCIDENCIAS', timelineX + timelineW/2, timelineY + 4.2, { align: 'center' });

  timelineY += 10;

  const getEventText = (e: any) => {
    switch (e.type) {
      case 'goals': return `Gol de ${e.playerName}`;
      case 'penalty_goals': return `Gol Penalti de ${e.playerName}`;
      case 'own_goals': return `Gol P.P de ${e.playerName}`;
      case 'opponent_own_goal': return `Gol P.P del Rival`;
      case 'own_goal_team': return `Gol P.P de U.D. Atzeneta`;
      case 'assists': return `Asist. de ${e.playerName}`;
      case 'yellow_cards': return `Tarj. Amarilla ${e.playerName}`;
      case 'red_card': return `Tarj. Roja ${e.playerName}`;
      case 'injury': return `Lesión de ${e.playerName}`;
      case 'sub_in': return `Entra ${e.playerName}`;
      case 'sub_out': return `Sale ${e.playerName}`;
      case 'substitution': return `Cambio: Sale ${e.playerName}, Entra ${e.extraInfo || 'Jugador'}`;
      case 'opponent_goal': return `Gol ${e.playerName}`;
      case 'opponent_yellow_card': return `Amarilla ${e.playerName}`;
      case 'conceded_goals': return `Gol encajado (${e.playerName})`;
      case 'conceded_penalty_goals': return `Gol Pen. encajado (${e.playerName})`;
      default: return `${e.type}: ${e.playerName}`;
    }
  };

  const getEventIconColor = (e: any): [number, number, number] => {
    switch (e.type) {
      case 'goals':
      case 'penalty_goals': 
        return [34, 197, 94]; // verde
      case 'own_goals':
      case 'opponent_own_goal':
      case 'own_goal_team':
        return [249, 115, 22]; // naranja
      case 'opponent_goal':
      case 'conceded_goals':
      case 'conceded_penalty_goals':
        return [239, 68, 68]; // rojo
      case 'yellow_cards':
      case 'opponent_yellow_card':
        return [234, 179, 8]; // amarillo
      case 'red_card':
        return [220, 38, 38]; // rojo oscuro
      case 'sub_in':
        return [59, 130, 246]; // azul
      case 'sub_out':
      case 'substitution':
        return [156, 163, 175]; // gris
      case 'injury':
        return [249, 115, 22]; // naranja
      case 'assists':
        return [168, 85, 247]; // morado
      default:
        return [100, 100, 100];
    }
  };

  const printEvents = (eventsPart: any[], title: string) => {
    if (eventsPart.length === 0) return;
    
    // Check if we need new page
    if (timelineY > pageHeight - 20) {
      doc.addPage();
      timelineY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 30, 30);
    doc.setFillColor(240, 240, 240);
    doc.rect(timelineX, timelineY - 3, timelineW, 5, 'F');
    doc.text(title, timelineX + timelineW/2, timelineY + 0.5, { align: 'center' });
    timelineY += 5;

    eventsPart.forEach(e => {
      if (timelineY > pageHeight - 15) {
        doc.addPage();
        timelineY = 20;
      }
      
      // Draw event symbol
      doc.setLineWidth(0.1);
      if (e.type === 'yellow_cards' || e.type === 'opponent_yellow_card') {
        doc.setFillColor(234, 179, 8); // yellow
        doc.setDrawColor(180, 140, 0);
        doc.rect(timelineX + 3.8, timelineY - 1.8, 2.2, 3.2, 'FD');
      } else if (e.type === 'red_card') {
        doc.setFillColor(220, 38, 38); // red
        doc.setDrawColor(150, 20, 20);
        doc.rect(timelineX + 3.8, timelineY - 1.8, 2.2, 3.2, 'FD');
      } else if (e.type === 'substitution') {
        doc.setLineWidth(0.35);
        // Red down arrow (left side)
        doc.setDrawColor(220, 38, 38);
        doc.line(timelineX + 3.8, timelineY - 1.3, timelineX + 3.8, timelineY + 1.3);
        doc.line(timelineX + 3.2, timelineY + 0.6, timelineX + 3.8, timelineY + 1.3);
        doc.line(timelineX + 4.4, timelineY + 0.6, timelineX + 3.8, timelineY + 1.3);
        // Green up arrow (right side)
        doc.setDrawColor(34, 197, 94);
        doc.line(timelineX + 5.8, timelineY - 1.3, timelineX + 5.8, timelineY + 1.3);
        doc.line(timelineX + 5.2, timelineY - 0.6, timelineX + 5.8, timelineY - 1.3);
        doc.line(timelineX + 6.4, timelineY - 0.6, timelineX + 5.8, timelineY - 1.3);
      } else if (e.type === 'goals' || e.type === 'penalty_goals' || e.type === 'opponent_goal') {
        doc.setLineWidth(0.25);
        doc.setDrawColor(30, 30, 30);
        doc.setFillColor(255, 255, 255);
        doc.circle(timelineX + 4.8, timelineY - 0.2, 1.6, 'FD');
        doc.setFillColor(30, 30, 30);
        doc.circle(timelineX + 4.8, timelineY - 0.2, 0.5, 'F'); // center dot
      } else if (e.type === 'own_goals' || e.type === 'opponent_own_goal' || e.type === 'own_goal_team') {
        doc.setLineWidth(0.25);
        doc.setDrawColor(249, 115, 22); // orange
        doc.setFillColor(255, 255, 255);
        doc.circle(timelineX + 4.8, timelineY - 0.2, 1.6, 'FD');
        doc.setFillColor(249, 115, 22);
        doc.circle(timelineX + 4.8, timelineY - 0.2, 0.5, 'F');
      } else if (e.type === 'assists') {
        doc.setFillColor(168, 85, 247); // purple
        doc.circle(timelineX + 4.8, timelineY - 0.2, 1.6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5);
        doc.setTextColor(255, 255, 255);
        doc.text('A', timelineX + 3.8, timelineY + 0.8);
      } else if (e.type === 'injury') {
        doc.setLineWidth(0.5);
        doc.setDrawColor(249, 115, 22); // orange
        doc.line(timelineX + 3.6, timelineY, timelineX + 6.0, timelineY);
        doc.line(timelineX + 4.8, timelineY - 1.2, timelineX + 4.8, timelineY + 1.2);
      } else {
        const iconColor = getEventIconColor(e);
        doc.setFillColor(...iconColor);
        doc.circle(timelineX + 4.8, timelineY - 0.2, 1.5, 'F');
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(50, 50, 50);
      
      // Limpiar prefijos "1T" o "2T" que a veces se guardan en la BBDD, 
      // ya que la cronología ya está dividida por partes
      let minStr = e.minute.toString().replace(/1T\s*/i, '').replace(/2T\s*/i, '').trim();
      if (!minStr.includes("'")) minStr += "'";
      
      doc.text(minStr, timelineX + 8, timelineY + 1);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      const text = getEventText(e);
      const lines = doc.splitTextToSize(text, timelineW - 16);
      doc.text(lines, timelineX + 14, timelineY + 1);
      
      timelineY += (lines.length * 3.5);
    });
    
    timelineY += 4;
  };

  // Separat events into halves
  const getMinVal = (m: string | number) => {
    if (!m) return 90;
    const str = String(m).trim();
    const parts = str.split(' ');
    if (parts.length > 1) {
      const period = parts[0].toUpperCase();
      const min = parseInt(parts[1].split('+')[0].replace(/\D/g, '')) || 0;
      if (period === '1T') return min;
      if (period === '2T') return min + 45;
      if (period === '1P' || period === 'PR1') return min + 90;
      if (period === '2P' || period === 'PR2') return min + 105;
      return min;
    }
    return parseInt(str.split('+')[0].replace(/\D/g, '')) || 90;
  };
  
  const firstHalf = matchEvents.filter(e => getMinVal(e.minute) <= 45).sort((a, b) => getMinVal(a.minute) - getMinVal(b.minute));
  const secondHalf = matchEvents.filter(e => getMinVal(e.minute) > 45).sort((a, b) => getMinVal(a.minute) - getMinVal(b.minute));

  printEvents(firstHalf, '1ª PARTE');
  printEvents(secondHalf, '2ª PARTE');

  // ── Página 2: Análisis Táctico y Valoraciones ──────────────────────────────────────
  if (
    match.team_positive_aspects || 
    match.team_improve_aspects || 
    match.tactical_with_ball || 
    match.tactical_without_ball || 
    match.tactical_set_pieces || 
    match.tactical_general || 
    match.team_ratings
  ) {
    doc.addPage();
    
    // Cabecera decorativa
    doc.setFillColor(...BRAND_RED);
    doc.rect(0, 8, pageWidth, 4, 'F');
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND_RED);
    doc.text('ANÁLISIS TÁCTICO Y VALORACIONES', 14, 20);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110, 110, 110);
    doc.text(`Partido vs ${match.rival} · Fecha: ${match.date}`, 14, 25);
    
    let leftY = 35;
    const colW = 125;
    
    const printTextBlock = (title: string, text: string, color: [number, number, number]) => {
      if (!text) return;
      if (leftY > pageHeight - 30) {
        doc.addPage();
        doc.setFillColor(...BRAND_RED);
        doc.rect(0, 8, pageWidth, 4, 'F');
        leftY = 20;
      }
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...color);
      doc.text(title.toUpperCase(), 14, leftY);
      
      leftY += 4.5;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(text, colW);
      doc.text(lines, 14, leftY);
      
      leftY += (lines.length * 3.5) + 6;
    };
    
    printTextBlock('Aspectos Positivos', match.team_positive_aspects || '', [16, 185, 129]); // emerald
    printTextBlock('Aspectos a Mejorar', match.team_improve_aspects || '', [239, 68, 68]); // red
    printTextBlock('Momento Con Balón', match.tactical_with_ball || '', [16, 185, 129]); // emerald
    printTextBlock('Momento Sin Balón', match.tactical_without_ball || '', [249, 115, 22]); // orange
    printTextBlock('Acciones a Balón Parado (ABP)', match.tactical_set_pieces || '', [217, 119, 6]); // amber
    printTextBlock('Resumen General', match.tactical_general || '', [37, 99, 235]); // blue
    
    // Right Column: Ratings (Star ratings)
    let rightY = 35;
    const rightX = 155;
    
    if (match.team_ratings) {
      const ratings = match.team_ratings;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      doc.text('VALORACIONES DE RENDIMIENTO', rightX, rightY);
      rightY += 8;
      
      const printRatingSection = (title: string, values: Record<string, number>, color: [number, number, number]) => {
        if (!values || Object.keys(values).length === 0) return;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...color);
        doc.text(title, rightX, rightY);
        rightY += 4.5;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        
        Object.entries(values).forEach(([key, val]) => {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          doc.text(label, rightX, rightY);
          
          // Dibujar círculos vectoriales para la valoración en lugar de estrellas unicode
          const dotRadius = 0.8;
          const dotSpacing = 3.2;
          const startX = rightX + 45;
          
          for (let i = 1; i <= 5; i++) {
            const curX = startX + (i - 1) * dotSpacing;
            if (i <= val) {
              doc.setFillColor(245, 158, 11); // Lleno (amber-500)
              doc.circle(curX, rightY - 1, dotRadius, 'F');
            } else {
              doc.setDrawColor(180, 180, 180); // Vacío
              doc.setLineWidth(0.15);
              doc.circle(curX, rightY - 1, dotRadius, 'D');
            }
          }
          
          rightY += 4;
        });
        
        rightY += 4;
      };
      
      if (ratings.with_ball) {
        printRatingSection('Fase Con Balón', ratings.with_ball, [16, 185, 129]);
      }
      if (ratings.without_ball) {
        printRatingSection('Fase Sin Balón', ratings.without_ball, [249, 115, 22]);
      }
      if (ratings.set_pieces) {
        printRatingSection('Acciones a Balón Parado (ABP)', ratings.set_pieces, [217, 119, 6]);
      }
    }
  }

  const filename = `Acta_${match.date}_vs_${match.rival.replace(/\s+/g, '_')}`;
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

  // Cálculo dinámico para que quepa en 1 página
  const startY = 35;
  const bottomMargin = 10;
  const headerHeight = 8;
  const availableHeight = doc.internal.pageSize.height - startY - bottomMargin - headerHeight; 
  
  // Altura máxima por fila
  let rowHeight = Math.floor(availableHeight / Math.max(players.length, 1));
  if (rowHeight > 14) rowHeight = 14; 
  if (rowHeight < 6) rowHeight = 6; 

  const photoSize = Math.max(4, rowHeight - 2);
  const paddingY = Math.max(0.5, (rowHeight - 6) / 2);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: startY,
    margin: { bottom: bottomMargin },
    styles: { fontSize: rowHeight < 8 ? 8 : 9, cellPadding: { top: paddingY, bottom: paddingY, left: 2, right: 2 }, minCellHeight: rowHeight, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 16, halign: 'center' },
      1: { cellWidth: 16, halign: 'center' },
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
          
          const imgX = data.cell.x + (data.cell.width - photoSize) / 2;
          const imgY = data.cell.y + (data.cell.height - photoSize) / 2;
          
          doc.addImage(photoData, format, imgX, imgY, photoSize, photoSize, undefined, 'FAST');
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
  allAttendanceData: any[],
  activeTab: string = 'matrix',
  allPlayerMatchStats: any[] = []
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

  const primerEquipo = players.filter(p => p.team_category === 'Primer Equipo' || !p.team_category);
  const juveniles = players.filter(p => p.team_category === 'Juvenil');

  const groups = [];
  if (primerEquipo.length > 0) groups.push({ title: 'Primer Equipo', players: primerEquipo });
  if (juveniles.length > 0) groups.push({ title: 'Juveniles', players: juveniles });

  groups.forEach((group, index) => {
    if (index > 0) doc.addPage();

    const groupPlayers = group.players;
    const availableHeight = 150; // Landscape height (210) - top margin (38) - header height (~12) - bottom margin (10)
    const maxCellHeight = availableHeight / Math.max(1, groupPlayers.length);
    const cellHeight = Math.min(10, Math.floor(maxCellHeight * 10) / 10); // keep 1 decimal
    const photoSize = Math.max(3, cellHeight - 1.5);
    const paddingY = Math.max(0.1, (cellHeight - 5) / 2);
    const fontSize = cellHeight < 5 ? 5 : 7;

    if (activeTab === 'cumul') {
      // ----- ACCUMULATIVE PAGE -----
      drawHeader(`Resumen Acumulativo (${group.title}) - ${new Date().toLocaleDateString('es-ES')}`);

      const cumulHeaders = ['Foto', 'Dorsal', 'Jugador', '% ENT', 'ENT', 'AUS', 'ED', 'L', 'E'];
      const cumulRows = groupPlayers.map(p => [
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
            const originalIndex = players.findIndex(p => p.id === groupPlayers[data.row.index].id);
            const photoData = playerPhotos[originalIndex];
            if (photoData) {
              const match = photoData.match(/^data:image\/(png|jpeg|jpg);/);
              const format = match ? match[1].toUpperCase() : 'PNG';
              const imgX = data.cell.x + (data.cell.width - photoSize) / 2;
              const imgY = data.cell.y + (data.cell.height - photoSize) / 2;
              doc.addImage(photoData, format, imgX, imgY, photoSize, photoSize, undefined, 'FAST');
            }
          }
        }
      });
    } else {
      // ----- MATRIX PAGE -----
      if (targetTrainings.length > 0) {
        const monthLabels = monthsToExport.map(m => allMonths.find(x => x.value === m)?.label || `Mes ${m}`).join(', ');
        drawHeader(`Matriz de Asistencia (${group.title}) - ${monthLabels}`);

        const matrixHeaders = ['Foto', 'Jugador', ...targetTrainings.map((t: any) => {
          const parts = t.date.split('-');
          const d = `${parts[2]}/${parts[1]}`;
          return t.type === 'partido' ? `P ${d}` : d;
        })];

        const matrixRows = groupPlayers.map(p => {
          const row = ['', p.nickname || p.full_name];
          targetTrainings.forEach((t: any) => {
            if (t.type === 'partido') {
              const stat = allPlayerMatchStats.find((s: any) => s.match_id === t.id && s.player_id === p.id);
              row.push(stat?.is_called_up ? 'CONV' : 'NC');
            } else {
              const log = allAttendanceData.find((a: any) => a.training_id === t.id && a.player_id === p.id);
              row.push(log?.status ? getShortStatus(log.status) : '-');
            }
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
              const originalIndex = players.findIndex(p => p.id === groupPlayers[data.row.index].id);
              const photoData = playerPhotos[originalIndex];
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
              if (['ENT', 'ED', 'CONV'].includes(String(data.cell.raw))) doc.setTextColor(52, 211, 153);
              else if (['A', 'AA', 'AO', 'V', 'P', 'LJ', 'NC'].includes(String(data.cell.raw))) doc.setTextColor(251, 113, 133);
              else if (['L', 'E'].includes(String(data.cell.raw))) doc.setTextColor(250, 204, 21);
              else doc.setTextColor(150, 150, 150);
            }
          }
        });
      }
    }
  });

  doc.save(`${filename}.pdf`);
};
