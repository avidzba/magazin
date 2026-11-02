import React from 'react';
import { AlertCircle, Plus, X, Barcode } from 'lucide-react';

interface UnknownBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  barcode: string;
  onCreateProduct: (barcode: string) => void;
}

export const UnknownBarcodeModal: React.FC<UnknownBarcodeModalProps> = ({
  isOpen,
  onClose,
  barcode,
  onCreateProduct,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-80 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-amber-500/10 dark:bg-amber-500/20 border-b border-amber-200 dark:border-amber-800/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                Неизвестный штрихкод
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-400 font-medium">
                Автоматическое добавление запрещено
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            Товар со штрихкодом{' '}
            <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700">
              <Barcode className="w-3.5 h-3.5 text-slate-500" />
              {barcode}
            </span>{' '}
            не найден в номенклатуре.
          </p>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Для соблюдения точности учета и предотвращения безымянных дубликатов, создать карточку можно вручную после проверки реквизитов.
          </p>

          <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onCreateProduct(barcode);
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Создать новую карточку</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
