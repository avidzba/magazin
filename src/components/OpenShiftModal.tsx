import React, { useState, useEffect } from 'react';
import { StoreShift } from '../types';
import { X, Play, ShieldAlert, Sparkles, Clock } from 'lucide-react';

interface OpenShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastClosedShift: StoreShift | null;
  onOpenShift: (startCash: number, cashierName: string) => Promise<void>;
}

export const OpenShiftModal: React.FC<OpenShiftModalProps> = ({
  isOpen,
  onClose,
  lastClosedShift,
  onOpenShift,
}) => {
  const [startCash, setStartCash] = useState<string>('0');
  const [cashierName, setCashierName] = useState<string>('Кассир 1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Automatically pre-fill startCash from the last closed shift's endActualCash!
  useEffect(() => {
    if (isOpen) {
      if (lastClosedShift && lastClosedShift.endActualCash !== undefined) {
        setStartCash(String(lastClosedShift.endActualCash));
      } else if (lastClosedShift && lastClosedShift.endExpectedCash !== undefined) {
        setStartCash(String(lastClosedShift.endExpectedCash));
      } else {
        setStartCash('5000');
      }
    }
  }, [isOpen, lastClosedShift]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cash = parseFloat(startCash);
    if (isNaN(cash) || cash < 0) {
      setErrorMsg('Укажите корректную сумму наличных на утро (0 или больше)');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await onOpenShift(cash, cashierName.trim() || 'Кассир');
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка открытия смены');
    } finally {
      setIsSubmitting(false);
    }
  };

  const carriedOverAmount =
    lastClosedShift && lastClosedShift.endActualCash !== undefined
      ? lastClosedShift.endActualCash
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play className="w-5 h-5 text-blue-400 fill-blue-400" />
            <h3 className="font-semibold text-sm">Открытие кассовой смены</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {errorMsg}
            </div>
          )}

          {/* Carried over balance notice */}
          {carriedOverAmount !== null ? (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Переходящий остаток с прошлой смены: </span>
                автоматически подставлено{' '}
                <strong className="text-blue-700 font-mono text-sm">
                  {carriedOverAmount.toLocaleString('ru-RU')} ₽
                </strong>
                . Вы можете пересчитать купюры в денежном ящике и скорректировать сумму при необходимости.
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
              Предыдущих закрытых смен не найдено. Укажите начальную разменную сумму в кассе.
            </div>
          )}

          {/* Cash input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Наличные в кассе на начало смены (₽) *
            </label>
            <input
              type="number"
              min="0"
              step="any"
              required
              value={startCash}
              onChange={(e) => setStartCash(e.target.value)}
              className="w-full px-3 py-2 text-2xl font-black bg-slate-50 border-2 border-blue-500 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono text-right"
              autoFocus
            />
          </div>

          {/* Cashier Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ФИО / Имя кассира
            </label>
            <input
              type="text"
              value={cashierName}
              onChange={(e) => setCashierName(e.target.value)}
              placeholder="Кассир 1"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Submit */}
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <Clock className="w-4 h-4" />
              <span>{isSubmitting ? 'Открытие...' : 'Открыть смену'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
