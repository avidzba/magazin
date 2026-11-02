import React, { useState, useMemo } from 'react';
import {
  StoreShift,
  StoreOrder,
  StoreProduct,
  PaymentMethod,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ReceiptEditorModal } from './ReceiptEditorModal';
import { ReceiptSlipModal } from '../ReceiptSlipModal';
import {
  Clock,
  Calendar,
  User,
  Search,
  Banknote,
  CreditCard,
  AlertCircle,
  TrendingUp,
  DollarSign,
  ArrowLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  XCircle,
  Printer,
  Edit2,
  Receipt,
  RotateCcw,
  Sparkles,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface ShiftsScreenProps {
  shifts: StoreShift[];
  orders: StoreOrder[];
  products: StoreProduct[];
}

export const ShiftsScreen: React.FC<ShiftsScreenProps> = ({
  shifts,
  orders,
  products,
}) => {
  const { user, isAdmin } = useAuth();

  // Selected shift for detailed dashboard view
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  // Search and filter inside shifts list
  const [shiftStatusFilter, setShiftStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [cashierSearch, setCashierSearch] = useState('');

  // Smart search inside shift receipts
  const [receiptSearch, setReceiptSearch] = useState('');
  const [receiptPaymentFilter, setReceiptPaymentFilter] = useState<'all' | PaymentMethod>('all');

  // Modals
  const [editingOrder, setEditingOrder] = useState<StoreOrder | null>(null);
  const [printingOrder, setPrintingOrder] = useState<StoreOrder | null>(null);

  // Map of products for instant purchasePrice lookup
  const productMap = useMemo(() => {
    const map = new Map<string, StoreProduct>();
    products.forEach((p) => {
      map.set(p.id, p);
    });
    return map;
  }, [products]);

  // Sort shifts STRICTLY newest to oldest (by openTime DESC)
  const sortedShifts = useMemo(() => {
    return [...shifts].sort((a, b) => {
      const timeA = a.openTime?.toDate
        ? a.openTime.toDate().getTime()
        : new Date(a.openTime || 0).getTime();
      const timeB = b.openTime?.toDate
        ? b.openTime.toDate().getTime()
        : new Date(b.openTime || 0).getTime();
      return timeB - timeA;
    });
  }, [shifts]);

  // Filtered shifts list
  const filteredShifts = useMemo(() => {
    return sortedShifts.filter((s) => {
      if (shiftStatusFilter !== 'all' && s.status !== shiftStatusFilter) {
        return false;
      }
      if (cashierSearch.trim()) {
        const q = cashierSearch.toLowerCase().trim();
        const matchesCashier = s.cashierName?.toLowerCase().includes(q) || false;
        return matchesCashier;
      }
      return true;
    });
  }, [sortedShifts, shiftStatusFilter, cashierSearch]);

  // Selected shift object
  const activeShift = useMemo(() => {
    if (!selectedShiftId) return null;
    return shifts.find((s) => s.id === selectedShiftId) || null;
  }, [shifts, selectedShiftId]);

  // Orders belonging to active shift (sorted strictly newest to oldest)
  const shiftOrders = useMemo(() => {
    if (!activeShift) return [];
    return orders
      .filter((o) => o.shiftId === activeShift.id)
      .sort((a, b) => {
        const numA = typeof a.orderNumber === 'number' ? a.orderNumber : parseInt((a.receiptNumber || '').replace(/\D/g, ''), 10) || 0;
        const numB = typeof b.orderNumber === 'number' ? b.orderNumber : parseInt((b.receiptNumber || '').replace(/\D/g, ''), 10) || 0;
        if (numA !== 0 && numB !== 0 && numA !== numB) {
          return numB - numA;
        }
        const timeA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date || 0).getTime();
        const timeB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date || 0).getTime();
        return timeB - timeA;
      });
  }, [orders, activeShift]);

  // Shift detailed financial and profit calculation
  const shiftStats = useMemo(() => {
    if (!activeShift) return null;

    const totalCash = activeShift.totalCash || 0;
    const totalCard = activeShift.totalCard || 0;
    const totalDebt = activeShift.totalDebt || 0;
    const totalRevenue = totalCash + totalCard + totalDebt;

    // Calculate profit: sum of (salePrice - purchasePrice) * quantity for all valid items in shift
    let totalProfit = 0;
    let totalItemsCount = 0;

    shiftOrders.forEach((o) => {
      if (o.status === 'cancelled') return;

      o.items.forEach((it) => {
        totalItemsCount += it.quantity;
        const prod = productMap.get(it.productId);
        const purchase = prod?.purchasePrice !== undefined ? prod.purchasePrice : 0;
        const itemProfit = (it.price - purchase) * it.quantity;
        totalProfit += itemProfit;
      });
    });

    // Cash discrepancy calculation (Расхождение)
    const expected = activeShift.endExpectedCash;
    const actual = activeShift.endActualCash;
    let discrepancy: number | null = null;
    if (activeShift.status === 'closed' && expected !== undefined && actual !== undefined) {
      discrepancy = actual - expected;
    }

    return {
      totalRevenue,
      totalCash,
      totalCard,
      totalDebt,
      totalProfit,
      totalItemsCount,
      receiptsCount: shiftOrders.filter((o) => o.status !== 'cancelled').length,
      cancelledCount: shiftOrders.filter((o) => o.status === 'cancelled').length,
      discrepancy,
    };
  }, [activeShift, shiftOrders, productMap]);

  // Smart search filter across shift receipts
  const filteredShiftOrders = useMemo(() => {
    return shiftOrders.filter((o) => {
      // Payment method filter
      if (receiptPaymentFilter !== 'all' && o.paymentMethod !== receiptPaymentFilter) {
        return false;
      }

      if (!receiptSearch.trim()) return true;
      const q = receiptSearch.toLowerCase().trim();

      // 1. Receipt number
      if (o.receiptNumber.toLowerCase().includes(q)) return true;

      // 2. Customer name (for debt sales)
      if (o.customerName && o.customerName.toLowerCase().includes(q)) return true;

      // 3. Time string
      const dateStr = o.date?.toDate
        ? o.date.toDate().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        : '';
      if (dateStr.includes(q)) return true;

      // 4. Product name inside receipt
      const hasProduct = o.items.some((it) => it.name.toLowerCase().includes(q));
      if (hasProduct) return true;

      return false;
    });
  }, [shiftOrders, receiptPaymentFilter, receiptSearch]);

  const formatDateTime = (d: any) => {
    if (!d) return '—';
    const dateObj = d?.toDate ? d.toDate() : new Date(d);
    if (isNaN(dateObj.getTime())) return '—';
    return dateObj.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTimeOnly = (d: any) => {
    if (!d) return '—';
    const dateObj = d?.toDate ? d.toDate() : new Date(d);
    if (isNaN(dateObj.getTime())) return '—';
    return dateObj.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* =========================================================================
         VIEW 1: SHIFT DETAILS & DASHBOARD (DRILL-DOWN)
      ========================================================================= */}
      {activeShift && shiftStats ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Navigation Back Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <button
              onClick={() => setSelectedShiftId(null)}
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-600 bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl transition shadow-2xs self-start cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Ко всем сменам</span>
            </button>

            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                  activeShift.status === 'open'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {activeShift.status === 'open' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Смена открыта</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Смена закрыта</span>
                  </>
                )}
              </span>
              <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-2xs">
                Кассир: {activeShift.cashierName || 'Кассир'}
              </span>
            </div>
          </div>

          {/* Shift Header Summary */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span>Кассовая смена: {formatDateTime(activeShift.openTime)}</span>
                </h2>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                  <span>Открыта: {formatDateTime(activeShift.openTime)}</span>
                  {activeShift.closeTime && (
                    <span>• Закрыта: {formatDateTime(activeShift.closeTime)}</span>
                  )}
                  <span>• Размен в начале: {activeShift.startCash.toLocaleString('ru-RU')} ₽</span>
                </div>
              </div>

              {/* Cash discrepancy badge */}
              {shiftStats.discrepancy !== null && (
                <div
                  className={`p-3 rounded-xl border flex items-center gap-3 ${
                    shiftStats.discrepancy === 0
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : shiftStats.discrepancy < 0
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  <Wallet className="w-5 h-5 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-bold block">
                      Расхождение в кассе (факт vs расчет)
                    </span>
                    <span className="text-base font-black font-mono">
                      {shiftStats.discrepancy === 0
                        ? '0 ₽ (идеально точно)'
                        : `${shiftStats.discrepancy > 0 ? '+' : ''}${shiftStats.discrepancy.toLocaleString('ru-RU')} ₽ ${
                            shiftStats.discrepancy < 0 ? '(недостача)' : '(излишек)'
                          }`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* DASHBOARD: Shift Financial Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {/* 1. Total Revenue */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
                Итого выручка
              </span>
              <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
                {shiftStats.totalRevenue.toLocaleString('ru-RU')} ₽
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {shiftStats.receiptsCount} чеков за смену
              </span>
            </div>

            {/* 2. Cash */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Наличными
                </span>
                <Banknote className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-emerald-600 font-mono">
                {shiftStats.totalCash.toLocaleString('ru-RU')} ₽
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">В кассовом ящике</span>
            </div>

            {/* 3. Card */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Картой / Перевод
                </span>
                <CreditCard className="w-4 h-4 text-blue-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-blue-600 font-mono">
                {shiftStats.totalCard.toLocaleString('ru-RU')} ₽
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Безналичный расчет</span>
            </div>

            {/* 4. Debt */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  В долг
                </span>
                <AlertCircle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-amber-600 font-mono">
                {shiftStats.totalDebt.toLocaleString('ru-RU')} ₽
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Записано на клиентов</span>
            </div>

            {/* 5. Net Profit (Разница между продажей и закупкой) */}
            <div className="p-4 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 rounded-2xl border border-emerald-200 shadow-2xs col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                  Чистая прибыль
                </span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-emerald-700 font-mono">
                {shiftStats.totalProfit.toLocaleString('ru-RU')} ₽
              </div>
              <span className="text-[10px] text-emerald-800 font-medium mt-1 block">
                Выручка минус себестоимость закупки
              </span>
            </div>
          </div>

          {/* SMART SEARCH FOR RECEIPTS */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={receiptSearch}
                onChange={(e) => setReceiptSearch(e.target.value)}
                placeholder="Умный поиск: номер, время (14:30), товар (Кофе), клиент..."
                className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>

            <div className="flex items-center gap-1.5 self-start md:self-auto overflow-x-auto no-scrollbar w-full md:w-auto">
              <button
                onClick={() => setReceiptPaymentFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  receiptPaymentFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Все чеки ({shiftOrders.length})
              </button>
              <button
                onClick={() => setReceiptPaymentFilter('cash')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  receiptPaymentFilter === 'cash'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Наличные
              </button>
              <button
                onClick={() => setReceiptPaymentFilter('card')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  receiptPaymentFilter === 'card'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                Карта
              </button>
              <button
                onClick={() => setReceiptPaymentFilter('debt')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  receiptPaymentFilter === 'debt'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                В долг
              </button>
            </div>
          </div>

          {/* TABLE OF RECEIPTS IN THIS SHIFT */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Чеки смены ({filteredShiftOrders.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Кликните «Редактировать / Отменить» для безопасной корректировки позиций
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-3 px-4">Номер чека</th>
                    <th className="py-3 px-3">Время</th>
                    <th className="py-3 px-4">Позиции в чеке</th>
                    <th className="py-3 px-3">Клиент</th>
                    <th className="py-3 px-3">Оплата</th>
                    <th className="py-3 px-4 text-right">Сумма</th>
                    <th className="py-3 px-3 text-center">Статус</th>
                    <th className="py-3 px-4 text-center">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredShiftOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        Чеки по данному фильтру не найдены.
                      </td>
                    </tr>
                  ) : (
                    filteredShiftOrders.map((order) => {
                      const isCancelled = order.status === 'cancelled';
                      const itemsPreview = order.items
                        .map((it) => `${it.name} × ${it.quantity}`)
                        .join(', ');

                      return (
                        <tr
                          key={order.id}
                          className={`hover:bg-blue-50/50 transition ${
                            isCancelled ? 'opacity-50 bg-slate-50/50' : ''
                          }`}
                        >
                          {/* Receipt Number */}
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            {order.receiptNumber}
                          </td>

                          {/* Time */}
                          <td className="py-3.5 px-3 text-slate-600 font-mono">
                            {formatTimeOnly(order.date)}
                          </td>

                          {/* Items preview */}
                          <td className="py-3.5 px-4 max-w-xs">
                            <span
                              className="block truncate text-slate-700 font-medium"
                              title={itemsPreview}
                            >
                              {itemsPreview}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {order.items.length} поз. (
                              {order.items.reduce((s, it) => s + it.quantity, 0)} шт.)
                            </span>
                          </td>

                          {/* Customer */}
                          <td className="py-3.5 px-3 text-slate-700">
                            {order.customerName ? (
                              <span className="font-bold text-slate-800">
                                {order.customerName}
                              </span>
                            ) : (
                              <span className="text-slate-400">Розничный</span>
                            )}
                          </td>

                          {/* Payment method */}
                          <td className="py-3.5 px-3">
                            {order.paymentMethod === 'cash' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <Banknote className="w-3 h-3 text-emerald-600" />
                                Наличные
                              </span>
                            ) : order.paymentMethod === 'card' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                <CreditCard className="w-3 h-3 text-blue-600" />
                                Карта
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                                <AlertCircle className="w-3 h-3 text-amber-600" />
                                В долг
                              </span>
                            )}
                          </td>

                          {/* Total */}
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-slate-900">
                            {order.totalAmount.toLocaleString('ru-RU')} ₽
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-3 text-center">
                            {isCancelled ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                                Отменен
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                Проведен
                              </span>
                            )}
                          </td>

                          {/* Actions: Edit / Cancel and Print */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Print */}
                              <button
                                type="button"
                                onClick={() => setPrintingOrder(order)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="Печать чека"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              {/* Edit / Cancel (Admin only) */}
                              {isAdmin && !isCancelled && (
                                <button
                                  type="button"
                                  onClick={() => setEditingOrder(order)}
                                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                  title="Безопасное редактирование позиций чека или отмена"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  <span>Редактировать / Отменить</span>
                                </button>
                              )}
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
      ) : (
        /* =========================================================================
           VIEW 2: LIST OF ALL SHIFTS
        ========================================================================= */
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-sm">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Журнал «Кассовые смены»
                </h1>
                <p className="text-xs text-slate-500">
                  Архив смен, контроль выручки кассиров, расхождений и чеков
                </p>
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={cashierSearch}
                onChange={(e) => setCashierSearch(e.target.value)}
                placeholder="Поиск по имени кассира..."
                className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto no-scrollbar">
              <button
                onClick={() => setShiftStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  shiftStatusFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Все смены ({shifts.length})
              </button>
              <button
                onClick={() => setShiftStatusFilter('open')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  shiftStatusFilter === 'open'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Открытые
              </button>
              <button
                onClick={() => setShiftStatusFilter('closed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  shiftStatusFilter === 'closed'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Закрытые
              </button>
            </div>
          </div>

          {/* Table of Shifts */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-3 px-4">Статус</th>
                    <th className="py-3 px-4">Время открытия</th>
                    <th className="py-3 px-4">Время закрытия</th>
                    <th className="py-3 px-3">Кассир</th>
                    <th className="py-3 px-4 text-right">Выручка</th>
                    <th className="py-3 px-4 text-right">Расхождение</th>
                    <th className="py-3 px-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredShifts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Смены не найдены.
                      </td>
                    </tr>
                  ) : (
                    filteredShifts.map((shift) => {
                      const revenue = (shift.totalCash || 0) + (shift.totalCard || 0);

                      let discrepancy: number | null = null;
                      if (
                        shift.status === 'closed' &&
                        shift.endExpectedCash !== undefined &&
                        shift.endActualCash !== undefined
                      ) {
                        discrepancy = shift.endActualCash - shift.endExpectedCash;
                      }

                      return (
                        <tr
                          key={shift.id}
                          onClick={() => setSelectedShiftId(shift.id)}
                          className="hover:bg-blue-50/60 cursor-pointer transition group"
                          title="Кликните для просмотра дашборда и чеков этой смены"
                        >
                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {shift.status === 'open' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Открыта</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                                Закрыта
                              </span>
                            )}
                          </td>

                          {/* Open Time */}
                          <td className="py-3.5 px-4 font-medium text-slate-800">
                            {formatDateTime(shift.openTime)}
                          </td>

                          {/* Close Time */}
                          <td className="py-3.5 px-4 text-slate-500">
                            {shift.closeTime ? formatDateTime(shift.closeTime) : '—'}
                          </td>

                          {/* Cashier */}
                          <td className="py-3.5 px-3 font-bold text-slate-900 group-hover:text-blue-600 transition">
                            {shift.cashierName || 'Кассир'}
                          </td>

                          {/* Revenue */}
                          <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 text-sm">
                            {revenue.toLocaleString('ru-RU')} ₽
                          </td>

                          {/* Discrepancy */}
                          <td className="py-3.5 px-4 text-right">
                            {discrepancy !== null ? (
                              discrepancy === 0 ? (
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                  0 ₽ (точно)
                                </span>
                              ) : discrepancy < 0 ? (
                                <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                  {discrepancy.toLocaleString('ru-RU')} ₽
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                  +{discrepancy.toLocaleString('ru-RU')} ₽
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>

                          {/* Arrow */}
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
        </div>
      )}

      {/* MODAL: EDIT / CANCEL RECEIPT */}
      {editingOrder && (
        <ReceiptEditorModal
          isOpen={!!editingOrder}
          onClose={() => setEditingOrder(null)}
          order={editingOrder}
          products={products}
          adminName={user?.displayName || 'Администратор'}
        />
      )}

      {/* MODAL: PRINT RECEIPT */}
      {printingOrder && (
        <ReceiptSlipModal
          isOpen={!!printingOrder}
          onClose={() => setPrintingOrder(null)}
          receiptNumber={printingOrder.receiptNumber}
          items={printingOrder.items}
          totalAmount={printingOrder.totalAmount}
          paymentMethod={printingOrder.paymentMethod}
          customerName={printingOrder.customerName}
          receivedAmount={printingOrder.receivedAmount}
          changeAmount={printingOrder.changeAmount}
        />
      )}
    </div>
  );
};
