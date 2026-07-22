import React, { useRef, useEffect, useState } from 'react';
import { Bold, Italic, Underline, Highlighter, Eraser, List, Heading1, Heading2, Heading3 } from 'lucide-react';

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export const RichTextEditor: React.FC<Props> = ({ value, onChange, placeholder, className = '' }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [internalVal, setInternalVal] = useState(value || '');

  // Sincronizar prop -> estado interno (solo si difiere mucho, para no perder el cursor)
  useEffect(() => {
    if (editorRef.current && value !== internalVal) {
      editorRef.current.innerHTML = value || '';
      setInternalVal(value || '');
    }
  }, [value]);

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    handleChange();
  };

  const handleChange = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setInternalVal(html);
      onChange(html);
    }
  };

  return (
    <div className={`flex flex-col border border-brand-black-border rounded-xl overflow-hidden bg-brand-black ${className}`}>
      {/* Barra de herramientas flotante */}
      <div className="flex flex-wrap items-center gap-1 border-b border-brand-black-border bg-brand-black-card p-2 shrink-0">
        <button type="button" onClick={() => exec('bold')} className="p-1.5 hover:bg-brand-black rounded text-brand-gray-light hover:text-white" title="Negrita">
          <Bold className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec('italic')} className="p-1.5 hover:bg-brand-black rounded text-brand-gray-light hover:text-white" title="Cursiva">
          <Italic className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec('underline')} className="p-1.5 hover:bg-brand-black rounded text-brand-gray-light hover:text-white" title="Subrayado">
          <Underline className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-brand-black-border mx-1" />
        
        <button type="button" onClick={() => exec('formatBlock', 'H3')} className="p-1.5 hover:bg-brand-black rounded text-brand-gray-light hover:text-brand-red-500 font-bold flex items-center gap-1" title="Título Principal">
          <Heading1 className="w-4 h-4" /> <span className="text-[10px]">T1</span>
        </button>
        <button type="button" onClick={() => exec('formatBlock', 'H4')} className="p-1.5 hover:bg-brand-black rounded text-brand-gray-light hover:text-white font-semibold flex items-center gap-1" title="Subtítulo">
          <Heading2 className="w-4 h-4" /> <span className="text-[10px]">T2</span>
        </button>
        <div className="w-px h-4 bg-brand-black-border mx-1" />
        
        <button type="button" onClick={() => exec('insertUnorderedList')} className="p-1.5 hover:bg-brand-black rounded text-brand-gray-light hover:text-white" title="Lista de viñetas">
          <List className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-brand-black-border mx-1" />
        
        <button type="button" onClick={() => exec('hiliteColor', '#ef4444')} className="p-1.5 hover:bg-brand-black rounded text-red-500 hover:text-red-400" title="Resaltado Rojo">
          <Highlighter className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec('hiliteColor', '#eab308')} className="p-1.5 hover:bg-brand-black rounded text-yellow-500 hover:text-yellow-400" title="Resaltado Amarillo">
          <Highlighter className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec('hiliteColor', 'transparent')} className="p-1.5 hover:bg-brand-black rounded text-brand-gray-muted hover:text-white" title="Quitar Resaltado">
          <Eraser className="w-4 h-4" />
        </button>
      </div>

      {/* Área de texto editable */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleChange}
        onBlur={handleChange}
        className="flex-1 p-4 outline-none min-h-[150px] max-h-[300px] overflow-y-auto rich-text focus:bg-brand-black/50 transition-colors empty:before:content-[attr(data-placeholder)] empty:before:text-brand-gray-dark cursor-text"
        data-placeholder={placeholder}
      />
    </div>
  );
};
