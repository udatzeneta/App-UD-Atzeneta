import React from 'react';

interface FuerzaSessionPrintViewProps {
  session: any;
  ejercicios: any[]; // The array of joined ejercicios (from catalogo)
}

function formatDate(iso: string) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

export const FuerzaSessionPrintView: React.FC<FuerzaSessionPrintViewProps> = ({ session, ejercicios }) => {
  if (!session) return null;

  return (
    <div id="pdf-fuerza-session" className="bg-white text-black p-6 mx-auto flex flex-col" style={{ width: '794px', height: '1122px', overflow: 'hidden' }}>
      {/* Header Compacto */}
      <div className="flex justify-between items-end border-b-2 border-[#C1121F] pb-3 mb-4 shrink-0">
        <div className="flex items-center gap-4">
          <img src="/club-logo.png" alt="Escudo" className="w-14 h-14 object-contain" />
          <div>
            <h1 className="text-2xl font-black text-[#0f0f0f] uppercase tracking-tight leading-none mb-1">Sesión de Fuerza</h1>
            <p className="text-[#C1121F] font-bold text-sm uppercase tracking-wide">
              {session.plantilla === 'primer_equipo' ? 'Primer Equipo' : 'Juvenil'}
            </p>
          </div>
        </div>
        <div className="text-right flex items-center gap-4">
          <div className="text-left">
            <div className="text-[10px] font-bold text-gray-500 uppercase">Fecha</div>
            <div className="text-base font-bold text-[#0f0f0f] leading-none">{formatDate(session.fecha)}</div>
          </div>
          <div>
            <span className="inline-block px-2 py-1 bg-[#C1121F] text-white text-[10px] font-bold uppercase rounded">
              {session.tipo === 'repeticiones' ? 'Repeticiones' : 'Tabata'}
            </span>
          </div>
        </div>
      </div>

      {/* Ejercicios (Grid Compacto) */}
      <div className="flex-1 flex flex-col">
        <h2 className="text-sm font-bold text-[#0f0f0f] bg-gray-100 py-1.5 px-3 rounded mb-3 uppercase tracking-wider shrink-0">
          Ejercicios Programados ({ejercicios.length})
        </h2>

        {ejercicios.length === 0 ? (
          <div className="text-center p-8 text-gray-500 text-sm">No hay ejercicios registrados.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 flex-1 content-start">
            {ejercicios.map((ej, idx) => (
              <div key={ej.id} className="flex gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
                {/* Imagen */}
                <div className="w-20 h-20 shrink-0 bg-white border border-gray-200 rounded overflow-hidden flex items-center justify-center">
                  {ej.imagen_url ? (
                    <img src={ej.imagen_url} alt={ej.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-300 text-[9px] font-bold uppercase text-center px-1 leading-tight">Sin<br/>imagen</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <div>
                    <h3 className="text-sm font-black text-[#0f0f0f] pb-1" title={ej.nombre}>
                      <span className="text-[#C1121F] mr-1">{idx + 1}.</span>
                      {ej.nombre}
                    </h3>
                    
                    {ej.tags && ej.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 mb-2">
                        {ej.tags.slice(0, 3).map((t: string) => (
                          <span key={t} className="text-[8px] bg-red-100 text-red-700 px-1 py-0.5 rounded font-bold uppercase">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 mb-2">
                    <div>
                      <span className="text-[9px] font-bold text-gray-500 uppercase block">Reps/Series</span>
                      <span className="text-xs font-bold text-gray-900 block">{ej.repeticiones || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-gray-500 uppercase block">Tiempo</span>
                      <span className="text-xs font-bold text-gray-900 block">{ej.tiempo || '—'}</span>
                    </div>
                  </div>
                  
                  {ej.comentarios && (
                    <div className="mt-auto pt-1 border-t border-gray-200">
                      <span className="text-[9px] font-bold text-gray-500 uppercase block">Observaciones</span>
                      <span className="text-[10px] text-gray-700 block mt-0.5">{ej.comentarios}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="shrink-0 mt-4 pt-3 border-t border-gray-200 text-center text-[10px] font-medium text-gray-400">
        Documento generado automáticamente • UD Atzeneta
      </div>
    </div>
  );
};
