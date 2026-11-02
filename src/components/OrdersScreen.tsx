import React, { useState } from 'react';
import { StoreOrder, PaymentMethod } from '../types';
import { ReceiptSlipModal } from './ReceiptSlipModal';
import {
  Receipt,
  Search,
  Printer,
  Calendar,
  CreditCard,
  Banknote,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

interface OrdersScreenProps {
  orders: StoreOrder[];
}

export const OrdersScreen: React.FC<OrdersScreenProps> = ({ orders }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<'all' | PaymentMethod>('all');
  const [selectedOrder, setSelectedOrder] = useState<StoreOrder | null>(null);

  const sortedOrders = [...orders].sort((a, b) => {
    // 1. Sort by numeric orderNumber descending
    const numA =
      typeof a.orderNumber === 'number'
        ? a.orderNumber
        : parseInt((a.receiptNumber || '').replace(/\D/g, ''), 10) || 0;
    const numB =
      typeof b.orderNumber === 'number'
        ? b.orderNumber
        : parseInt((b.receiptNumber || '').replace(/\D/g, ''), 10) || 0;
    if (numA !== 0 && numB !== 0 && numA !== numB) {
      return numB - numA; // strictly descending: №150 above №149
    }

    // 2. Sort by timestamp descending
    const timeA = a.date?.toDate
      ? a.date.toDate().getTime()
      : new Date(a.date || 0).getTime();
    const timeB = b.date?.toDate
      ? b.date.toDate().getTime()
      : new Date(b.date || 0).getTime();
    return timeB - timeA;
  });

  const filteredOrders = sortedOrders.filter((o) => {
    const matchesMethod = methodFilter === 'all' || o.paymentMethod === methodFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      o.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.customerName && o.customerName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesMethod && matchesSearch;
  });

  const getMethodBadge = (method: PaymentMethod, customerName?: string | null) => {
    switch (method) {
      case 'cash':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <Banknote className="w-3 h-3 text-emerald-600" />
            Наличные
          </span>
        );
      case 'card':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <CreditCard className="w-3 h-3 text-blue-600" />
            Карта / Перевод
          </span>
        );
      case 'debt':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <AlertCircle className="w-3 h-3 text-amber-600" />
            В ДОЛГ {customerName ? `(${customerName})` : ''}
          </span>
        );
      default:
        return <span>{method}</span>;
    }
  };

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
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Controls */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по номеру чека или клиенту..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
            <button
              onClick={() => setMethodFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                methodFilter === 'all'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Все ({orders.length})
            </button>
            <button
              onClick={() => setMethodFilter('cash')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                methodFilter === 'cash'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Наличные
            </button>
            <button
              onClick={() => setMethodFilter('card')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                methodFilter === 'card'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Карта / Перевод
            </button>
            <button
              onClick={() => setMethodFilter('debt')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                methodFilter === 'debt'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              В ДОЛГ
            </button>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200 select-none">
                <tr>
                  <th className="py-3 px-4 font-semibold">Чек</th>
                  <th className="py-3 px-4 font-semibold">Дата и время</th>
                  <th className="py-3 px-4 font-semibold">Оплата</th>
                  <th className="py-3 px-4 font-semibold">Позиции</th>
                  <th className="py-3 px-4 font-semibold text-right">Сумма</th>
                  <th className="py-3 px-4 font-semibold text-center">Просмотр</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Чеков пока нет
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((ord) => (
                    <tr
                      key={ord.id}
                      onClick={() => setSelectedOrder(ord)}
                      className="hover:bg-slate-50/70 transition cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 group-hover:text-blue-600">
                        {ord.receiptNumber}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(ord.date)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {getMethodBadge(ord.paymentMethod, ord.customerName)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                        {ord.items && ord.items.length > 0
                          ? ord.items.map((i) => `${i.name} (x${i.quantity})`).join(', ')
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-slate-900 font-mono text-sm">
                        {ord.totalAmount.toLocaleString('ru-RU')} ₽
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(ord);
                          }}
                          className="px-2.5 py-1 bg-slate-100 group-hover:bg-blue-600 group-hover:text-white text-slate-700 rounded-md transition text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Чек</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Selected Order Receipt Slip */}
      {selectedOrder && (
        <ReceiptSlipModal
          isOpen={true}
          onClose={() => setSelectedOrder(null)}
          receiptNumber={selectedOrder.receiptNumber}
          items={selectedOrder.items}
          totalAmount={selectedOrder.totalAmount}
          paymentMethod={selectedOrder.paymentMethod}
          customerName={selectedOrder.customerName}
          receivedAmount={selectedOrder.receivedAmount}
          changeAmount={selectedOrder.changeAmount}
        />
      )}
    </div>
  );
};
