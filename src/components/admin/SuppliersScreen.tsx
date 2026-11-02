import React, { useState, useMemo } from 'react';
import {
  StoreSupplier,
  StoreInventoryDoc,
  StoreProduct,
  StorePurchaseOrder,
  StoreShift,
  FinanceTransaction,
} from '../../types';
import { createSupplier, deleteSupplier } from '../../services/storeService';
import { SupplierProfileDrawer } from './SupplierProfileDrawer';
import { PaySupplierDebtModal } from './PaySupplierDebtModal';
import { SmartPurchaseOrderModal } from './SmartPurchaseOrderModal';
import {
  Truck,
  Search,
  Plus,
  Phone,
  Mail,
  Building2,
  Wallet,
  Sparkles,
  PackagePlus,
  AlertCircle,
  CheckCircle2,
  FileText,
  ChevronRight,
  TrendingDown,
  Trash2,
  X,
  CreditCard,
  DollarSign,
  ArrowUpRight,
} from 'lucide-react';

interface SuppliersScreenProps {
  suppliers: StoreSupplier[];
  inventoryDocs: StoreInventoryDoc[];
  products: StoreProduct[];
  purchaseOrders: StorePurchaseOrder[];
  transactions: FinanceTransaction[];
  currentShift: StoreShift | null;
  authorName?: string;
  authorId?: string;
}

export const SuppliersScreen: React.FC<SuppliersScreenProps> = ({
  suppliers,
  inventoryDocs,
  products,
  purchaseOrders,
  transactions,
  currentShift,
  authorName,
  authorId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDebtOnly, setFilterDebtOnly] = useState<'all' | 'debt' | 'no_debt'>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<StoreSupplier | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Quick modals from list
  const [payingSupplier, setPayingSupplier] = useState<StoreSupplier | null>(null);
  const [orderingSupplier, setOrderingSupplier] = useState<StoreSupplier | null>(null);

  // New Supplier form state
  const [newName, setNewName] = useState('');
  const [newInn, setNewInn] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newBankDetails, setNewBankDetails] = useState('');
  const [newInitialDebt, setNewInitialDebt] = useState<number>(0);
  const [newComment, setNewComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Keep selectedSupplier updated with live data from suppliers prop
  const liveSelectedSupplier = useMemo(() => {
    if (!selectedSupplier) return null;
    return suppliers.find((s) => s.id === selectedSupplier.id) || selectedSupplier;
  }, [suppliers, selectedSupplier]);

  // Overall KPI statistics
  const stats = useMemo(() => {
    const totalSuppliers = suppliers.length;
    let totalDebt = 0;
    let suppliersWithDebt = 0;

    suppliers.forEach((s) => {
      const debt = s.currentDebt || 0;
      if (debt > 0) {
        totalDebt += debt;
        suppliersWithDebt += 1;
      }
    });

    const totalReceipts = inventoryDocs.filter((d) => d.type === 'receipt').length;
    const totalProcurementSum = inventoryDocs
      .filter((d) => d.type === 'receipt')
      .reduce((sum, d) => sum + (d.totalAmount || 0), 0);

    return {
      totalSuppliers,
      totalDebt,
      suppliersWithDebt,
      totalReceipts,
      totalProcurementSum,
    };
  }, [suppliers, inventoryDocs]);

  // Supplier receipts stats lookup
  const supplierReceiptStats = useMemo(() => {
    const map = new Map<string, { count: number; totalSum: number }>();
    inventoryDocs.forEach((d) => {
      if (d.type !== 'receipt') return;
      const key = d.supplierId || d.supplier;
      if (!key) return;

      const current = map.get(key) || { count: 0, totalSum: 0 };
      current.count += 1;
      current.totalSum += d.totalAmount || 0;
      map.set(key, current);
    });
    return map;
  }, [inventoryDocs]);

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      // Debt filter
      const debt = s.currentDebt || 0;
      if (filterDebtOnly === 'debt' && debt <= 0) return false;
      if (filterDebtOnly === 'no_debt' && debt > 0) return false;

      // Text query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        s.name.toLowerCase().includes(q) ||
        (s.inn && s.inn.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q))
      );
    });
  }, [suppliers, filterDebtOnly, searchQuery]);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSaving(true);
    try {
      const newId = await createSupplier({
        name: newName.trim(),
        inn: newInn.trim() || undefined,
        phone: newPhone.trim() || undefined,
        email: newEmail.trim() || undefined,
        address: newAddress.trim() || undefined,
        bankDetails: newBankDetails.trim() || undefined,
        currentDebt: Number(newInitialDebt) || 0,
        comment: newComment.trim() || undefined,
      });

      setIsAddModalOpen(false);
      // Reset form
      setNewName('');
      setNewInn('');
      setNewPhone('');
      setNewEmail('');
      setNewAddress('');
      setNewBankDetails('');
      setNewInitialDebt(0);
      setNewComment('');

      // Auto-open created supplier drawer
      const created = suppliers.find((s) => s.id === newId);
      if (created) setSelectedSupplier(created);
    } catch (err: any) {
      alert(`Ошибка создания поставщика: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, s: StoreSupplier) => {
    e.stopPropagation();
    if (confirm(`Вы уверены, что хотите удалить поставщика «${s.name}»?`)) {
      try {
        await deleteSupplier(s.id);
        if (selectedSupplier?.id === s.id) {
          setSelectedSupplier(null);
        }
      } catch (err: any) {
        alert(`Ошибка удаления: ${err.message}`);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Поставщики (CRM)
              </h1>
              <p className="text-xs text-slate-500">
                База контрагентов, контроль долгов, сверка накладных и умный автозаказ
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить поставщика</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Suppliers */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Поставщиков в базе
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
            {stats.totalSuppliers}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Активные партнеры</p>
        </div>

        {/* Card 2: Total Debt */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Общий долг
            </span>
            <div
              className={`p-2 rounded-xl ${
                stats.totalDebt > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`mt-2 text-2xl font-black font-mono ${
              stats.totalDebt > 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}
          >
            {stats.totalDebt.toLocaleString('ru-RU')} ₽
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {stats.suppliersWithDebt > 0
              ? `У ${stats.suppliersWithDebt} поставщиков есть задолженность`
              : 'Задолженность отсутствует'}
          </p>
        </div>

        {/* Card 3: Total Receipts */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Всего приемок
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <PackagePlus className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
            {stats.totalReceipts}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Проведенных накладных</p>
        </div>

        {/* Card 4: Total Procurement Volume */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Объем закупок
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
            {stats.totalProcurementSum.toLocaleString('ru-RU')} ₽
          </div>
          <p className="mt-1 text-[11px] text-slate-400">За все время работы</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию, ИНН, телефону..."
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto w-full sm:w-auto overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilterDebtOnly('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              filterDebtOnly === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Все ({suppliers.length})
          </button>
          <button
            onClick={() => setFilterDebtOnly('debt')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              filterDebtOnly === 'debt'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <AlertCircle className="w-3 h-3" />
            <span>С долгом ({stats.suppliersWithDebt})</span>
          </button>
          <button
            onClick={() => setFilterDebtOnly('no_debt')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              filterDebtOnly === 'no_debt'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>Без долга</span>
          </button>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 select-none">
              <tr>
                <th className="py-3 px-4">Поставщик / Организация</th>
                <th className="py-3 px-3">Контакты</th>
                <th className="py-3 px-3 text-center">Приемок</th>
                <th className="py-3 px-4 text-right">Сумма закупок</th>
                <th className="py-3 px-4 text-right">Текущий долг</th>
                <th className="py-3 px-4 text-center">Действия</th>
                <th className="py-3 px-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <Truck className="w-12 h-12 text-slate-300 mb-2 stroke-1" />
                      <p className="font-bold text-sm text-slate-700">
                        Поставщики не найдены
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {searchQuery
                          ? 'Попробуйте изменить поисковый запрос'
                          : 'Добавьте первого поставщика в базу'}
                      </p>
                      <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Добавить поставщика</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((s) => {
                  const debt = s.currentDebt || 0;
                  const receiptStat = supplierReceiptStats.get(s.id) ||
                    supplierReceiptStats.get(s.name) || { count: 0, totalSum: 0 };

                  return (
                    <tr
                      key={s.id}
                      onClick={() => setSelectedSupplier(s)}
                      className="hover:bg-blue-50/60 cursor-pointer transition group"
                      title="Нажмите для открытия профиля поставщика"
                    >
                      {/* Name & INN */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 group-hover:bg-blue-100 text-slate-600 group-hover:text-blue-600 rounded-xl transition">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 group-hover:text-blue-600 transition text-sm">
                              {s.name}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              {s.inn ? (
                                <span className="font-mono">ИНН: {s.inn}</span>
                              ) : (
                                <span>Без ИНН</span>
                              )}
                              {s.comment && (
                                <span className="truncate max-w-xs text-slate-500">
                                  • {s.comment}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contacts */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-0.5">
                          {s.phone && (
                            <div className="flex items-center gap-1.5 text-slate-700 font-mono">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{s.phone}</span>
                            </div>
                          )}
                          {s.email && (
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span className="truncate max-w-[160px]">{s.email}</span>
                            </div>
                          )}
                          {!s.phone && !s.email && (
                            <span className="text-slate-400 text-[11px]">Контакты не указаны</span>
                          )}
                        </div>
                      </td>

                      {/* Receipts Count */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                          {receiptStat.count} накл.
                        </span>
                      </td>

                      {/* Procurement Sum */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {receiptStat.totalSum > 0
                          ? `${receiptStat.totalSum.toLocaleString('ru-RU')} ₽`
                          : '—'}
                      </td>

                      {/* Debt Status Badge */}
                      <td className="py-3.5 px-4 text-right">
                        {debt > 0 ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-black font-mono bg-rose-100 text-rose-700 border border-rose-200">
                              {debt.toLocaleString('ru-RU')} ₽
                            </span>
                            <span className="text-[10px] text-rose-600 font-bold mt-0.5">
                              Долг магазину
                            </span>
                          </div>
                        ) : debt < 0 ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-black font-mono bg-blue-100 text-blue-700">
                              {Math.abs(debt).toLocaleString('ru-RU')} ₽
                            </span>
                            <span className="text-[10px] text-blue-600 font-bold mt-0.5">
                              Переплата
                            </span>
                          </div>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            0 ₽ (нет долга)
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div
                          className="flex items-center justify-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {debt > 0 && (
                            <button
                              type="button"
                              onClick={() => setPayingSupplier(s)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white rounded-lg text-[11px] font-bold transition"
                              title="Погасить задолженность"
                            >
                              Погасить
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setOrderingSupplier(s)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-600 text-amber-700 hover:text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                            title="Сформировать умный заказ поставщику"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Заказ</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDelete(e, s)}
                            className="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Удалить поставщика"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Arrow indicator */}
                      <td className="py-3.5 px-2 text-center text-slate-300 group-hover:text-blue-600 transition">
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplier Profile Drawer (Full Profile with 4 tabs: Info, Receipts, Analytics, Orders) */}
      {liveSelectedSupplier && (
        <SupplierProfileDrawer
          isOpen={!!liveSelectedSupplier}
          onClose={() => setSelectedSupplier(null)}
          supplier={liveSelectedSupplier}
          inventoryDocs={inventoryDocs}
          products={products}
          purchaseOrders={purchaseOrders}
          transactions={transactions}
          currentShift={currentShift}
          authorName={authorName}
          authorId={authorId}
        />
      )}

      {/* Quick Pay Debt Modal from list */}
      {payingSupplier && (
        <PaySupplierDebtModal
          isOpen={!!payingSupplier}
          onClose={() => setPayingSupplier(null)}
          supplier={payingSupplier}
          currentShift={currentShift}
        />
      )}

      {/* Quick Smart Order Modal from list */}
      {orderingSupplier && (
        <SmartPurchaseOrderModal
          isOpen={!!orderingSupplier}
          onClose={() => setOrderingSupplier(null)}
          supplier={orderingSupplier}
          products={products}
          authorName={authorName}
        />
      )}

      {/* Modal: Add New Supplier */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-600 rounded-lg">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-sm">Новый поставщик</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Название организации / ИП *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="ООО АльфаТрейд, ИП Смирнов..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ИНН
                  </label>
                  <input
                    type="text"
                    value={newInn}
                    onChange={(e) => setNewInn(e.target.value)}
                    placeholder="7701234567"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Телефон
                  </label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+7 999 123-45-67"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="order@supplier.ru"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Начальный долг (₽)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newInitialDebt}
                    onChange={(e) => setNewInitialDebt(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Фактический адрес / Адрес склада
                </label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="г. Москва, ул. Складская 12, стр. 3"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Банковские реквизиты (р/с, БИК, Банк)
                </label>
                <textarea
                  rows={2}
                  value={newBankDetails}
                  onChange={(e) => setNewBankDetails(e.target.value)}
                  placeholder="р/с 40702810..., БИК 044525225, Банк ПАО СБЕРБАНК..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-none text-[11px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Примечание / Контакты менеджера
                </label>
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Менеджер Артем, заказ отправлять до 16:00..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !newName.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Сохранение...' : 'Создать поставщика'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
