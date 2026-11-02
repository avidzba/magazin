import { useEffect, useRef } from 'react';

interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  maxDelay?: number; // max delay between keystrokes in ms (default 50ms)
  minLength?: number; // minimum barcode length (default 3)
}

export function useBarcodeScanner({
  onScan,
  maxDelay = 60,
  minLength = 3,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier keys
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastTimeRef.current;
      lastTimeRef.current = now;

      // Handle Enter (end of barcode scan)
      if (e.key === 'Enter') {
        const barcode = bufferRef.current.trim();
        bufferRef.current = '';

        if (barcode.length >= minLength) {
          // Trigger scan callback
          onScan(barcode);
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      // If characters are coming too slowly, reset the buffer (manual keyboard typing)
      if (timeDiff > maxDelay && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      // Only accumulate printable single characters
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onScan, maxDelay, minLength]);
}
