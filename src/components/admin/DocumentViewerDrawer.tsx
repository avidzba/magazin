import React, { useState, useEffect, useRef } from 'react';
import {
  StoreInventoryDoc,
  InventoryDocItem,
  StoreProduct,
} from '../../types';
import {
  updateInventoryDocWithStockDelta,
  deleteInventoryDoc,
  createProduct,
} from '../../services/storeService';
import { recognizeWaybillImage } from '../../utils/waybillAi';
import { SupplierSelect } from './SupplierSelect';
import { ProductSearchAndScanModal } from './ProductSearchAndScanModal';
import { ProductCardModal } from './ProductCardModal';
import { InventoryAuditModal } from './InventoryAuditModal';
import {
  X,
  Edit3,
  Trash2,
  Save,
  PackagePlus,
  ArrowDownRight,
  ClipboardCheck,
  Plus,
  Calendar,
  User,
  Truck,
  AlertTriangle,
  FileText,
  Barcode,
  CheckCircle2,
  Clock,
  RotateCcw,
} from 'lucide-react';

interface DocumentViewerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  doc: StoreInventoryDoc | null;
  products: StoreProduct[];
}

export const DocumentViewerDrawer: React.FC<DocumentViewerDrawerProps> = ({
  isOpen,
  onClose,
  doc: initialDoc,
  products,
}) => {
  const [currentDoc, setCurrentDoc] = useState<StoreInventoryDoc | null>(initialDoc);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [selectedProductCard, setSelectedProductCard] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Editable fields state
  const [editDate, setEditDate] = useState('');
  const [editSupplier, setEditSupplier] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editComment, setEditComment] = useState('');
  const [editItems, setEditItems] = useState<
    (InventoryDocItem & { isNew?: boolean; sellPrice?: number })[]
  >([]);
  const [isRecognizingWaybill, setIsRecognizingWaybill] = useState(false);
  const [waybillProgress, setWaybillProgress] = useState<number>(0);
  const waybillInputRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // Sync state whenever selected document changes
  useEffect(() => {
    if (initialDoc) {
      setCurrentDoc(initialDoc);
      setIsEditing(false);
      resetEditFields(initialDoc);
    }
  }, [initialDoc]);

  const resetEditFields = (targetDoc: StoreInventoryDoc) => {
    let formattedDate = '';
    try {
      if (targetDoc.date?.toDate) {
        formattedDate = targetDoc.date.toDate().toISOString().split('T')[0];
      } else if (typeof targetDoc.date === 'string') {
        formattedDate = targetDoc.date.split('T')[0];
      } else {
        formattedDate = new Date().toISOString().split('T')[0];
      }
    } catch (_) {
      formattedDate = new Date().toISOString().split('T')[0];
    }

    setEditDate(formattedDate);
    setEditSupplier(targetDoc.supplier || '');
    setEditReason(targetDoc.reason || '');
    setEditComment(targetDoc.comment || '');
    setEditItems(
      targetDoc.items.map((it) => ({
        ...it,
      }))
    );
  };

  if (!isOpen || !currentDoc) return null;

  // Format document timestamp for display
  const formatDocDate = (rawDate: any) => {
    try {
      if (rawDate?.toDate) {
        return rawDate.toDate().toLocaleString('ru-RU', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
      }
      if (typeof rawDate === 'string') {
        const d = new Date(rawDate);
        return isNaN(d.getTime())
          ? rawDate
          : d.toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
      }
    } catch (_) {}
    return 'Дата не указана';
  };

  // Type styling and label
  const typeConfig = {
    receipt: {
      label: 'Приемка товаров',
      icon: PackagePlus,
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      badgeBg: 'bg-emerald-600',
    },
    write_off: {
      label: 'Списание товаров',
      icon: ArrowDownRight,
      bg: 'bg-rose-50 text-rose-800 border-rose-200',
      badgeBg: 'bg-rose-600',
    },
    inventory: {
      label: 'Инвентаризация',
      icon: ClipboardCheck,
      bg: 'bg-blue-50 text-blue-800 border-blue-200',
      badgeBg: 'bg-blue-600',
    },
  }[currentDoc.type] || {
    label: 'Складской документ',
    icon: FileText,
    bg: 'bg-slate-50 text-slate-800 border-slate-200',
    badgeBg: 'bg-slate-700',
  };

  const TypeIcon = typeConfig.icon;

  // Edit item quantity
  const handleItemQtyChange = (index: number, newQty: number) => {
    const clampedQty = Math.max(1, newQty);
    setEditItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[index] };
      target.qty = clampedQty;
      target.total = clampedQty * (target.price || 0);
      copy[index] = target;
      return copy;
    });
  };

  // Edit item price
  const handleItemPriceChange = (index: number, newPrice: number) => {
    const clampedPrice = Math.max(0, newPrice);
    setEditItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[index] };
      target.price = clampedPrice;
      target.total = (target.qty || 1) * clampedPrice;
      copy[index] = target;
      return copy;
    });
  };

  // Remove line item
  const handleRemoveItem = (index: number) => {
    if (editItems.length <= 1) {
      alert('В документе должна оставаться хотя бы одна позиция.');
      return;
    }
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Add product picked from modal
  const handleAddProductFromModal = (newItem: {
    productId: string;
    name: string;
    barcode?: string;
    qty: number;
    price: number;
  }) => {
    setEditItems((prev) => {
      const existingIdx = prev.findIndex((it) => it.productId === newItem.productId);
      if (existingIdx >= 0) {
        const copy = [...prev];
        const existing = copy[existingIdx];
        const nextQty = existing.qty + newItem.qty;
        copy[existingIdx] = {
          ...existing,
          qty: nextQty,
          price: newItem.price || existing.price,
          total: nextQty * (newItem.price || existing.price),
        };
        return copy;
      }
      return [
        ...prev,
        {
          productId: newItem.productId,
          name: newItem.name,
          barcode: newItem.barcode,
          qty: newItem.qty,
          price: newItem.price,
          total: newItem.qty * newItem.price,
        },
      ];
    });
  };

  // Calculate live editable totals
  const editTotalAmount = editItems.reduce(
    (sum, it) => sum + (it.total || it.qty * it.price || 0),
    0
  );
  const editTotalQty = editItems.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);

  // Handle AI Recognition from Waybill Photo in Edit Mode (Strictly Draft Mode)
  const handleWaybillFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    setIsRecognizingWaybill(true);
    setWaybillProgress(5);
    setNotification(null);

    // Smoothly simulate progress up to 85% over ~2 seconds
    progressIntervalRef.current = setInterval(() => {
      setWaybillProgress((prev) => {
        if (prev < 45) return Math.min(85, prev + 8);
        if (prev < 72) return Math.min(85, prev + 4);
        if (prev < 84) return Math.min(85, prev + 1);
        return 85;
      });
    }, 140);

    try {
      const result = await recognizeWaybillImage(file, products);

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      setWaybillProgress(100);

      if (result.date) setEditDate(result.date);
      if (result.supplier) setEditSupplier(result.supplier);
      if (result.waybillNumber) {
        setEditComment((prev) =>
          prev
            ? `${prev} | Накладная ${result.waybillNumber}`
            : `Накладная ${result.waybillNumber}`
        );
      }

      if (result.items.length > 0) {
        setEditItems(
          result.items.map((it) => ({
            productId: it.productId,
            name: it.name,
            barcode: it.barcode,
            qty: it.qty,
            price: it.price,
            total: it.qty * it.price,
            isNew: it.isNew,
            sellPrice: it.sellPrice,
          }))
        );
        setNotification({
          type: 'success',
          text: `Черновик заполнен ИИ: найдено в базе ${result.matchedCount} поз., новых товаров (+25%): ${result.newCount} поз. Проверьте данные перед сохранением!`,
        });
      } else {
        setNotification({
          type: 'error',
          text: 'На фото не найдено товарных позиций. Попробуйте более четкое фото.',
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (err: any) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setNotification({
        type: 'error',
        text: err?.message || 'Ошибка распознавания накладной.',
      });
    } finally {
      setIsRecognizingWaybill(false);
      setWaybillProgress(0);
      if (waybillInputRef.current) waybillInputRef.current.value = '';
    }
  };

  // Save changes with atomic delta stock updates
  const handleSaveChanges = async () => {
    if (editItems.length === 0) {
      alert('В документе не может быть 0 позиций.');
      return;
    }

    setIsSaving(true);
    setNotification(null);

    try {
      // Create any new products recognized by AI before updating receipt
      const resolvedItems: InventoryDocItem[] = [];
      for (const it of editItems) {
        let finalProductId = it.productId;
        const cleanName = it.name.trim() || 'Новый товар';

        if (it.isNew || it.productId.startsWith('new_')) {
          const sellPrice =
            it.sellPrice !== undefined && it.sellPrice > 0
              ? it.sellPrice
              : Math.round(it.price * 1.25);

          finalProductId = await createProduct({
            name: cleanName,
            price: sellPrice,
            purchasePrice: it.price,
            stockQuantity: 0,
            barcode: it.barcode || '',
            category: 'Общее',
            unit: 'шт',
          });
        }

        resolvedItems.push({
          productId: finalProductId,
          name: cleanName,
          barcode: it.barcode,
          qty: it.qty,
          price: it.price,
          total: it.qty * it.price,
        });
      }

      await updateInventoryDocWithStockDelta(currentDoc.id, currentDoc, {
        items: resolvedItems,
        supplier: editSupplier.trim() || undefined,
        reason: editReason.trim() || undefined,
        comment: editComment.trim() || undefined,
        date: new Date(editDate).toISOString(),
      });

      // Update current displayed document
      const updatedDoc: StoreInventoryDoc = {
        ...currentDoc,
        items: resolvedItems,
        supplier: editSupplier.trim() || undefined,
        reason: editReason.trim() || undefined,
        comment: editComment.trim() || undefined,
        date: editDate,
        totalAmount: editTotalAmount,
      };
      setCurrentDoc(updatedDoc);
      setIsEditing(false);

      setNotification({
        type: 'success',
        text: 'Документ успешно обновлен! Складские остатки скорректированы (дельта учтена атомарно).',
      });
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setNotification({
        type: 'error',
        text: `Ошибка сохранения: ${err.message}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Rollback and delete document
  const handleDeleteDoc = async () => {
    const confirmText =
      currentDoc.type === 'receipt'
        ? `Внимание! При удалении документа «${currentDoc.docNumber}» оприходованные товары будут СПИСАНЫ со склада в объеме позиций документа. Удалить?`
        : `Внимание! При удалении документа списания «${currentDoc.docNumber}» списанные остатки будут ВОЗВРАЩЕНЫ на склад. Удалить?`;

    if (!window.confirm(confirmText)) return;

    setIsDeleting(true);
    try {
      await deleteInventoryDoc(currentDoc);
      onClose();
    } catch (err: any) {
      alert(`Ошибка удаления: ${err.message}`);
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col min-h-0 border-l border-slate-200 animate-in slide-in-from-right duration-200">
          {/* Drawer Top Header */}
          <div className="p-4 sm:p-5 bg-slate-900 text-white shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${typeConfig.badgeBg} text-white shadow-sm`}>
                <TypeIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm sm:text-base font-bold text-white bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-700">
                    {currentDoc.docNumber}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Проведен
                  </span>
                  {isEditing && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                      Редактирование
                    </span>
                  )}
                </div>
                <h2 className="text-xs sm:text-sm font-semibold text-slate-300 mt-1">
                  {typeConfig.label}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isEditing ? (
                <>
                  {currentDoc.type === 'inventory' && (
                    <button
                      onClick={() => setIsAuditModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs active:scale-95"
                      title="Открыть полную сличительную ведомость инвентаризации"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      <span>Сличительная ведомость</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      resetEditFields(currentDoc);
                      setIsEditing(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs active:scale-95"
                    title="Редактировать позиции и данные документа"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Редактировать</span>
                  </button>

                  <button
                    onClick={handleDeleteDoc}
                    disabled={isDeleting}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition active:scale-95"
                    title="Удалить документ и вернуть остатки"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    resetEditFields(currentDoc);
                    setIsEditing(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Отмена
                </button>
              )}

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Закрыть панель"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Feedback Notification Banner */}
          {notification && (
            <div
              className={`p-3 text-xs font-semibold flex items-center justify-between shrink-0 ${
                notification.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-b border-emerald-200'
                  : 'bg-rose-50 text-rose-900 border-b border-rose-200'
              }`}
            >
              <span>{notification.text}</span>
              <button
                onClick={() => setNotification(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Main Content Body */}
          <div className="flex-1 overflow-y-auto touch-pan-y overscroll-y-contain p-4 sm:p-6 space-y-5 min-h-0 bg-slate-50/50">
            {isRecognizingWaybill && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs font-bold text-indigo-950">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>Распознавание накладной... {Math.round(waybillProgress)}%</span>
                  </div>
                  <span className="font-mono text-indigo-700">{Math.round(waybillProgress)}%</span>
                </div>
                <progress
                  value={Math.round(waybillProgress)}
                  max={100}
                  className="w-full h-2 rounded-full overflow-hidden block [&::-webkit-progress-bar]:bg-indigo-200/70 [&::-webkit-progress-value]:bg-indigo-600 [&::-webkit-progress-value]:transition-all [&::-webkit-progress-value]:duration-150 [&::-moz-progress-bar]:bg-indigo-600"
                />
              </div>
            )}
            {/* Meta Cards: View Mode vs Edit Mode */}
            {!isEditing ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                {/* Date */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Дата и время
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 mt-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formatDocDate(currentDoc.date)}</span>
                  </div>
                </div>

                {/* Supplier or Reason */}
                {currentDoc.type === 'receipt' ? (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Поставщик
                    </span>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 mt-1">
                      <Truck className="w-3.5 h-3.5 text-blue-500" />
                      <span className="truncate">{currentDoc.supplier || 'Основной поставщик'}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Причина
                    </span>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{currentDoc.reason || 'Списание'}</span>
                    </div>
                  </div>
                )}

                {/* Author */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Ответственный
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 mt-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{currentDoc.authorName || 'Сотрудник'}</span>
                  </div>
                </div>

                {/* Comment / Waybill */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Примечание
                  </span>
                  <div className="text-xs text-slate-600 mt-1 truncate" title={currentDoc.comment}>
                    {currentDoc.comment || '—'}
                  </div>
                </div>
              </div>
            ) : (
              /* Editable Document Details Form */
              <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Параметры документа
                  </span>
                  <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-medium">
                    Остатки будут обновлены строго по дельте
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Date Input */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Дата документа
                    </label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>

                  {/* Supplier or Reason */}
                  {currentDoc.type === 'receipt' ? (
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Поставщик (Умный поиск / создание)
                      </label>
                      <SupplierSelect
                        value={editSupplier}
                        onChange={(val) => setEditSupplier(val)}
                        placeholder="Начните вводить поставщика..."
                      />
                    </div>
                  ) : (
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Причина списания
                      </label>
                      <input
                        type="text"
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        placeholder="Порча, Брак, Хозрасходы..."
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Примечание / Накладная
                  </label>
                  <input
                    type="text"
                    value={editComment}
                    onChange={(e) => setEditComment(e.target.value)}
                    placeholder="Номер входящей накладной или комментарий к изменениям..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>
            )}

            {/* Items Table Section */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Товарные позиции ({isEditing ? editItems.length : currentDoc.items.length})
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {isEditing
                      ? 'Измените количество, цену или добавьте новые позиции'
                      : 'Перечень товаров, зафиксированных в документе'}
                  </p>
                </div>

                {isEditing && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {currentDoc.type === 'receipt' && (
                      <>
                        <input
                          ref={waybillInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleWaybillFileChange}
                          className="hidden"
                        />
                        <button
                          type="button"
                          disabled={isRecognizingWaybill}
                          onClick={() => waybillInputRef.current?.click()}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition shadow-xs active:scale-95"
                        >
                          {isRecognizingWaybill ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                              <span className="font-mono">Распознавание... {Math.round(waybillProgress)}%</span>
                            </>
                          ) : (
                            <span>📷 Сфотографировать/Загрузить накладную</span>
                          )}
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsAddProductModalOpen(true)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Добавить товар</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200 select-none">
                    <tr>
                      <th className="py-2.5 px-3 w-8">#</th>
                      <th className="py-2.5 px-3">Наименование</th>
                      <th className="py-2.5 px-3">Штрихкод</th>
                      <th className="py-2.5 px-3 text-right">Кол-во</th>
                      <th className="py-2.5 px-3 text-right">
                        {currentDoc.type === 'receipt' ? 'Цена закупки' : 'Себестоимость'}
                      </th>
                      <th className="py-2.5 px-4 text-right">Сумма</th>
                      {isEditing && <th className="py-2.5 px-3 text-center w-12">Удалить</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(isEditing ? editItems : currentDoc.items).map((item, index) => {
                      const itemTotal = item.total || item.qty * item.price;
                      return (
                        <tr
                          key={`${item.productId}-${index}`}
                          className="hover:bg-slate-50/70 transition"
                        >
                          <td className="py-3 px-3 text-slate-400 font-mono">{index + 1}</td>
                          <td className="py-3 px-3">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedProductCard({
                                  id: item.productId,
                                  name: item.name,
                                })
                              }
                              className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer text-left transition block"
                              title="Открыть карточку товара"
                            >
                              {item.name}
                            </button>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                            {item.barcode ? (
                              <span className="inline-flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                                <Barcode className="w-3 h-3 text-slate-400" />
                                {item.barcode}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>

                          {/* Quantity */}
                          <td className="py-3 px-3 text-right">
                            {isEditing ? (
                              <div className="inline-flex items-center gap-1">
                                <input
                                  type="number"
                                  min="1"
                                  value={item.qty}
                                  onChange={(e) =>
                                    handleItemQtyChange(index, parseInt(e.target.value) || 1)
                                  }
                                  className="w-16 px-2 py-1 text-right font-black font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-[11px] text-slate-400 font-medium">шт.</span>
                              </div>
                            ) : (
                              <span className="font-black font-mono text-slate-900">
                                {item.qty} шт.
                              </span>
                            )}
                          </td>

                          {/* Price */}
                          <td className="py-3 px-3 text-right">
                            {isEditing ? (
                              <div className="inline-flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.price}
                                  onChange={(e) =>
                                    handleItemPriceChange(index, parseFloat(e.target.value) || 0)
                                  }
                                  className="w-20 px-2 py-1 text-right font-bold font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-[11px] text-slate-400 font-medium">₽</span>
                              </div>
                            ) : (
                              <span className="font-semibold font-mono text-slate-700">
                                {item.price.toLocaleString('ru-RU')} ₽
                              </span>
                            )}
                          </td>

                          {/* Line Total */}
                          <td className="py-3 px-4 text-right font-black font-mono text-slate-900">
                            {itemTotal.toLocaleString('ru-RU')} ₽
                          </td>

                          {/* Delete Item in Edit Mode */}
                          {isEditing && (
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                title="Удалить позицию"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Drawer Fixed Footer */}
          <div className="p-4 sm:p-5 bg-white border-t border-slate-200 shrink-0 flex items-center justify-between shadow-lg">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Итого по документу
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black font-mono text-slate-900">
                  {(isEditing ? editTotalAmount : currentDoc.totalAmount).toLocaleString('ru-RU')} ₽
                </span>
                <span className="text-xs text-slate-500">
                  ({isEditing ? editTotalQty : currentDoc.items.reduce((s, it) => s + it.qty, 0)}{' '}
                  шт.)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      resetEditFields(currentDoc);
                      setIsEditing(false);
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                  >
                    Отмена
                  </button>

                  <button
                    type="button"
                    disabled={isSaving || isRecognizingWaybill || editItems.length === 0}
                    onClick={handleSaveChanges}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'Сохранение...' : 'Сохранить изменения'}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Закрыть
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Product Modal during Edit Mode */}
      {isAddProductModalOpen && (
        <ProductSearchAndScanModal
          isOpen={isAddProductModalOpen}
          onClose={() => setIsAddProductModalOpen(false)}
          products={products}
          onAddProduct={handleAddProductFromModal}
          mode={currentDoc.type}
        />
      )}

      {/* Product Card Modal on clicking product name */}
      <ProductCardModal
        isOpen={!!selectedProductCard}
        onClose={() => setSelectedProductCard(null)}
        productId={selectedProductCard?.id || null}
        products={products}
        fallbackName={selectedProductCard?.name}
      />

      {/* Full Inventory Audit Modal */}
      {isAuditModalOpen && currentDoc.type === 'inventory' && (
        <InventoryAuditModal
          isOpen={isAuditModalOpen}
          onClose={() => setIsAuditModalOpen(false)}
          auditDoc={currentDoc}
          products={products}
        />
      )}
    </>
  );
};
