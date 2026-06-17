import { useEffect } from 'react';

interface UseKeyboardShortcutOptions {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  callback: () => void;
}

/**
 * Hook para registrar atajos de teclado globales
 * @example useKeyboardShortcut({ key: 'k', metaKey: true, callback: () => console.log('Cmd+K') })
 */
export const useKeyboardShortcut = ({
  key,
  ctrlKey = false,
  shiftKey = false,
  altKey = false,
  metaKey = false,
  callback,
}: UseKeyboardShortcutOptions) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const matches =
        e.key.toLowerCase() === key.toLowerCase() &&
        e.ctrlKey === ctrlKey &&
        e.shiftKey === shiftKey &&
        e.altKey === altKey &&
        e.metaKey === metaKey;

      if (matches) {
        e.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, ctrlKey, shiftKey, altKey, metaKey, callback]);
};
