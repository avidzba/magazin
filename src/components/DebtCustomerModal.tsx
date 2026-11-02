import React, { useState } from 'react';
import { StoreCustomer } from '../types';
import { createCustomer } from '../services/storeService';
import { X, Search, UserPlus, UserCheck, AlertTriangle, ArrowRight } from 'lucide-react';

interface DebtCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: StoreCustomer[];
  totalAmount: number;
  onSelectCustomerAndConfirm: (customer: StoreCustomer) => void;
}

export const DebtCustomerModal: React.FC<DebtCustomerModalProps> = ({
  isOpen,
  onClose,
  customers,
  totalAmount,
  onSelectCustomerAndConfirm,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNote, setNewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery))
  );

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setErrorMsg('Укажите имя клиента');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const newId = await createCustomer({
        name: newName.trim(),
        phone: newPhone.trim(),
        note: newNote.trim(),
        totalDebt: 0,
      });

      const createdCustomer: StoreCustomer = {
        id: newId,
        name: newName.trim(),
        phone: newPhone.trim(),
        totalDebt: 0,
        note: newNote.trim(),
      };

      onSelectCustomerAndConfirm(createdCustomer);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка при создании клиента');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-200" />
            <div>
              <h3 className="font-semibold text-sm">Проведение чека «В ДОЛГ»</h3>
              <p className="text-xs text-amber-100">
                Сумма чека: <span className="font-bold">{totalAmount.toLocaleString('ru-RU')} ₽</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-amber-200 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Finance Logic Notice */}
        <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-200 text-xs text-amber-900 flex items-start gap-2">
          <span className="font-bold text-amber-700">Правило учета:</span>
          <span>
            Сумма чека ({totalAmount.toLocaleString('ru-RU')} ₽) запишется в долг выбранного клиента.
            Транзакция дохода в «Учет финансов» <strong>НЕ создается</strong>, так как деньги в кассу еще не поступили.
          </span>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {!isCreatingNew ? (
            <>
              {/* Search & Actions */}
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск клиента по имени или телефону..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      Очистить
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsCreatingNew(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition shrink-0"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Создать нового</span>
                </button>
              </div>

              {/* Customer List */}
              <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {filteredCustomers.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-sm">
                    Клиенты не найдены.
                    <button
                      type="button"
                      onClick={() => {
                        setNewName(searchQuery);
                        setIsCreatingNew(true);
                      }}
                      className="block mx-auto mt-2 text-xs font-medium text-blue-600 hover:underline"
                    >
                      Создать клиента «{searchQuery || 'Новый клиент'}»
                    </button>
                  </div>
                ) : (
                  filteredCustomers.map((cust) => {
                    const newTotalDebt = cust.totalDebt + totalAmount;
                    return (
                      <div
                        key={cust.id}
                        className="p-3 hover:bg-amber-50/60 transition flex items-center justify-between group cursor-pointer"
                        onClick={() => onSelectCustomerAndConfirm(cust)}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900 group-hover:text-amber-800">
                              {cust.name}
                            </span>
                            {cust.phone && (
                              <span className="text-xs text-slate-500 font-mono">
                                {cust.phone}
                              </span>
                            )}
                          </div>
                          {cust.note && (
                            <p className="text-xs text-slate-400 truncate max-w-sm">
                              {cust.note}
                            </p>
                          )}
                          <div className="text-xs mt-1 text-slate-600 flex items-center gap-1">
                            <span>Текущий долг:</span>
                            <span className={`font-semibold ${cust.totalDebt > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                              {cust.totalDebt.toLocaleString('ru-RU')} ₽
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="text-amber-700 font-semibold">
                              Станет: {newTotalDebt.toLocaleString('ru-RU')} ₽
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md transition shadow-xs flex items-center gap-1"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Выбрать</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            /* Create Customer Inline Form */
            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-semibold text-sm text-slate-800">Создание нового клиента</span>
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  ← Назад к списку
                </button>
              </div>

              {errorMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ФИО / Имя клиента *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Например: Иван Иванов (сосед)"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Номер телефона
                </label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+7 (___) ___-__-__"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Примечание / адрес
                </label>
                <textarea
                  rows={2}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Кем приходится, ориентир, адрес..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isSubmitting ? 'Сохранение...' : 'Создать и оформить в долг'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>Нажмите Esc для отмены</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded-md bg-white"
          >
            Отмена (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
