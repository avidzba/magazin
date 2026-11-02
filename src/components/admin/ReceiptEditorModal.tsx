import React, { useState } from 'react';
import { StoreOrder, OrderItem, StoreProduct } from '../../types';
import { cancelOrder, updateOrderItems } from '../../services/storeService';
import { ProductCardModal } from './ProductCardModal';
import {
  X,
  AlertTriangle,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  Ban,
  Receipt,
  RotateCcw,
  Clock,
  User,
  CreditCard,
  Banknote,
  DollarSign,
} from 'lucide-react';

interface ReceiptEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: StoreOrder;
  products: StoreProduct[];
  adminName: string;
}

export const ReceiptEditorModal: React.FC<ReceiptEditorModalProps> = ({
  isOpen,
  onClose,
  order,
  products,
  adminName,
}) => {
  const [items, setItems] = useState<OrderItem[]>(() =>
    order.items.map((it) => ({ ...it }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [selectedProductCard, setSelectedProductCard] = useState<{
    id: string;
    name: string;
  } | null>(null);

  if (!isOpen) return null;

  const originalTotal = order.totalAmount;
  const currentTotal = items.reduce((sum, it) => sum + (it.sum || it.quantity * it.price), 0);
  const diffTotal = originalTotal - currentTotal; // positive if reduced
  const isChanged = items.length !== order.items.length || diffTotal !== 0;

  // Handle quantity adjustment
  const handleQtyChange = (idx: number, delta: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[idx] };
      const newQty = Math.max(1, target.quantity + delta);
      target.quantity = newQty;
      target.sum = newQty * target.price;
      copy[idx] = target;
      return copy;
    });
  };

  // Remove a position from receipt
  const handleRemoveItem = (idx: number) => {
    if (items.length === 1) {
      if (
        confirm(
          'Это последняя позиция в чеке. Удаление последней позиции приведет к отмене всего чека. Отменить чек целиком?'
        )
      ) {
        handleCancelEntireOrder();
      }
      return;
    }

    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Save modified items (Safe atomic stock return + shift deduction)
  const handleSaveChanges = async () => {
    if (!isChanged) {
      onClose();
      return;
    }

    if (items.length === 0) {
      alert('В чеке должна оставаться хотя бы одна позиция. Либо нажмите «Отменить чек целиком».');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateOrderItems({
        order,
        newItems: items,
        adminName,
      });
      alert(`Чек ${order.receiptNumber} успешно обновлен. Удаленные позиции возвращены на остаток склада.`);
      onClose();
    } catch (err: any) {
      alert(`Ошибка обновления чека: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel entire order (Safe atomic return of all items + shift deduction + debt deduction)
  const handleCancelEntireOrder = async () => {
    setIsSubmitting(true);
    try {
      await cancelOrder({
        order,
        adminName,
      });
      alert(`Чек ${order.receiptNumber} аннулирован. Все товары возвращены на остаток склада.`);
      onClose();
    } catch (err: any) {
      alert(`Ошибка отмены чека: ${err.message}`);
    } finally {
      setIsSubmitting(false);
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
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-600 rounded-xl">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base">
                  Редактирование чека {order.receiptNumber}
                </h3>
                {order.status === 'cancelled' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    Отменен
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Безопасный возврат товаров на склад и перерасчет смены
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Дата и время</span>
            <span className="font-semibold text-slate-800">{formatDate(order.date)}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Оплата</span>
            <span className="font-bold text-slate-800">
              {order.paymentMethod === 'cash'
                ? 'Наличные'
                : order.paymentMethod === 'card'
                ? 'Карта / Перевод'
                : 'В долг'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Клиент</span>
            <span className="font-semibold text-slate-800">
              {order.customerName || 'Обычный покупатель'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Исходная сумма</span>
            <span className="font-mono font-bold text-slate-900">
              {originalTotal.toLocaleString('ru-RU')} ₽
            </span>
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Товары в чеке ({items.length})
            </span>
            <span className="text-[11px] text-slate-400">
              Удалите позицию или уменьшите кол-во для возврата
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs divide-y divide-slate-100">
            {items.map((it, idx) => (
              <div
                key={it.productId || idx}
                className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition"
              >
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedProductCard({
                        id: it.productId,
                        name: it.name,
                      })
                    }
                    className="font-bold text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer block truncate text-left transition"
                    title="Открыть карточку товара"
                  >
                    {it.name}
                  </button>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {it.price.toLocaleString('ru-RU')} ₽ за 1 шт.
                  </span>
                </div>

                {/* - / + Qty adjuster */}
                <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg p-0.5 bg-slate-50 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleQtyChange(idx, -1)}
                    disabled={it.quantity <= 1}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:bg-slate-200 disabled:opacity-30 transition"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center text-xs font-bold font-mono text-slate-800">
                    {it.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleQtyChange(idx, 1)}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:bg-slate-200 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Subtotal */}
                <div className="w-24 text-right font-mono font-bold text-slate-900 text-xs">
                  {((it.sum || it.quantity * it.price)).toLocaleString('ru-RU')} ₽
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemoveItem(idx)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition shrink-0"
                  title="Удалить позицию из чека"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Delta calculation callout */}
          {diffTotal > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center justify-between">
              <div>
                <span className="font-bold block">Сумма чека уменьшена на {diffTotal.toLocaleString('ru-RU')} ₽</span>
                <span className="text-[11px] text-amber-700 block">
                  Товары вернутся на остаток. Выручка смены
                  {order.paymentMethod === 'debt' ? ' и долг клиента' : ''} уменьшится на эту сумму.
                </span>
              </div>
              <span className="font-black text-amber-800 font-mono text-sm shrink-0">
                Новый итог: {currentTotal.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Cancel Entire Order Button */}
          {!cancelConfirm ? (
            <button
              type="button"
              onClick={() => setCancelConfirm(true)}
              disabled={isSubmitting || order.status === 'cancelled'}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-xl transition flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
            >
              <Ban className="w-4 h-4" />
              <span>Отменить чек целиком</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 p-1.5 rounded-xl">
              <span className="text-[11px] font-bold text-rose-800 pl-1">Точно аннулировать?</span>
              <button
                type="button"
                onClick={handleCancelEntireOrder}
                disabled={isSubmitting}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition"
              >
                Да, отменить
              </button>
              <button
                type="button"
                onClick={() => setCancelConfirm(false)}
                className="px-2 py-1 text-slate-500 hover:text-slate-800 text-xs font-semibold"
              >
                Нет
              </button>
            </div>
          )}

          {/* Right actions: Close and Save */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
            >
              Закрыть
            </button>
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={isSubmitting || !isChanged || order.status === 'cancelled'}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Сохранение...' : 'Применить изменения'}</span>
            </button>
          </div>
        </div>
      </div>

      <ProductCardModal
        isOpen={!!selectedProductCard}
        onClose={() => setSelectedProductCard(null)}
        productId={selectedProductCard?.id || null}
        products={products}
        fallbackName={selectedProductCard?.name}
      />
    </div>
  );
};
