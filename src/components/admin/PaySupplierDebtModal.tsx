import React, { useState } from 'react';
import { StoreSupplier, StoreShift } from '../../types';
import { paySupplierDebt } from '../../services/storeService';
import {
  Wallet,
  Building2,
  Banknote,
  Landmark,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface PaySupplierDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: StoreSupplier;
  currentShift: StoreShift | null;
  onSuccess?: () => void;
}

export const PaySupplierDebtModal: React.FC<PaySupplierDebtModalProps> = ({
  isOpen,
  onClose,
  supplier,
  currentShift,
  onSuccess,
}) => {
  const [amount, setAmount] = useState<number>(supplier.currentDebt > 0 ? supplier.currentDebt : 1000);
  const [source, setSource] = useState<'cash_drawer' | 'bank_account'>('cash_drawer');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setError('Укажите сумму оплаты больше 0');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await paySupplierDebt({
        supplierId: supplier.id,
        supplierName: supplier.name,
        amount,
        source,
        note: note.trim() || undefined,
        shiftId: currentShift?.id || null,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка проведения платежа');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600 rounded-xl text-white">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">Погасить задолженность</h3>
              <p className="text-xs text-slate-400 truncate max-w-[240px]">{supplier.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Debt Card */}
        <div className="p-4 bg-amber-50/70 border-b border-amber-100 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
              Текущий долг перед поставщиком
            </span>
            <span className="text-xl font-black font-mono text-amber-900">
              {supplier.currentDebt.toLocaleString('ru-RU')} ₽
            </span>
          </div>
          {supplier.currentDebt > 0 && (
            <button
              type="button"
              onClick={() => setAmount(supplier.currentDebt)}
              className="px-2.5 py-1 text-xs font-bold text-amber-800 bg-amber-200/70 hover:bg-amber-200 rounded-lg transition"
            >
              Вся сумма
            </button>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Сумма к выплате (₽) *
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-3.5 py-2.5 text-base font-black font-mono bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                ₽
              </span>
            </div>
          </div>

          {/* Source Selection: Cash Drawer vs Bank Account */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Источник списания средств
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSource('cash_drawer')}
                className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 ${
                  source === 'cash_drawer'
                    ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 font-bold ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium'
                }`}
              >
                <Banknote className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-xs">Касса магазина</div>
                  <div className="text-[10px] text-slate-400 font-normal">Наличные</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSource('bank_account')}
                className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 ${
                  source === 'bank_account'
                    ? 'border-blue-600 bg-blue-50/80 text-blue-950 font-bold ring-1 ring-blue-500'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium'
                }`}
              >
                <Landmark className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <div className="text-xs">Расчетный счет</div>
                  <div className="text-[10px] text-slate-400 font-normal">Безналичный перевод</div>
                </div>
              </button>
            </div>
          </div>

          {/* Comment / Note */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Примечание к платежу (необязательно)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Оплата по счету №123, частичное погашение..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Remaining Debt Forecast */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600">Остаток долга после оплаты:</span>
            <span
              className={`font-mono font-bold ${
                supplier.currentDebt - amount <= 0 ? 'text-emerald-600' : 'text-slate-900'
              }`}
            >
              {Math.max(0, supplier.currentDebt - amount).toLocaleString('ru-RU')} ₽
            </span>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting || amount <= 0}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Проведение...' : 'Провести оплату'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
