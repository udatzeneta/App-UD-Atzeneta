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
    <div id="pdf-fuerza-session" className="bg-white text-black p-8 mx-auto" style={{ width: '794px', minHeight: '1122px' }}>
      {/* Header */}
      <div className="flex justify-between items-start border-b-4 border-[#C1121F] pb-4 mb-8">
        <div className="flex items-center gap-6">
          <img src="/club-logo.png" alt="Escudo" className="w-20 h-20 object-contain" />
          <div>
            <h1 className="text-3xl font-bold text-[#0f0f0f] uppercase tracking-wider">Sesión de Fuerza</h1>
            <p className="text-[#C1121F] font-semibold text-lg uppercase tracking-wide">
              {session.plantilla === 'primer_equipo' ? 'Primer Equipo' : 'Juvenil'}
            </p>
            <p className="text-gray-500 text-sm">UD Atzeneta</p>
          </div>
        </div>
        <div className="text-right">
          <div className="bg-gray-100 px-4 py-2 rounded-lg border border-gray-200 inline-block mb-2">
            <div className="text-xs font-bold text-gray-500 uppercase">Fecha</div>
            <div className="text-lg font-bold text-[#0f0f0f]">{formatDate(session.fecha)}</div>
          </div>
          <div>
            <span className="inline-block px-3 py-1 bg-[#C1121F] text-white text-xs font-bold uppercase rounded">
              Tipo: {session.tipo === 'repeticiones' ? 'Repeticiones' : 'Tabata'}
            </span>
          </div>
        </div>
      </div>

      {/* Ejercicios */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#0f0f0f] border-b border-gray-300 pb-2 mb-6 uppercase tracking-wider">
          Ejercicios Realizados ({ejercicios.length})
        </h2>

        {ejercicios.length === 0 ? (
          <div className="text-center p-8 text-gray-500">No hay ejercicios registrados en esta sesión.</div>
        ) : (
          <div className="space-y-6">
            {ejercicios.map((ej, idx) => (
              <div key={ej.id} className="flex gap-6 p-4 border border-gray-200 rounded-xl bg-gray-50 page-break-inside-avoid">
                {/* Imagen del ejercicio (si hay) */}
                <div className="w-32 h-32 shrink-0 bg-white border border-gray-200 rounded-lg overflow-hidden flex items-center justify-center">
                  {ej.imagen_url ? (
                    <img src={ej.imagen_url} alt={ej.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-300 text-sm font-bold uppercase text-center px-2">Sin imagen</span>
                  )}
                </div>

                {/* Detalles */}
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-[#0f0f0f]">
                      <span className="text-[#C1121F] mr-2">{idx + 1}.</span>
                      {ej.nombre}
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-y-3 mt-4">
                    <div>
                      <span className="text-xs font-bold text-gray-500 uppercase block">Grupos Musculares</span>
                      <span className="text-sm font-semibold text-gray-800">
                        {Array.isArray(ej.grupos) && ej.grupos.length > 0 ? ej.grupos.join(', ') : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-500 uppercase block">Zona</span>
                      <span className="text-sm font-semibold text-gray-800 capitalize">{ej.zona || 'Ambos'}</span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-500 uppercase block">Tren</span>
                      <span className="text-sm font-semibold text-gray-800 capitalize">{ej.tren ? ej.tren.replace('_', ' ') : 'Full Body'}</span>
                    </div>
                    {ej.tren === 'superior' && (
                      <div>
                        <span className="text-xs font-bold text-gray-500 uppercase block">Patrón</span>
                        <span className="text-sm font-semibold text-gray-800 capitalize">{ej.patron || 'Ninguno'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="mt-12 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
        Este documento es propiedad de UD Atzeneta. Uso interno y confidencial.
      </div>
    </div>
  );
};
