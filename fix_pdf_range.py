import re

with open('/Users/victorzandal/Proyectos/App-UD-Atzeneta/src/utils/export.ts', 'r') as f:
    export_content = f.read()

export_search = """      if (!dayInfo.isCurrentRange && grid.days.length > 14) {
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

        // Buscar eventos de este día"""

export_replace = """      if (!dayInfo.isCurrentRange) {
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

        // Buscar eventos de este día"""

export_content = export_content.replace(export_search, export_replace)

with open('/Users/victorzandal/Proyectos/App-UD-Atzeneta/src/utils/export.ts', 'w') as f:
    f.write(export_content)

# Now fix Calendar.tsx inputs
with open('/Users/victorzandal/Proyectos/App-UD-Atzeneta/src/pages/Calendar.tsx', 'r') as f:
    calendar_content = f.read()

calendar_content = calendar_content.replace('className="input-base"', 'className="form-input px-3 py-2 bg-brand-black border border-brand-black-border rounded-lg text-white font-medium focus:ring-1 focus:ring-brand-red-600"')

with open('/Users/victorzandal/Proyectos/App-UD-Atzeneta/src/pages/Calendar.tsx', 'w') as f:
    f.write(calendar_content)

