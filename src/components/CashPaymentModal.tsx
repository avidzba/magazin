import React, { useState, useEffect } from 'react';
import { X, Banknote, CheckCircle2 } from 'lucide-react';

interface CashPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  onConfirm: (receivedAmount: number, changeAmount: number) => void;
}

export const CashPaymentModal: React.FC<CashPaymentModalProps> = ({
  isOpen,
  onClose,
  totalAmount,
  onConfirm,
}) => {
  const [receivedInput, setReceivedInput] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setReceivedInput(String(totalAmount));
    }
  }, [isOpen, totalAmount]);

  if (!isOpen) return null;

  const received = parseFloat(receivedInput) || 0;
  const change = Math.max(0, received - totalAmount);
  const isShort = received < totalAmount;

  const handleQuickAdd = (added: number) => {
    const current = parseFloat(receivedInput) || 0;
    setReceivedInput(String(current + added));
  };

  const handleSetExact = () => {
    setReceivedInput(String(totalAmount));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isShort) return;
    onConfirm(received, change);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        <div className="px-5 py-3.5 bg-emerald-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-200" />
            <h3 className="font-semibold text-sm">Оплата наличными</h3>
          </div>
          <button onClick={onClose} className="text-emerald-200 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          {/* Target Amount */}
          <div className="text-center pb-4 border-b border-slate-100">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              К оплате по чеку
            </span>
            <div className="text-3xl font-extrabold text-slate-900 mt-0.5">
              {totalAmount.toLocaleString('ru-RU')} ₽
            </div>
          </div>

          {/* Received Input */}
          <div className="my-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Получено от покупателя (₽):
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="any"
                value={receivedInput}
                onChange={(e) => setReceivedInput(e.target.value)}
                className="w-full text-2xl font-bold px-4 py-2.5 bg-slate-50 border-2 border-emerald-500 rounded-lg text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-emerald-400"
                autoFocus
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg font-bold">
                ₽
              </span>
            </div>
          </div>

          {/* Quick Denomination buttons */}
          <div className="mb-4">
            <span className="text-[11px] text-slate-500 font-medium block mb-1.5">
              Быстрый ввод купюр:
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={handleSetExact}
                className="py-1.5 px-2 text-xs font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-md transition"
              >
                Без сдачи
              </button>
              <button
                type="button"
                onClick={() => setReceivedInput('500')}
                className="py-1.5 px-2 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md transition"
              >
                500 ₽
              </button>
              <button
                type="button"
                onClick={() => setReceivedInput('1000')}
                className="py-1.5 px-2 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md transition"
              >
                1 000 ₽
              </button>
              <button
                type="button"
                onClick={() => setReceivedInput('2000')}
                className="py-1.5 px-2 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md transition"
              >
                2 000 ₽
              </button>
              <button
                type="button"
                onClick={() => setReceivedInput('5000')}
                className="py-1.5 px-2 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md transition"
              >
                5 000 ₽
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdd(100)}
                className="py-1.5 px-2 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md transition"
              >
                +100 ₽
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdd(500)}
                className="py-1.5 px-2 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md transition"
              >
                +500 ₽
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdd(1000)}
                className="py-1.5 px-2 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md transition"
              >
                +1 000 ₽
              </button>
            </div>
          </div>

          {/* Change Display */}
          <div
            className={`p-3.5 rounded-lg border flex items-center justify-between ${
              isShort
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div>
              <span className="text-xs uppercase font-bold tracking-wider">
                {isShort ? 'Не хватает' : 'Сдача клиенту'}
              </span>
              <div className="text-2xl font-extrabold">
                {isShort
                  ? `${(totalAmount - received).toLocaleString('ru-RU')} ₽`
                  : `${change.toLocaleString('ru-RU')} ₽`}
              </div>
            </div>
            {!isShort && (
              <CheckCircle2 className="w-8 h-8 text-emerald-600 opacity-80" />
            )}
          </div>

          {/* Confirm Button */}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Отмена (Esc)
            </button>
            <button
              type="submit"
              disabled={isShort}
              className="flex-2 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
            >
              <span>Пробить чек (Enter)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
