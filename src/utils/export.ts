// =====================================================================
// UTILIDAD DE EXPORTACIÓN REUTILIZABLE (CSV / PDF)
// Centraliza la lógica de exportación para evitar duplicación entre páginas.
// Cada página define una sola vez sus columnas y filas; ambos formatos las reutilizan.
// =====================================================================

export type ExportCell = string | number | null | undefined;

// Colores de marca UD Atzeneta para el PDF
const BRAND_RED: [number, number, number] = [193, 18, 31]; // #C1121F

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

  doc.setFontSize(15);
  doc.setTextColor(...BRAND_RED);
  doc.text(title, 14, 18);

  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`UD Atzeneta · Generado el ${new Date().toLocaleDateString('es-ES')}`, 14, 24);

  autoTable(doc, {
    head: [headers],
    body: rows.map((row) => row.map(toText)),
    startY: 30,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: BRAND_RED, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  doc.save(`${filename}.pdf`);
};
