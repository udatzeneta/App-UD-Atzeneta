import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center p-6 text-center select-none relative overflow-hidden">
      
      {/* Luz ambiental */}
      <div className="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[350px] h-[350px] bg-brand-red-600/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative z-10 max-w-md bg-brand-black border border-brand-black-border p-8 rounded-2xl shadow-premium space-y-6">
        
        {/* Icono de interrogación */}
        <div className="w-16 h-16 rounded-2xl bg-brand-black-hover text-brand-gray-muted border border-brand-black-border flex items-center justify-center mx-auto">
          <FileQuestion className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-brand-gray-light tracking-tight">Página no Encontrada (404)</h2>
          <p className="text-xs text-brand-gray-muted leading-relaxed">
            La URL seleccionada no existe o ha sido dada de baja del portal del club. Verifica la dirección e inténtalo de nuevo.
          </p>
        </div>

        <div className="pt-4 border-t border-brand-black-border">
          <Link to="/dashboard" className="btn-primary py-2.5 text-xs font-semibold w-full">
            <ArrowLeft className="w-3.5 h-3.5" /> Volver al Inicio
          </Link>
        </div>
      </div>
    </div>
  );
};
