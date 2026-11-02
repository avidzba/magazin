import React, { useState } from 'react';
import {
  FinanceTransaction,
  StoreShift,
  StoreCashFlow,
  StoreOrder,
} from '../../types';
import { addStoreExpense } from '../../services/storeService';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Banknote,
  Building2,
  PlusCircle,
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  Calendar,
  X,
  CreditCard,
  FileCheck2,
} from 'lucide-react';

interface AdminFinanceScreenProps {
  transactions: FinanceTransaction[];
  shifts: StoreShift[];
  cashFlows: StoreCashFlow[];
  orders: StoreOrder[];
}

export const AdminFinanceScreen: React.FC<AdminFinanceScreenProps> = ({
  transactions,
  shifts,
  cashFlows,
  orders,
}) => {
  const [activeTab, setActiveTab] = useState<'movements' | 'shifts'>('movements');
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('Все');

  const currentShift = shifts.find((s) => s.status === 'open') || null;
  const cashInDrawer = currentShift
    ? currentShift.startCash +
      currentShift.totalCash +
      currentShift.totalCashIn -
      currentShift.totalCashOut
    : 0;

  // Revenue today & this month
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const getDocTime = (d: any) => {
    return d?.toDate?.()?.getTime() || (typeof d === 'string' ? new Date(d).getTime() : 0);
  };

  const revenueToday = orders
    .filter((o) => getDocTime(o.date) >= startOfToday)
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const revenueMonth = orders
    .filter((o) => getDocTime(o.date) >= startOfMonth)
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const expensesMonth = transactions
    .filter((t) => t.type === 'expense' && getDocTime(t.date) >= startOfMonth)
    .reduce((sum, t) => sum + t.amount, 0);

  // Categories list for filtering
  const allCategories = ['Все', ...Array.from(new Set(transactions.map((t) => t.category)))];

  const filteredTransactions = transactions.filter((t) => {
    if (categoryFilter === 'Все') return true;
    return t.category === categoryFilter;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Финансовый учет магазина
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Контроль выручки, кассовой наличности, счетов и операционных расходов
          </p>
        </div>

        <button
          onClick={() => setIsExpenseModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95 shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Внести расход</span>
        </button>
      </div>

      {/* 4 Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Revenue */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Выручка за сегодня
          </span>
          <div className="text-2xl font-black text-emerald-600 font-mono mt-2">
            {revenueToday.toLocaleString('ru-RU')} ₽
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            Всего продаж: {orders.filter((o) => getDocTime(o.date) >= startOfToday).length} чеков
          </span>
        </div>

        {/* Card 2: Monthly Revenue */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Выручка за месяц
          </span>
          <div className="text-2xl font-black text-slate-900 font-mono mt-2">
            {revenueMonth.toLocaleString('ru-RU')} ₽
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Текущий расчетный период</span>
        </div>

        {/* Card 3: Cash in Active Shift Drawer */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Наличные в кассе
            </span>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-2xl font-black text-blue-600 font-mono mt-2">
            {cashInDrawer.toLocaleString('ru-RU')} ₽
          </div>
          <span className="text-xs text-slate-400 mt-1 block truncate">
            {currentShift ? `Смена кассира: ${currentShift.cashierName || 'Открыта'}` : 'Смена закрыта'}
          </span>
        </div>

        {/* Card 4: Monthly Expenses */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Расходы за месяц
          </span>
          <div className="text-2xl font-black text-rose-600 font-mono mt-2">
            {expensesMonth.toLocaleString('ru-RU')} ₽
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            Аренда, поставщики, ЗП, хозрасходы
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('movements')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              activeTab === 'movements'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Движение средств ({transactions.length})
          </button>
          <button
            onClick={() => setActiveTab('shifts')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              activeTab === 'shifts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Кассовые смены ({shifts.length})
          </button>
        </div>

        {/* Filter Category Dropdown */}
        {activeTab === 'movements' && (
          <div className="flex items-center gap-1.5 pb-2">
            <span className="text-xs text-slate-400">Категория:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"
            >
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: Unified Cash Movements & Transactions */}
      {activeTab === 'movements' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 select-none">
                <tr>
                  <th className="py-3 px-4">Тип</th>
                  <th className="py-3 px-3">Дата и время</th>
                  <th className="py-3 px-3">Категория</th>
                  <th className="py-3 px-3">Источник списания / счет</th>
                  <th className="py-3 px-4">Назначение / Описание</th>
                  <th className="py-3 px-4 text-right">Сумма</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      Операций движения средств пока не зафиксировано
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const isIncome = tx.type === 'income';
                    const txDate = tx.date?.toDate?.()
                      ? tx.date.toDate().toLocaleString('ru-RU')
                      : 'Сегодня';

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4">
                          {isIncome ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                              Доход
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              <ArrowDownRight className="w-3 h-3 text-rose-600" />
                              Расход
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500 font-mono">{txDate}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800">{tx.category}</td>
                        <td className="py-3 px-3 text-slate-600">
                          {tx.accountId || (tx.source === 'cash_drawer' ? 'Касса магазина' : 'Банковский счет')}
                        </td>
                        <td className="py-3 px-4 text-slate-500 truncate max-w-xs">
                          {tx.description || '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-black font-mono">
                          <span className={isIncome ? 'text-emerald-600' : 'text-rose-600'}>
                            {isIncome ? '+' : '-'} {tx.amount.toLocaleString('ru-RU')} ₽
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Shift History */}
      {activeTab === 'shifts' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 select-none">
                <tr>
                  <th className="py-3 px-4">Кассир</th>
                  <th className="py-3 px-3">Открытие</th>
                  <th className="py-3 px-3">Закрытие</th>
                  <th className="py-3 px-3 text-right">Начало смены</th>
                  <th className="py-3 px-3 text-right">Продажи нал</th>
                  <th className="py-3 px-3 text-right">Продажи безнал</th>
                  <th className="py-3 px-3 text-right">В долг</th>
                  <th className="py-3 px-3 text-right">Фактический итог</th>
                  <th className="py-3 px-3 text-center">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shifts.map((s) => {
                  const openDate = s.openTime?.toDate?.()
                    ? s.openTime.toDate().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
                    : '—';
                  const closeDate = s.closeTime?.toDate?.()
                    ? s.closeTime.toDate().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
                    : '—';

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {s.cashierName || 'Кассир'}
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-mono">{openDate}</td>
                      <td className="py-3 px-3 text-slate-500 font-mono">{closeDate}</td>
                      <td className="py-3 px-3 text-right font-mono">{s.startCash} ₽</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                        {s.totalCash} ₽
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-blue-700">
                        {s.totalCard} ₽
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-amber-700">
                        {s.totalDebt} ₽
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-slate-900">
                        {s.endActualCash !== undefined ? `${s.endActualCash} ₽` : '—'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === 'open'
                              ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {s.status === 'open' ? 'Открыта' : 'Закрыта'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Record Store Expense */}
      {isExpenseModalOpen && (
        <CreateExpenseModal
          isOpen={isExpenseModalOpen}
          onClose={() => setIsExpenseModalOpen(false)}
          currentShift={currentShift}
        />
      )}
    </div>
  );
};

/* =========================================================================
   MODAL: Record Store Expense (Внести расход)
========================================================================= */
interface CreateExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentShift: StoreShift | null;
}

const CreateExpenseModal: React.FC<CreateExpenseModalProps> = ({
  isOpen,
  onClose,
  currentShift,
}) => {
  const [amount, setAmount] = useState<number>(0);
  const [category, setCategory] = useState('Оплата поставщикам');
  const [source, setSource] = useState<'cash_drawer' | 'bank_account'>('cash_drawer');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      alert('Сумма расхода должна быть больше 0.');
      return;
    }

    setSubmitting(true);
    try {
      await addStoreExpense({
        amount,
        category,
        source,
        note,
        shiftId: currentShift?.id || null,
      });
      onClose();
    } catch (err: any) {
      alert(`Ошибка внесения расхода: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-rose-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowDownRight className="w-5 h-5 text-rose-100" />
            <h3 className="font-bold text-sm">Внести расход магазина</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-rose-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Сумма расхода ₽ *</label>
            <input
              type="number"
              min="1"
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              placeholder="0"
              required
              autoFocus
              className="w-full px-3 py-2 text-lg font-black font-mono text-rose-600 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Категория расхода *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none font-medium"
            >
              <option value="Оплата поставщикам">Оплата поставщикам</option>
              <option value="Выдача ЗП">Выдача заработной платы сотрудникам</option>
              <option value="Аренда помещения">Аренда помещения</option>
              <option value="Хозрасходы">Хозяйственные расходы / Расходные материалы</option>
              <option value="Налоги и сборы">Налоги и банковские сборы</option>
              <option value="Инкассация">Инкассация в банк</option>
              <option value="Прочее">Прочие расходы</option>
            </select>
          </div>

          {/* Source selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Источник списания средств *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSource('cash_drawer')}
                className={`p-3 rounded-xl border text-left transition ${
                  source === 'cash_drawer'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-1 ring-blue-500'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Banknote className="w-4 h-4 text-blue-600" />
                  <span>Из кассы</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Вычитается из наличных денег текущей смены
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSource('bank_account')}
                className={`p-3 rounded-xl border text-left transition ${
                  source === 'bank_account'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-1 ring-blue-500'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Со счета</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Безналичный расчетный счет (касса не меняется)
                </p>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Примечание / Назначение платежа
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Кому, за что (например, ИП Иванов, кофе)..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting || amount <= 0}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-sm"
            >
              {submitting ? 'Сохранение...' : 'Зафиксировать расход'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
