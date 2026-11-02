import React, { useState, useEffect } from 'react';
import { X, ArrowDownRight, ArrowUpRight, Building2, AlertCircle } from 'lucide-react';
import { StoreSupplier } from '../types';
import { subscribeSuppliers } from '../services/storeService';

interface CashFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftId: string;
  suppliers?: StoreSupplier[];
  onConfirm: (data: {
    type: 'in' | 'out';
    amount: number;
    category: string;
    note?: string;
    supplierId?: string;
    supplierName?: string;
  }) => Promise<void>;
}

export const CashFlowModal: React.FC<CashFlowModalProps> = ({
  isOpen,
  onClose,
  shiftId,
  suppliers: propsSuppliers,
  onConfirm,
}) => {
  const [type, setType] = useState<'in' | 'out'>('out'); // default 'out' (Изъятие)
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Оплата поставщику');
  const [note, setNote] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [localSuppliers, setLocalSuppliers] = useState<StoreSupplier[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fallback subscription to suppliers if not passed via props
  useEffect(() => {
    if (propsSuppliers && propsSuppliers.length > 0) {
      setLocalSuppliers(propsSuppliers);
      return;
    }
    const unsub = subscribeSuppliers(
      (list) => setLocalSuppliers(list),
      (err) => console.error('Failed to load suppliers:', err)
    );
    return () => unsub();
  }, [propsSuppliers]);

  // Keep localSuppliers in sync if propsSuppliers changes
  useEffect(() => {
    if (propsSuppliers) {
      setLocalSuppliers(propsSuppliers);
    }
  }, [propsSuppliers]);

  if (!isOpen) return null;

  const categoriesOut = [
    'Оплата поставщику',
    'Зарплата',
    'Инкассация владельцу',
    'Хозяйственные расходы',
    'Прочее',
  ];

  const categoriesIn = [
    'Внесение разменной монеты',
    'Внесение владельцем',
    'Возврат подотчета',
    'Прочее',
  ];

  const isSupplierPayment = type === 'out' && category === 'Оплата поставщику';
  const selectedSupplier = localSuppliers.find((s) => s.id === selectedSupplierId);
  const parsedAmount = parseFloat(amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedAmount || parsedAmount <= 0) {
      setErrorMsg('Укажите корректную сумму больше нуля');
      return;
    }

    if (isSupplierPayment && !selectedSupplierId) {
      setErrorMsg('Пожалуйста, выберите поставщика из списка для уменьшения задолженности');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await onConfirm({
        type,
        amount: parsedAmount,
        category,
        note: note.trim(),
        supplierId: isSupplierPayment ? selectedSupplierId : undefined,
        supplierName: isSupplierPayment ? selectedSupplier?.name : undefined,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка при сохранении операции');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTypeChange = (newType: 'in' | 'out') => {
    setType(newType);
    setCategory(newType === 'out' ? 'Оплата поставщику' : 'Внесение разменной монеты');
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div
          className={`px-5 py-3.5 text-white flex items-center justify-between ${
            type === 'out' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}
        >
          <div className="flex items-center gap-2">
            {type === 'out' ? (
              <ArrowDownRight className="w-5 h-5 text-rose-200" />
            ) : (
              <ArrowUpRight className="w-5 h-5 text-emerald-200" />
            )}
            <h3 className="font-semibold text-sm">
              {type === 'out' ? 'Изъятие наличных из кассы' : 'Внесение наличных в кассу'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Тип кассовой операции:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange('out')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  type === 'out'
                    ? 'bg-rose-50 text-rose-700 border-rose-400 shadow-2xs ring-1 ring-rose-400'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <ArrowDownRight className="w-4 h-4 text-rose-600" />
                <span>Изъятие (Расход)</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('in')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  type === 'in'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-400 shadow-2xs ring-1 ring-emerald-400'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                <span>Внесение (Приход)</span>
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Сумма наличных (₽) *
            </label>
            <input
              type="number"
              min="1"
              step="any"
              required
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setErrorMsg('');
              }}
              placeholder="0.00"
              className="w-full px-3 py-2 text-xl font-bold bg-slate-50 border-2 border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              autoFocus
            />
          </div>

          {/* Category / Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Категория / Причина *
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setErrorMsg('');
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              {(type === 'out' ? categoriesOut : categoriesIn).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Supplier Dropdown (When type === 'out' and category === 'Оплата поставщику') */}
          {isSupplierPayment && (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-amber-600" />
                <span>Поставщик для уменьшения долга *</span>
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => {
                  setSelectedSupplierId(e.target.value);
                  setErrorMsg('');
                }}
                className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-900"
                required
              >
                <option value="">-- Выберите поставщика из базы --</option>
                {localSuppliers.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name}
                    {sup.currentDebt !== undefined
                      ? ` (Долг: ${sup.currentDebt.toLocaleString('ru-RU')} ₽)`
                      : ''}
                  </option>
                ))}
              </select>

              {selectedSupplier && (
                <div className="text-[11px] text-amber-900 flex flex-col gap-0.5 pt-1 border-t border-amber-200/80">
                  <div className="flex justify-between">
                    <span className="text-amber-700">Текущий долг перед поставщиком:</span>
                    <span className="font-bold font-mono">
                      {(selectedSupplier.currentDebt || 0).toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                  {parsedAmount > 0 && (
                    <div className="flex justify-between text-emerald-800 font-semibold">
                      <span>Остаток долга после изъятия:</span>
                      <span className="font-mono">
                        {Math.max(
                          0,
                          (selectedSupplier.currentDebt || 0) - parsedAmount
                        ).toLocaleString('ru-RU')}{' '}
                        ₽
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Примечание (кому выдано / детали)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                isSupplierPayment
                  ? 'Номер накладной или комментарий...'
                  : 'Например: Закупка хозтоваров'
              }
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Integration Notice */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed">
            {type === 'out' ? (
              <span>
                <strong>Взаиморасчеты и касса:</strong> Сумма спишется из наличных открытой смены{' '}
                <code className="text-slate-800 font-bold font-mono">(shift.totalCashOut)</code>
                {isSupplierPayment && selectedSupplier ? (
                  <span>
                    {' '}
                    и <strong>одновременно уменьшит долг</strong> перед поставщиком{' '}
                    <strong>«{selectedSupplier.name}»</strong>.
                  </span>
                ) : (
                  <span> и зафиксируется в финансовых отчетах.</span>
                )}
              </span>
            ) : (
              <span>
                <strong>Внесение:</strong> Сумма прибавится к текущему счетчику наличных в кассе и будет учтена в вечернем Z-отчете смены.
              </span>
            )}
          </div>

          {/* Buttons */}
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 text-xs font-bold text-white rounded-lg shadow-sm disabled:opacity-50 cursor-pointer ${
                type === 'out'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isSubmitting
                ? 'Проведение...'
                : type === 'out'
                ? 'Провести изъятие'
                : 'Провести внесение'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
