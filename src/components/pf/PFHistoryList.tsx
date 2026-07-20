import React from 'react';
import { Trash2, Edit2, Printer } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  render?: (row: any) => React.ReactNode;
}

interface PFHistoryListProps {
  title: string;
  data: any[];
  columns: Column[];
  onDelete?: (id: string) => void;
  onEdit?: (row: any) => void;
  onPrint?: (row: any) => void;
  hasPermission: boolean;
}

export const PFHistoryList: React.FC<PFHistoryListProps> = ({ title, data, columns, onDelete, onEdit, onPrint, hasPermission }) => {
  return (
    <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-6">
      <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
      
      {data.length === 0 ? (
        <div className="text-center p-8 bg-brand-black/50 rounded-lg text-brand-gray-muted text-sm">
          No hay registros disponibles.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-brand-black-border text-xs font-semibold text-brand-gray-muted uppercase tracking-wider">
                {columns.map(col => (
                  <th key={col.key} className="py-3 px-4">{col.label}</th>
                ))}
                {hasPermission && (onEdit || onDelete || onPrint) && (
                  <th className="py-3 px-4 text-right">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-black-border">
              {data.map((row, i) => (
                <tr key={row.id || i} className="hover:bg-brand-black/30 transition-colors text-sm text-brand-gray-light">
                  {columns.map(col => (
                    <td key={col.key} className="py-3 px-4">
                      {col.render ? col.render(row) : row[col.key] ?? '—'}
                    </td>
                  ))}
                  {hasPermission && (onEdit || onDelete || onPrint) && (
                    <td className="py-3 px-4 text-right flex justify-end gap-2">
                      {onPrint && (
                        <button
                          onClick={() => onPrint(row)}
                          className="p-1.5 text-brand-gray-muted hover:text-white transition-colors rounded-lg hover:bg-brand-black"
                          title="Imprimir"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      )}
                      {onEdit && (
                        <button
                          onClick={() => onEdit(row)}
                          className="p-1.5 text-brand-gray-muted hover:text-brand-blue transition-colors rounded-lg hover:bg-brand-black"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(row.id)}
                          className="p-1.5 text-brand-gray-muted hover:text-brand-red-600 transition-colors rounded-lg hover:bg-brand-black"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
