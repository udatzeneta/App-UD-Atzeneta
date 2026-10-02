import React, { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
}

export const TimeInput: React.FC<TimeInputProps> = ({
  value,
  onChange,
  placeholder = 'HH:MM (ej. 17:30)',
  className = '',
  disabled = false,
  required = false,
  id,
  name,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalize incoming value to HH:mm (strip seconds if present)
  const normalizedValue = (value || '').trim().slice(0, 5);

  // Local display value for smooth typing
  const [displayValue, setDisplayValue] = useState(normalizedValue);

  useEffect(() => {
    setDisplayValue(normalizedValue);
  }, [normalizedValue]);

  // Close dropdown on outside click or touch
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Parse current hour and minute
  let currentHours = '--';
  let currentMinutes = '--';
  if (normalizedValue && normalizedValue.includes(':')) {
    const parts = normalizedValue.split(':');
    if (parts.length >= 2) {
      currentHours = parts[0].padStart(2, '0');
      currentMinutes = parts[1].padStart(2, '0');
    }
  }

  // Format manual typing (auto adds colon, restricts 0-9)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value.replace(/[^0-9:]/g, '');

    // Allow deleting colon
    if (input.length === 3 && !input.includes(':')) {
      input = `${input.slice(0, 2)}:${input.slice(2)}`;
    } else if (input.length === 2 && !displayValue.includes(':') && !input.includes(':')) {
      input = `${input}:`;
    }

    if (input.length > 5) {
      input = input.slice(0, 5);
    }

    setDisplayValue(input);

    // Validate and emit when format is HH:MM or valid partial
    if (input.length === 5 && input.includes(':')) {
      const [hStr, mStr] = input.split(':');
      let h = parseInt(hStr, 10);
      let m = parseInt(mStr, 10);

      if (isNaN(h)) h = 0;
      if (isNaN(m)) m = 0;
      if (h > 23) h = 23;
      if (m > 59) m = 59;

      const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      setDisplayValue(formatted);
      onChange(formatted);
    } else if (input === '') {
      onChange('');
    }
  };

  const handleBlur = () => {
    if (!displayValue) {
      onChange('');
      return;
    }

    // Auto-fix partial input on blur (e.g., "9" -> "09:00", "9:3" -> "09:30", "18" -> "18:00")
    let cleaned = displayValue.replace(/[^0-9:]/g, '');
    if (cleaned.includes(':')) {
      const [hStr, mStr] = cleaned.split(':');
      let h = parseInt(hStr || '0', 10);
      let m = parseInt(mStr || '0', 10);
      if (isNaN(h) || h < 0) h = 0;
      if (h > 23) h = 23;
      if (isNaN(m) || m < 0) m = 0;
      if (m > 59) m = 59;
      const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      setDisplayValue(formatted);
      onChange(formatted);
    } else if (cleaned.length > 0) {
      let h = parseInt(cleaned, 10);
      if (isNaN(h) || h < 0) h = 0;
      if (h > 23) h = 23;
      const formatted = `${String(h).padStart(2, '0')}:00`;
      setDisplayValue(formatted);
      onChange(formatted);
    }
  };

  // Adjust time by delta minutes (+/- 15, +/- 60, etc.)
  const adjustTime = (deltaMinutes: number) => {
    let h = 18;
    let m = 0;

    if (normalizedValue && normalizedValue.includes(':')) {
      const [hStr, mStr] = normalizedValue.split(':');
      h = parseInt(hStr, 10) || 0;
      m = parseInt(mStr, 10) || 0;
    }

    let totalMinutes = h * 60 + m + deltaMinutes;
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    totalMinutes = totalMinutes % (24 * 60);

    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;
    const formatted = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    setDisplayValue(formatted);
    onChange(formatted);
  };

  // Set explicit hour
  const selectHour = (h: number) => {
    const currentM = currentMinutes !== '--' ? parseInt(currentMinutes, 10) : 0;
    const formatted = `${String(h).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`;
    setDisplayValue(formatted);
    onChange(formatted);
  };

  // Set explicit minute
  const selectMinute = (m: number) => {
    const currentH = currentHours !== '--' ? parseInt(currentHours, 10) : 18;
    const formatted = `${String(currentH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setDisplayValue(formatted);
    onChange(formatted);
  };

  // Set now
  const setNow = () => {
    const now = new Date();
    const formatted = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setDisplayValue(formatted);
    onChange(formatted);
  };

  const commonHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  const commonMinutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Input container with direct typing & clock button */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          id={id}
          name={name}
          inputMode="numeric"
          pattern="[0-2][0-9]:[0-5][0-9]"
          placeholder={placeholder}
          value={displayValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          disabled={disabled}
          required={required}
          className={`form-input pr-10 text-xs py-1.5 w-full bg-brand-black-bg font-mono tracking-wider ${className}`}
          style={{ colorScheme: 'dark' }}
          autoComplete="off"
        />

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          title="Seleccionar hora"
          className="absolute right-1 p-1 text-brand-gray-muted hover:text-brand-red-600 hover:bg-brand-black-hover rounded-md transition-colors focus:outline-none"
        >
          <Clock className="w-4 h-4" />
        </button>
      </div>

      {/* Dropdown / Popover Time Picker */}
      {isOpen && (
        <div className="absolute left-0 right-0 sm:right-auto sm:w-72 mt-1 z-50 bg-brand-black-card border border-brand-black-border rounded-xl shadow-2xl p-3 animate-slide-up backdrop-blur-md">
          {/* Header with large time display & Steppers */}
          <div className="flex items-center justify-between bg-brand-black-bg/80 p-2.5 rounded-lg border border-brand-black-border/60 mb-3">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-brand-red-500" />
              <span className="text-lg font-mono font-black text-brand-gray-light tracking-widest pl-1">
                {currentHours !== '--' ? currentHours : '18'}:{currentMinutes !== '--' ? currentMinutes : '00'}
              </span>
              <span className="text-[10px] text-brand-gray-muted uppercase font-bold ml-1">hs</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => adjustTime(-15)}
                className="px-1.5 py-1 text-[10px] font-bold bg-brand-black-hover hover:bg-brand-black-border rounded text-brand-gray-muted hover:text-white transition-colors"
                title="-15 minutos"
              >
                -15m
              </button>
              <button
                type="button"
                onClick={() => adjustTime(15)}
                className="px-1.5 py-1 text-[10px] font-bold bg-brand-black-hover hover:bg-brand-black-border rounded text-brand-gray-muted hover:text-white transition-colors"
                title="+15 minutos"
              >
                +15m
              </button>
              <button
                type="button"
                onClick={() => adjustTime(60)}
                className="px-1.5 py-1 text-[10px] font-bold bg-brand-black-hover hover:bg-brand-black-border rounded text-brand-gray-muted hover:text-white transition-colors"
                title="+1 hora"
              >
                +1h
              </button>
            </div>
          </div>

          {/* Selector de Horas */}
          <div className="mb-2.5">
            <span className="text-[10px] font-bold text-brand-gray-muted uppercase tracking-wider block mb-1">
              Hora ({currentHours !== '--' ? `${currentHours}h` : 'Selecciona'}):
            </span>
            <div className="grid grid-cols-8 gap-1 max-h-24 overflow-y-auto no-scrollbar p-0.5">
              {commonHours.map((h) => {
                const isSelected = currentHours !== '--' && parseInt(currentHours, 10) === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => selectHour(h)}
                    className={`py-1 text-[11px] font-mono font-bold rounded transition-all ${
                      isSelected
                        ? 'bg-brand-red-600 text-white shadow-glow-red'
                        : 'bg-brand-black-bg/60 text-brand-gray-muted hover:text-brand-gray-light hover:bg-brand-black-hover border border-brand-black-border/40'
                    }`}
                  >
                    {String(h).padStart(2, '0')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selector de Minutos */}
          <div className="mb-3">
            <span className="text-[10px] font-bold text-brand-gray-muted uppercase tracking-wider block mb-1">
              Minutos ({currentMinutes !== '--' ? `${currentMinutes}m` : '00'}):
            </span>
            <div className="grid grid-cols-6 gap-1">
              {commonMinutes.map((m) => {
                const isSelected = currentMinutes !== '--' && parseInt(currentMinutes, 10) === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => selectMinute(m)}
                    className={`py-1 text-[11px] font-mono font-bold rounded transition-all ${
                      isSelected
                        ? 'bg-brand-red-600 text-white shadow-glow-red'
                        : 'bg-brand-black-bg/60 text-brand-gray-muted hover:text-brand-gray-light hover:bg-brand-black-hover border border-brand-black-border/40'
                    }`}
                  >
                    :{String(m).padStart(2, '0')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action buttons footer */}
          <div className="flex items-center justify-between pt-2 border-t border-brand-black-border/80">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={setNow}
                className="text-[10px] text-brand-gray-muted hover:text-brand-gray-light py-1 px-1.5 rounded hover:bg-brand-black-hover"
              >
                Ahora
              </button>
              <button
                type="button"
                onClick={() => {
                  setDisplayValue('');
                  onChange('');
                }}
                className="text-[10px] text-brand-red-400 hover:text-brand-red-300 py-1 px-1.5 rounded hover:bg-brand-black-hover"
              >
                Limpiar
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="btn-primary py-1 px-3 text-xs bg-brand-red-600 hover:bg-brand-red-700 text-white"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
