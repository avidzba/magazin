import React, { useState, useEffect } from 'react';
import {
  StoreSupplier,
  StoreProduct,
  PurchaseOrderItem,
  StorePurchaseOrder,
} from '../../types';
import {
  peekNextPurchaseOrderNumber,
  createPurchaseOrder,
} from '../../services/storeService';
import { ProductSearchAndScanModal } from './ProductSearchAndScanModal';
import { ProductCardModal } from './ProductCardModal';
import {
  ShoppingCart,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  Printer,
  Share2,
  Copy,
  X,
  Calendar,
  Truck,
  AlertCircle,
  MessageCircle,
} from 'lucide-react';

interface SmartPurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: StoreSupplier;
  products: StoreProduct[];
  authorName?: string;
  authorId?: string;
  onOrderCreated?: (orderNumber: string) => void;
}

export const SmartPurchaseOrderModal: React.FC<SmartPurchaseOrderModalProps> = ({
  isOpen,
  onClose,
  supplier,
  products,
  authorName = 'Администратор',
  authorId = '',
  onOrderCreated,
}) => {
  const [orderNumber, setOrderNumber] = useState('Загрузка...');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [comment, setComment] = useState('Автоматическое пополнение запасов');
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);
  const [selectedProductCard, setSelectedProductCard] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Initialize auto-order items based on:
  // primarySupplierId === supplier.id AND stockQuantity <= (minStock || 0)
  useEffect(() => {
    if (isOpen) {
      peekNextPurchaseOrderNumber().then(setOrderNumber);

      // Find products linked to this supplier
      const supplierProducts = products.filter(
        (p) => p.primarySupplierId === supplier.id || (!p.primarySupplierId && p.category && supplier.comment?.includes(p.category))
      );

      // Filter products needing restock
      const lowStockProducts = supplierProducts.filter(
        (p) => p.stockQuantity <= (p.minStock || 0)
      );

      // If low stock found, use them; if none are below minStock, offer all products of this supplier with recommended restock
      const targets = lowStockProducts.length > 0 ? lowStockProducts : supplierProducts;

      const autoItems: PurchaseOrderItem[] = targets.map((p) => {
        const minS = p.minStock || 0;
        // Recommend qty: double the minStock or at least 10 items to replenish
        const recommended = Math.max(5, (minS * 2) - p.stockQuantity, minS > 0 ? minS : 10);
        const pPrice = p.purchasePrice || Math.round(p.price * 0.7);

        return {
          productId: p.id,
          name: p.name,
          barcode: p.barcode,
          currentStock: p.stockQuantity,
          minStock: minS,
          orderQty: recommended,
          purchasePrice: pPrice,
          total: recommended * pPrice,
        };
      });

      setItems(autoItems);
    }
  }, [isOpen, supplier, products]);

  if (!isOpen) return null;

  // Change quantity of an item
  const handleQtyChange = (index: number, newQty: number) => {
    const clamped = Math.max(1, newQty);
    setItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[index] };
      target.orderQty = clamped;
      target.total = clamped * target.purchasePrice;
      copy[index] = target;
      return copy;
    });
  };

  // Change purchase price of an item
  const handlePriceChange = (index: number, newPrice: number) => {
    const clamped = Math.max(0, newPrice);
    setItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[index] };
      target.purchasePrice = clamped;
      target.total = target.orderQty * clamped;
      copy[index] = target;
      return copy;
    });
  };

  // Remove line item
  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Add product picked from modal
  const handleAddProductFromModal = (picked: {
    productId: string;
    name: string;
    barcode?: string;
    qty: number;
    price: number;
  }) => {
    const existingIdx = items.findIndex((it) => it.productId === picked.productId);
    if (existingIdx >= 0) {
      handleQtyChange(existingIdx, items[existingIdx].orderQty + picked.qty);
      return;
    }

    const prod = products.find((p) => p.id === picked.productId);
    const minS = prod?.minStock || 0;
    const curStock = prod?.stockQuantity || 0;

    setItems((prev) => [
      ...prev,
      {
        productId: picked.productId,
        name: picked.name,
        barcode: picked.barcode,
        currentStock: curStock,
        minStock: minS,
        orderQty: picked.qty,
        purchasePrice: picked.price,
        total: picked.qty * picked.price,
      },
    ]);
  };

  const totalAmount = items.reduce((sum, it) => sum + it.total, 0);
  const totalQty = items.reduce((sum, it) => sum + it.orderQty, 0);

  // Generate clean text specification for message/clipboard
  const generateOrderText = () => {
    let text = `📦 ЗАКАЗ ПОСТАВЩИКУ: ${supplier.name}\n`;
    text += `Номер: ${orderNumber} от ${date}\n`;
    text += `--------------------------------------\n`;
    items.forEach((it, idx) => {
      text += `${idx + 1}. ${it.name} ${it.barcode ? `[${it.barcode}]` : ''}\n`;
      text += `   Количество: ${it.orderQty} шт. x ${it.purchasePrice} ₽ = ${it.total.toLocaleString('ru-RU')} ₽\n`;
    });
    text += `--------------------------------------\n`;
    text += `ИТОГО: ${totalQty} шт. на сумму ${totalAmount.toLocaleString('ru-RU')} ₽\n`;
    if (comment) text += `Примечание: ${comment}\n`;
    return text;
  };

  // Copy order text to clipboard
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generateOrderText());
      setCopiedNotification('Спецификация заказа скопирована в буфер обмена!');
      setTimeout(() => setCopiedNotification(null), 3000);
    } catch (_) {
      alert('Не удалось скопировать текст.');
    }
  };

  // Send via WhatsApp
  const handleSendWhatsApp = () => {
    const cleanPhone = (supplier.phone || '').replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(generateOrderText());
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  // Print order specification
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Заказ поставщику ${orderNumber}</title>
          <style>
            body { font-family: monospace, sans-serif; padding: 20px; color: #111; }
            h2 { margin-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .right { text-align: right; }
            .total { font-weight: bold; font-size: 16px; margin-top: 15px; text-align: right; }
          </style>
        </head>
        <body>
          <h2>ЗАКАЗ ПОСТАВЩИКУ: ${supplier.name}</h2>
          <p>Номер документа: <strong>${orderNumber}</strong> | Дата: ${date}</p>
          <p>Поставщик: ${supplier.name} | Тел: ${supplier.phone || '—'} | ИНН: ${supplier.inn || '—'}</p>
          ${comment ? `<p>Примечание: ${comment}</p>` : ''}
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Наименование товара</th>
                <th>Штрихкод</th>
                <th class="right">Кол-во (шт)</th>
                <th class="right">Цена закупки (₽)</th>
                <th class="right">Сумма (₽)</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  (it, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${it.name}</td>
                  <td>${it.barcode || '—'}</td>
                  <td class="right">${it.orderQty}</td>
                  <td class="right">${it.purchasePrice.toLocaleString('ru-RU')} ₽</td>
                  <td class="right">${it.total.toLocaleString('ru-RU')} ₽</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
          <p class="total">ИТОГО К ЗАКАЗУ: ${totalAmount.toLocaleString('ru-RU')} ₽ (${totalQty} шт.)</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  // Submit and save purchase order
  const handleSaveOrder = async () => {
    if (items.length === 0) {
      alert('Добавьте хотя бы одну позицию в заказ.');
      return;
    }

    setSubmitting(true);
    try {
      const generated = await createPurchaseOrder({
        supplierId: supplier.id,
        supplierName: supplier.name,
        status: 'confirmed',
        date: new Date(date).toISOString(),
        items,
        totalAmount,
        comment: comment.trim() || undefined,
        authorName,
        authorId,
      });

      onOrderCreated?.(generated);
      onClose();
    } catch (err: any) {
      alert(`Ошибка сохранения заказа: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl h-[94vh] max-h-[850px] flex flex-col overflow-hidden animate-in zoom-in-95">
          {/* Header */}
          <div className="p-4 bg-slate-900 text-white shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-sm">
                <Sparkles className="w-5 h-5 text-indigo-100" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm sm:text-base">Умный заказ поставщику</h3>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    {orderNumber}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Поставщик: <strong className="text-white">{supplier.name}</strong>
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Notification */}
          {copiedNotification && (
            <div className="p-2.5 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{copiedNotification}</span>
              </div>
              <button onClick={() => setCopiedNotification(null)} className="text-slate-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Form Meta */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Дата формирования
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Примечание к заказу
                </label>
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Срочная доставка, комментарии по фасовке..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 bg-slate-50/50">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
              <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">
                    Позиции к заказу ({items.length})
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Система рассчитала оптимальный объем заказа на основе неснижаемого остатка
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSearchModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl text-xs font-bold transition active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Добавить товар из каталога</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200 select-none">
                    <tr>
                      <th className="py-2.5 px-3 w-8">#</th>
                      <th className="py-2.5 px-3">Наименование</th>
                      <th className="py-2.5 px-3 text-right">На складе</th>
                      <th className="py-2.5 px-3 text-right">Несниж.</th>
                      <th className="py-2.5 px-3 text-center w-36">К заказу</th>
                      <th className="py-2.5 px-3 text-right w-32">Закупка (₽)</th>
                      <th className="py-2.5 px-4 text-right">Сумма</th>
                      <th className="py-2.5 px-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
                          Все товары поставщика в наличии в достаточном объеме! Нажмите «Добавить товар из каталога», чтобы заказать нужные позиции вручную.
                        </td>
                      </tr>
                    ) : (
                      items.map((it, idx) => (
                        <tr key={it.productId} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedProductCard({
                                  id: it.productId,
                                  name: it.name,
                                })
                              }
                              className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer text-left transition block"
                              title="Открыть карточку товара"
                            >
                              {it.name}
                            </button>
                            {it.barcode && (
                              <span className="text-[10px] font-mono text-slate-400">
                                {it.barcode}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                it.currentStock <= it.minStock
                                  ? 'bg-rose-50 text-rose-700 font-bold'
                                  : 'text-slate-700'
                              }`}
                            >
                              {it.currentStock} шт.
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                            {it.minStock} шт.
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                              <button
                                type="button"
                                onClick={() => handleQtyChange(idx, it.orderQty - 1)}
                                className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-slate-200"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={it.orderQty}
                                onChange={(e) =>
                                  handleQtyChange(idx, parseInt(e.target.value) || 1)
                                }
                                className="w-14 text-center text-xs font-bold font-mono bg-white rounded border border-slate-300 py-0.5"
                              />
                              <button
                                type="button"
                                onClick={() => handleQtyChange(idx, it.orderQty + 1)}
                                className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-slate-200"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={it.purchasePrice}
                              onChange={(e) =>
                                handlePriceChange(idx, parseFloat(e.target.value) || 0)
                              }
                              className="w-20 px-2 py-1 text-right text-xs font-bold font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                            />
                          </td>
                          <td className="py-2.5 px-4 text-right font-black font-mono text-slate-900">
                            {it.total.toLocaleString('ru-RU')} ₽
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Удалить"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

          {/* Footer Actions */}
          <div className="p-4 bg-white border-t border-slate-200 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Сумма заказа поставщику
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black font-mono text-slate-900">
                  {totalAmount.toLocaleString('ru-RU')} ₽
                </span>
                <span className="text-xs text-slate-500">({totalQty} шт.)</span>
              </div>
            </div>

            {/* Quick Export & Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopyText}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition active:scale-95"
                title="Скопировать текст спецификации"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Текст</span>
              </button>

              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition active:scale-95"
                title="Отправить поставщику в WhatsApp"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition active:scale-95"
                title="Печать спецификации"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Печать</span>
              </button>

              <button
                type="button"
                disabled={submitting || items.length === 0}
                onClick={handleSaveOrder}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Сохранение...' : 'Провести заказ'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Product Catalog Picker Modal */}
      {isSearchModalOpen && (
        <ProductSearchAndScanModal
          isOpen={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
          products={products}
          onAddProduct={handleAddProductFromModal}
          mode="receipt"
        />
      )}

      {/* Product Card Modal */}
      <ProductCardModal
        isOpen={!!selectedProductCard}
        onClose={() => setSelectedProductCard(null)}
        productId={selectedProductCard?.id || null}
        products={products}
        fallbackName={selectedProductCard?.name}
      />
    </>
  );
};
