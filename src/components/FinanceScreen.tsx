import React, { useState } from 'react';
import { FinanceTransaction } from '../types';
import {
  TrendingUp,
  Banknote,
  CreditCard,
  Layers,
  Calendar,
  CheckCircle,
  HelpCircle,
  Search,
} from 'lucide-react';

interface FinanceScreenProps {
  transactions: FinanceTransaction[];
}

export const FinanceScreen: React.FC<FinanceScreenProps> = ({ transactions }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Все');

  // Metrics
  const totalIncome = transactions.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : 0), 0);
  const cashIncome = transactions
    .filter((t) => t.category === 'Продажи Наличные')
    .reduce((sum, t) => sum + t.amount, 0);
  const cardIncome = transactions
    .filter((t) => t.category === 'Продажи Карта/Перевод')
    .reduce((sum, t) => sum + t.amount, 0);

  const categories = ['Все', 'Продажи Наличные', 'Продажи Карта/Перевод'];

  const filteredTransactions = transactions.filter((t) => {
    const matchesCat = categoryFilter === 'Все' || t.category === categoryFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const formatDate = (d: any) => {
    if (!d) return '—';
    if (d.toDate) return d.toDate().toLocaleString('ru-RU');
    if (typeof d === 'string' || typeof d === 'number') {
      return new Date(d).toLocaleString('ru-RU');
    }
    return 'Недавно';
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Architectural integration notice */}
        <div className="p-4 bg-gradient-to-r from-blue-900 to-slate-900 text-white rounded-xl shadow-md border border-blue-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/50 flex items-center justify-center shrink-0 border border-blue-400/40">
              <TrendingUp className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-wide">
                Общая база данных: Коллекция «transactions» (Учет финансов)
              </h2>
              <p className="text-xs text-blue-200 mt-0.5 leading-relaxed">
                Сюда поступают фактические доходы розничной точки с полем{' '}
                <code className="bg-blue-950 px-1.5 py-0.5 rounded text-blue-300 font-mono">
                  accountId: 'Магазин'
                </code>
                . Чеки «В долг» не создают проводок до момента, пока клиент не принесет реальные деньги в кассу.
              </p>
            </div>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                Общая фактическая выручка
              </span>
              <div className="text-2xl font-black text-emerald-600 mt-1 font-mono">
                {totalIncome.toLocaleString('ru-RU')} ₽
              </div>
              <span className="text-[11px] text-slate-500">
                Все поступившие средства в кассу
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Продажи Наличные
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                {cashIncome.toLocaleString('ru-RU')} ₽
              </div>
              <span className="text-[11px] text-slate-500">
                Физические банкноты и монеты
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Banknote className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Продажи Карта / Перевод
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                {cardIncome.toLocaleString('ru-RU')} ₽
              </div>
              <span className="text-[11px] text-slate-500">
                Безналичный эквайринг и СБП
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <CreditCard className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по описанию или категории..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition border ${
                  categoryFilter === cat
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200 select-none">
                <tr>
                  <th className="py-3 px-4 font-semibold">Дата и время</th>
                  <th className="py-3 px-4 font-semibold">Счет</th>
                  <th className="py-3 px-4 font-semibold">Тип</th>
                  <th className="py-3 px-4 font-semibold">Категория</th>
                  <th className="py-3 px-4 font-semibold">Описание транзакции</th>
                  <th className="py-3 px-4 font-semibold text-right">Сумма дохода</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Транзакции пока не зарегистрированы
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap font-mono">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(tx.date)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-mono border border-slate-200">
                          {tx.accountId}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                          Приход
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            tx.category === 'Продажи Наличные'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {tx.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        {tx.description || 'Розничная продажа'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-emerald-600 font-mono text-sm">
                        +{tx.amount.toLocaleString('ru-RU')} ₽
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
