import React, { useState, useMemo } from 'react';
import {
  StoreSupplier,
  StoreInventoryDoc,
  StoreProduct,
  StorePurchaseOrder,
  StoreShift,
  FinanceTransaction,
} from '../../types';
import { updateSupplier, deleteSupplier } from '../../services/storeService';
import { PaySupplierDebtModal } from './PaySupplierDebtModal';
import { SmartPurchaseOrderModal } from './SmartPurchaseOrderModal';
import { DocumentViewerDrawer } from './DocumentViewerDrawer';
import { ProductCardModal } from './ProductCardModal';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Wallet,
  Sparkles,
  PackagePlus,
  BarChart3,
  ShoppingCart,
  Calendar,
  Clock,
  Edit3,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  Boxes,
  Save,
  ArrowUpRight,
} from 'lucide-react';

interface SupplierProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: StoreSupplier;
  inventoryDocs: StoreInventoryDoc[];
  products: StoreProduct[];
  purchaseOrders: StorePurchaseOrder[];
  transactions: FinanceTransaction[];
  currentShift: StoreShift | null;
  authorName?: string;
  authorId?: string;
}

export const SupplierProfileDrawer: React.FC<SupplierProfileDrawerProps> = ({
  isOpen,
  onClose,
  supplier,
  inventoryDocs,
  products,
  purchaseOrders,
  transactions,
  currentShift,
  authorName = 'Администратор',
  authorId = '',
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'receipts' | 'analytics' | 'orders'>('info');

  // Modals state
  const [isPayDebtModalOpen, setIsPayDebtModalOpen] = useState(false);
  const [isAutoOrderModalOpen, setIsAutoOrderModalOpen] = useState(false);
  const [selectedReceiptDoc, setSelectedReceiptDoc] = useState<StoreInventoryDoc | null>(null);
  const [selectedProductCard, setSelectedProductCard] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Edit Supplier Form State
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editName, setEditName] = useState(supplier.name);
  const [editPhone, setEditPhone] = useState(supplier.phone || '');
  const [editEmail, setEditEmail] = useState(supplier.email || '');
  const [editInn, setEditInn] = useState(supplier.inn || '');
  const [editAddress, setEditAddress] = useState(supplier.address || '');
  const [editBankDetails, setEditBankDetails] = useState(supplier.bankDetails || '');
  const [editComment, setEditComment] = useState(supplier.comment || '');
  const [isSaving, setIsSaving] = useState(false);

  // Sync edit state on supplier change
  React.useEffect(() => {
    setEditName(supplier.name);
    setEditPhone(supplier.phone || '');
    setEditEmail(supplier.email || '');
    setEditInn(supplier.inn || '');
    setEditAddress(supplier.address || '');
    setEditBankDetails(supplier.bankDetails || '');
    setEditComment(supplier.comment || '');
    setIsEditingInfo(false);
  }, [supplier]);

  if (!isOpen) return null;

  // Receipts linked to this supplier
  const supplierReceipts = inventoryDocs.filter(
    (d) =>
      d.type === 'receipt' &&
      (d.supplierId === supplier.id ||
        (d.supplier && d.supplier.trim().toLowerCase() === supplier.name.trim().toLowerCase()))
  );

  // Purchase orders linked to this supplier
  const supplierOrders = purchaseOrders.filter(
    (o) =>
      o.supplierId === supplier.id ||
      o.supplierName.trim().toLowerCase() === supplier.name.trim().toLowerCase()
  );

  // Products where this supplier is the primary supplier
  const linkedProducts = products.filter(
    (p) => p.primarySupplierId === supplier.id
  );

  // Payment transactions to this supplier
  const supplierPayments = transactions.filter(
    (t) =>
      t.type === 'expense' &&
      (t.category === 'Оплата поставщикам' || t.category === 'Оплата поставщику') &&
      ((t as any).supplierId === supplier.id || t.description?.includes(supplier.name))
  );

  // Analytics Computation
  const analytics = useMemo(() => {
    let totalPurchasesSum = 0;
    let lastDate: Date | null = null;
    const itemMap: Record<string, { name: string; qty: number; sum: number }> = {};

    for (const doc of supplierReceipts) {
      totalPurchasesSum += Number(doc.totalAmount) || 0;

      const d = doc.date?.toDate ? doc.date.toDate() : new Date(doc.date);
      if (!isNaN(d.getTime())) {
        if (!lastDate || d > lastDate) {
          lastDate = d;
        }
      }

      for (const it of doc.items) {
        if (!itemMap[it.productId]) {
          itemMap[it.productId] = { name: it.name, qty: 0, sum: 0 };
        }
        itemMap[it.productId].qty += it.qty;
        itemMap[it.productId].sum += it.total || it.qty * it.price;
      }
    }

    // Most popular product by sum and qty
    let topProduct: { name: string; qty: number; sum: number } | null = null;
    for (const it of Object.values(itemMap)) {
      if (!topProduct || it.sum > topProduct.sum) {
        topProduct = it;
      }
    }

    const lowStockCount = linkedProducts.filter(
      (p) => p.stockQuantity <= (p.minStock || 0)
    ).length;

    const lastDeliveryText: string =
      lastDate !== null
        ? (lastDate as Date).toLocaleDateString('ru-RU', { dateStyle: 'medium' })
        : 'Нет поставок';

    return {
      totalPurchasesSum,
      receiptsCount: supplierReceipts.length,
      lastDeliveryDate: lastDeliveryText,
      topProduct: topProduct as { name: string; qty: number; sum: number } | null,
      lowStockCount,
    };
  }, [supplierReceipts, linkedProducts]);

  const handleSaveSupplierInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    setIsSaving(true);
    try {
      await updateSupplier(supplier.id, {
        name: editName.trim(),
        phone: editPhone.trim() || undefined,
        email: editEmail.trim() || undefined,
        inn: editInn.trim() || undefined,
        address: editAddress.trim() || undefined,
        bankDetails: editBankDetails.trim() || undefined,
        comment: editComment.trim() || undefined,
      });
      setIsEditingInfo(false);
    } catch (err: any) {
      alert(`Ошибка обновления: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Удалить поставщика «${supplier.name}»? Данные о задолженности и профиль будут удалены.`
      )
    ) {
      return;
    }
    try {
      await deleteSupplier(supplier.id);
      onClose();
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col min-h-0 border-l border-slate-200 animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-4 sm:p-6 bg-slate-900 text-white shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center font-black text-white text-lg shrink-0 shadow-md">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black truncate">{supplier.name}</h2>
                  {supplier.currentDebt > 0 ? (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      Долг: {supplier.currentDebt.toLocaleString('ru-RU')} ₽
                    </span>
                  ) : (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      В расчете (0 ₽)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                  {supplier.phone && <span>Тел: {supplier.phone}</span>}
                  {supplier.inn && <span>ИНН: {supplier.inn}</span>}
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {supplier.currentDebt > 0 && (
                <button
                  type="button"
                  onClick={() => setIsPayDebtModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs active:scale-95"
                >
                  <Wallet className="w-4 h-4" />
                  <span>Погасить долг</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsAutoOrderModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs active:scale-95"
                title="Сформировать автоматический заказ товаров"
              >
                <Sparkles className="w-4 h-4 text-indigo-200" />
                <span>Автозаказ</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="px-6 bg-slate-900 border-t border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            <button
              onClick={() => setActiveTab('info')}
              className={`py-3 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'info'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Информация и реквизиты</span>
            </button>

            <button
              onClick={() => setActiveTab('receipts')}
              className={`py-3 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'receipts'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <PackagePlus className="w-3.5 h-3.5" />
              <span>Приемки ({supplierReceipts.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-3 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'analytics'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Аналитика и товары</span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`py-3 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'orders'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Заказы ({supplierOrders.length})</span>
            </button>
          </div>

          {/* Tab 1: ИНФОРМАЦИЯ И РЕКВИЗИТЫ */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 min-h-0 bg-slate-50/50">
            {activeTab === 'info' && (
              <div className="space-y-5">
                {/* Balance & Debt Card */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Баланс взаиморасчетов
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span
                        className={`text-2xl sm:text-3xl font-black font-mono ${
                          supplier.currentDebt > 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {supplier.currentDebt.toLocaleString('ru-RU')} ₽
                      </span>
                      <span className="text-xs text-slate-500">
                        {supplier.currentDebt > 0
                          ? 'Задолженность магазина перед поставщиком'
                          : 'Задолженности нет'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {supplier.currentDebt > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsPayDebtModalOpen(true)}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 active:scale-95"
                      >
                        <Wallet className="w-4 h-4" />
                        <span>Погасить задолженность</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Profile Details or Edit Form */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-900">Контакты и реквизиты</h3>
                    {!isEditingInfo ? (
                      <button
                        type="button"
                        onClick={() => setIsEditingInfo(true)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Редактировать</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsEditingInfo(false)}
                        className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                      >
                        Отмена
                      </button>
                    )}
                  </div>

                  {!isEditingInfo ? (
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Наименование
                        </span>
                        <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                          {supplier.name}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          ИНН организации
                        </span>
                        <span className="text-sm font-mono text-slate-800 mt-0.5 block">
                          {supplier.inn || 'Не указан'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Телефон
                        </span>
                        <div className="flex items-center gap-1.5 text-slate-800 mt-0.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{supplier.phone || 'Не указан'}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Email
                        </span>
                        <div className="flex items-center gap-1.5 text-slate-800 mt-0.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{supplier.email || 'Не указан'}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Фактический адрес / Склад отгрузки
                        </span>
                        <div className="flex items-center gap-1.5 text-slate-800 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{supplier.address || 'Не указан'}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Банковские реквизиты (БИК, р/с)
                        </span>
                        <div className="flex items-center gap-1.5 text-slate-800 mt-0.5">
                          <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                          <span>{supplier.bankDetails || 'Не указаны'}</span>
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Примечание / Контакты менеджера
                        </span>
                        <p className="text-slate-700 mt-0.5">{supplier.comment || '—'}</p>
                      </div>
                    </div>
                  ) : (
                    /* Edit Supplier Form */
                    <form onSubmit={handleSaveSupplierInfo} className="p-5 space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Наименование поставщика *
                        </label>
                        <input
                          type="text"
                          required
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            ИНН
                          </label>
                          <input
                            type="text"
                            value={editInn}
                            onChange={(e) => setEditInn(e.target.value)}
                            placeholder="7701234567"
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Телефон
                          </label>
                          <input
                            type="tel"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            placeholder="+7 999 123-45-67"
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            placeholder="sales@supplier.ru"
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Адрес склада
                          </label>
                          <input
                            type="text"
                            value={editAddress}
                            onChange={(e) => setEditAddress(e.target.value)}
                            placeholder="г. Москва, складской проезд 4"
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Банковские реквизиты (БИК, расчетный счет)
                        </label>
                        <input
                          type="text"
                          value={editBankDetails}
                          onChange={(e) => setEditBankDetails(e.target.value)}
                          placeholder="р/с 40702810..., БИК 044525..."
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                          Примечание
                        </label>
                        <textarea
                          rows={2}
                          value={editComment}
                          onChange={(e) => setEditComment(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white resize-none"
                        />
                      </div>

                      <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                        <button
                          type="button"
                          onClick={handleDelete}
                          className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
                        >
                          Удалить поставщика
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingInfo(false)}
                            className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                          >
                            Отмена
                          </button>
                          <button
                            type="submit"
                            disabled={isSaving}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{isSaving ? 'Сохранение...' : 'Сохранить'}</span>
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>

                {/* History of Payments to Supplier */}
                {supplierPayments.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="p-4 border-b border-slate-100">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                        История выплат и погашений долга ({supplierPayments.length})
                      </h4>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                      {supplierPayments.map((t) => {
                        const tDate = t.date?.toDate
                          ? t.date.toDate().toLocaleDateString('ru-RU')
                          : 'Недавно';
                        return (
                          <div key={t.id} className="p-3 text-xs flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-slate-900 block">
                                {t.description || 'Оплата поставщику'}
                              </span>
                              <span className="text-[10px] text-slate-400">{tDate}</span>
                            </div>
                            <span className="font-bold font-mono text-emerald-600">
                              -{t.amount.toLocaleString('ru-RU')} ₽
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: ПРИЕМКИ ТОВАРОВ */}
            {activeTab === 'receipts' && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">
                        Поступления от {supplier.name} ({supplierReceipts.length})
                      </h3>
                      <p className="text-xs text-slate-500">
                        Кликните на строку для просмотра спецификации или редактирования накладной
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 select-none">
                        <tr>
                          <th className="py-3 px-4">Номер накладной</th>
                          <th className="py-3 px-3">Дата</th>
                          <th className="py-3 px-3">Автор</th>
                          <th className="py-3 px-4">Позиций</th>
                          <th className="py-3 px-4 text-right">Сумма закупки</th>
                          <th className="py-3 px-3 text-center">Оплата</th>
                          <th className="py-3 px-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {supplierReceipts.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-400">
                              Пока нет документов приемок от этого поставщика.
                            </td>
                          </tr>
                        ) : (
                          supplierReceipts.map((doc) => {
                            const docDate = doc.date?.toDate
                              ? doc.date.toDate().toLocaleDateString('ru-RU')
                              : 'Недавно';

                            return (
                              <tr
                                key={doc.id}
                                onClick={() => setSelectedReceiptDoc(doc)}
                                className="hover:bg-blue-50/70 cursor-pointer transition group"
                              >
                                <td className="py-3 px-4 font-bold text-slate-900 font-mono group-hover:text-blue-600 transition">
                                  {doc.docNumber}
                                </td>
                                <td className="py-3 px-3 text-slate-500">{docDate}</td>
                                <td className="py-3 px-3 text-slate-700">{doc.authorName || '—'}</td>
                                <td className="py-3 px-4 text-slate-600">{doc.items.length} поз.</td>
                                <td className="py-3 px-4 text-right font-black font-mono text-emerald-700">
                                  {doc.totalAmount.toLocaleString('ru-RU')} ₽
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {doc.isPaidImmediately ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                      Оплачено сразу
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                      В долг
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-2 text-center text-slate-300 group-hover:text-blue-600">
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

            {/* Tab 3: АНАЛИТИКА И ПРИВЯЗАННЫЕ ТОВАРЫ */}
            {activeTab === 'analytics' && (
              <div className="space-y-5">
                {/* 3 Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Сумма закупок за все время
                    </span>
                    <span className="text-xl font-black font-mono text-slate-900 mt-1 block">
                      {analytics.totalPurchasesSum.toLocaleString('ru-RU')} ₽
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                      {analytics.receiptsCount} документов прихода
                    </span>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Дата последней поставки
                    </span>
                    <span className="text-base font-bold text-slate-800 mt-1 block">
                      {analytics.lastDeliveryDate}
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                      Регулярность снабжения
                    </span>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Топ закупаемый товар
                    </span>
                    {analytics.topProduct ? (
                      <>
                        <span className="text-xs font-bold text-blue-600 mt-1 block truncate" title={analytics.topProduct.name}>
                          {analytics.topProduct.name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 mt-0.5 block">
                          {analytics.topProduct.qty} шт. на {analytics.topProduct.sum.toLocaleString('ru-RU')} ₽
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400 mt-1 block">Нет данных</span>
                    )}
                  </div>
                </div>

                {/* Linked Products Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">
                        Товары основного поставщика ({linkedProducts.length})
                      </h4>
                      <p className="text-xs text-slate-500">
                        Товары, у которых этот поставщик указан как основной (для автозаказа)
                      </p>
                    </div>

                    {analytics.lowStockCount > 0 && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 flex items-center gap-1 animate-pulse">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Требуют заказа: {analytics.lowStockCount}</span>
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 select-none">
                        <tr>
                          <th className="py-2.5 px-3">Наименование</th>
                          <th className="py-2.5 px-3">Категория</th>
                          <th className="py-2.5 px-3 font-mono">Штрихкод</th>
                          <th className="py-2.5 px-3 text-right">Текущий остаток</th>
                          <th className="py-2.5 px-3 text-right">Неснижаемый (min)</th>
                          <th className="py-2.5 px-3 text-right">Закупка</th>
                          <th className="py-2.5 px-3 text-center">Статус</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {linkedProducts.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-400">
                              Пока нет привязанных товаров. Откройте карточку товара на складе и укажите этого поставщика основным.
                            </td>
                          </tr>
                        ) : (
                          linkedProducts.map((p) => {
                            const isLow = p.stockQuantity <= (p.minStock || 0);
                            return (
                              <tr key={p.id} className="hover:bg-slate-50/70 transition">
                                <td className="py-2.5 px-3 font-bold text-slate-900">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedProductCard({
                                        id: p.id,
                                        name: p.name,
                                      })
                                    }
                                    className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer text-left transition"
                                    title="Открыть карточку товара"
                                  >
                                    {p.name}
                                  </button>
                                </td>
                                <td className="py-2.5 px-3 text-slate-500">{p.category || '—'}</td>
                                <td className="py-2.5 px-3 font-mono text-slate-400">{p.barcode || '—'}</td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold">
                                  <span
                                    className={`px-1.5 py-0.5 rounded ${
                                      isLow ? 'bg-rose-100 text-rose-800' : 'text-slate-800'
                                    }`}
                                  >
                                    {p.stockQuantity} шт.
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                                  {p.minStock || 0} шт.
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                                  {p.purchasePrice ? `${p.purchasePrice} ₽` : '—'}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {isLow ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                      Пополнить
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700">
                                      В норме
                                    </span>
                                  )}
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

            {/* Tab 4: ЗАКАЗЫ И АВТОЗАКАЗ */}
            {activeTab === 'orders' && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">
                        Сформированные заказы поставщику ({supplierOrders.length})
                      </h3>
                      <p className="text-xs text-slate-500">
                        Документы предварительного заказа и спецификации на закупку
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsAutoOrderModalOpen(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs active:scale-95"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Сформировать заказ</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 select-none">
                        <tr>
                          <th className="py-3 px-4">Номер заказа</th>
                          <th className="py-3 px-3">Дата</th>
                          <th className="py-3 px-3">Автор</th>
                          <th className="py-3 px-4">Позиций</th>
                          <th className="py-3 px-4 text-right">Сумма заказа</th>
                          <th className="py-3 px-4">Примечание</th>
                          <th className="py-3 px-3 text-center">Статус</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {supplierOrders.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-400">
                              Пока нет сформированных заказов. Нажмите кнопку «Сформировать заказ» для умного расчета потребностей склада.
                            </td>
                          </tr>
                        ) : (
                          supplierOrders.map((order) => {
                            const oDate = order.date?.toDate
                              ? order.date.toDate().toLocaleDateString('ru-RU')
                              : 'Недавно';

                            return (
                              <tr key={order.id} className="hover:bg-slate-50/70 transition">
                                <td className="py-3 px-4 font-bold text-slate-900 font-mono text-indigo-600">
                                  {order.orderNumber}
                                </td>
                                <td className="py-3 px-3 text-slate-500">{oDate}</td>
                                <td className="py-3 px-3 text-slate-700">{order.authorName || '—'}</td>
                                <td className="py-3 px-4 text-slate-600">{order.items.length} поз.</td>
                                <td className="py-3 px-4 text-right font-black font-mono text-slate-900">
                                  {order.totalAmount.toLocaleString('ru-RU')} ₽
                                </td>
                                <td className="py-3 px-4 text-slate-500 truncate max-w-xs">
                                  {order.comment || '—'}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {order.status === 'confirmed' ? 'Подтвержден' : order.status}
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pay Debt Modal */}
      {isPayDebtModalOpen && (
        <PaySupplierDebtModal
          isOpen={isPayDebtModalOpen}
          onClose={() => setIsPayDebtModalOpen(false)}
          supplier={supplier}
          currentShift={currentShift}
        />
      )}

      {/* Smart Purchase Order Modal */}
      {isAutoOrderModalOpen && (
        <SmartPurchaseOrderModal
          isOpen={isAutoOrderModalOpen}
          onClose={() => setIsAutoOrderModalOpen(false)}
          supplier={supplier}
          products={products}
          authorName={authorName}
          authorId={authorId}
        />
      )}

      {/* Document Viewer Drawer for Receipts */}
      {selectedReceiptDoc && (
        <DocumentViewerDrawer
          isOpen={!!selectedReceiptDoc}
          onClose={() => setSelectedReceiptDoc(null)}
          doc={selectedReceiptDoc}
          products={products}
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
