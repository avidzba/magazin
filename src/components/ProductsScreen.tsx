import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { StoreProduct } from '../types';
import {
  createProduct,
  updateProduct,
  deleteProduct,
  importProductsBatch,
} from '../services/storeService';
import {
  Package,
  Plus,
  Search,
  Barcode,
  Edit,
  Trash2,
  X,
  PlusCircle,
  MinusCircle,
  Tag,
  Upload,
  Loader2,
  CheckCircle2,
  FileSpreadsheet,
  Flame,
} from 'lucide-react';

interface ProductsScreenProps {
  products: StoreProduct[];
}

export const ProductsScreen: React.FC<ProductsScreenProps> = ({ products }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Все');

  // Edit/Create Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [pName, setPName] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pPurchasePrice, setPPurchasePrice] = useState('');
  const [pStock, setPStock] = useState('0');
  const [pBarcode, setPBarcode] = useState('');
  const [pCategory, setPCategory] = useState('Общее');
  const [pIsHot, setPIsHot] = useState(false);
  const [pHotColor, setPHotColor] = useState('#2563eb');
  const [isSaving, setIsSaving] = useState(false);

  // CSV Import State
  const [isImporting, setIsImporting] = useState(false);
  const [importStatusText, setImportStatusText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const categories = ['Все', ...Array.from(new Set(products.map((p) => p.category || 'Общее')))];

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'Все' || p.category === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const openCreateModal = () => {
    setEditingProduct(null);
    setPName('');
    setPPrice('');
    setPPurchasePrice('');
    setPStock('10');
    setPBarcode('');
    setPCategory('Общее');
    setPIsHot(false);
    setPHotColor('#2563eb');
    setIsModalOpen(true);
  };

  const openEditModal = (p: StoreProduct) => {
    setEditingProduct(p);
    setPName(p.name);
    setPPrice(String(p.price));
    setPPurchasePrice(p.purchasePrice !== undefined ? String(p.purchasePrice) : '');
    setPStock(String(p.stockQuantity));
    setPBarcode(p.barcode || '');
    setPCategory(p.category || 'Общее');
    setPIsHot(!!p.isHot);
    setPHotColor(p.hotColor || '#2563eb');
    setIsModalOpen(true);
  };

  const handleToggleHot = async (e: React.MouseEvent, p: StoreProduct) => {
    e.stopPropagation();
    try {
      await updateProduct(p.id, {
        isHot: !p.isHot,
        hotColor: p.hotColor || '#2563eb',
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName.trim()) return;

    setIsSaving(true);
    try {
      const priceNum = parseFloat(pPrice) || 0;
      const purchasePriceNum = pPurchasePrice ? parseFloat(pPurchasePrice) : undefined;
      const stockNum = parseFloat(pStock) || 0;

      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          name: pName.trim(),
          price: priceNum,
          purchasePrice: purchasePriceNum,
          stockQuantity: stockNum,
          barcode: pBarcode.trim(),
          category: pCategory.trim(),
          isHot: pIsHot,
          hotColor: pHotColor,
        });
        setNotification({ type: 'success', text: 'Товар успешно обновлен' });
      } else {
        await createProduct({
          name: pName.trim(),
          price: priceNum,
          stockQuantity: stockNum,
          barcode: pBarcode.trim(),
          category: pCategory.trim(),
          isHot: pIsHot,
          hotColor: pHotColor,
        });
        setNotification({ type: 'success', text: 'Новый товар добавлен в каталог' });
      }
      setIsModalOpen(false);
    } catch (err) {
      setNotification({
        type: 'error',
        text: err instanceof Error ? err.message : 'Ошибка при сохранении',
      });
    } finally {
      setIsSaving(false);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleStockAdjust = async (product: StoreProduct, delta: number) => {
    const newStock = Math.max(0, product.stockQuantity + delta);
    try {
      await updateProduct(product.id, { stockQuantity: newStock });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteProduct = async (p: StoreProduct) => {
    if (!confirm(`Удалить товар «${p.name}» из каталога?`)) return;
    try {
      await deleteProduct(p.id);
      setNotification({ type: 'success', text: 'Товар удален' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      setNotification({
        type: 'error',
        text: err instanceof Error ? err.message : 'Ошибка при удалении',
      });
    }
  };

  const generateRandomBarcode = () => {
    const code = '460' + Math.floor(1000000 + Math.random() * 9000000);
    setPBarcode(code);
  };

  // Mass CSV Import Logic (МойСклад export support)
  const handleCsvButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const parseNumber = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    // Replace spaces, non-breaking spaces, currency symbols, and convert comma to dot
    const cleanStr = String(val)
      .replace(/\s+/g, '')
      .replace(/₽|руб\.?/gi, '')
      .replace(',', '.');
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatusText('Чтение CSV-файла...');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: async (results) => {
        try {
          const rows = results.data as Record<string, any>[];
          if (!rows || rows.length === 0) {
            throw new Error('Файл CSV пуст или не содержит строк с данными');
          }

          setImportStatusText(`Обработка ${rows.length} строк...`);

          // Flexible header mapping
          const itemsToImport: {
            name: string;
            price: number;
            purchasePrice?: number;
            stockQuantity: number;
            barcode?: string;
            category?: string;
          }[] = [];

          for (const row of rows) {
            // Find key by fuzzy name
            const getVal = (...variants: string[]): string => {
              for (const v of variants) {
                const targetKey = Object.keys(row).find(
                  (k) => k.trim().toLowerCase() === v.toLowerCase()
                );
                if (targetKey && row[targetKey] !== undefined && row[targetKey] !== null) {
                  return String(row[targetKey]).trim();
                }
              }
              return '';
            };

            const name = getVal('Наименование', 'Название', 'Товар', 'name', 'title');
            if (!name) continue; // Skip empty rows

            const barcode = getVal(
              'Артикул',
              'Штрихкод',
              'Штрих-код',
              'Код',
              'barcode',
              'sku'
            );
            const priceRaw = getVal(
              'Цена продажи',
              'Цена',
              'Розничная цена',
              'Цена розница',
              'price'
            );
            const purchasePriceRaw = getVal(
              'Закупочная цена',
              'Цена закупки',
              'Себестоимость',
              'Закупка',
              'purchasePrice'
            );
            const stockRaw = getVal(
              'Остаток',
              'Остаток на складе',
              'Количество',
              'Кол-во',
              'stock',
              'quantity'
            );
            const category = getVal('Группа', 'Категория', 'Группа товаров', 'category') || 'Общее';

            const price = parseNumber(priceRaw);
            const purchasePrice = purchasePriceRaw ? parseNumber(purchasePriceRaw) : undefined;
            const stockQuantity = stockRaw ? parseNumber(stockRaw) : 0;

            itemsToImport.push({
              name,
              price,
              purchasePrice,
              stockQuantity,
              barcode: barcode || undefined,
              category,
            });
          }

          if (itemsToImport.length === 0) {
            throw new Error(
              'Не удалось распознать товары в файле. Проверьте заголовки: "Наименование", "Цена продажи", "Артикул" (или "Штрихкод").'
            );
          }

          setImportStatusText(`Запись в базу Firestore (${itemsToImport.length} товаров по батчам)...`);

          // Execute batch writes (chunks of <= 450 to obey 500 batch limit)
          const totalImported = await importProductsBatch(itemsToImport);

          setNotification({
            type: 'success',
            text: `Успешно импортировано ${totalImported} товаров из файла ${file.name}`,
          });
        } catch (err) {
          setNotification({
            type: 'error',
            text: err instanceof Error ? err.message : 'Ошибка импорта CSV',
          });
        } finally {
          setIsImporting(false);
          setImportStatusText('');
          if (fileInputRef.current) fileInputRef.current.value = '';
          setTimeout(() => setNotification(null), 6000);
        }
      },
      error: (error) => {
        setIsImporting(false);
        setNotification({
          type: 'error',
          text: `Ошибка чтения CSV: ${error.message}`,
        });
        setTimeout(() => setNotification(null), 6000);
      },
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Hidden File Input for CSV */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleCsvFileChange}
          className="hidden"
        />

        {/* Notification Toast */}
        {notification && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-2xs animate-in slide-in-from-top-2 ${
              notification.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{notification.text}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-700 ml-3"
            >
              ×
            </button>
          </div>
        )}

        {/* Import in progress overlay */}
        {isImporting && (
          <div className="p-4 bg-blue-50 border-2 border-blue-400 rounded-xl flex items-center justify-between shadow-sm animate-pulse">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-blue-900">Обработка данных...</h4>
                <p className="text-xs text-blue-700">{importStatusText || 'Импорт товаров в базу...'}</p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold bg-blue-200/80 text-blue-900 px-2.5 py-1 rounded-md">
              Batch Write (Firebase)
            </span>
          </div>
        )}

        {/* Header & Controls */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full lg:w-auto flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по названию или штрихкоду..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition border ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons: Import CSV & Add Product */}
          <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
            <button
              onClick={handleCsvButtonClick}
              disabled={isImporting}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition active:scale-95 disabled:opacity-50"
              title="Импортировать товары из CSV (выгрузка МойСклад)"
            >
              {isImporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>Импорт из CSV</span>
            </button>

            <button
              onClick={openCreateModal}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить товар</span>
            </button>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200 select-none">
                <tr>
                  <th className="py-3 px-4 font-semibold">Товар</th>
                  <th className="py-3 px-4 font-semibold">Категория</th>
                  <th className="py-3 px-4 font-semibold">Штрихкод / Артикул</th>
                  <th className="py-3 px-4 font-semibold text-right">Закупка</th>
                  <th className="py-3 px-4 font-semibold text-right">Цена продажи</th>
                  <th className="py-3 px-4 font-semibold text-center">Остаток на складе</th>
                  <th className="py-3 px-3 font-semibold text-center">Горячий</th>
                  <th className="py-3 px-4 font-semibold text-center">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Товары не найдены
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-semibold text-slate-900 text-sm">
                        {p.name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium">
                          <Tag className="w-3 h-3 text-slate-400" />
                          {p.category || 'Общее'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {p.barcode ? (
                          <span className="flex items-center gap-1">
                            <Barcode className="w-3.5 h-3.5 text-slate-400" />
                            {p.barcode}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-500 font-mono text-xs">
                        {p.purchasePrice !== undefined
                          ? `${p.purchasePrice.toLocaleString('ru-RU')} ₽`
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-slate-900 font-mono text-sm">
                        {p.price.toLocaleString('ru-RU')} ₽
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleStockAdjust(p, -1)}
                            className="text-slate-400 hover:text-slate-600"
                            title="Уменьшить на 1"
                          >
                            <MinusCircle className="w-4 h-4" />
                          </button>
                          <span
                            className={`min-w-12 text-center font-bold px-2 py-0.5 rounded text-xs ${
                              p.stockQuantity <= 0
                                ? 'bg-rose-100 text-rose-700'
                                : p.stockQuantity <= 5
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {p.stockQuantity} шт
                          </span>
                          <button
                            onClick={() => handleStockAdjust(p, 1)}
                            className="text-slate-400 hover:text-slate-600"
                            title="Увеличить на 1"
                          >
                            <PlusCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => handleToggleHot(e, p)}
                          className={`p-1.5 rounded-lg transition inline-flex items-center gap-1 ${
                            p.isHot
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300'
                              : 'text-slate-300 hover:text-slate-600 hover:bg-slate-100'
                          }`}
                          title={p.isHot ? 'Горячий товар (нажмите, чтобы убрать)' : 'Сделать горячим товаром'}
                        >
                          <Flame
                            className={`w-4 h-4 ${
                              p.isHot ? 'fill-amber-500 text-amber-500' : 'text-slate-300'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 transition"
                            title="Редактировать товар"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition"
                            title="Удалить товар"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Product Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                {editingProduct ? 'Редактировать товар' : 'Новый товар'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Наименование товара *
                </label>
                <input
                  type="text"
                  required
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  placeholder="Например: Кофе в зернах 1кг"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Цена продажи (₽) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={pPrice}
                    onChange={(e) => setPPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Закупочная цена (₽)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={pPurchasePrice}
                    onChange={(e) => setPPurchasePrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Кол-во на складе (шт)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={pStock}
                    onChange={(e) => setPStock(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Категория
                  </label>
                  <input
                    type="text"
                    value={pCategory}
                    onChange={(e) => setPCategory(e.target.value)}
                    placeholder="Напитки, Снеки..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Штрихкод / Артикул
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomBarcode}
                    className="text-[10px] text-blue-600 hover:underline"
                  >
                    Сгенерировать EAN
                  </button>
                </div>
                <div className="relative">
                  <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={pBarcode}
                    onChange={(e) => setPBarcode(e.target.value)}
                    placeholder="4607001001"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Hot Product Configuration */}
              <div className="space-y-2 pt-1 border-t border-slate-200">
                <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pIsHot}
                    onChange={(e) => setPIsHot(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
                      <span>Сделать горячим товаром (быстрый чек)</span>
                    </span>
                    <span className="text-[11px] text-slate-600 block mt-0.5 leading-tight">
                      Отображается крупной цветной плиткой вверху кассы для мгновенной продажи в 1 касание
                    </span>
                  </div>
                </label>

                {pIsHot && (
                  <div className="pl-1 pt-1">
                    <span className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                      Цвет плитки на экране кассы:
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { name: 'Синий', color: '#2563eb' },
                        { name: 'Изумруд', color: '#059669' },
                        { name: 'Бирюза', color: '#0891b2' },
                        { name: 'Янтарь', color: '#d97706' },
                        { name: 'Красный', color: '#e11d48' },
                        { name: 'Фиолетовый', color: '#7c3aed' },
                        { name: 'Розовый', color: '#db2777' },
                        { name: 'Графит', color: '#0f172a' },
                      ].map((c) => (
                        <button
                          key={c.color}
                          type="button"
                          onClick={() => setPHotColor(c.color)}
                          style={{ backgroundColor: c.color }}
                          className={`w-7 h-7 rounded-full transition ${
                            pHotColor === c.color
                              ? 'ring-3 ring-offset-2 ring-slate-800 scale-110'
                              : 'opacity-75 hover:opacity-100'
                          }`}
                          title={c.name}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {isSaving ? 'Сохранение...' : 'Сохранить товар'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
