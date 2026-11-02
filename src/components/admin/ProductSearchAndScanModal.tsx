import React, { useState, useRef, useEffect } from 'react';
import { StoreProduct } from '../../types';
import { CameraScannerModal } from '../CameraScannerModal';
import { UnknownBarcodeModal } from '../common/UnknownBarcodeModal';
import { ProductCardModal } from './ProductCardModal';
import {
  Boxes,
  Plus,
  Search,
  X,
  Barcode,
  Scan,
  Camera,
  AlertTriangle,
} from 'lucide-react';

/* Helper beep sound for scanning */
export const playBarcodeBeep = () => {
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

export interface ProductSearchAndScanModalProps {
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
  mode: 'receipt' | 'write_off' | 'inventory';
}

export const ProductSearchAndScanModal: React.FC<ProductSearchAndScanModalProps> = ({
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

  // Unknown barcode modal & archived product warning states
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [isUnknownBarcodeModalOpen, setIsUnknownBarcodeModalOpen] = useState(false);
  const [archivedAlertProduct, setArchivedAlertProduct] = useState<StoreProduct | null>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [cardModalProductId, setCardModalProductId] = useState<string | null>(null);
  const [cardModalInitialBarcode, setCardModalInitialBarcode] = useState<string | undefined>(undefined);

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
    const cleanLower = clean.toLowerCase();

    // Check if barcode belongs to an archived product (block scanning and warn)
    const archived = products.find(
      (p) =>
        (p.isActive === false || p.isArchived === true) &&
        ((p.barcode && p.barcode.toLowerCase() === cleanLower) ||
          (Array.isArray(p.barcodes) && p.barcodes.some((b) => b && b.toLowerCase() === cleanLower)))
    );

    if (archived) {
      setArchivedAlertProduct(archived);
      return;
    }

    const found = products.find(
      (p) =>
        p.isActive !== false &&
        !p.isArchived &&
        ((p.barcode && p.barcode.toLowerCase() === cleanLower) ||
          (Array.isArray(p.barcodes) && p.barcodes.some((b) => b && b.toLowerCase() === cleanLower)))
    );

    if (found) {
      playBarcodeBeep();
      setScanNotification(`Товар найден: ${found.name}`);
      setTimeout(() => setScanNotification(null), 3000);
      handlePickProduct(found);
    } else {
      // Prohibit automatic creation: show confirmation modal
      setUnknownBarcode(clean);
      setIsUnknownBarcodeModalOpen(true);
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

  // Filter products by search query (only active non-archived products by default)
  const filtered = products.filter((p) => {
    if (p.isActive === false || p.isArchived === true) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const matchesName = p.name.toLowerCase().includes(q);
    const matchesBarcode = p.barcode ? p.barcode.toLowerCase().includes(q) : false;
    const matchesBarcodes = Array.isArray(p.barcodes) && p.barcodes.some((b) => b && b.toLowerCase().includes(q));
    const matchesCategory = p.category ? p.category.toLowerCase().includes(q) : false;
    return matchesName || matchesBarcode || matchesBarcodes || matchesCategory;
  });

  const handleConfirmAdd = () => {
    if (!liveSelectedProduct) return;
    if (qtyInput <= 0) {
      alert('Укажите количество больше нуля.');
      return;
    }

    onAddProduct({
      productId: liveSelectedProduct.id,
      name: liveSelectedProduct.name,
      barcode: liveSelectedProduct.barcode,
      qty: qtyInput,
      price: priceInput,
    });

    setSelectedProduct(null);
    setSearchQuery('');

    if (!keepOpen) {
      onClose();
    } else {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl h-[94vh] max-h-[850px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-xl">
                <Boxes className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-base sm:text-lg">
                  {mode === 'receipt'
                    ? 'Добавить товар в Приемку'
                    : mode === 'write_off'
                    ? 'Добавить товар на Списание'
                    : 'Выбор товара для документа'}
                </h3>
                <p className="text-xs text-slate-400">
                  Поиск по наименованию, штрихкоду или сканирование сканером [USB/BT/Камера]
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Keep open toggle */}
              <label className="hidden sm:flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer select-none bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
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
            {/* Warning when attempting to scan archived product */}
            {archivedAlertProduct && (
              <div className="p-3 bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-200 shrink-0" />
                  <div>
                    <span className="block font-black">
                      Внимание! Этот товар находится в архиве. Перейдите в карточку товара, чтобы восстановить его
                    </span>
                    <span className="text-[11px] font-normal text-rose-100">
                      Товар: {archivedAlertProduct.name}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setCardModalProductId(archivedAlertProduct.id);
                      setIsCardModalOpen(true);
                      setArchivedAlertProduct(null);
                    }}
                    className="px-2.5 py-1 bg-white text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-black shadow-xs transition cursor-pointer"
                  >
                    Перейти в карточку
                  </button>
                  <button
                    type="button"
                    onClick={() => setArchivedAlertProduct(null)}
                    className="p-1 text-rose-200 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

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
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm shrink-0 active:scale-95"
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
                        className="px-3 py-1.5 bg-blue-50 group-hover:bg-blue-600 text-blue-600 group-hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0"
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
        </div>
      </div>

      {/* Mini-Modal: Quantity and Purchase Price input */}
      {liveSelectedProduct && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-100">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                  {mode === 'receipt' ? 'Оприходование' : 'Списание'}
                </span>
                <h4 className="font-bold text-sm sm:text-base leading-snug line-clamp-1">
                  {liveSelectedProduct.name}
                </h4>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Stock Banner */}
            <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between text-xs">
              <span className="text-slate-600">Текущий остаток на складе:</span>
              <span className="font-bold font-mono text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">
                {liveSelectedProduct.stockQuantity} шт.
              </span>
            </div>

            {/* Inputs Form */}
            <div className="p-4 space-y-4">
              {/* Quantity Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  {mode === 'receipt' ? 'Количество прихода *' : 'Количество списания *'}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQtyInput((q) => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-lg transition flex items-center justify-center shrink-0"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    name="qtyOrPrice"
                    value={qtyInput}
                    onChange={(e) => setQtyInput(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 px-3 py-2 text-center text-lg font-black font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setQtyInput((q) => q + 1)}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-lg transition flex items-center justify-center shrink-0"
                  >
                    +
                  </button>
                </div>
                {/* Fast presets */}
                <div className="flex items-center gap-1.5 mt-2">
                  {[5, 10, 20, 50].map((step) => (
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
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-1.5"
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

      {/* Unknown Barcode Confirmation Modal */}
      <UnknownBarcodeModal
        isOpen={isUnknownBarcodeModalOpen}
        barcode={unknownBarcode || ''}
        onCreateProduct={(code) => {
          setIsUnknownBarcodeModalOpen(false);
          setCardModalProductId(null);
          setCardModalInitialBarcode(code || unknownBarcode || '');
          setIsCardModalOpen(true);
        }}
        onClose={() => {
          setIsUnknownBarcodeModalOpen(false);
          setUnknownBarcode(null);
        }}
      />

      {/* Product Card Modal for Creating or Restoring Product */}
      <ProductCardModal
        isOpen={isCardModalOpen}
        onClose={() => {
          setIsCardModalOpen(false);
          setCardModalProductId(null);
          setCardModalInitialBarcode(undefined);
          setUnknownBarcode(null);
        }}
        productId={cardModalProductId}
        initialBarcode={cardModalInitialBarcode}
        products={products}
      />
    </>
  );
};
