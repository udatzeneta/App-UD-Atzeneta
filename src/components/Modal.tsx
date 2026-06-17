import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  // Manejar escape de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Fondo difuminado interactivo */}
      <div 
        className="fixed inset-0 bg-[#000000]/60 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
      />
      
      {/* Caja de Diálogo Modal */}
      <div className="bg-brand-black-card border border-brand-black-border w-full max-w-lg rounded-xl shadow-premium overflow-hidden z-10 animate-slide-up flex flex-col max-h-[90vh]">
        
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-black-border bg-brand-black-hover/40">
          <h3 className="text-base font-semibold text-brand-gray-light">{title}</h3>
          <button 
            onClick={onClose}
            className="text-brand-gray-muted hover:text-brand-gray-light p-1.5 rounded-lg hover:bg-brand-black-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido (Scrollable interno en móvil si es largo) */}
        <div className="p-6 overflow-y-auto flex-1 no-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};
