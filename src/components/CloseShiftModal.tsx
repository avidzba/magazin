import React, { useState, useEffect } from 'react';
import { StoreShift } from '../types';
import {
  X,
  FileCheck2,
  Banknote,
  CreditCard,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  Clock,
  Printer,
} from 'lucide-react';

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: StoreShift;
  onCloseShift: (expectedCash: number, actualCash: number) => Promise<void>;
}

export const CloseShiftModal: React.FC<CloseShiftModalProps> = ({
  isOpen,
  onClose,
  shift,
  onCloseShift,
}) => {
  // Expected cash = startCash + salesCash + cashIn - cashOut
  const expectedCash =
    shift.startCash +
    shift.totalCash +
    (shift.totalCashIn || 0) -
    (shift.totalCashOut || 0);

  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActualCashInput(String(Math.max(0, expectedCash)));
    }
  }, [isOpen, expectedCash]);

  if (!isOpen) return null;

  const actualCash = parseFloat(actualCashInput) || 0;
  const difference = actualCash - expectedCash;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(actualCash) || actualCash < 0) {
      setErrorMsg('Укажите корректную сумму фактических наличных в кассе');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await onCloseShift(expectedCash, actualCash);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка закрытия смены');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (d: any) => {
    if (!d) return '—';
    if (d.toDate) return d.toDate().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-semibold text-sm">Закрытие смены (Z-отчет)</h3>
              <p className="text-[11px] text-slate-400">
                Открыта в {formatTime(shift.openTime)} | {shift.cashierName || 'Кассир'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {errorMsg}
            </div>
          )}

          {/* Shift Financial Summary Breakdown */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span>Остаток на начало смены (утро):</span>
              <span className="font-mono font-bold text-slate-900">
                {shift.startCash.toLocaleString('ru-RU')} ₽
              </span>
            </div>

            <div className="flex justify-between items-center text-emerald-700">
              <span className="flex items-center gap-1">
                <Banknote className="w-3.5 h-3.5" />
                <span>Продажи Наличные (приход):</span>
              </span>
              <span className="font-mono font-bold">
                +{shift.totalCash.toLocaleString('ru-RU')} ₽
              </span>
            </div>

            {shift.totalCashIn > 0 && (
              <div className="flex justify-between items-center text-emerald-600">
                <span>Ручные внесения в кассу:</span>
                <span className="font-mono font-bold">
                  +{shift.totalCashIn.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            )}

            {shift.totalCashOut > 0 && (
              <div className="flex justify-between items-center text-rose-600">
                <span>Изъятия из кассы (расход):</span>
                <span className="font-mono font-bold">
                  -{shift.totalCashOut.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline font-bold">
              <span className="text-slate-900 uppercase">Ожидаемый остаток налички:</span>
              <span className="text-base text-slate-900 font-mono font-black">
                {expectedCash.toLocaleString('ru-RU')} ₽
              </span>
            </div>

            {/* Non-cash indicators */}
            <div className="pt-2 border-t border-dashed border-slate-200 grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 bg-blue-50/60 rounded border border-blue-100 flex justify-between">
                <span className="text-blue-800">Безнал (Карта):</span>
                <span className="font-bold text-blue-900 font-mono">
                  {shift.totalCard.toLocaleString('ru-RU')} ₽
                </span>
              </div>
              <div className="p-2 bg-amber-50/60 rounded border border-amber-100 flex justify-between">
                <span className="text-amber-800">В долг:</span>
                <span className="font-bold text-amber-900 font-mono">
                  {shift.totalDebt.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            </div>
          </div>

          {/* Actual Cash Input */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Фактическая сумма наличных в кассе (пересчитано кассиром):
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="any"
                required
                value={actualCashInput}
                onChange={(e) => setActualCashInput(e.target.value)}
                className="w-full px-4 py-2.5 text-2xl font-black bg-slate-50 border-2 border-emerald-500 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono text-right"
                autoFocus
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg font-bold">
                ₽
              </span>
            </div>
          </div>

          {/* Difference Indicator */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
              difference === 0
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : difference > 0
                ? 'bg-blue-50 border-blue-300 text-blue-800'
                : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {difference === 0 ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : difference > 0 ? (
                <TrendingUp className="w-5 h-5 text-blue-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-rose-600" />
              )}
              <span>
                {difference === 0
                  ? 'Касса сходится копейка в копейку!'
                  : difference > 0
                  ? `Излишек в кассе: +${difference.toLocaleString('ru-RU')} ₽`
                  : `Недостача в кассе: ${difference.toLocaleString('ru-RU')} ₽`}
              </span>
            </div>
          </div>

          {/* Carry-over rule note */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
            <strong>Переходящий остаток:</strong> Введенный фактический остаток ({actualCash.toLocaleString('ru-RU')} ₽)
            будет зафиксирован и <strong>автоматически подставится как начальная сумма для завтрашней смены</strong>.
            Обнуления наличных не произойдет.
          </div>

          {/* Buttons */}
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
              className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-lg shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <FileCheck2 className="w-4 h-4 text-emerald-400" />
              <span>{isSubmitting ? 'Закрытие...' : 'Закрыть смену (Z-отчет)'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
