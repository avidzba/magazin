import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, RefreshCw } from 'lucide-react';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const readerId = 'camera-barcode-reader';

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsStarting(true);
    setErrorMsg(null);

    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode(readerId);
        html5QrCodeRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 160 },
          aspectRatio: 1.333,
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            // Success scan
            if (isMounted) {
              // Beep tone
              try {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = 880;
                gain.gain.value = 0.1;
                osc.start();
                osc.stop(ctx.currentTime + 0.1);
              } catch (_) {}

              onScan(decodedText);
              // Stop camera and close
              html5QrCode
                .stop()
                .then(() => {
                  html5QrCode.clear();
                  onClose();
                })
                .catch(() => onClose());
            }
          },
          () => {
            // Frame error (no barcode in frame) - ignore
          }
        );

        if (isMounted) setIsStarting(false);
      } catch (err) {
        if (isMounted) {
          setIsStarting(false);
          setErrorMsg(
            err instanceof Error
              ? err.message
              : 'Не удалось получить доступ к камере. Убедитесь, что дано разрешение на использование камеры.'
          );
        }
      }
    };

    // Small delay to allow DOM element to render
    const timer = setTimeout(() => {
      startScanner();
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().then(() => {
              html5QrCodeRef.current?.clear();
            });
          }
        } catch (_) {}
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-sm">Сканирование штрихкода камерой</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="p-4 bg-slate-950 flex flex-col items-center justify-center min-h-[300px] relative">
          {errorMsg ? (
            <div className="text-center p-6 text-rose-300">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 text-rose-400" />
              <p className="text-xs">{errorMsg}</p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg"
              >
                Закрыть
              </button>
            </div>
          ) : (
            <>
              {isStarting && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-white z-10">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                  <span className="text-xs text-slate-300">Запуск камеры устройства...</span>
                </div>
              )}
              <div id={readerId} className="w-full overflow-hidden rounded-xl" />
            </>
          )}
        </div>

        {/* Instruction Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-600">
            Наведите камеру на штрихкод товара. Товар автоматически добавится в чек.
          </p>
        </div>
      </div>
    </div>
  );
};
