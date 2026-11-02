import React, { useState, useRef, useEffect } from 'react';
import {
  StoreProduct,
  StoreInventoryDoc,
  InventoryDocType,
  InventoryDocItem,
} from '../../types';
import {
  createAndPostInventoryDoc,
  peekNextDocNumber,
  createProduct,
  updateProduct,
  deleteProduct,
  importProductsFromCsv,
  batchUpdateStockQuantity,
} from '../../services/storeService';
import { useAuth } from '../../context/AuthContext';
import { parseExcelStockImport } from '../../utils/excelImport';
import { recognizeWaybillImage, DraftReceiptItem } from '../../utils/waybillAi';
import { CameraScannerModal } from '../CameraScannerModal';
import { SupplierSelect } from './SupplierSelect';
import { DocumentViewerDrawer } from './DocumentViewerDrawer';
import { ProductCardModal } from './ProductCardModal';
import { InventoryAuditsView } from './InventoryAuditsView';
import { InventoryAuditModal } from './InventoryAuditModal';
import {
  Boxes,
  Plus,
  PackagePlus,
  ArrowDownRight,
  ClipboardCheck,
  Search,
  Filter,
  AlertTriangle,
  Upload,
  Download,
  Trash2,
  CheckCircle2,
  X,
  FileText,
  RotateCcw,
  Sparkles,
  Barcode,
  Scan,
  Camera,
  Truck,
  Calendar,
  Layers,
  ChevronRight,
  Minus,
} from 'lucide-react';

interface InventoryScreenProps {
  products: StoreProduct[];
  inventoryDocs: StoreInventoryDoc[];
  initialTab?: 'stock' | 'receipt' | 'write_off' | 'inventory';
}

export const InventoryScreen: React.FC<InventoryScreenProps> = ({
  products,
  inventoryDocs,
  initialTab,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'stock' | 'receipt' | 'write_off' | 'inventory'>(
    initialTab || 'stock'
  );

  // Search & Filters for "Остатки"
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Все');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  // Modals
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isWriteOffModalOpen, setIsWriteOffModalOpen] = useState(false);
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [isInventoryAuditModalOpen, setIsInventoryAuditModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<StoreInventoryDoc | null>(null);
  const [selectedProductCard, setSelectedProductCard] = useState<{
    id: string;
    name?: string;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  // Categories
  const categories = ['Все', ...Array.from(new Set(products.map((p) => p.category || 'Общее')))];

  // Filtered products list
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'Все' || p.category === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()));

    let matchesStock = true;
    if (stockFilter === 'low') matchesStock = p.stockQuantity > 0 && p.stockQuantity <= 5;
    if (stockFilter === 'out') matchesStock = p.stockQuantity <= 0;

    return matchesCategory && matchesSearch && matchesStock;
  });

  // Handle CSV Import
  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportSummary(null);
    try {
      const count = await importProductsFromCsv(file);
      setImportSummary(`Успешно импортировано ${count} товаров в каталог!`);
      setTimeout(() => setImportSummary(null), 5000);
    } catch (err: any) {
      alert(`Ошибка импорта: ${err.message}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Excel Stock Import
  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportSummary(null);
    try {
      const rows = await parseExcelStockImport(file);
      const updates: { productId: string; stockQuantity: number }[] = [];

      for (const row of rows) {
        const product = products.find(p => p.name.trim().toLowerCase() === row.name.trim().toLowerCase());
        if (product) {
          updates.push({ productId: product.id, stockQuantity: row.stockQuantity });
        }
      }

      if (updates.length > 0) {
        await batchUpdateStockQuantity(updates);
        setImportSummary(`Остатки успешно обновлены для ${updates.length} товаров.`);
      } else {
        setImportSummary('Товары для обновления не найдены.');
      }
      setTimeout(() => setImportSummary(null), 5000);
    } catch (err: any) {
      alert(`Ошибка импорта Excel: ${err.message}`);
    } finally {
      setIsImporting(false);
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  // Receipts and Write-offs filtered lists
  const receipts = inventoryDocs.filter((d) => d.type === 'receipt');
  const writeOffs = inventoryDocs.filter((d) => d.type === 'write_off');
  const audits = inventoryDocs.filter((d) => d.type === 'inventory');

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Title & Sub-Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Складской учет и Движение товаров
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Оприходование, списания, инвентаризация и контроль фактических остатков
          </p>
        </div>

        {/* Action Buttons for Current Tab */}
        <div className="flex items-center gap-2">
          {activeTab === 'stock' && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCsvFileChange}
                className="hidden"
              />
              <input
                ref={excelInputRef}
                type="file"
                accept=".xls,.xlsx"
                onChange={handleExcelFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition shadow-2xs active:scale-95 disabled:opacity-50"
              >
                <Upload className="w-4 h-4 text-slate-500" />
                <span>{isImporting ? 'Импорт...' : 'Импорт CSV'}</span>
              </button>
              <button
                onClick={() => excelInputRef.current?.click()}
                disabled={isImporting}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition shadow-2xs active:scale-95 disabled:opacity-50"
              >
                <FileText className="w-4 h-4 text-emerald-500" />
                <span>{isImporting ? 'Импорт...' : 'Остатки Excel'}</span>
              </button>

              <button
                onClick={() => setIsNewProductModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Новый товар</span>
              </button>
            </>
          )}

          {activeTab === 'receipt' && (
            <button
              onClick={() => setIsReceiptModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95"
            >
              <PackagePlus className="w-4 h-4" />
              <span>Создать Приемку</span>
            </button>
          )}

          {activeTab === 'write_off' && (
            <button
              onClick={() => setIsWriteOffModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95"
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>Создать Списание</span>
            </button>
          )}

          {activeTab === 'inventory' && (
            <button
              onClick={() => setIsInventoryAuditModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>Провести инвентаризацию</span>
            </button>
          )}
        </div>
      </div>

      {/* CSV Import Success Banner */}
      {importSummary && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{importSummary}</span>
          </div>
          <button onClick={() => setImportSummary(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4 Main Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
            activeTab === 'stock'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Остатки ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('receipt')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
            activeTab === 'receipt'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <PackagePlus className="w-4 h-4 text-emerald-600" />
          <span>Приемка ({receipts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('write_off')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
            activeTab === 'write_off'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ArrowDownRight className="w-4 h-4 text-rose-600" />
          <span>Списания ({writeOffs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
            activeTab === 'inventory'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ClipboardCheck className="w-4 h-4 text-indigo-600" />
          <span>Инвентаризация ({audits.length})</span>
        </button>
      </div>

      {/* TAB 1: ОСТАТКИ (Каталог товаров) */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          {/* Search, Category, and Stock Filters Bar */}
          <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-[260px] relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по названию или штрихкоду..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {/* Category selector */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Stock Filter Chips */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                <button
                  onClick={() => setStockFilter('all')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                    stockFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Все
                </button>
                <button
                  onClick={() => setStockFilter('low')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                    stockFilter === 'low'
                      ? 'bg-amber-100 text-amber-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ≤ 5 шт.
                </button>
                <button
                  onClick={() => setStockFilter('out')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                    stockFilter === 'out'
                      ? 'bg-rose-100 text-rose-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  0 шт.
                </button>
              </div>
            </div>
          </div>

          {/* Table of Products */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-3 px-4">Наименование</th>
                    <th className="py-3 px-3">Категория</th>
                    <th className="py-3 px-3">Штрихкод</th>
                    <th className="py-3 px-3 text-right">Закупка</th>
                    <th className="py-3 px-3 text-right">Продажа</th>
                    <th className="py-3 px-4 text-right">Остаток</th>
                    <th className="py-3 px-4 text-right">Оценка склада</th>
                    <th className="py-3 px-3 text-center">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        Товары не найдены
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isOut = p.stockQuantity <= 0;
                      const isLow = p.stockQuantity > 0 && p.stockQuantity <= 5;
                      const stockValuation = p.stockQuantity * (p.purchasePrice || p.price * 0.7);

                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-slate-50/70 transition ${
                            isOut ? 'bg-rose-50/20' : isLow ? 'bg-amber-50/20' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-bold text-slate-900">
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
                            {p.isHot && (
                              <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700">
                                Горячий
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-500">{p.category || 'Общее'}</td>
                          <td className="py-3 px-3 font-mono text-slate-500">{p.barcode || '—'}</td>
                          <td className="py-3 px-3 text-right font-mono text-slate-600">
                            {p.purchasePrice !== undefined ? `${p.purchasePrice.toLocaleString('ru-RU')} ₽` : '—'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                            {p.price.toLocaleString('ru-RU')} ₽
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isOut ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                0 шт (Нет)
                              </span>
                            ) : isLow ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                                {p.stockQuantity} шт (Мало)
                              </span>
                            ) : (
                              <span className="font-semibold text-slate-800 font-mono">
                                {p.stockQuantity} шт
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-700">
                            {Math.round(stockValuation).toLocaleString('ru-RU')} ₽
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => {
                                if (confirm(`Удалить товар «${p.name}» из каталога?`)) {
                                  deleteProduct(p.id);
                                }
                              }}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 transition"
                              title="Удалить товар"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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

      {/* TAB 2: ПРИЕМКА ТОВАРОВ (Оприходование) */}
      {activeTab === 'receipt' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Документы оприходования (Приемка)</h3>
                <p className="text-xs text-slate-500">
                  Поступления от поставщиков, увеличение остатков склада и обновление цен закупки
                </p>
              </div>
              <button
                onClick={() => setIsReceiptModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
              >
                <PackagePlus className="w-4 h-4" />
                <span>Новая приемка</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-3 px-4">Номер документа</th>
                    <th className="py-3 px-3">Дата</th>
                    <th className="py-3 px-3">Поставщик</th>
                    <th className="py-3 px-3">Автор</th>
                    <th className="py-3 px-4">Позиций</th>
                    <th className="py-3 px-4 text-right">Сумма закупки</th>
                    <th className="py-3 px-4">Комментарий</th>
                    <th className="py-3 px-3 text-center">Статус</th>
                    <th className="py-3 px-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receipts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        Пока нет документов приемки. Нажмите «Создать Приемку», чтобы оприходовать товар.
                      </td>
                    </tr>
                  ) : (
                    receipts.map((doc) => {
                      const docDate = doc.date?.toDate?.()
                        ? doc.date.toDate().toLocaleDateString('ru-RU')
                        : 'Недавно';

                      return (
                        <tr
                          key={doc.id}
                          onClick={() => setSelectedDoc(doc)}
                          className="hover:bg-blue-50/70 cursor-pointer transition group"
                          title="Нажмите для просмотра и редактирования накладной"
                        >
                          <td className="py-3 px-4 font-bold text-slate-900 font-mono group-hover:text-blue-600 transition">
                            {doc.docNumber}
                          </td>
                          <td className="py-3 px-3 text-slate-500">{docDate}</td>
                          <td className="py-3 px-3 font-semibold text-slate-800">
                            {doc.supplier || '—'}
                          </td>
                          <td className="py-3 px-3 text-slate-700">{doc.authorName || 'Сотрудник'}</td>
                          <td className="py-3 px-4 text-slate-600">{doc.items.length} поз.</td>
                          <td className="py-3 px-4 text-right font-black font-mono text-emerald-700">
                            {doc.totalAmount.toLocaleString('ru-RU')} ₽
                          </td>
                          <td className="py-3 px-4 text-slate-500 truncate max-w-xs">
                            {doc.comment || '—'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Проведен
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center text-slate-300 group-hover:text-blue-600 transition">
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

      {/* TAB 3: СПИСАНИЯ ТОВАРОВ */}
      {activeTab === 'write_off' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Документы списания товаров</h3>
                <p className="text-xs text-slate-500">
                  Списание испорченных товаров, брака, утери и расхода на хозяйственные нужды
                </p>
              </div>
              <button
                onClick={() => setIsWriteOffModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
              >
                <ArrowDownRight className="w-4 h-4" />
                <span>Новое списание</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-3 px-4">Номер документа</th>
                    <th className="py-3 px-3">Дата</th>
                    <th className="py-3 px-3">Причина списания</th>
                    <th className="py-3 px-4">Позиций</th>
                    <th className="py-3 px-4 text-right">Сумма списания</th>
                    <th className="py-3 px-4">Комментарий</th>
                    <th className="py-3 px-3 text-center">Статус</th>
                    <th className="py-3 px-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {writeOffs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        Пока нет документов списания.
                      </td>
                    </tr>
                  ) : (
                    writeOffs.map((doc) => {
                      const docDate = doc.date?.toDate?.()
                        ? doc.date.toDate().toLocaleDateString('ru-RU')
                        : 'Недавно';

                      return (
                        <tr
                          key={doc.id}
                          onClick={() => setSelectedDoc(doc)}
                          className="hover:bg-rose-50/70 cursor-pointer transition group"
                          title="Нажмите для просмотра и редактирования списания"
                        >
                          <td className="py-3 px-4 font-bold text-slate-900 font-mono group-hover:text-rose-600 transition">
                            {doc.docNumber}
                          </td>
                          <td className="py-3 px-3 text-slate-500">{docDate}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              {doc.reason || 'Списание'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{doc.items.length} поз.</td>
                          <td className="py-3 px-4 text-right font-black font-mono text-rose-700">
                            {doc.totalAmount.toLocaleString('ru-RU')} ₽
                          </td>
                          <td className="py-3 px-4 text-slate-500 truncate max-w-xs">
                            {doc.comment || '—'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              Проведен
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center text-slate-300 group-hover:text-rose-600 transition">
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

      {/* TAB 4: ИНВЕНТАРИЗАЦИЯ (Сверка и фиксация остатков) */}
      {activeTab === 'inventory' && (
        <InventoryAuditsView
          products={products}
          inventoryDocs={inventoryDocs}
          authorName={user?.displayName || 'Администратор'}
          authorId={user?.uid}
        />
      )}

      {/* Modals */}
      {isReceiptModalOpen && (
        <CreateReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          products={products}
          authorName={user?.displayName || 'Администратор'}
          authorId={user?.uid || ''}
          onOpenProductCard={(id, name) => setSelectedProductCard({ id, name })}
        />
      )}

      {isWriteOffModalOpen && (
        <CreateWriteOffModal
          isOpen={isWriteOffModalOpen}
          onClose={() => setIsWriteOffModalOpen(false)}
          products={products}
          authorName={user?.displayName || 'Администратор'}
          authorId={user?.uid || ''}
          onOpenProductCard={(id, name) => setSelectedProductCard({ id, name })}
        />
      )}

      {isNewProductModalOpen && (
        <CreateProductModal
          isOpen={isNewProductModalOpen}
          onClose={() => setIsNewProductModalOpen(false)}
        />
      )}

      {/* New Inventory Audit Modal */}
      {isInventoryAuditModalOpen && (
        <InventoryAuditModal
          isOpen={isInventoryAuditModalOpen}
          onClose={() => setIsInventoryAuditModalOpen(false)}
          auditDoc={null}
          products={products}
          authorName={user?.displayName || 'Администратор'}
          authorId={user?.uid}
        />
      )}

      {/* Slide-over Document Viewer & Editor with Atomic Stock Sync */}
      <DocumentViewerDrawer
        isOpen={!!selectedDoc}
        onClose={() => setSelectedDoc(null)}
        doc={selectedDoc}
        products={products}
      />

      {/* Product Card Modal on clicking product name */}
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

/* =========================================================================
   HELPER: Audio beep on barcode scan
========================================================================= */
const playBeepSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.12;
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    }
  } catch (_) {}
};

/* =========================================================================
   MODAL: Product Search & Scan (Модалка добавления товаров в стиле МойСклад)
========================================================================= */
interface ProductSearchAndScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: StoreProduct[];
  onAddProduct: (item: {
    productId: string;
    name: string;
    barcode?: string;
    qty: number;
    price: number;
  }) => void;
  mode: 'receipt' | 'write_off';
}

const ProductSearchAndScanModal: React.FC<ProductSearchAndScanModalProps> = ({
  isOpen,
  onClose,
  products,
  onAddProduct,
  mode,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [keepOpen, setKeepOpen] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [qtyInput, setQtyInput] = useState(1);
  const [priceInput, setPriceInput] = useState(0);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [scanNotification, setScanNotification] = useState<string | null>(null);

  // Live product from realtime subscription
  const liveSelectedProduct = selectedProduct
    ? products.find((p) => p.id === selectedProduct.id) || selectedProduct
    : null;

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when modal opens or after adding
  useEffect(() => {
    if (isOpen && !selectedProduct) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, selectedProduct]);

  // When a product is picked, initialize default inputs
  const handlePickProduct = (product: StoreProduct) => {
    setSelectedProduct(product);
    setQtyInput(1);
    if (mode === 'receipt') {
      setPriceInput(product.purchasePrice || Math.round(product.price * 0.7));
    } else {
      setPriceInput(product.purchasePrice || product.price);
    }
  };

  // Barcode scanner matching handler
  const handleBarcodeScanned = (barcode: string) => {
    const clean = barcode.trim();
    if (!clean) return;

    const found = products.find(
      (p) => p.barcode && p.barcode.toLowerCase() === clean.toLowerCase()
    );

    if (found) {
      playBeepSound();
      setScanNotification(`Товар найден: ${found.name}`);
      setTimeout(() => setScanNotification(null), 3000);
      handlePickProduct(found);
    } else {
      setScanNotification(`Товар со штрихкодом "${clean}" не найден в базе`);
      setTimeout(() => setScanNotification(null), 4000);
    }
  };

  // Hardware scanner listener (fast keystroke buffer)
  useEffect(() => {
    if (!isOpen) return;

    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in price or qty inputs
      const activeEl = document.activeElement;
      if (
        activeEl &&
        activeEl.tagName === 'INPUT' &&
        (activeEl.getAttribute('type') === 'number' || (activeEl as HTMLInputElement).name === 'qtyOrPrice')
      ) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTime;
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          e.preventDefault();
          handleBarcodeScanned(buffer);
        }
        buffer = '';
        return;
      }

      if (e.key.length === 1) {
        if (timeDiff > 80) {
          buffer = e.key;
        } else {
          buffer += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, products, mode]);

  // Filter products by search query
  const filtered = products.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const matchesName = p.name.toLowerCase().includes(q);
    const matchesBarcode = p.barcode ? p.barcode.toLowerCase().includes(q) : false;
    const matchesCategory = p.category ? p.category.toLowerCase().includes(q) : false;
    return matchesName || matchesBarcode || matchesCategory;
  });

  const handleConfirmAdd = () => {
    if (!selectedProduct || qtyInput <= 0) return;

    onAddProduct({
      productId: selectedProduct.id,
      name: selectedProduct.name,
      barcode: selectedProduct.barcode,
      qty: qtyInput,
      price: priceInput,
    });

    if (keepOpen) {
      setSelectedProduct(null);
      setSearchQuery('');
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSelectedProduct(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col h-[92vh] max-h-[800px]">
          {/* Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-600 rounded-xl text-white">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">
                  {mode === 'receipt' ? 'Выбор товаров для приемки' : 'Выбор товаров для списания'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Поиск по названию, штрихкоду или сканирование сканером
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Keep open toggle */}
              <label className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer select-none bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700">
                <input
                  type="checkbox"
                  checked={keepOpen}
                  onChange={(e) => setKeepOpen(e.target.checked)}
                  className="rounded text-blue-500 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span>Не закрывать после добавления</span>
              </label>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search bar with camera scan button */}
          <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50 shrink-0 space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по наименованию или штрихкоду..."
                  className="w-full pl-9 pr-9 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Barcode Camera Scanner Button */}
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition shadow-sm shrink-0 active:scale-95"
                title="Сканировать штрихкод камерой смартфона"
              >
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline">Камера</span>
              </button>
            </div>

            {/* Mobile keep-open toggle */}
            <div className="sm:hidden flex items-center justify-between text-xs text-slate-600 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={keepOpen}
                  onChange={(e) => setKeepOpen(e.target.checked)}
                  className="rounded text-blue-500 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span>Не закрывать окно после добавления</span>
              </label>
              <span className="text-[11px] text-slate-400">Найдено: {filtered.length}</span>
            </div>

            {/* Scan Notification */}
            {scanNotification && (
              <div className="p-2 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs font-semibold flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-2">
                  <Scan className="w-4 h-4 text-blue-600 animate-pulse" />
                  <span>{scanNotification}</span>
                </div>
                <button
                  onClick={() => setScanNotification(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Products List Area */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
            {filtered.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <Boxes className="w-12 h-12 mb-2 text-slate-300" />
                <p className="text-sm font-bold text-slate-600">Товары не найдены</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Проверьте запрос или отсканируйте штрихкод на упаковке товара
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {filtered.map((prod) => {
                  return (
                    <div
                      key={prod.id}
                      onClick={() => handlePickProduct(prod)}
                      className="group p-3 bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 rounded-xl transition cursor-pointer flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-blue-600 transition">
                            {prod.name}
                          </span>
                          {prod.category && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {prod.category}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
                          {prod.barcode ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                              <Barcode className="w-3 h-3 text-slate-400" />
                              {prod.barcode}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">Без штрихкода</span>
                          )}

                          {/* Stock Tag in Green */}
                          <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                            В наличии: {prod.stockQuantity} шт.
                          </span>

                          <span className="text-slate-600 font-mono">
                            {mode === 'receipt' ? (
                              <>
                                Закупка:{' '}
                                <strong className="text-slate-800">
                                  {prod.purchasePrice !== undefined
                                    ? `${prod.purchasePrice} ₽`
                                    : '—'}
                                </strong>{' '}
                                | Продажа: {prod.price} ₽
                              </>
                            ) : (
                              <>Цена: {prod.purchasePrice || prod.price} ₽</>
                            )}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePickProduct(prod);
                        }}
                        className="px-3 py-1.5 bg-blue-50 group-hover:bg-blue-500 text-blue-600 group-hover:text-white rounded-lg text-xs font-bold transition shrink-0 flex items-center gap-1 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Выбрать</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer close button */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
            <span>Всего товаров в каталоге: {products.length}</span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition"
            >
              Закрыть окно
            </button>
          </div>
        </div>
      </div>

      {/* Mini Dialog for Quantity & Price when a product is clicked */}
      {liveSelectedProduct && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-4 bg-blue-600 text-white flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-blue-200 font-bold block">
                  {mode === 'receipt' ? 'Приемка позиции' : 'Списание позиции'}
                </span>
                <h4 className="font-bold text-sm truncate max-w-xs">{liveSelectedProduct.name}</h4>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1 rounded-lg text-blue-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Product Info Card with Live Real-time Stock */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Штрихкод / Артикул:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {liveSelectedProduct.barcode || '—'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[11px]">Текущий остаток:</span>
                  <span className="font-bold text-emerald-600 font-mono">
                    {liveSelectedProduct.stockQuantity} шт.
                  </span>
                </div>
              </div>

              {/* Quantity Input with - / + buttons and quick pills */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  {mode === 'receipt' ? 'Пришедшее количество (шт) *' : 'Списываемое количество (шт) *'}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQtyInput((q) => Math.max(1, q - 1))}
                    className="w-11 h-11 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition active:scale-95"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    name="qtyOrPrice"
                    value={qtyInput}
                    onChange={(e) => setQtyInput(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 h-11 text-center text-lg font-bold font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setQtyInput((q) => q + 1)}
                    className="w-11 h-11 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition active:scale-95"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Add Pills */}
                <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar">
                  {[1, 5, 10, 20, 50, 100].map((step) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setQtyInput((q) => q + step)}
                      className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                    >
                      +{step}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setQtyInput(1)}
                    className="px-2 py-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 rounded-lg transition ml-auto"
                  >
                    Сброс (1)
                  </button>
                </div>
              </div>

              {/* Purchase Price Input (for receipt) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  {mode === 'receipt' ? 'Закупочная цена за 1 шт. (₽) *' : 'Себестоимость за 1 шт. (₽)'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="qtyOrPrice"
                    value={priceInput}
                    onChange={(e) => setPriceInput(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2.5 text-sm font-mono font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                    ₽
                  </span>
                </div>
                {liveSelectedProduct.purchasePrice !== undefined && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Предыдущая закупка: {liveSelectedProduct.purchasePrice} ₽ | Продажа:{' '}
                    {liveSelectedProduct.price} ₽
                  </p>
                )}
              </div>

              {/* Subtotal calculation */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 uppercase">Итого по позиции:</span>
                <span className="text-lg font-black text-blue-900 font-mono">
                  {(qtyInput * priceInput).toLocaleString('ru-RU')} ₽
                </span>
              </div>
            </div>

            {/* Dialog Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmAdd}
                className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить в документ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Barcode Scanner Modal */}
      {isCameraOpen && (
        <CameraScannerModal
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onScan={(scannedBarcode) => {
            setIsCameraOpen(false);
            handleBarcodeScanned(scannedBarcode);
          }}
        />
      )}
    </>
  );
};

/* =========================================================================
   MODAL 1: Create Receipt Document (Приемка товаров в стиле МойСклад)
========================================================================= */
interface CreateReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: StoreProduct[];
  authorName: string;
  authorId: string;
  onOpenProductCard?: (productId: string, fallbackName?: string) => void;
}

const CreateReceiptModal: React.FC<CreateReceiptModalProps> = ({
  isOpen,
  onClose,
  products,
  authorName,
  authorId,
  onOpenProductCard,
}) => {
  const [docNumber, setDocNumber] = useState('Загрузка...');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [supplier, setSupplier] = useState('Основной поставщик');
  const [supplierId, setSupplierId] = useState('');
  const [isPaidImmediately, setIsPaidImmediately] = useState(true);
  const [comment, setComment] = useState('');
  const [items, setItems] = useState<DraftReceiptItem[]>([]);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // AI Waybill Recognition State (Strictly Draft Mode in Component State)
  const [isRecognizingWaybill, setIsRecognizingWaybill] = useState(false);
  const [waybillProgress, setWaybillProgress] = useState<number>(0);
  const [aiDraftBanner, setAiDraftBanner] = useState<{
    matchedCount: number;
    newCount: number;
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const waybillInputRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup progress timer on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // Automatically peek sequential doc number on open
  useEffect(() => {
    if (isOpen) {
      peekNextDocNumber('receipt').then((num) => {
        setDocNumber(num);
      });
    }
  }, [isOpen]);

  // Handle AI Recognition from Waybill Photo (Draft-Only: populates form fields in state)
  const handleWaybillFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    setIsRecognizingWaybill(true);
    setWaybillProgress(5);
    setAiError(null);
    setAiDraftBanner(null);

    // Smoothly simulate progress up to 85% over ~2-2.5 seconds while waiting for AI response
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

      // Immediately jump to 100% and populate fields
      setWaybillProgress(100);

      // Populate draft form fields in component state WITHOUT saving to Firebase
      if (result.date) {
        setDate(result.date);
      }
      if (result.supplier) {
        setSupplier(result.supplier);
        setSupplierId(''); // SupplierSelect will match or create when user reviews
      }
      if (result.waybillNumber) {
        setComment((prev) =>
          prev
            ? `${prev} | Накладная ${result.waybillNumber}`
            : `Накладная ${result.waybillNumber}`
        );
      }

      if (result.items.length > 0) {
        setItems(result.items);
        setAiDraftBanner({
          matchedCount: result.matchedCount,
          newCount: result.newCount,
        });
      } else {
        setAiError('На фото не удалось обнаружить товарные позиции. Попробуйте более четкое фото.');
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (err: any) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setAiError(err?.message || 'Не удалось распознать накладную по фото.');
    } finally {
      setIsRecognizingWaybill(false);
      setWaybillProgress(0);
      if (waybillInputRef.current) {
        waybillInputRef.current.value = '';
      }
    }
  };

  const handleAddProductFromModal = (newItem: {
    productId: string;
    name: string;
    barcode?: string;
    qty: number;
    price: number;
  }) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.productId === newItem.productId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          qty: copy[idx].qty + newItem.qty,
          price: newItem.price, // update to latest purchase price
        };
        return copy;
      }
      return [...prev, { ...newItem, isNew: false }];
    });
  };

  const handleUpdateItemName = (productId: string, newName: string) => {
    setItems((prev) =>
      prev.map((it) => (it.productId === productId ? { ...it, name: newName } : it))
    );
  };

  const handleUpdateItemQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(productId);
      return;
    }
    setItems((prev) =>
      prev.map((it) => (it.productId === productId ? { ...it, qty: newQty } : it))
    );
  };

  const handleUpdateItemPrice = (productId: string, newPrice: number) => {
    const cleanPrice = Math.max(0, newPrice);
    setItems((prev) =>
      prev.map((it) => {
        if (it.productId !== productId) return it;
        // For new items, recalculate retail sellPrice = purchasePrice + 25% automatically
        const nextSellPrice = it.isNew ? Math.round(cleanPrice * 1.25) : it.sellPrice;
        return {
          ...it,
          price: cleanPrice,
          sellPrice: nextSellPrice,
        };
      })
    );
  };

  const handleUpdateItemSellPrice = (productId: string, newSellPrice: number) => {
    setItems((prev) =>
      prev.map((it) =>
        it.productId === productId ? { ...it, sellPrice: Math.max(0, newSellPrice) } : it
      )
    );
  };

  const handleRemoveItem = (productId: string) => {
    setItems((prev) => prev.filter((it) => it.productId !== productId));
  };

  const totalAmount = items.reduce((sum, it) => sum + it.qty * it.price, 0);
  const totalQty = items.reduce((sum, it) => sum + it.qty, 0);

  const handleSaveAndPost = async () => {
    if (items.length === 0) {
      alert('Добавьте хотя бы один товар в документ приемки.');
      return;
    }
    setSubmitting(true);
    try {
      // 1. Create any new (unmatched) products in store_products first upon manual save
      const resolvedItems: InventoryDocItem[] = [];
      for (const it of items) {
        let finalProductId = it.productId;
        const cleanItemName = it.name.trim() || 'Новый товар';

        if (it.isNew || it.productId.startsWith('new_')) {
          const sellPrice =
            it.sellPrice !== undefined && it.sellPrice > 0
              ? it.sellPrice
              : Math.round(it.price * 1.25);

          finalProductId = await createProduct({
            name: cleanItemName,
            price: sellPrice,
            purchasePrice: it.price,
            stockQuantity: 0, // will be incremented atomically by createAndPostInventoryDoc
            barcode: it.barcode || '',
            category: 'Общее',
            unit: 'шт',
            primarySupplierId: supplierId || undefined,
            primarySupplierName: supplier.trim() || undefined,
          });
        }

        resolvedItems.push({
          productId: finalProductId,
          name: cleanItemName,
          barcode: it.barcode,
          qty: it.qty,
          price: it.price,
          total: it.qty * it.price,
        });
      }

      // 2. Post the receipt inventory document
      const postedNumber = await createAndPostInventoryDoc({
        type: 'receipt',
        status: 'posted',
        date: new Date(date).toISOString(),
        authorId,
        authorName,
        supplier: supplier.trim() || 'Основной поставщик',
        supplierId: supplierId || undefined,
        isPaidImmediately,
        comment: comment.trim(),
        items: resolvedItems,
        totalAmount,
      });
      alert(`Документ ${postedNumber} успешно сохранен и проведен! Остатки товаров увеличены.`);
      onClose();
    } catch (err: any) {
      alert(`Ошибка проведения документа: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto touch-pan-y flex items-start sm:items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col my-auto max-h-[94dvh] sm:h-[92vh] sm:max-h-[880px]">
          {/* Header */}
          <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-600 rounded-xl text-white">
                <PackagePlus className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-sm sm:text-base">Приемка товаров (Оприходование)</h3>
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    {docNumber}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  Строгая последовательная нумерация, ИИ-распознавание накладных и оприходование
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Hidden file input for Waybill Photo Recognition */}
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
                className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer border border-indigo-400/30"
                title="Загрузить фото бумажной накладной для автоматического заполнения черновика"
              >
                {isRecognizingWaybill ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                    <span className="font-mono">Распознавание... {Math.round(waybillProgress)}%</span>
                  </>
                ) : (
                  <span>📷 Сфотографировать/Загрузить накладную</span>
                )}
              </button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Body (Unlocks full page/modal scroll on mobile even while AI is thinking!) */}
          <div className="flex-1 overflow-y-auto min-h-0 touch-pan-y overscroll-y-contain">
            {/* Non-blocking Progress Bar Banner while AI Vision is processing */}
            {isRecognizingWaybill && (
              <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-200 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
                    <div>
                      <div className="text-xs font-black text-indigo-950 flex items-center gap-2">
                        <span>Распознавание накладной...</span>
                        <span className="font-mono text-indigo-700">{Math.round(waybillProgress)}%</span>
                      </div>
                      <div className="text-[11px] text-indigo-700">
                        Вы можете свободно прокручивать страницу и заполнять поля, пока ИИ обрабатывает фото
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 shrink-0">
                    {Math.round(waybillProgress)}%
                  </span>
                </div>
                <progress
                  value={Math.round(waybillProgress)}
                  max={100}
                  className="w-full h-2 rounded-full overflow-hidden block [&::-webkit-progress-bar]:bg-indigo-200/70 [&::-webkit-progress-value]:bg-indigo-600 [&::-webkit-progress-value]:transition-all [&::-webkit-progress-value]:duration-150 [&::-moz-progress-bar]:bg-indigo-600"
                />
              </div>
            )}

            {/* AI Recognition Error Banner */}
            {aiError && (
              <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200 flex items-center justify-between gap-2 text-xs text-rose-800 font-semibold">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{aiError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAiError(null)}
                  className="text-rose-400 hover:text-rose-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* AI Draft Mode Confirmation Banner */}
            {aiDraftBanner && (
              <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-950">
                <div className="flex items-center gap-2 flex-wrap">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-bold">Режим черновика (ИИ-распознавание):</span>
                  <span>
                    Найдено в базе: <strong>{aiDraftBanner.matchedCount} поз.</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Новых товаров (авто-наценка +25%):{' '}
                    <strong className="text-indigo-700">{aiDraftBanner.newCount} поз.</strong>
                  </span>
                  <span className="text-[11px] text-amber-800">
                    — Проверьте данные глазами и нажмите «Сохранить приемку» для записи в базу.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAiDraftBanner(null)}
                  className="text-amber-500 hover:text-amber-800 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Document Metadata Form */}
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {/* Document Sequential Number */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Номер документа
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={docNumber}
                      readOnly
                      className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-300 rounded-xl font-mono font-bold text-slate-700 cursor-not-allowed select-none"
                      title="Номер присваивается строго последовательно через счетчик Firestore"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                      Авто
                    </span>
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Дата приемки *
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                    />
                  </div>
                </div>

                {/* Supplier */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Поставщик * (Умный поиск / создание)
                  </label>
                  <SupplierSelect
                    value={supplier}
                    onChange={(val) => setSupplier(val)}
                    onSupplierIdChange={(id) => setSupplierId(id)}
                    selectedSupplierId={supplierId}
                    placeholder="Начните вводить название поставщика..."
                    required
                  />
                </div>
              </div>

              {/* Payment & Debt Mode Selector: В долг / Оплачено из кассы */}
              <div className="mt-3 p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Условия расчета с поставщиком *
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {isPaidImmediately ? 'Списание из кассы' : 'Начисление в задолженность'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPaidImmediately(false)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                      !isPaidImmediately
                        ? 'bg-rose-50 text-rose-800 border-rose-300 ring-2 ring-rose-400/30'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                        !isPaidImmediately ? 'border-rose-600' : 'border-slate-400'
                      }`}>
                        {!isPaidImmediately && <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />}
                      </span>
                      <span>В долг (отсрочка)</span>
                    </div>
                    <span className="text-[10px] font-semibold text-rose-600 bg-rose-100/70 px-1.5 py-0.5 rounded">
                      +К долгу
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPaidImmediately(true)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                      isPaidImmediately
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-400/30'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                        isPaidImmediately ? 'border-emerald-600' : 'border-slate-400'
                      }`}>
                        {isPaidImmediately && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />}
                      </span>
                      <span>Оплачено из кассы</span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                      Касса (Изъятие)
                    </span>
                  </button>
                </div>

                {!isPaidImmediately ? (
                  <div className="text-[11px] text-rose-700 bg-rose-50/70 border border-rose-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>
                      Сумма приемки (<strong>{totalAmount.toLocaleString('ru-RU')} ₽</strong>) увеличит долг перед поставщиком «{supplier || 'Основной поставщик'}».
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-emerald-700 bg-emerald-50/70 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                    <span>✓</span>
                    <span>
                      Долг поставщику НЕ увеличится. Из открытой кассовой смены автоматически спишется сумма <strong>{totalAmount.toLocaleString('ru-RU')} ₽</strong> (Изъятие: Оплата поставщику).
                    </span>
                  </div>
                )}
              </div>

              {/* Comment / Waybill reference */}
              <div className="mt-2.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Примечание / Номер накладной поставщика
                </label>
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Входящая накладная №1234 от поставщика, комментарии к партии..."
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Items List Table & Prominent Action Buttons */}
            <div className="p-4 space-y-3">
              {/* Table of Added Positions */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-600 uppercase font-bold border-b border-slate-200 select-none">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center text-slate-400">#</th>
                      <th className="py-2.5 px-3">Наименование и статус сопоставления</th>
                      <th className="py-2.5 px-3 text-center w-36">Кол-во</th>
                      <th className="py-2.5 px-3 text-right w-32">Цена закупки</th>
                      <th className="py-2.5 px-3 text-right w-32">Цена продажи</th>
                      <th className="py-2.5 px-3 text-right w-32">Сумма закупки</th>
                      <th className="py-2.5 px-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                            <PackagePlus className="w-10 h-10 text-slate-300 mb-2 stroke-1" />
                            <p className="font-bold text-sm text-slate-600">
                              В документе еще нет позиций
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              Загрузите фото бумажной накладной для автозаполнения через ИИ или добавьте товары вручную из каталога
                            </p>
                            <button
                              type="button"
                              disabled={isRecognizingWaybill}
                              onClick={() => waybillInputRef.current?.click()}
                              className="mt-3 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                            >
                              {isRecognizingWaybill ? (
                                <>
                                  <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
                                  <span className="font-mono">Распознавание... {Math.round(waybillProgress)}%</span>
                                </>
                              ) : (
                                <span>📷 Сфотографировать/Загрузить накладную</span>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                    items.map((it, idx) => (
                      <tr
                        key={it.productId}
                        className={`hover:bg-slate-50/70 transition ${
                          it.isNew ? 'bg-indigo-50/30' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            {it.isNew ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                ✨ Новый товар (будет создан, розница +25%)
                              </span>
                            ) : (
                              <>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  ✓ Найден в базе
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onOpenProductCard?.(it.productId, it.name)}
                                  className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer text-xs text-left transition"
                                  title="Открыть карточку товара"
                                >
                                  {it.name}
                                </button>
                              </>
                            )}
                            {it.barcode && (
                              <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {it.barcode}
                              </span>
                            )}
                          </div>

                          <input
                            type="text"
                            value={it.name}
                            onChange={(e) => handleUpdateItemName(it.productId, e.target.value)}
                            className="w-full font-bold text-slate-900 bg-white border border-slate-200 focus:border-blue-500 rounded-lg px-2 py-1 text-xs focus:outline-none"
                            title="Можно подкорректировать название перед сохранением"
                          />

                          {it.recognizedName && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              В накладной: «{it.recognizedName}»
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(it.productId, it.qty - 1)}
                              className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:bg-slate-200 transition"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={it.qty}
                              onChange={(e) =>
                                handleUpdateItemQty(it.productId, parseInt(e.target.value) || 1)
                              }
                              className="w-12 text-center text-xs font-bold font-mono bg-white rounded border border-slate-300 py-0.5"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(it.productId, it.qty + 1)}
                              className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:bg-slate-200 transition"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="relative inline-block w-24">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={it.price}
                              onChange={(e) =>
                                handleUpdateItemPrice(
                                  it.productId,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full text-right text-xs font-bold font-mono py-1 px-2 pr-5 bg-white border border-slate-300 rounded-lg"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">
                              ₽
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {it.isNew ? (
                            <div className="relative inline-block w-24">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={it.sellPrice ?? Math.round(it.price * 1.25)}
                                onChange={(e) =>
                                  handleUpdateItemSellPrice(
                                    it.productId,
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-full text-right text-xs font-bold font-mono py-1 px-2 pr-5 bg-indigo-50/60 border border-indigo-300 text-indigo-950 rounded-lg"
                                title="Автоматическая цена продажи: закупка + 25%"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 font-bold text-[10px]">
                                ₽
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs font-mono text-slate-500">
                              {it.sellPrice !== undefined
                                ? `${it.sellPrice.toLocaleString('ru-RU')} ₽`
                                : '—'}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black font-mono text-slate-900">
                          {(it.qty * it.price).toLocaleString('ru-RU')} ₽
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.productId)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Удалить позицию"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

              {/* Action buttons below table: Add Position & Upload Waybill Photo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsSearchModalOpen(true)}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-600 active:scale-[0.99] text-white font-bold rounded-xl shadow-sm text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Добавить позицию (Поиск и сканирование)</span>
                </button>

                <button
                  type="button"
                  disabled={isRecognizingWaybill}
                  onClick={() => waybillInputRef.current?.click()}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-sm text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  {isRecognizingWaybill ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                      <span className="font-mono">Распознавание... {Math.round(waybillProgress)}%</span>
                    </>
                  ) : (
                    <span>📷 Сфотографировать/Загрузить накладную</span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Fixed Bottom Bar: Summary & Save Receipt Button */}
          <div className="p-4 bg-white border-t border-slate-200 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div>
              <span className="text-[11px] uppercase font-bold text-slate-500 block">
                Всего позиций: {items.length} ({totalQty} шт.)
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
                ИТОГО: {totalAmount.toLocaleString('ru-RU')} ₽
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Отмена
              </button>

              <button
                type="button"
                onClick={handleSaveAndPost}
                disabled={submitting || isRecognizingWaybill || items.length === 0}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-black transition shadow-md flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{submitting ? 'Сохранение...' : 'Сохранить приемку'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Child Search & Scan Modal */}
      {isSearchModalOpen && (
        <ProductSearchAndScanModal
          isOpen={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
          products={products}
          onAddProduct={handleAddProductFromModal}
          mode="receipt"
        />
      )}
    </>
  );
};

/* =========================================================================
   MODAL 2: Create Write-off Document (Списание товаров с поиском и сканером)
========================================================================= */
interface CreateWriteOffModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: StoreProduct[];
  authorName: string;
  authorId: string;
  onOpenProductCard?: (productId: string, fallbackName?: string) => void;
}

const CreateWriteOffModal: React.FC<CreateWriteOffModalProps> = ({
  isOpen,
  onClose,
  products,
  authorName,
  authorId,
  onOpenProductCard,
}) => {
  const [docNumber, setDocNumber] = useState('Загрузка...');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('Порча / Истек срок годности');
  const [comment, setComment] = useState('');
  const [items, setItems] = useState<
    { productId: string; name: string; qty: number; price: number; barcode?: string }[]
  >([]);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Automatically peek sequential doc number on open
  useEffect(() => {
    if (isOpen) {
      peekNextDocNumber('write_off').then((num) => {
        setDocNumber(num);
      });
    }
  }, [isOpen]);

  const handleAddProductFromModal = (newItem: {
    productId: string;
    name: string;
    barcode?: string;
    qty: number;
    price: number;
  }) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.productId === newItem.productId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          qty: copy[idx].qty + newItem.qty,
        };
        return copy;
      }
      return [...prev, newItem];
    });
  };

  const handleUpdateItemQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      setItems((prev) => prev.filter((it) => it.productId !== productId));
      return;
    }
    setItems((prev) =>
      prev.map((it) => (it.productId === productId ? { ...it, qty: newQty } : it))
    );
  };

  const handleRemoveItem = (productId: string) => {
    setItems((prev) => prev.filter((it) => it.productId !== productId));
  };

  const totalAmount = items.reduce((sum, it) => sum + it.qty * it.price, 0);
  const totalQty = items.reduce((sum, it) => sum + it.qty, 0);

  const handleSaveAndPost = async () => {
    if (items.length === 0) {
      alert('Добавьте позиции для списания.');
      return;
    }
    setSubmitting(true);
    try {
      const postedNumber = await createAndPostInventoryDoc({
        type: 'write_off',
        status: 'posted',
        date: new Date(date).toISOString(),
        authorId,
        authorName,
        reason,
        comment: comment.trim(),
        items: items.map((it) => ({
          productId: it.productId,
          name: it.name,
          barcode: it.barcode,
          qty: it.qty,
          price: it.price,
          total: it.qty * it.price,
        })),
        totalAmount,
      });
      alert(`Списание ${postedNumber} успешно проведено! Остатки товаров списаны.`);
      onClose();
    } catch (err: any) {
      alert(`Ошибка проведения списания: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col h-[94vh] max-h-[850px]">
          {/* Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-600 rounded-xl text-white">
                <ArrowDownRight className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-sm sm:text-base">Списание товаров</h3>
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    {docNumber}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Списанное количество будет вычтено из фактических остатков склада
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form fields */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Номер документа
                </label>
                <input
                  type="text"
                  value={docNumber}
                  readOnly
                  className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-300 rounded-xl font-mono font-bold text-slate-700 cursor-not-allowed select-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Дата списания
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Причина списания *
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-2xs"
                >
                  <option value="Порча / Истек срок годности">Порча / Истек срок годности</option>
                  <option value="Заводской брак">Заводской брак</option>
                  <option value="Хозяйственные нужды">Хозяйственные нужды</option>
                  <option value="Утеря / Бой при разгрузке">Утеря / Бой при разгрузке</option>
                  <option value="Пересортица">Пересортица</option>
                </select>
              </div>
            </div>

            <div className="mt-2.5">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Комментарий / Обоснование
              </label>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Причина списания, номер акта комиссии..."
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* Table & Blue Button */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-600 uppercase font-bold border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center text-slate-400">#</th>
                    <th className="py-2.5 px-3">Товар и штрихкод</th>
                    <th className="py-2.5 px-3 text-center w-36">Списывается</th>
                    <th className="py-2.5 px-3 text-right w-32">Себестоимость</th>
                    <th className="py-2.5 px-3 text-right w-32">Сумма</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center">
                          <ArrowDownRight className="w-10 h-10 text-slate-300 mb-2 stroke-1" />
                          <p className="font-bold text-sm text-slate-600">Позиции не выбраны</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Нажмите синюю кнопку «Добавить позицию», чтобы выбрать списываемые товары
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => (
                      <tr key={it.productId} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          <button
                            type="button"
                            onClick={() => onOpenProductCard?.(it.productId, it.name)}
                            className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer text-left transition block"
                            title="Открыть карточку товара"
                          >
                            {it.name}
                          </button>
                          {it.barcode && (
                            <span className="block font-mono text-[11px] text-slate-400 mt-0.5 font-normal">
                              {it.barcode}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(it.productId, it.qty - 1)}
                              className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:bg-slate-200 transition"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={it.qty}
                              onChange={(e) =>
                                handleUpdateItemQty(it.productId, parseInt(e.target.value) || 1)
                              }
                              className="w-12 text-center text-xs font-bold font-mono bg-white rounded border border-slate-300 py-0.5 text-rose-600"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(it.productId, it.qty + 1)}
                              className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:bg-slate-200 transition"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {it.price.toLocaleString('ru-RU')} ₽
                        </td>
                        <td className="py-2.5 px-3 text-right font-black font-mono text-rose-600">
                          {(it.qty * it.price).toLocaleString('ru-RU')} ₽
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.productId)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Prominent Full-Width Blue Button */}
            <button
              type="button"
              onClick={() => setIsSearchModalOpen(true)}
              className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 active:scale-[0.99] text-white font-bold rounded-xl shadow-sm text-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>Добавить позицию для списания</span>
            </button>
          </div>

          {/* Sticky Footer */}
          <div className="p-4 bg-white border-t border-slate-200 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div>
              <span className="text-[11px] uppercase font-bold text-slate-500 block">
                Списывается: {items.length} поз. ({totalQty} шт.)
              </span>
              <div className="text-xl sm:text-2xl font-black text-rose-600 font-mono tracking-tight">
                ИТОГО: {totalAmount.toLocaleString('ru-RU')} ₽
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveAndPost}
                disabled={submitting || items.length === 0}
                className="px-6 py-3 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] disabled:opacity-50 text-white rounded-xl text-sm font-black transition shadow-md flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{submitting ? 'Списание...' : 'Провести списание'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {isSearchModalOpen && (
        <ProductSearchAndScanModal
          isOpen={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
          products={products}
          onAddProduct={handleAddProductFromModal}
          mode="write_off"
        />
      )}
    </>
  );
};



/* =========================================================================
   MODAL 3: Create Single Product
========================================================================= */
interface CreateProductModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateProductModal: React.FC<CreateProductModalProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Общее');
  const [barcode, setBarcode] = useState('');
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [price, setPrice] = useState(0);
  const [stockQuantity, setStockQuantity] = useState(0);
  const [minStock, setMinStock] = useState(0);
  const [primarySupplierName, setPrimarySupplierName] = useState('');
  const [primarySupplierId, setPrimarySupplierId] = useState('');
  const [isHot, setIsHot] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      await createProduct({
        name: name.trim(),
        category: category.trim() || 'Общее',
        barcode: barcode.trim() || undefined,
        purchasePrice: purchasePrice || undefined,
        price,
        stockQuantity,
        minStock,
        primarySupplierId: primarySupplierId || undefined,
        primarySupplierName: primarySupplierName || undefined,
        isHot,
        hotColor: isHot ? '#2563eb' : undefined,
      });
      onClose();
    } catch (err: any) {
      alert(`Ошибка создания товара: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="font-bold text-sm">Новый товар в каталог</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Наименование товара *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Кофе в зернах 1кг"
              required
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Категория</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Напитки, Снеки..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Штрихкод</label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="460..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Закупка ₽</label>
              <input
                type="number"
                min="0"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Продажа ₽ *</label>
              <input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                required
                className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Остаток шт</label>
              <input
                type="number"
                min="0"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(parseInt(e.target.value) || 0)}
                className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Мин. остаток (неснижаемый)
              </label>
              <input
                type="number"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0"
                className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
                title="При снижении остатка ниже этой планки система предложит автозаказ"
              />
              <span className="text-[10px] text-slate-400">Порог автозаказа</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Основной поставщик
              </label>
              <SupplierSelect
                value={primarySupplierName}
                onChange={(name) => setPrimarySupplierName(name)}
                onSupplierIdChange={(id) => setPrimarySupplierId(id)}
                selectedSupplierId={primarySupplierId}
                placeholder="Выберите поставщика..."
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isHot}
                onChange={(e) => setIsHot(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-semibold text-slate-700">
                Отображать в блоке «Горячие клавиши» кассы
              </span>
            </label>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
            >
              {submitting ? 'Сохранение...' : 'Добавить товар'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
