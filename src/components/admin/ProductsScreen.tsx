import React, { useState, useMemo } from 'react';
import { StoreProduct, StoreSupplier } from '../../types';
import {
  createProduct,
  updateProduct,
  deleteProduct,
  archiveProduct,
  restoreProduct,
  checkBarcodeUnique,
} from '../../services/storeService';
import { SupplierSelect } from './SupplierSelect';
import { MergeProductsModal } from './MergeProductsModal';
import {
  Package,
  Search,
  Plus,
  Barcode,
  Tag,
  Boxes,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Edit2,
  Trash2,
  X,
  Check,
  ChevronRight,
  Filter,
  Sparkles,
  Layers,
  ArrowUpDown,
  Archive,
  CheckCircle2,
  GitMerge,
  RefreshCw,
} from 'lucide-react';

interface ProductsScreenProps {
  products: StoreProduct[];
  suppliers?: StoreSupplier[];
}

export const ProductsScreen: React.FC<ProductsScreenProps> = ({
  products,
  suppliers = [],
}) => {
  const [activeTab, setActiveTab] = useState<'active' | 'archive' | 'all'>('active');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeInitialA, setMergeInitialA] = useState<StoreProduct | null>(null);
  const [mergeInitialB, setMergeInitialB] = useState<StoreProduct | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock' | 'low_stock'>('all');

  // Slide-over drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);

  // Form states inside drawer
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Общее');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formPurchasePrice, setFormPurchasePrice] = useState<number | ''>('');
  const [formPrice, setFormPrice] = useState<number | ''>('');
  const [formUnit, setFormUnit] = useState<string>('шт');
  const [formStockQuantity, setFormStockQuantity] = useState<number>(0);
  const [formMinStock, setFormMinStock] = useState<number>(0);
  const [formSupplierId, setFormSupplierId] = useState<string>('');
  const [formSupplierName, setFormSupplierName] = useState<string>('');
  const [formIsHot, setFormIsHot] = useState<boolean>(false);
  const [formIsArchived, setFormIsArchived] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);

  // Split active vs archive vs all counts
  const counts = useMemo(() => {
    let active = 0;
    let archive = 0;
    products.forEach((p) => {
      const isArch = p.isActive === false || p.isArchived === true;
      if (isArch) archive += 1;
      else active += 1;
    });
    return { active, archive, all: products.length };
  }, [products]);

  // Unique categories from current active products
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [products]);

  // Overall Catalog Statistics (for active products)
  const stats = useMemo(() => {
    const activeList = products.filter((p) => p.isActive !== false && !p.isArchived);
    const totalCount = activeList.length;
    let purchaseTotal = 0;
    let retailTotal = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;

    activeList.forEach((p) => {
      const stock = p.stockQuantity || 0;
      const price = p.price || 0;
      const purchasePrice = p.purchasePrice || 0;

      purchaseTotal += purchasePrice * stock;
      retailTotal += price * stock;

      if (stock <= 0) {
        outOfStockCount += 1;
      }
      if (stock > 0 && stock <= (p.minStock || 0)) {
        lowStockCount += 1;
      }
    });

    return {
      totalCount,
      purchaseTotal,
      retailTotal,
      outOfStockCount,
      lowStockCount,
    };
  }, [products]);

  // Filtered products list based on tab, category, stock and search query
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Tab filter: Active vs Archive vs All
      const isArchived = p.isActive === false || p.isArchived === true;
      if (activeTab === 'active' && isArchived) return false;
      if (activeTab === 'archive' && !isArchived) return false;
      // if 'all', show both

      // Category filter
      if (selectedCategory !== 'all' && (p.category || 'Общее') !== selectedCategory) {
        return false;
      }

      // Stock filter
      if (stockFilter === 'in_stock' && p.stockQuantity <= 0) return false;
      if (stockFilter === 'out_of_stock' && p.stockQuantity > 0) return false;
      if (stockFilter === 'low_stock' && (p.stockQuantity <= 0 || p.stockQuantity > (p.minStock || 0))) {
        return false;
      }

      // Search query filter (name or barcode)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesBarcode = p.barcode ? p.barcode.toLowerCase().includes(q) : false;
        const matchesBarcodes = p.barcodes ? p.barcodes.some((b) => b.toLowerCase().includes(q)) : false;
        const matchesCategory = p.category ? p.category.toLowerCase().includes(q) : false;
        return matchesName || matchesBarcode || matchesBarcodes || matchesCategory;
      }

      return true;
    });
  }, [products, activeTab, selectedCategory, stockFilter, searchQuery]);

  // Open Drawer for creating new product
  const handleOpenCreate = (prefilledBarcode?: string) => {
    setEditingProduct(null);
    setFormName('');
    setFormCategory('Общее');
    setIsCustomCategory(false);
    setCustomCategoryInput('');
    setFormBarcode(prefilledBarcode || '');
    setFormPurchasePrice('');
    setFormPrice('');
    setFormUnit('шт');
    setFormStockQuantity(0);
    setFormMinStock(0);
    setFormSupplierId('');
    setFormSupplierName('');
    setFormIsHot(false);
    setFormIsArchived(false);
    setFormError(null);
    setIsDrawerOpen(true);
  };

  // Open Drawer for editing existing product
  const handleOpenEdit = (p: StoreProduct) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCategory(p.category || 'Общее');
    setIsCustomCategory(false);
    setCustomCategoryInput('');
    setFormBarcode(p.barcode || '');
    setFormPurchasePrice(p.purchasePrice !== undefined ? p.purchasePrice : '');
    setFormPrice(p.price);
    setFormUnit(p.unit || 'шт');
    setFormStockQuantity(p.stockQuantity || 0);
    setFormMinStock(p.minStock || 0);
    setFormSupplierId(p.primarySupplierId || '');
    setFormSupplierName(p.primarySupplierName || '');
    setFormIsHot(!!p.isHot);
    setFormIsArchived(p.isActive === false || p.isArchived === true);
    setFormError(null);
    setIsDrawerOpen(true);
  };

  // Generate random mock barcode EAN-13 style
  const handleGenerateBarcode = () => {
    const random12 = '2000' + Math.floor(10000000 + Math.random() * 90000000).toString();
    setFormBarcode(random12);
  };

  // Multi-selection management
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map((p) => p.id));
    }
  };

  const handleOpenMergeSelected = () => {
    if (selectedIds.length >= 2) {
      const prodA = products.find((p) => p.id === selectedIds[0]) || null;
      const prodB = products.find((p) => p.id === selectedIds[1]) || null;
      setMergeInitialA(prodA);
      setMergeInitialB(prodB);
      setIsMergeModalOpen(true);
    } else if (selectedIds.length === 1) {
      const prodA = products.find((p) => p.id === selectedIds[0]) || null;
      setMergeInitialA(prodA);
      setMergeInitialB(null);
      setIsMergeModalOpen(true);
    } else {
      setMergeInitialA(null);
      setMergeInitialB(null);
      setIsMergeModalOpen(true);
    }
  };

  // Save product (Create or Update)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || formPrice === '') return;

    const cleanBarcode = formBarcode.trim();

    // Enforce barcode uniqueness check
    if (cleanBarcode) {
      const conflict = products.find(
        (p) =>
          (!editingProduct || p.id !== editingProduct.id) &&
          ((p.barcode && p.barcode.toLowerCase() === cleanBarcode.toLowerCase()) ||
            (p.barcodes && p.barcodes.some((b) => b.toLowerCase() === cleanBarcode.toLowerCase())))
      );
      if (conflict) {
        setFormError(`Товар со штрихкодом "${cleanBarcode}" уже существует: «${conflict.name}»!`);
        return;
      }
    }

    const finalCategory = isCustomCategory
      ? (customCategoryInput.trim() || 'Общее')
      : (formCategory.trim() || 'Общее');

    setIsSaving(true);
    setFormError(null);
    try {
      if (editingProduct) {
        // Update existing product
        await updateProduct(editingProduct.id, {
          name: formName.trim(),
          category: finalCategory,
          barcode: cleanBarcode || undefined,
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
        setToastMsg({ type: 'success', text: `Товар «${formName.trim()}» успешно обновлен!` });
      } else {
        // Create new product
        await createProduct({
          name: formName.trim(),
          category: finalCategory,
          barcode: cleanBarcode || undefined,
          purchasePrice: formPurchasePrice !== '' ? Number(formPurchasePrice) : undefined,
          price: Number(formPrice) || 0,
          stockQuantity: Number(formStockQuantity) || 0,
          unit: formUnit,
          minStock: Number(formMinStock) || 0,
          primarySupplierId: formSupplierId || undefined,
          primarySupplierName: formSupplierName || undefined,
          isHot: formIsHot,
          hotColor: formIsHot ? '#2563eb' : undefined,
          isActive: !formIsArchived,
          isArchived: formIsArchived,
        });
        setToastMsg({ type: 'success', text: `Новый товар «${formName.trim()}» успешно создан!` });
      }
      setTimeout(() => setToastMsg(null), 3500);
      setIsDrawerOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Ошибка сохранения товара');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete product (permanent)
  const handleDeleteProduct = async (e: React.MouseEvent, p: StoreProduct) => {
    e.stopPropagation();
    try {
      await deleteProduct(p.id);
      if (editingProduct?.id === p.id) {
        setIsDrawerOpen(false);
      }
      setToastMsg({ type: 'success', text: `Товар «${p.name}» удален из базы` });
      setTimeout(() => setToastMsg(null), 3500);
    } catch (err: any) {
      setToastMsg({ type: 'error', text: `Ошибка удаления: ${err.message}` });
      setTimeout(() => setToastMsg(null), 3500);
    }
  };

  // Quick toggle archive status directly from table (Soft Delete / Restore)
  const handleToggleArchive = async (e: React.MouseEvent, p: StoreProduct) => {
    e.stopPropagation();
    const isCurrentlyArchived = p.isActive === false || p.isArchived === true;
    try {
      if (isCurrentlyArchived) {
        await restoreProduct(p.id);
        setToastMsg({ type: 'success', text: `Товар «${p.name}» восстановлен из архива!` });
      } else {
        await archiveProduct(p.id);
        setToastMsg({ type: 'success', text: `Товар «${p.name}» перенесен в архив!` });
      }
      setTimeout(() => setToastMsg(null), 3500);
    } catch (err: any) {
      setToastMsg({ type: 'error', text: `Ошибка изменения статуса: ${err.message}` });
      setTimeout(() => setToastMsg(null), 3500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-sm">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Справочник «Товары»
            </h1>
            <p className="text-xs text-slate-500">
              Управление номенклатурой, ценами, штрихкодами, остатками и архивными позициями
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenMergeSelected}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer"
            title="Слияние дубликатов номенклатуры"
          >
            <GitMerge className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Слияние дублей</span>
          </button>

          <button
            onClick={() => handleOpenCreate()}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить товар</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 animate-in fade-in ${
            toastMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Floating Selection Action Bar */}
      {selectedIds.length > 0 && (
        <div className="p-3 bg-indigo-900 text-white rounded-2xl shadow-lg flex items-center justify-between gap-3 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <span className="font-bold">Выбрано товаров: {selectedIds.length}</span>
            {selectedIds.length === 2 && (
              <span className="text-indigo-200 hidden sm:inline">
                — готово для объединения
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenMergeSelected}
              className="px-3.5 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <GitMerge className="w-3.5 h-3.5" />
              <span>Объединить дубли</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 text-xs text-indigo-300 hover:text-white transition cursor-pointer"
            >
              Снять выбор
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total active positions */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Активных позиций
            </span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-mono">
            {stats.totalCount}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {categories.length} товарных групп
          </p>
        </div>

        {/* Card 2: Retail Stock Value */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Склад в рознице
            </span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600 font-mono">
            {stats.retailTotal.toLocaleString('ru-RU')} ₽
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Оценка выручки</p>
        </div>

        {/* Card 3: Purchase Stock Value */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Себестоимость
            </span>
            <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-800 dark:text-slate-200 font-mono">
            {stats.purchaseTotal.toLocaleString('ru-RU')} ₽
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Сумма закупки</p>
        </div>

        {/* Card 4: Archive Count */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              В архиве
            </span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-xl">
              <Archive className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-700 dark:text-slate-300 font-mono">
            {counts.archive}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Скрыты от кассира</p>
        </div>
      </div>

      {/* Tabs / Filters: Active vs Archive vs All */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 flex-wrap">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeTab === 'active'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Только активные ({counts.active})</span>
        </button>

        <button
          onClick={() => setActiveTab('archive')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeTab === 'archive'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>В архиве ({counts.archive})</span>
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeTab === 'all'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Все товары ({counts.all})</span>
        </button>
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию или штрихкоду..."
            className="w-full pl-10 pr-8 py-2 text-xs sm:text-sm bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
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

        {/* Group / Category dropdown */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-56">
            <Tag className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 cursor-pointer"
            >
              <option value="all">Все группы ({products.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Stock pills filter */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setStockFilter('all')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                stockFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => setStockFilter('in_stock')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                stockFilter === 'in_stock'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              В наличии
            </button>
            <button
              onClick={() => setStockFilter('out_of_stock')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                stockFilter === 'out_of_stock'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              Нет в наличии
            </button>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase font-bold border-b border-slate-200 dark:border-slate-700 select-none">
              <tr>
                <th className="w-10 py-3 px-3 text-center">
                  <input
                    type="checkbox"
                    checked={filteredProducts.length > 0 && selectedIds.length === filteredProducts.length}
                    onChange={toggleSelectAll}
                    title="Выбрать все для массовых действий"
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4">Наименование</th>
                <th className="py-3 px-3">Группа (Категория)</th>
                <th className="py-3 px-3">Штрихкод / Артикул</th>
                <th className="py-3 px-3 text-right">Закупка</th>
                <th className="py-3 px-3 text-right">Продажа</th>
                <th className="py-3 px-3 text-center">Ед. изм.</th>
                <th className="py-3 px-4 text-right">Остаток</th>
                <th className="py-3 px-3 text-center">Статус</th>
                <th className="py-3 px-3 text-center">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-2 stroke-1" />
                      <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Товары не найдены</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm">
                        {searchQuery || selectedCategory !== 'all' || stockFilter !== 'all'
                          ? 'Попробуйте сбросить фильтры или изменить поисковый запрос'
                          : activeTab === 'archive'
                          ? 'В архиве пока нет товаров.'
                          : 'В каталоге еще нет товаров.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const stock = p.stockQuantity || 0;
                  const unit = p.unit || 'шт';
                  const isArchived = p.isActive === false || p.isArchived === true;
                  const isOutOfStock = stock <= 0;
                  const isLowStock = stock > 0 && stock <= (p.minStock || 0);
                  const isSelected = selectedIds.includes(p.id);

                  const marginPct =
                    p.purchasePrice && p.purchasePrice > 0
                      ? Math.round(((p.price - p.purchasePrice) / p.purchasePrice) * 100)
                      : null;

                  return (
                    <tr
                      key={p.id}
                      onClick={() => handleOpenEdit(p)}
                      className={`hover:bg-blue-50/60 dark:hover:bg-slate-800/60 cursor-pointer transition group ${
                        isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                      } ${
                        isArchived ? 'opacity-65 bg-slate-50/50 dark:bg-slate-900/40 text-slate-500' : ''
                      }`}
                      title="Кликните для редактирования карточки товара"
                    >
                      {/* Selection Checkbox */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => toggleSelect(p.id, e as any)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                        />
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`p-1.5 rounded-lg transition shrink-0 ${
                              isArchived
                                ? 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                                : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-100 text-slate-500 group-hover:text-blue-600'
                            }`}
                          >
                            <Package className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span
                              className={`font-bold transition truncate block text-xs sm:text-sm hover:underline cursor-pointer ${
                                isArchived
                                  ? 'text-slate-500 line-through'
                                  : 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300'
                              }`}
                            >
                              {p.name}
                            </span>
                            {p.primarySupplierName && (
                              <span className="text-[10px] text-slate-400 block truncate">
                                Поставщик: {p.primarySupplierName}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {p.category || 'Общее'}
                        </span>
                      </td>

                      {/* Barcode */}
                      <td className="py-3 px-3">
                        {p.barcode ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md">
                            <Barcode className="w-3.5 h-3.5 text-slate-400" />
                            {p.barcode}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Purchase Price */}
                      <td className="py-3 px-3 text-right font-mono font-semibold text-slate-600 dark:text-slate-300">
                        {p.purchasePrice !== undefined ? `${p.purchasePrice.toLocaleString('ru-RU')} ₽` : '—'}
                      </td>

                      {/* Sale Price */}
                      <td className="py-3 px-3 text-right">
                        <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                          {p.price.toLocaleString('ru-RU')} ₽
                        </div>
                        {marginPct !== null && (
                          <span className="text-[10px] font-bold text-emerald-600 block">
                            +{marginPct}%
                          </span>
                        )}
                      </td>

                      {/* Unit */}
                      <td className="py-3 px-3 text-center">
                        <span className="text-xs font-bold text-slate-500 font-mono">
                          {unit}
                        </span>
                      </td>

                      {/* Stock Quantity */}
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${
                            isOutOfStock
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : isLowStock
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          }`}
                        >
                          {stock} {unit}
                        </span>
                        {isLowStock && (
                          <span className="block text-[9px] font-bold text-amber-600 mt-0.5">
                            Мин: {p.minStock} {unit}
                          </span>
                        )}
                      </td>

                      {/* Archive Status Toggle Badge */}
                      <td className="py-3 px-3 text-center">
                        {isArchived ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            В архиве
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Активен
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {/* Soft Delete (Archive) or Restore */}
                          <button
                            type="button"
                            onClick={(e) => handleToggleArchive(e, p)}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              isArchived
                                ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                            }`}
                            title={isArchived ? 'Восстановить из архива (сделать активным)' : 'Перенести в архив (soft delete)'}
                          >
                            {isArchived ? <RefreshCw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                          </button>

                          {/* Quick Merge with another product */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMergeInitialA(p);
                              setMergeInitialB(null);
                              setIsMergeModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition cursor-pointer"
                            title="Слияние с дублем"
                          >
                            <GitMerge className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition cursor-pointer"
                            title="Редактировать товар"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Permanent Delete only for archived positions */}
                          {isArchived && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteProduct(e, p)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                              title="Удалить из базы навсегда"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* SLIDE-OVER DRAWER FOR ADDING / EDITING PRODUCT */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-60 overflow-hidden animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
              {/* Header */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-600 rounded-xl">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">
                      {editingProduct ? 'Редактирование товара' : 'Новый товар в номенклатуре'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {editingProduct ? `ID: ${editingProduct.id.slice(0, 10)}...` : 'Заполните параметры позиции'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-4 space-y-4">
                {formError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-xl text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}
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
                    placeholder="Например: Кофе в зернах Lavazza 1кг"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    autoFocus
                  />
                </div>

                {/* 2. Group / Category */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Группа (Категория)</label>
                    <button
                      type="button"
                      onClick={() => setIsCustomCategory(!isCustomCategory)}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800"
                    >
                      {isCustomCategory ? 'Выбрать из списка' : '+ Новая группа'}
                    </button>
                  </div>

                  {isCustomCategory ? (
                    <input
                      type="text"
                      value={customCategoryInput}
                      onChange={(e) => setCustomCategoryInput(e.target.value)}
                      placeholder="Введите название новой группы..."
                      className="w-full px-3 py-2 text-xs bg-white border border-blue-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  ) : (
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      <option value="Общее">Общее</option>
                      {categories
                        .filter((c) => c !== 'Общее')
                        .map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                {/* 3. Barcode with auto-generate button */}
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
                      className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition shrink-0"
                      title="Сгенерировать случайный штрихкод EAN-13"
                    >
                      Сгенерировать
                    </button>
                  </div>
                </div>

                {/* 4. Price & Purchase Price */}
                <div className="grid grid-cols-2 gap-3">
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
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                </div>

                {/* 5. Unit of Measurement */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Единица измерения
                  </label>
                  <div className="grid grid-cols-4 gap-2">
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

                {/* 6. Stock Quantity (if creating new) & Min Stock */}
                <div className="grid grid-cols-2 gap-3">
                  {!editingProduct && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Начальный остаток ({formUnit})
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formStockQuantity}
                        onChange={(e) => setFormStockQuantity(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  <div className={editingProduct ? 'col-span-2' : ''}>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Неснижаемый остаток (Мин. запас)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formMinStock}
                      onChange={(e) => setFormMinStock(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="0"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      При снижении до этой цифры позиция попадет в автозаказ
                    </span>
                  </div>
                </div>

                {/* 7. Primary Supplier */}
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

                {/* 8. Toggles: Hot Keys & Archive Status */}
                <div className="space-y-2 pt-1">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formIsHot}
                        onChange={(e) => setFormIsHot(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          Горячие клавиши на кассе
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          Выносить в верхнюю панель быстрого выбора кассира
                        </span>
                      </div>
                    </label>
                  </div>

                  <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formIsArchived}
                        onChange={(e) => setFormIsArchived(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                      />
                      <div>
                        <span className="text-xs font-bold text-amber-900 block">
                          Находится в архиве
                        </span>
                        <span className="text-[11px] text-amber-700 block">
                          Архивные товары скрыты от кассира в POS-терминале
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Submit / Cancel Buttons */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !formName.trim() || formPrice === ''}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSaving ? 'Сохранение...' : editingProduct ? 'Сохранить изменения' : 'Создать товар'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Merge Duplicate Products Modal */}
      {isMergeModalOpen && (
        <MergeProductsModal
          isOpen={isMergeModalOpen}
          onClose={() => {
            setIsMergeModalOpen(false);
            setMergeInitialA(null);
            setMergeInitialB(null);
          }}
          products={products}
          initialProductA={mergeInitialA}
          initialProductB={mergeInitialB}
          onSuccess={(target, newStock) => {
            setSelectedIds([]);
            setToastMsg({
              type: 'success',
              text: `Слияние успешно завершено! Итоговый остаток «${target.name}»: ${newStock}`,
            });
            setTimeout(() => setToastMsg(null), 4000);
          }}
        />
      )}
    </div>
  );
};
