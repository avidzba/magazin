import React, { useState, useMemo } from 'react';
import { StoreProduct } from '../../types';
import { mergeProducts } from '../../services/storeService';
import {
  GitMerge,
  ArrowRightLeft,
  X,
  Check,
  Package,
  Barcode,
  Boxes,
  AlertTriangle,
  Archive,
  Trash2,
  Search,
} from 'lucide-react';

interface MergeProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: StoreProduct[];
  initialProductA?: StoreProduct | null;
  initialProductB?: StoreProduct | null;
  onSuccess?: (targetProduct: StoreProduct, newStock: number) => void;
}

export const MergeProductsModal: React.FC<MergeProductsModalProps> = ({
  isOpen,
  onClose,
  products,
  initialProductA,
  initialProductB,
  onSuccess,
}) => {
  const [targetId, setTargetId] = useState<string>(initialProductA?.id || '');
  const [sourceId, setSourceId] = useState<string>(initialProductB?.id || '');
  const [sourceAction, setSourceAction] = useState<'archive' | 'delete'>('archive');
  const [searchTarget, setSearchTarget] = useState('');
  const [searchSource, setSearchSource] = useState('');
  const [isSelectingTarget, setIsSelectingTarget] = useState(false);
  const [isSelectingSource, setIsSelectingSource] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync initial selections when modal opens or props change
  React.useEffect(() => {
    if (isOpen) {
      if (initialProductA) setTargetId(initialProductA.id);
      if (initialProductB) setSourceId(initialProductB.id);
      setErrorMsg(null);
    }
  }, [isOpen, initialProductA, initialProductB]);

  const productA = useMemo(() => products.find((p) => p.id === targetId), [products, targetId]);
  const productB = useMemo(() => products.find((p) => p.id === sourceId), [products, sourceId]);

  // Combined stock and barcodes preview
  const combinedStock = (productA?.stockQuantity || 0) + (productB?.stockQuantity || 0);

  const combinedBarcodes = useMemo(() => {
    const set = new Set<string>();
    if (productA?.barcode) set.add(productA.barcode.trim());
    if (productA?.barcodes) productA.barcodes.forEach((b) => b && set.add(b.trim()));
    if (productB?.barcode) set.add(productB.barcode.trim());
    if (productB?.barcodes) productB.barcodes.forEach((b) => b && set.add(b.trim()));
    return Array.from(set).filter(Boolean);
  }, [productA, productB]);

  // Swap target and source
  const handleSwap = () => {
    const temp = targetId;
    setTargetId(sourceId);
    setSourceId(temp);
  };

  const handleMerge = async () => {
    if (!productA || !productB) {
      setErrorMsg('Пожалуйста, выберите оба товара для слияния.');
      return;
    }
    if (productA.id === productB.id) {
      setErrorMsg('Нельзя объединить товар с самим собой. Выберите два разных товара.');
      return;
    }

    setIsMerging(true);
    setErrorMsg(null);

    try {
      const res = await mergeProducts({
        targetProductId: productA.id,
        sourceProductId: productB.id,
        combinedStock,
        targetBarcode: productA.barcode || productB.barcode || '',
        additionalBarcodes: combinedBarcodes,
        sourceAction,
      });

      onSuccess?.(productA, res.newStock);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка объединения товаров');
    } finally {
      setIsMerging(false);
    }
  };

  const filteredTargetList = useMemo(() => {
    const q = searchTarget.toLowerCase().trim();
    return products.filter((p) => {
      if (p.id === sourceId) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    });
  }, [products, sourceId, searchTarget]);

  const filteredSourceList = useMemo(() => {
    const q = searchSource.toLowerCase().trim();
    return products.filter((p) => {
      if (p.id === targetId) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    });
  }, [products, targetId, searchSource]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl overflow-hidden my-auto animate-in zoom-in-95 duration-150 flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-xs">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg">Слияние дублей товаров</h3>
              <p className="text-xs text-slate-400">
                Объединение остатков и штрихкодов двух карточек в одну
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Cards Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-3 sm:gap-4 items-stretch">
            {/* Card A: Target */}
            <div className="p-4 rounded-2xl border-2 border-indigo-500/50 bg-indigo-50/20 dark:bg-indigo-950/20 flex flex-col justify-between relative">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2.5 py-1 bg-indigo-600 text-white text-[11px] font-black uppercase tracking-wider rounded-lg">
                    Товар А (Основной)
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSelectingTarget(true)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                  >
                    {productA ? 'Сменить' : 'Выбрать'}
                  </button>
                </div>

                {productA ? (
                  <div className="space-y-2 mt-3">
                    <h4 className="font-black text-slate-900 dark:text-white text-sm line-clamp-2">
                      {productA.name}
                    </h4>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                      <Barcode className="w-3.5 h-3.5" />
                      <span>{productA.barcode || 'Штрихкод отсутствует'}</span>
                    </div>
                    <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Остаток</span>
                        <span className="font-black text-slate-900 dark:text-white font-mono text-sm">
                          {productA.stockQuantity} {productA.unit || 'шт'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Цена розн.</span>
                        <span className="font-bold text-slate-900 dark:text-white font-mono">
                          {productA.price} ₽
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setIsSelectingTarget(true)}
                    className="h-28 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-indigo-400 transition"
                  >
                    <Package className="w-6 h-6 mb-1 text-slate-400" />
                    <span className="text-xs font-semibold">Нажмите для выбора товара</span>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mt-3">
                ✓ Эта карточка останется активной в каталоге.
              </p>
            </div>

            {/* Middle Swap Button */}
            <div className="flex md:flex-col items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleSwap}
                disabled={!productA || !productB}
                title="Поменять местами основной и поглощаемый товар"
                className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 rounded-xl text-slate-700 dark:text-slate-300 transition shadow-xs cursor-pointer"
              >
                <ArrowRightLeft className="w-5 h-5" />
              </button>
            </div>

            {/* Card B: Source (To absorb) */}
            <div className="p-4 rounded-2xl border-2 border-amber-500/50 bg-amber-50/20 dark:bg-amber-950/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2.5 py-1 bg-amber-600 text-white text-[11px] font-black uppercase tracking-wider rounded-lg">
                    Товар Б (Дубликат)
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSelectingSource(true)}
                    className="text-xs text-amber-600 dark:text-amber-400 font-bold hover:underline"
                  >
                    {productB ? 'Сменить' : 'Выбрать'}
                  </button>
                </div>

                {productB ? (
                  <div className="space-y-2 mt-3">
                    <h4 className="font-black text-slate-900 dark:text-white text-sm line-clamp-2">
                      {productB.name}
                    </h4>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                      <Barcode className="w-3.5 h-3.5" />
                      <span>{productB.barcode || 'Штрихкод отсутствует'}</span>
                    </div>
                    <div className="pt-2 border-t border-amber-100 dark:border-amber-900/40 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Остаток</span>
                        <span className="font-black text-slate-900 dark:text-white font-mono text-sm">
                          {productB.stockQuantity} {productB.unit || 'шт'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Цена розн.</span>
                        <span className="font-bold text-slate-900 dark:text-white font-mono">
                          {productB.price} ₽
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setIsSelectingSource(true)}
                    className="h-28 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-amber-400 transition"
                  >
                    <Package className="w-6 h-6 mb-1 text-slate-400" />
                    <span className="text-xs font-semibold">Нажмите для выбора дубликата</span>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium mt-3">
                ⚠ Остаток перейдет в Товар А, а эта позиция будет архивирована.
              </p>
            </div>
          </div>

          {/* Resulting merged details preview */}
          {productA && productB && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Результат слияния:
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 text-[11px] block">Итоговый остаток Товара А:</span>
                  <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                    {productA.stockQuantity} + {productB.stockQuantity} = {combinedStock} {productA.unit || 'шт'}
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 text-[11px] block">Объединенные штрихкоды:</span>
                  <div className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 flex flex-wrap gap-1">
                    {combinedBarcodes.length > 0 ? (
                      combinedBarcodes.map((b) => (
                        <span key={b} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[11px]">
                          {b}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic font-normal">Без штрихкодов</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Duplicate disposition options */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                  Что сделать с Товаром Б после объединения:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition select-none ${
                      sourceAction === 'archive'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="sourceAction"
                      value="archive"
                      checked={sourceAction === 'archive'}
                      onChange={() => setSourceAction('archive')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-slate-900 dark:text-white block">
                        Перенести в архив (isActive: false)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Рекомендуется. История операций сохранится
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition select-none ${
                      sourceAction === 'delete'
                        ? 'border-rose-600 bg-rose-50/50 dark:bg-rose-950/30'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="sourceAction"
                      value="delete"
                      checked={sourceAction === 'delete'}
                      onChange={() => setSourceAction('delete')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-rose-700 dark:text-rose-300 block">
                        Удалить карточку навсегда
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Полное удаление из базы данных
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleMerge}
            disabled={!productA || !productB || isMerging}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-md flex items-center gap-2 cursor-pointer"
          >
            <GitMerge className="w-4 h-4" />
            <span>{isMerging ? 'Объединение...' : 'Выполнить слияние'}</span>
          </button>
        </div>
      </div>

      {/* Selector Sub-Modal: Product A */}
      {isSelectingTarget && (
        <div
          className="fixed inset-0 z-80 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs"
          onClick={() => setIsSelectingTarget(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 w-full max-w-lg border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-black text-sm text-slate-900 dark:text-white">
                Выберите основной Товар А
              </h4>
              <button
                onClick={() => setIsSelectingTarget(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTarget}
                onChange={(e) => setSearchTarget(e.target.value)}
                placeholder="Поиск по названию или штрихкоду..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTargetList.slice(0, 50).map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setTargetId(p.id);
                    setIsSelectingTarget(false);
                  }}
                  className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer rounded-lg flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {p.name}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {p.barcode || 'Без штрихкода'} • {p.category || 'Общее'}
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 shrink-0">
                    {p.stockQuantity} {p.unit || 'шт'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selector Sub-Modal: Product B */}
      {isSelectingSource && (
        <div
          className="fixed inset-0 z-80 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs"
          onClick={() => setIsSelectingSource(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 w-full max-w-lg border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-black text-sm text-slate-900 dark:text-white">
                Выберите поглощаемый дубликат (Товар Б)
              </h4>
              <button
                onClick={() => setIsSelectingSource(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchSource}
                onChange={(e) => setSearchSource(e.target.value)}
                placeholder="Поиск по названию или штрихкоду..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSourceList.slice(0, 50).map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setSourceId(p.id);
                    setIsSelectingSource(false);
                  }}
                  className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer rounded-lg flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {p.name}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {p.barcode || 'Без штрихкода'} • {p.category || 'Общее'}
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 shrink-0">
                    {p.stockQuantity} {p.unit || 'шт'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
