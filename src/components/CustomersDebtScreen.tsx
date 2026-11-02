import React, { useState } from 'react';
import { StoreCustomer, StoreShift } from '../types';
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  repayCustomerDebt,
} from '../services/storeService';
import {
  Users,
  Search,
  UserPlus,
  ArrowDownLeft,
  Banknote,
  CreditCard,
  Edit2,
  Trash2,
  X,
  Phone,
  FileText,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface CustomersDebtScreenProps {
  customers: StoreCustomer[];
  currentShift?: StoreShift | null;
}

export const CustomersDebtScreen: React.FC<CustomersDebtScreenProps> = ({ customers, currentShift }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDebtOnly, setFilterDebtOnly] = useState(false);

  // Repay Debt Modal state
  const [selectedRepayCustomer, setSelectedRepayCustomer] = useState<StoreCustomer | null>(null);
  const [repayAmount, setRepayAmount] = useState<string>('');
  const [repayMethod, setRepayMethod] = useState<'cash' | 'card'>('cash');
  const [repayNote, setRepayNote] = useState<string>('');
  const [isSubmittingRepay, setIsSubmittingRepay] = useState(false);

  // Customer Edit/Create Modal state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<StoreCustomer | null>(null);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custDebt, setCustDebt] = useState('0');
  const [custNote, setCustNote] = useState('');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // Feedback banner
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Summary Metrics
  const totalDebtSum = customers.reduce((acc, c) => acc + (c.totalDebt > 0 ? c.totalDebt : 0), 0);
  const debtorCount = customers.filter((c) => c.totalDebt > 0).length;
  const totalCustomersCount = customers.length;

  // Filtered List
  const filteredList = customers.filter((c) => {
    const matchesFilter = filterDebtOnly ? c.totalDebt > 0 : true;
    const matchesSearch =
      !searchQuery.trim() ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery));
    return matchesFilter && matchesSearch;
  });

  // Open Repay Modal
  const openRepayModal = (customer: StoreCustomer) => {
    setSelectedRepayCustomer(customer);
    setRepayAmount(String(Math.max(0, customer.totalDebt)));
    setRepayMethod('cash');
    setRepayNote('');
  };

  // Submit Repay Debt
  const handleRepaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepayCustomer) return;

    const amount = parseFloat(repayAmount);
    if (!amount || amount <= 0) {
      setNotification({ type: 'error', text: 'Укажите положительную сумму возврата' });
      return;
    }

    setIsSubmittingRepay(true);
    try {
      await repayCustomerDebt({
        customerId: selectedRepayCustomer.id,
        customerName: selectedRepayCustomer.name,
        amount,
        paymentMethod: repayMethod,
        note: repayNote.trim(),
        shiftId: currentShift ? currentShift.id : null,
      });

      setNotification({
        type: 'success',
        text: `Оплата долга на сумму ${amount.toLocaleString('ru-RU')} ₽ успешно принята. Доход добавлен в общую коллекцию финансов!`,
      });
      setSelectedRepayCustomer(null);
    } catch (err) {
      setNotification({
        type: 'error',
        text: err instanceof Error ? err.message : 'Ошибка при возврате долга',
      });
    } finally {
      setIsSubmittingRepay(false);
    }
  };

  // Open Create/Edit
  const openCreateModal = () => {
    setEditingCustomer(null);
    setCustName('');
    setCustPhone('');
    setCustDebt('0');
    setCustNote('');
    setIsCustomerModalOpen(true);
  };

  const openEditModal = (customer: StoreCustomer) => {
    setEditingCustomer(customer);
    setCustName(customer.name);
    setCustPhone(customer.phone || '');
    setCustDebt(String(customer.totalDebt));
    setCustNote(customer.note || '');
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) return;

    setIsSavingCustomer(true);
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, {
          name: custName.trim(),
          phone: custPhone.trim(),
          totalDebt: parseFloat(custDebt) || 0,
          note: custNote.trim(),
        });
        setNotification({ type: 'success', text: 'Данные клиента обновлены' });
      } else {
        await createCustomer({
          name: custName.trim(),
          phone: custPhone.trim(),
          totalDebt: parseFloat(custDebt) || 0,
          note: custNote.trim(),
        });
        setNotification({ type: 'success', text: 'Новый клиент успешно добавлен' });
      }
      setIsCustomerModalOpen(false);
    } catch (err) {
      setNotification({
        type: 'error',
        text: err instanceof Error ? err.message : 'Ошибка сохранения клиента',
      });
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleDeleteCustomer = async (customer: StoreCustomer) => {
    if (!confirm(`Удалить клиента «${customer.name}»?`)) return;
    try {
      await deleteCustomer(customer.id);
      setNotification({ type: 'success', text: 'Клиент удален' });
    } catch (err) {
      setNotification({
        type: 'error',
        text: err instanceof Error ? err.message : 'Ошибка удаления клиента',
      });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Notification Banner */}
        {notification && (
          <div
            className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between shadow-2xs ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <span>{notification.text}</span>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-600 font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">
                Общий долг клиентов
              </span>
              <div className="text-2xl font-black text-rose-600 mt-1 font-mono">
                {totalDebtSum.toLocaleString('ru-RU')} ₽
              </div>
              <span className="text-[11px] text-slate-500">
                Сумма неоплаченных покупок «В долг»
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Клиентов с долгами
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {debtorCount}{' '}
                <span className="text-xs font-normal text-slate-400">
                  из {totalCustomersCount}
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                Требуют внесения возврата долга
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Всего клиентов в базе
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {totalCustomersCount}
              </div>
              <span className="text-[11px] text-slate-500">
                Постоянные покупатели магазина
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по имени или номеру телефона..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            <button
              onClick={() => setFilterDebtOnly(!filterDebtOnly)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition border ${
                filterDebtOnly
                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Только должники ({debtorCount})
            </button>
          </div>

          <button
            onClick={openCreateModal}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Добавить клиента</span>
          </button>
        </div>

        {/* Customers Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200 select-none">
                <tr>
                  <th className="py-3 px-4 font-semibold">Клиент</th>
                  <th className="py-3 px-4 font-semibold">Телефон</th>
                  <th className="py-3 px-4 font-semibold">Примечание</th>
                  <th className="py-3 px-4 font-semibold text-right">Текущий долг</th>
                  <th className="py-3 px-4 font-semibold text-center">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      Клиенты не найдены
                    </td>
                  </tr>
                ) : (
                  filteredList.map((cust) => {
                    const hasDebt = cust.totalDebt > 0;
                    return (
                      <tr key={cust.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 text-sm">{cust.name}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {cust.phone ? (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {cust.phone}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                          {cust.note || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
                              hasDebt
                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {cust.totalDebt.toLocaleString('ru-RU')} ₽
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-2">
                            {hasDebt && (
                              <button
                                onClick={() => openRepayModal(cust)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-semibold text-xs flex items-center gap-1 shadow-2xs transition active:scale-95"
                                title="Внести оплату (Возврат долга)"
                              >
                                <ArrowDownLeft className="w-3.5 h-3.5" />
                                <span>Возврат долга</span>
                              </button>
                            )}

                            <button
                              onClick={() => openEditModal(cust)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 transition"
                              title="Редактировать"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteCustomer(cust)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition"
                              title="Удалить"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Repay Debt (Возврат долга) */}
      {selectedRepayCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            <div className="px-5 py-3.5 bg-emerald-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-200" />
                <h3 className="font-semibold text-sm">Внесение оплаты (Возврат долга)</h3>
              </div>
              <button
                onClick={() => setSelectedRepayCustomer(null)}
                className="text-emerald-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRepaySubmit} className="p-5 space-y-4">
              {/* Customer Info Card */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500">Клиент-должник:</div>
                <div className="font-bold text-slate-900 text-sm mt-0.5">
                  {selectedRepayCustomer.name}
                </div>
                <div className="flex justify-between items-baseline mt-2 pt-2 border-t border-slate-200">
                  <span className="text-xs text-slate-600">Текущий долг:</span>
                  <span className="text-sm font-black text-rose-600 font-mono">
                    {selectedRepayCustomer.totalDebt.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Сумма погашения долга (₽):
                  </label>
                  <button
                    type="button"
                    onClick={() => setRepayAmount(String(selectedRepayCustomer.totalDebt))}
                    className="text-[11px] text-emerald-600 hover:underline font-medium"
                  >
                    Погасить весь долг
                  </button>
                </div>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xl font-bold bg-slate-50 border-2 border-emerald-500 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  autoFocus
                />
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Каким способом внесены деньги:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRepayMethod('cash')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      repayMethod === 'cash'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Наличные</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepayMethod('card')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      repayMethod === 'card'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Карта / Перевод</span>
                  </button>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Примечание к платежу (опционально)
                </label>
                <input
                  type="text"
                  value={repayNote}
                  onChange={(e) => setRepayNote(e.target.value)}
                  placeholder="Например: частичная оплата, перевел на Сбербанк"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Integration Logic Explanation */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 leading-relaxed">
                <span className="font-bold text-emerald-800">Движение средств:</span> После подтверждения
                долг клиента уменьшится на {repayAmount || 0} ₽, и <strong>в общую коллекцию «transactions» (Учет финансов)</strong> автоматически
                запишется приход на сумму {repayAmount || 0} ₽ в категорию{' '}
                <strong>
                  {repayMethod === 'cash' ? '«Продажи Наличные»' : '«Продажи Карта/Перевод»'}
                </strong>.
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRepayCustomer(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRepay}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {isSubmittingRepay ? 'Проведение...' : 'Зачислить возврат долга'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create/Edit Customer */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                {editingCustomer ? 'Редактировать клиента' : 'Новый клиент'}
              </h3>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ФИО / Имя клиента *
                </label>
                <input
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="Иван Петров"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Номер телефона
                </label>
                <input
                  type="tel"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="+7 (999) 000-00-00"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Сумма долга (₽)
                </label>
                <input
                  type="number"
                  step="any"
                  value={custDebt}
                  onChange={(e) => setCustDebt(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Примечание / адрес
                </label>
                <textarea
                  rows={2}
                  value={custNote}
                  onChange={(e) => setCustNote(e.target.value)}
                  placeholder="Ориентир, постоянный клиент..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomer}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {isSavingCustomer ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
