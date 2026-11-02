import React, { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { StoreProduct } from '../../types';
import { createProduct, updateProduct, deleteProduct, archiveProduct, restoreProduct, checkBarcodeUnique } from '../../services/storeService';
import { SupplierSelect } from './SupplierSelect';
import { MergeProductsModal } from './MergeProductsModal';
import {
  Package,
  Barcode,
  Boxes,
  TrendingUp,
  Check,
  X,
  Trash2,
  Archive,
  Sparkles,
  AlertTriangle,
  GitMerge,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

interface ProductCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string | null;
  products?: StoreProduct[];
  fallbackName?: string;
  initialBarcode?: string;
  onCreated?: (newId: string) => void;
}

export const ProductCardModal: React.FC<ProductCardModalProps> = ({
  isOpen,
  onClose,
  productId,
  products = [],
  fallbackName,
  initialBarcode,
  onCreated,
}) => {
  const [liveProduct, setLiveProduct] = useState<StoreProduct | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Editable form states
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Общее');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formPurchasePrice, setFormPurchasePrice] = useState<number | ''>('');
  const [formPrice, setFormPrice] = useState<number | ''>('');
  const [formUnit, setFormUnit] = useState<string>('шт');
  const [formMinStock, setFormMinStock] = useState<number>(0);
  const [formSupplierId, setFormSupplierId] = useState<string>('');
  const [formSupplierName, setFormSupplierName] = useState<string>('');
  const [formIsHot, setFormIsHot] = useState<boolean>(false);
  const [formIsArchived, setFormIsArchived] = useState<boolean>(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isMergeOpen, setIsMergeOpen] = useState(false);

  // Categories list from catalog
  const categories = useMemo(() => {
    const set = new Set<string>(['Общее']);
    products.forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    if (liveProduct?.category && liveProduct.category.trim()) {
      set.add(liveProduct.category.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [products, liveProduct]);

  const populateForm = (p: StoreProduct) => {
    setFormName(p.name || '');
    setFormCategory(p.category || 'Общее');
    setIsCustomCategory(false);
    setCustomCategoryInput('');
    setFormBarcode(p.barcode || '');
    setFormPurchasePrice(p.purchasePrice !== undefined ? p.purchasePrice : '');
    setFormPrice(p.price ?? 0);
    setFormUnit(p.unit || 'шт');
    setFormMinStock(p.minStock || 0);
    setFormSupplierId(p.primarySupplierId || '');
    setFormSupplierName(p.primarySupplierName || '');
    setFormIsHot(!!p.isHot);
    setFormIsArchived(!!p.isArchived);
  };

  // Resolve product by ID from props & subscribe to live Firestore document
  useEffect(() => {
    if (!isOpen) {
      setLiveProduct(null);
      setSaveSuccess(null);
      setSaveError(null);
      return;
    }

    setSaveSuccess(null);
    setSaveError(null);

    // If initial barcode is passed without existing product, initialize creation form
    if (!productId && initialBarcode) {
      const newProd: StoreProduct = {
        id: 'new_custom_product',
        name: '',
        price: 0,
        stockQuantity: 0,
        barcode: initialBarcode,
        unit: 'шт',
      };
      setLiveProduct(newProd);
      populateForm(newProd);
      setIsLoading(false);
      return;
    }

    if (!productId && !fallbackName) {
      setLiveProduct(null);
      return;
    }

    // 1. Check in local products array first for instant render
    let matched = productId ? products.find((p) => p.id === productId) || null : null;
    if (!matched && fallbackName) {
      const cleanFallback = fallbackName.trim().toLowerCase();
      matched =
        products.find((p) => p.name.trim().toLowerCase() === cleanFallback) || null;
    }

    if (matched) {
      setLiveProduct(matched);
      populateForm(matched);
    }

    const targetId = matched?.id || (productId && !productId.startsWith('new_') ? productId : null);
    if (!targetId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(!matched);

    // 2. Subscribe to real-time document in Firestore for guaranteed fresh data
    const unsub = onSnapshot(
      doc(db, 'store_products', targetId),
      (snap) => {
        setIsLoading(false);
        if (snap.exists()) {
          const data = snap.data() as any;
          const fresh: StoreProduct = {
            id: snap.id,
            name: data.name || 'Без названия',
            barcode:
              data.barcode ||
              (Array.isArray(data.barcodes) && data.barcodes.length > 0
                ? data.barcodes[0]
                : undefined),
            barcodes: Array.isArray(data.barcodes) ? data.barcodes : undefined,
            price:
              data.retailPrice !== undefined
                ? Number(data.retailPrice) || 0
                : Number(data.price) || 0,
            purchasePrice:
              data.purchasePrice !== undefined ? Number(data.purchasePrice) : undefined,
            stockQuantity: Number(data.stockQuantity) || 0,
            minStock: data.minStock !== undefined ? Number(data.minStock) : undefined,
            primarySupplierId: data.primarySupplierId || undefined,
            primarySupplierName: data.primarySupplierName || undefined,
            category: data.category || data.group || 'Общее',
            unit: data.unit || 'шт',
            isHot: Boolean(data.isHot),
            hotColor: data.hotColor || undefined,
            isArchived: Boolean(data.isArchived),
            updatedAt: data.updatedAt,
          };
          setLiveProduct((prev) => {
            // Populate form fields on initial load
            if (!prev || prev.id !== fresh.id) {
              populateForm(fresh);
            }
            return fresh;
          });
        }
      },
      () => {
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [isOpen, productId, fallbackName]);

  if (!isOpen) return null;

  const handleGenerateBarcode = () => {
    const random12 = '2000' + Math.floor(10000000 + Math.random() * 90000000).toString();
    setFormBarcode(random12);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveProduct || !formName.trim() || formPrice === '') return;

    const cleanBarcode = formBarcode.trim();

    // Check barcode uniqueness locally first
    if (cleanBarcode) {
      const conflict = products.find(
        (p) =>
          p.id !== liveProduct.id &&
          ((p.barcode && p.barcode.toLowerCase() === cleanBarcode.toLowerCase()) ||
            (p.barcodes && p.barcodes.some((b) => b.toLowerCase() === cleanBarcode.toLowerCase())))
      );
      if (conflict) {
        setSaveError(`Товар со штрихкодом "${cleanBarcode}" уже существует: «${conflict.name}»!`);
        return;
      }
    }

    const finalCategory = isCustomCategory
      ? customCategoryInput.trim() || 'Общее'
      : formCategory.trim() || 'Общее';

    setIsSaving(true);
    setSaveSuccess(null);
    setSaveError(null);
    try {
      if (liveProduct.id === 'new_custom_product' || !productId) {
        const newId = await createProduct({
          name: formName.trim(),
          category: finalCategory,
          barcode: cleanBarcode || undefined,
          purchasePrice: formPurchasePrice !== '' ? Number(formPurchasePrice) : undefined,
          price: Number(formPrice) || 0,
          stockQuantity: 0,
          unit: formUnit,
          minStock: Number(formMinStock) || 0,
          primarySupplierId: formSupplierId || undefined,
          primarySupplierName: formSupplierName || undefined,
          isHot: formIsHot,
          hotColor: formIsHot ? '#2563eb' : undefined,
          isActive: !formIsArchived,
          isArchived: formIsArchived,
        });
        setSaveSuccess('Новый товар успешно создан в номенклатуре!');
        onCreated?.(newId);
        setTimeout(() => {
          onClose();
        }, 1200);
        return;
      }

      await updateProduct(liveProduct.id, {
        name: formName.trim(),
        category: finalCategory,
        barcode: cleanBarcode || '',
        purchasePrice: formPurchasePrice !== '' ? Number(formPurchasePrice) : undefined,
        price: Number(formPrice) || 0,
        unit: formUnit,
        minStock: Number(formMinStock) || 0,
        primarySupplierId: formSupplierId || undefined,
        primarySupplierName: formSupplierName || undefined,
        isHot: formIsHot,
        hotColor: formIsHot ? '#2563eb' : undefined,
        isActive: !formIsArchived,
        isArchived: formIsArchived,
      });
      setSaveSuccess('Данные карточки товара успешно сохранены!');
      setTimeout(() => setSaveSuccess(null), 3500);
    } catch (err: any) {
      setSaveError(err.message || 'Ошибка сохранения товара');
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!liveProduct) return;
    setIsSaving(true);
    setSaveSuccess(null);
    setSaveError(null);
    try {
      const isCurrentlyArchived = liveProduct.isActive === false || liveProduct.isArchived === true;
      if (isCurrentlyArchived) {
        await restoreProduct(liveProduct.id);
        setFormIsArchived(false);
        setSaveSuccess('Товар успешно восстановлен из архива!');
      } else {
        await archiveProduct(liveProduct.id);
        setFormIsArchived(true);
        setSaveSuccess('Товар перенесен в архив (скрыт из терминала кассира)');
      }
      setTimeout(() => setSaveSuccess(null), 3500);
    } catch (err: any) {
      setSaveError(err.message || 'Ошибка изменения статуса');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!liveProduct) return;
    try {
      await deleteProduct(liveProduct.id);
      onClose();
    } catch (err: any) {
      setSaveError(`Ошибка удаления: ${err.message}`);
    }
  };

  const currentPurchase = formPurchasePrice !== '' ? Number(formPurchasePrice) : 0;
  const currentSell = formPrice !== '' ? Number(formPrice) : 0;
  const marginRub = currentSell - currentPurchase;
  const marginPct =
    currentPurchase > 0 ? Math.round(((currentSell - currentPurchase) / currentPurchase) * 100) : null;

  return (
    <div
      className="fixed inset-0 z-70 overflow-y-auto touch-pan-y flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92dvh] my-auto animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-blue-600 rounded-xl text-white shrink-0 shadow-sm">
              <Package className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-sm sm:text-base truncate">Карточка товара</h3>
                {liveProduct && (
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    ID: {liveProduct.id.slice(0, 8)}
                  </span>
                )}
                {liveProduct?.isArchived ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    В архиве
                  </span>
                ) : (
                  liveProduct && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Активен
                    </span>
                  )
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {liveProduct ? liveProduct.name : fallbackName || 'Загрузка данных из базы...'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
            title="Закрыть карточку"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {isLoading ? (
          <div className="p-10 flex flex-col items-center justify-center gap-3 text-slate-500">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold">Загрузка карточки товара из базы...</span>
          </div>
        ) : !liveProduct ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900">
                Товар еще не сохранен в справочнике
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Позиция «{fallbackName || 'Новый товар'}» находится в режиме черновика или была удалена из каталога. Сохраните документ, чтобы карточка товара появилась в базе.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
            >
              Понятно
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSave}
            className="flex-1 overflow-y-auto min-h-0 touch-pan-y overscroll-y-contain p-4 sm:p-5 space-y-4"
          >
            {saveSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{saveSuccess}</span>
              </div>
            )}

            {saveError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            {/* Quick KPI Metrics Strip */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Текущий остаток
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <Boxes className="w-4 h-4 text-blue-600 shrink-0" />
                  <span
                    className={`text-base font-black font-mono ${
                      liveProduct.stockQuantity <= 0
                        ? 'text-rose-600'
                        : liveProduct.stockQuantity <= (liveProduct.minStock || 0)
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                    }`}
                  >
                    {liveProduct.stockQuantity} {liveProduct.unit || 'шт'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Оценка запаса
                </span>
                <div className="text-base font-black font-mono text-slate-900 mt-1">
                  {Math.round(liveProduct.stockQuantity * currentSell).toLocaleString('ru-RU')} ₽
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Наценка / Маржа
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-sm font-black font-mono text-emerald-600">
                    {marginPct !== null ? `+${marginPct}%` : '—'}{' '}
                    {currentPurchase > 0 ? `(+${Math.round(marginRub)} ₽)` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* 1. Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Наименование товара *
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              />
            </div>

            {/* 2. Group / Category & Unit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">Группа (Категория)</label>
                  <button
                    type="button"
                    onClick={() => setIsCustomCategory(!isCustomCategory)}
                    className="text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    {isCustomCategory ? 'Из списка' : '+ Новая'}
                  </button>
                </div>
                {isCustomCategory ? (
                  <input
                    type="text"
                    value={customCategoryInput}
                    onChange={(e) => setCustomCategoryInput(e.target.value)}
                    placeholder="Название новой группы..."
                    className="w-full px-3 py-2 text-xs bg-white border border-blue-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                ) : (
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Единица измерения
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['шт', 'кг', 'л', 'упак'].map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setFormUnit(u)}
                      className={`py-2 rounded-xl text-xs font-bold transition border ${
                        formUnit === u
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Barcode */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Штрихкод / Артикул
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    placeholder="460123456789"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleGenerateBarcode}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition shrink-0"
                >
                  Сгенерировать
                </button>
              </div>
              {liveProduct.barcodes && liveProduct.barcodes.length > 1 && (
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400">Все штрихкоды:</span>
                  {liveProduct.barcodes.map((b) => (
                    <span
                      key={b}
                      className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-600"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Prices & MinStock */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Цена закупки (₽)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formPurchasePrice}
                  onChange={(e) =>
                    setFormPurchasePrice(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Цена продажи (₽) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={formPrice}
                  onChange={(e) =>
                    setFormPrice(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Мин. запас ({formUnit})
                </label>
                <input
                  type="number"
                  min="0"
                  value={formMinStock}
                  onChange={(e) => setFormMinStock(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 5. Supplier */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Основной поставщик
              </label>
              <SupplierSelect
                value={formSupplierName}
                onChange={(name) => setFormSupplierName(name)}
                onSupplierIdChange={(id) => setFormSupplierId(id)}
                selectedSupplierId={formSupplierId}
                placeholder="Выберите поставщика..."
              />
            </div>

            {/* 6. Flags */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formIsHot}
                    onChange={(e) => setFormIsHot(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Горячая клавиша POS</span>
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Быстрый выбор на кассе
                    </span>
                  </div>
                </label>
              </div>

              <div className="p-2.5 bg-amber-50/50 rounded-xl border border-amber-200">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formIsArchived}
                    onChange={(e) => setFormIsArchived(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                      <Archive className="w-3 h-3 text-amber-600" />
                      <span>В архиве</span>
                    </span>
                    <span className="text-[10px] text-amber-700 block">
                      Скрыть из терминала кассира
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Archive / Restore Button */}
                <button
                  type="button"
                  onClick={handleArchiveToggle}
                  disabled={isSaving}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                    liveProduct?.isArchived
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                  }`}
                  title={liveProduct?.isArchived ? 'Восстановить товар в активный каталог' : 'Перенести в архив (soft delete)'}
                >
                  {liveProduct?.isArchived ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Восстановить</span>
                    </>
                  ) : (
                    <>
                      <Archive className="w-3.5 h-3.5" />
                      <span>В архив</span>
                    </>
                  )}
                </button>

                {/* Merge duplicates button */}
                <button
                  type="button"
                  onClick={() => setIsMergeOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition cursor-pointer"
                  title="Объединить этот товар с дублем"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Слияние дублей</span>
                </button>

                {/* Permanent Delete for archived or admin */}
                {liveProduct?.isArchived && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition"
                    title="Удалить из базы навсегда"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Удалить</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Закрыть
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !formName.trim() || formPrice === ''}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSaving ? 'Сохранение...' : 'Сохранить изменения'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Merge Products Modal */}
      {isMergeOpen && liveProduct && (
        <MergeProductsModal
          isOpen={isMergeOpen}
          onClose={() => setIsMergeOpen(false)}
          products={products}
          initialProductA={liveProduct}
          onSuccess={(target, newStock) => {
            setSaveSuccess(`Слияние успешно завершено! Итоговый остаток: ${newStock}`);
            setTimeout(() => setSaveSuccess(null), 4000);
          }}
        />
      )}
    </div>
  );
};
