import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { StoreProduct, StoreInventoryDoc, InventoryDocItem } from '../../types';
import {
  saveInventoryAuditDoc,
  createWriteOffFromAudit,
  createReceiptFromAudit,
  peekNextDocNumber,
} from '../../services/storeService';
import { ProductCardModal } from './ProductCardModal';
import { UnknownBarcodeModal } from '../common/UnknownBarcodeModal';
import {
  X,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowDownRight,
  PackagePlus,
  Search,
  Filter,
  Printer,
  Save,
  RotateCcw,
  Sparkles,
  FileText,
  Lock,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  TrendingDown,
  TrendingUp,
  Scale,
  Calendar,
  User,
  Barcode,
  Layers,
  HelpCircle,
  ScanLine,
} from 'lucide-react';

interface InventoryAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditDoc: StoreInventoryDoc | null;
  products: StoreProduct[];
  authorName?: string;
  authorId?: string;
  onSelectRelatedDoc?: (docId: string) => void;
}

export const InventoryAuditModal: React.FC<InventoryAuditModalProps> = ({
  isOpen,
  onClose,
  auditDoc,
  products,
  authorName = 'Администратор',
  authorId = '',
  onSelectRelatedDoc,
}) => {
  // Document metadata state
  const [docId, setDocId] = useState<string | undefined>(auditDoc?.id);
  const [docNumber, setDocNumber] = useState<string>(auditDoc?.docNumber || '');
  const [status, setStatus] = useState<'draft' | 'posted'>(auditDoc?.status || 'draft');
  const [date, setDate] = useState<string>(() => {
    if (auditDoc?.date) {
      if (auditDoc.date.toDate) return auditDoc.date.toDate().toISOString().split('T')[0];
      if (typeof auditDoc.date === 'string') return auditDoc.date.split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  });
  const [comment, setComment] = useState<string>(auditDoc?.comment || 'Плановая инвентаризация магазина');
  const [writeOffDocNumber, setWriteOffDocNumber] = useState<string | undefined>(auditDoc?.writeOffDocNumber);
  const [receiptDocNumber, setReceiptDocNumber] = useState<string | undefined>(auditDoc?.receiptDocNumber);

  // Table items state
  const [items, setItems] = useState<InventoryDocItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Все');
  const [filterType, setFilterType] = useState<
    'all' | 'discrepancies' | 'shortages' | 'surpluses' | 'exact' | 'uncounted'
  >('all');

  // Pagination state (50, 100, 200 items per page to prevent UI lag on large catalogs)
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Hardware scanner detection & highlight state
  const barcodeBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const [scannedFeedback, setScannedFeedback] = useState<{
    text: string;
    isError?: boolean;
  } | null>(null);
  const [highlightedProdId, setHighlightedProdId] = useState<string | null>(null);

  // Interactive Product Card modal state
  const [selectedProductCard, setSelectedProductCard] = useState<{ id: string; name: string } | null>(null);

  // Unknown barcode modal & archived product warning states
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [isUnknownBarcodeModalOpen, setIsUnknownBarcodeModalOpen] = useState(false);
  const [archivedAlertProduct, setArchivedAlertProduct] = useState<StoreProduct | null>(null);
  const [newCardInitialBarcode, setNewCardInitialBarcode] = useState<string | undefined>(undefined);
  const [isCreateCardModalOpen, setIsCreateCardModalOpen] = useState(false);

  // Loading & actions state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Safe confirm helper to avoid iframe blocking errors
  const safeConfirm = (msg: string): boolean => {
    try {
      return typeof window !== 'undefined' && window.confirm ? window.confirm(msg) : true;
    } catch {
      return true;
    }
  };

  // References to actualQty input elements for keyboard navigation & scanner focusing
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Reset page to 1 whenever filters change
  const handleFilterTypeChange = (newType: typeof filterType) => {
    setFilterType(newType);
    setCurrentPage(1);
  };

  const handleCategoryChange = (newCat: string) => {
    setSelectedCategory(newCat);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  // Initialize or reload document items
  useEffect(() => {
    if (!isOpen) return;

    if (auditDoc) {
      setDocId(auditDoc.id);
      setDocNumber(auditDoc.docNumber);
      setStatus(auditDoc.status || 'draft');
      setComment(auditDoc.comment || '');
      setWriteOffDocNumber(auditDoc.writeOffDocNumber);
      setReceiptDocNumber(auditDoc.receiptDocNumber);

      let d = new Date().toISOString().split('T')[0];
      try {
        if (auditDoc.date?.toDate) d = auditDoc.date.toDate().toISOString().split('T')[0];
        else if (typeof auditDoc.date === 'string') d = auditDoc.date.split('T')[0];
      } catch (_) {}
      setDate(d);

      // Map saved items, merging with latest product info if needed
      const mapped = auditDoc.items.map((it) => {
        const prod = products.find((p) => p.id === it.productId);
        const purchasePrice = it.price ?? prod?.purchasePrice ?? Math.round((prod?.price || 100) * 0.7);
        const retailPrice = it.retailPrice ?? prod?.price ?? 0;
        const bookQty = it.bookQty ?? prod?.stockQuantity ?? 0;
        const actualQty = it.actualQty !== undefined ? it.actualQty : null;

        let diff: number | undefined = undefined;
        let diffCost: number | undefined = undefined;
        let diffRetail: number | undefined = undefined;

        if (actualQty !== null && actualQty !== undefined) {
          diff = actualQty - bookQty;
          diffCost = diff * purchasePrice;
          diffRetail = diff * retailPrice;
        }

        return {
          ...it,
          barcode: it.barcode || prod?.barcode || '',
          category: prod?.category || 'Общее',
          price: purchasePrice,
          retailPrice,
          bookQty,
          actualQty,
          diff,
          diffCost,
          diffRetail,
          total: (actualQty ?? bookQty) * purchasePrice,
        };
      });

      setItems(mapped);
      setCurrentPage(1);
    } else {
      // New audit document: Automatically preload ALL active products from database
      setDocId(undefined);
      setStatus('draft');
      setComment('Плановая инвентаризация торгового зала');
      setDate(new Date().toISOString().split('T')[0]);
      setWriteOffDocNumber(undefined);
      setReceiptDocNumber(undefined);

      peekNextDocNumber('inventory').then((num) => {
        setDocNumber(num);
      });

      const initialItems: InventoryDocItem[] = products
        .filter((p) => !p.isArchived && p.isActive !== false)
        .map((p) => {
          const purchasePrice = p.purchasePrice ?? Math.round(p.price * 0.7);
          const retailPrice = p.price;
          const bookQty = p.stockQuantity;

          return {
            productId: p.id,
            name: p.name,
            barcode: p.barcode || '',
            category: p.category || 'Общее',
            qty: bookQty,
            bookQty,
            actualQty: null, // default empty
            diff: undefined,
            diffCost: undefined,
            diffRetail: undefined,
            price: purchasePrice,
            retailPrice,
            total: bookQty * purchasePrice,
          };
        });

      setItems(initialItems);
      setCurrentPage(1);
    }
  }, [isOpen, auditDoc, products]);

  // Handle actual quantity change on a row
  const handleActualQtyChange = (productId: string, rawVal: string) => {
    if (status === 'posted') return; // Locked when posted

    setItems((prev) =>
      prev.map((it) => {
        if (it.productId !== productId) return it;

        if (rawVal === '') {
          return {
            ...it,
            actualQty: null,
            diff: undefined,
            diffCost: undefined,
            diffRetail: undefined,
          };
        }

        const parsed = parseInt(rawVal, 10);
        const actualQty = isNaN(parsed) ? 0 : Math.max(0, parsed);
        const bookQty = it.bookQty ?? 0;
        const diff = actualQty - bookQty;
        const diffCost = diff * (it.price || 0);
        const diffRetail = diff * (it.retailPrice || 0);

        return {
          ...it,
          actualQty,
          diff,
          diffCost,
          diffRetail,
          total: actualQty * (it.price || 0),
        };
      })
    );
  };

  // Keyboard navigation within the page: Enter or ArrowDown moves to next row, ArrowUp to previous row
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentProdId: string) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const visible = pagedItems;
      const curIdx = visible.findIndex((it) => it.productId === currentProdId);
      if (curIdx >= 0 && curIdx < visible.length - 1) {
        const nextId = visible[curIdx + 1].productId;
        inputRefs.current[nextId]?.focus();
        inputRefs.current[nextId]?.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const visible = pagedItems;
      const curIdx = visible.findIndex((it) => it.productId === currentProdId);
      if (curIdx > 0) {
        const prevId = visible[curIdx - 1].productId;
        inputRefs.current[prevId]?.focus();
        inputRefs.current[prevId]?.select();
      }
    }
  };

  // Quick fill all actual quantities with system / book quantities
  const handleFillAllWithBook = () => {
    if (status === 'posted') return;
    if (!safeConfirm('Заполнить все фактические остатки расчетными значениями из базы?')) return;

    setItems((prev) =>
      prev.map((it) => {
        const bookQty = it.bookQty ?? 0;
        return {
          ...it,
          actualQty: bookQty,
          diff: 0,
          diffCost: 0,
          diffRetail: 0,
        };
      })
    );
  };

  // Clear all actual quantities back to uncounted (empty)
  const handleClearAllActual = () => {
    if (status === 'posted') return;
    if (!safeConfirm('Очистить все введенные фактические остатки?')) return;

    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        actualQty: null,
        diff: undefined,
        diffCost: undefined,
        diffRetail: undefined,
      }))
    );
  };

  // Categories list
  const categories = useMemo(() => {
    return ['Все', ...Array.from(new Set(items.map((it) => it.category || 'Общее')))];
  }, [items]);

  // Compute live statistics and financial totals
  const summary = useMemo(() => {
    let countedCount = 0;
    let exactCount = 0;
    let shortageCount = 0;
    let surplusCount = 0;

    let shortagePcs = 0;
    let shortageCostSum = 0;
    let shortageRetailSum = 0;

    let surplusPcs = 0;
    let surplusCostSum = 0;
    let surplusRetailSum = 0;

    for (const it of items) {
      if (it.actualQty !== null && it.actualQty !== undefined) {
        countedCount++;
        const diff = it.diff ?? 0;

        if (diff < 0) {
          shortageCount++;
          shortagePcs += Math.abs(diff);
          shortageCostSum += Math.abs(it.diffCost ?? diff * it.price);
          shortageRetailSum += Math.abs(it.diffRetail ?? diff * (it.retailPrice || 0));
        } else if (diff > 0) {
          surplusCount++;
          surplusPcs += diff;
          surplusCostSum += it.diffCost ?? diff * it.price;
          surplusRetailSum += it.diffRetail ?? diff * (it.retailPrice || 0);
        } else {
          exactCount++;
        }
      }
    }

    const uncountedCount = items.length - countedCount;
    const netCostSum = surplusCostSum - shortageCostSum;
    const netRetailSum = surplusRetailSum - shortageRetailSum;
    const totalAmount = items.reduce((acc, it) => acc + (it.actualQty ?? it.bookQty ?? 0) * it.price, 0);

    return {
      totalItems: items.length,
      countedCount,
      uncountedCount,
      exactCount,
      shortageCount,
      shortagePcs,
      shortageCostSum,
      shortageRetailSum, // KEY NUMBER: CASHIER ACCOUNTABILITY
      surplusCount,
      surplusPcs,
      surplusCostSum,
      surplusRetailSum,
      netCostSum,
      netRetailSum,
      totalAmount,
    };
  }, [items]);

  // Filtered items based on category, search, and discrepancy filter type
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      // Category filter
      if (selectedCategory !== 'Все' && (it.category || 'Общее') !== selectedCategory) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = it.name.toLowerCase().includes(q);
        const matchesBarcode = it.barcode ? it.barcode.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesBarcode) return false;
      }

      // Filter type
      if (filterType === 'discrepancies') {
        return it.actualQty !== null && it.actualQty !== undefined && it.diff !== 0;
      }
      if (filterType === 'shortages') {
        return it.actualQty !== null && it.actualQty !== undefined && (it.diff ?? 0) < 0;
      }
      if (filterType === 'surpluses') {
        return it.actualQty !== null && it.actualQty !== undefined && (it.diff ?? 0) > 0;
      }
      if (filterType === 'exact') {
        return it.actualQty !== null && it.actualQty !== undefined && it.diff === 0;
      }
      if (filterType === 'uncounted') {
        return it.actualQty === null || it.actualQty === undefined;
      }

      return true;
    });
  }, [items, selectedCategory, searchQuery, filterType]);

  // Total pages calculation and current page clamp
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  // Paginated items for zero DOM lag
  const pagedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, safeCurrentPage, pageSize]);

  // Jump to product and focus its actualQty input
  const jumpToProductAndFocus = useCallback(
    (targetProdId: string) => {
      // Ensure the product is visible in filteredItems
      const targetItem = items.find((p) => p.productId === targetProdId);
      if (!targetItem) return;

      // Reset filters if item is currently filtered out
      let activeFiltered = filteredItems;
      const isVisibleInCurrentFilter = filteredItems.some((p) => p.productId === targetProdId);

      if (!isVisibleInCurrentFilter) {
        setSelectedCategory('Все');
        setFilterType('all');
        setSearchQuery('');
        activeFiltered = items;
      }

      const itemIndex = activeFiltered.findIndex((p) => p.productId === targetProdId);
      if (itemIndex !== -1) {
        const targetPage = Math.floor(itemIndex / pageSize) + 1;
        setCurrentPage(targetPage);
        setHighlightedProdId(targetProdId);

        // Defer focus slightly until React renders the target page
        setTimeout(() => {
          const el = inputRefs.current[targetProdId];
          if (el) {
            el.focus();
            el.select();
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 120);

        setTimeout(() => {
          setHighlightedProdId((curr) => (curr === targetProdId ? null : curr));
        }, 3000);
      }
    },
    [items, filteredItems, pageSize]
  );

  // Hardware barcode scanner global keydown listener
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const delta = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // If user pressed Enter, process the accumulated barcode buffer
      if (e.key === 'Enter') {
        const scannedCode = barcodeBufferRef.current.trim();
        barcodeBufferRef.current = '';

        if (scannedCode.length >= 3) {
          const cleanCode = scannedCode.replace(/\s+/g, '').toLowerCase();

          // 1. Check if barcode belongs to an archived product (block scanning and warn)
          const archivedProd = products.find(
            (p) =>
              (p.isActive === false || p.isArchived === true) &&
              ((p.barcode && p.barcode.replace(/\s+/g, '').toLowerCase() === cleanCode) ||
                (Array.isArray(p.barcodes) &&
                  p.barcodes.some((b) => b && b.replace(/\s+/g, '').toLowerCase() === cleanCode)))
          );

          if (archivedProd) {
            e.preventDefault();
            e.stopPropagation();
            setArchivedAlertProduct(archivedProd);
            setScannedFeedback({
              text: 'Внимание! Этот товар находится в архиве. Перейдите в карточку товара, чтобы восстановить его',
              isError: true,
            });
            return;
          }

          // 2. Find matching item in existing items by barcode
          const found = items.find(
            (it) => it.barcode && it.barcode.replace(/\s+/g, '').toLowerCase() === cleanCode
          );

          if (found) {
            e.preventDefault();
            e.stopPropagation();

            jumpToProductAndFocus(found.productId);
            setScannedFeedback({
              text: `📷 Сканер: ${found.name} (${found.barcode})`,
              isError: false,
            });
            setTimeout(() => setScannedFeedback(null), 4000);
            return;
          }

          // 3. Check if product exists in active catalog but not yet in audit items
          const activeProd = products.find(
            (p) =>
              p.isActive !== false &&
              !p.isArchived &&
              ((p.barcode && p.barcode.replace(/\s+/g, '').toLowerCase() === cleanCode) ||
                (Array.isArray(p.barcodes) &&
                  p.barcodes.some((b) => b && b.replace(/\s+/g, '').toLowerCase() === cleanCode)))
          );

          if (activeProd) {
            e.preventDefault();
            e.stopPropagation();
            const purchasePrice = activeProd.purchasePrice ?? Math.round(activeProd.price * 0.7);
            const newItem: InventoryDocItem = {
              productId: activeProd.id,
              name: activeProd.name,
              barcode: activeProd.barcode || '',
              category: activeProd.category || 'Общее',
              qty: activeProd.stockQuantity,
              bookQty: activeProd.stockQuantity,
              actualQty: 1,
              diff: 1 - activeProd.stockQuantity,
              diffCost: (1 - activeProd.stockQuantity) * purchasePrice,
              diffRetail: (1 - activeProd.stockQuantity) * activeProd.price,
              price: purchasePrice,
              retailPrice: activeProd.price,
              total: 1 * purchasePrice,
            };
            setItems((prev) => [newItem, ...prev]);
            jumpToProductAndFocus(activeProd.id);
            setScannedFeedback({
              text: `📷 Добавлен в опись: ${activeProd.name}`,
              isError: false,
            });
            setTimeout(() => setScannedFeedback(null), 4000);
            return;
          }

          // 4. Barcode scanned but not found in catalog: prohibit automatic creation, ask user
          e.preventDefault();
          e.stopPropagation();
          setUnknownBarcode(scannedCode);
          setIsUnknownBarcodeModalOpen(true);
        }
        return;
      }

      // If key is a printable character (length === 1)
      if (e.key.length === 1) {
        // Scanners emit characters rapidly (< 50ms apart). If > 90ms, start fresh buffer
        if (delta > 85) {
          barcodeBufferRef.current = e.key;
        } else {
          barcodeBufferRef.current += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [isOpen, items, products, jumpToProductAndFocus]);

  // Handle Search Input Enter: if exact barcode or 1 match, auto jump and focus
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return;

      const cleanQ = q.replace(/\s+/g, '');

      // Check if it matches an archived product
      const archivedMatch = products.find(
        (p) =>
          (p.isActive === false || p.isArchived === true) &&
          ((p.barcode && p.barcode.replace(/\s+/g, '').toLowerCase() === cleanQ) ||
            (Array.isArray(p.barcodes) &&
              p.barcodes.some((b) => b && b.replace(/\s+/g, '').toLowerCase() === cleanQ)))
      );

      if (archivedMatch) {
        e.preventDefault();
        setArchivedAlertProduct(archivedMatch);
        return;
      }

      const exactBarcodeMatch = items.find(
        (it) => it.barcode && it.barcode.replace(/\s+/g, '').toLowerCase() === cleanQ
      );

      if (exactBarcodeMatch) {
        e.preventDefault();
        jumpToProductAndFocus(exactBarcodeMatch.productId);
      } else if (filteredItems.length === 1) {
        e.preventDefault();
        jumpToProductAndFocus(filteredItems[0].productId);
      } else if (filteredItems.length === 0 && /^\d{4,}$/.test(cleanQ)) {
        e.preventDefault();
        setUnknownBarcode(searchQuery.trim());
        setIsUnknownBarcodeModalOpen(true);
      }
    }
  };

  // Save as Draft
  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    setActionSuccessMsg(null);
    try {
      const res = await saveInventoryAuditDoc({
        id: docId,
        docNumber,
        status: 'draft',
        date,
        authorName,
        authorId,
        comment,
        items,
        shortageCount: summary.shortageCount,
        surplusCount: summary.surplusCount,
        exactCount: summary.exactCount,
        shortageCostSum: summary.shortageCostSum,
        shortageRetailSum: summary.shortageRetailSum,
        surplusCostSum: summary.surplusCostSum,
        surplusRetailSum: summary.surplusRetailSum,
        netCostSum: summary.netCostSum,
        netRetailSum: summary.netRetailSum,
        totalAmount: summary.totalAmount,
      });

      if (!docId) {
        setDocId(res.id);
        setDocNumber(res.docNumber);
      }
      setStatus('draft');
      setActionSuccessMsg('Черновик инвентаризации успешно сохранен!');
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      setActionErrorMsg(`Ошибка сохранения черновика: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Finalize and Post Inventory
  const handleCommitAudit = async () => {
    if (summary.uncountedCount > 0) {
      const proceed = safeConfirm(
        `Внимание! Остались не пересчитанные товары (${summary.uncountedCount} поз.). Вы хотите провести инвентаризацию? По не посчитанным товарам расхождения учтены не будут.`
      );
      if (!proceed) return;
    } else {
      const proceed = safeConfirm(
        `Провести инвентаризацию ${docNumber}? После проведения документ будет заблокирован, и вы сможете в 1 клик списать недостачи и оприходовать излишки.`
      );
      if (!proceed) return;
    }

    setIsSubmitting(true);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);
    try {
      const res = await saveInventoryAuditDoc({
        id: docId,
        docNumber,
        status: 'posted',
        date,
        authorName,
        authorId,
        comment,
        items,
        shortageCount: summary.shortageCount,
        surplusCount: summary.surplusCount,
        exactCount: summary.exactCount,
        shortageCostSum: summary.shortageCostSum,
        shortageRetailSum: summary.shortageRetailSum,
        surplusCostSum: summary.surplusCostSum,
        surplusRetailSum: summary.surplusRetailSum,
        netCostSum: summary.netCostSum,
        netRetailSum: summary.netRetailSum,
        totalAmount: summary.totalAmount,
      });

      if (!docId) {
        setDocId(res.id);
        setDocNumber(res.docNumber);
      }
      setStatus('posted');
      setActionSuccessMsg('Инвентаризация успешно проведена и зафиксирована!');
      setTimeout(() => setActionSuccessMsg(null), 5000);
    } catch (err: any) {
      setActionErrorMsg(`Ошибка проведения инвентаризации: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Automate: Create Write-Off for all shortages
  const handleCreateWriteOff = async () => {
    if (!docId) return;
    if (summary.shortageCount === 0) {
      setActionErrorMsg('В документе нет недостач для списания.');
      return;
    }

    const confirmMsg = `Создать документ списания на все ${summary.shortageCount} поз. с недостачей на сумму ${summary.shortageCostSum.toLocaleString('ru-RU')} ₽ (по себестоимости)? Товары будут списаны со склада в Firestore.`;
    if (!safeConfirm(confirmMsg)) return;

    setIsSubmitting(true);
    setActionErrorMsg(null);
    try {
      const currentDocObj: StoreInventoryDoc = {
        id: docId,
        docNumber,
        type: 'inventory',
        status,
        date,
        authorName,
        authorId,
        items,
        totalAmount: summary.totalAmount,
      };

      const res = await createWriteOffFromAudit({
        auditDoc: currentDocObj,
        authorName,
        authorId,
      });

      setWriteOffDocNumber(res.writeOffDocNumber);
      setActionSuccessMsg(
        `Документ списания ${res.writeOffDocNumber} успешно создан и проведен! Товары списаны со склада.`
      );
      setTimeout(() => setActionSuccessMsg(null), 6000);
    } catch (err: any) {
      setActionErrorMsg(`Ошибка создания списания: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Automate: Create Receipt for all surpluses
  const handleCreateReceipt = async () => {
    if (!docId) return;
    if (summary.surplusCount === 0) {
      setActionErrorMsg('В документе нет излишков для оприходования.');
      return;
    }

    const confirmMsg = `Создать документ оприходования на все ${summary.surplusCount} поз. с излишками на сумму ${summary.surplusCostSum.toLocaleString('ru-RU')} ₽? Товары будут добавлены на склад в Firestore.`;
    if (!safeConfirm(confirmMsg)) return;

    setIsSubmitting(true);
    setActionErrorMsg(null);
    try {
      const currentDocObj: StoreInventoryDoc = {
        id: docId,
        docNumber,
        type: 'inventory',
        status,
        date,
        authorName,
        authorId,
        items,
        totalAmount: summary.totalAmount,
      };

      const res = await createReceiptFromAudit({
        auditDoc: currentDocObj,
        authorName,
        authorId,
      });

      setReceiptDocNumber(res.receiptDocNumber);
      setActionSuccessMsg(
        `Документ оприходования ${res.receiptDocNumber} успешно создан и проведен! Товары добавлены на склад.`
      );
      setTimeout(() => setActionSuccessMsg(null), 6000);
    } catch (err: any) {
      setActionErrorMsg(`Ошибка создания оприходования: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Print official inventory audit statement & cashier report
  const handlePrint = () => {
    let printWindow: Window | null = null;
    try {
      printWindow = window.open('', '_blank');
    } catch (_) {
      printWindow = null;
    }

    if (!printWindow) {
      window.print();
      return;
    }

    const discrepancyRows = items
      .filter((it) => it.actualQty !== null && it.actualQty !== undefined && it.diff !== 0)
      .map(
        (it, idx) => `
        <tr style="background-color: ${it.diff! < 0 ? '#fff1f2' : '#f0fdf4'};">
          <td style="border: 1px solid #ccc; padding: 6px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #ccc; padding: 6px; font-weight: bold;">${it.name}</td>
          <td style="border: 1px solid #ccc; padding: 6px; font-family: monospace;">${it.barcode || '—'}</td>
          <td style="border: 1px solid #ccc; padding: 6px; text-align: right;">${it.bookQty} шт</td>
          <td style="border: 1px solid #ccc; padding: 6px; text-align: right; font-weight: bold;">${it.actualQty} шт</td>
          <td style="border: 1px solid #ccc; padding: 6px; text-align: right; font-weight: bold; color: ${it.diff! < 0 ? '#b91c1c' : '#15803d'};">
            ${it.diff! > 0 ? '+' : ''}${it.diff} шт
          </td>
          <td style="border: 1px solid #ccc; padding: 6px; text-align: right;">${it.price.toLocaleString('ru-RU')} ₽</td>
          <td style="border: 1px solid #ccc; padding: 6px; text-align: right; font-weight: bold; color: ${it.diff! < 0 ? '#b91c1c' : '#15803d'};">
            ${(it.diffCost || 0).toLocaleString('ru-RU')} ₽
          </td>
          <td style="border: 1px solid #ccc; padding: 6px; text-align: right;">${(it.retailPrice || 0).toLocaleString('ru-RU')} ₽</td>
          <td style="border: 1px solid #ccc; padding: 6px; text-align: right; font-weight: bold; color: ${it.diff! < 0 ? '#b91c1c' : '#15803d'};">
            ${(it.diffRetail || 0).toLocaleString('ru-RU')} ₽
          </td>
        </tr>
      `
      )
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Акт инвентаризации ${docNumber}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #0f172a; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            .header-info { font-size: 13px; color: #475569; margin-bottom: 20px; }
            .cashier-box { background: #fee2e2; border: 2px solid #ef4444; border-radius: 8px; padding: 16px; margin: 20px 0; }
            .cashier-title { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #991b1b; }
            .cashier-amount { font-size: 24px; font-weight: 900; color: #b91c1c; font-family: monospace; margin: 4px 0; }
            .cashier-sub { font-size: 12px; color: #7f1d1d; }
            .summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 16px 0; }
            .summary-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11px; }
            th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px 6px; text-align: left; }
            .signatures { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; }
            .sig-line { width: 220px; border-bottom: 1px solid #000; margin-top: 25px; }
          </style>
        </head>
        <body>
          <h1>СЛИЧИТЕЛЬНАЯ ВЕДОМОСТЬ РЕЗУЛЬТАТОВ ИНВЕНТАРИЗАЦИИ</h1>
          <div class="header-info">
            Документ №: <strong>${docNumber}</strong> | Дата проведения: <strong>${date}</strong> | Ответственный: <strong>${authorName}</strong> | Статус: <strong>${status === 'posted' ? 'ПРОВЕДЕН' : 'ЧЕРНОВИК'}</strong>
          </div>

          <div class="cashier-box">
            <div class="cashier-title">Сводка для кассира (Сумма к удержанию за недостачу)</div>
            <div class="cashier-amount">Общая сумма недостачи по розничным ценам: ${summary.shortageRetailSum.toLocaleString('ru-RU')} ₽</div>
            <div class="cashier-sub">Позиций с недостачей: ${summary.shortageCount} шт. (${summary.shortagePcs} единиц товара). Сумма недостачи по закупочной себестоимости: ${summary.shortageCostSum.toLocaleString('ru-RU')} ₽.</div>
          </div>

          <div class="summary-grid">
            <div class="summary-card">
              <strong>Недостачи:</strong> ${summary.shortageCount} поз. (${summary.shortagePcs} шт.)<br/>
              По себестоимости: <strong>-${summary.shortageCostSum.toLocaleString('ru-RU')} ₽</strong><br/>
              По розничной цене: <strong>-${summary.shortageRetailSum.toLocaleString('ru-RU')} ₽</strong>
            </div>
            <div class="summary-card">
              <strong>Излишки:</strong> ${summary.surplusCount} поз. (${summary.surplusPcs} шт.)<br/>
              По себестоимости: <strong>+${summary.surplusCostSum.toLocaleString('ru-RU')} ₽</strong><br/>
              По розничной цене: <strong>+${summary.surplusRetailSum.toLocaleString('ru-RU')} ₽</strong>
            </div>
            <div class="summary-card">
              <strong>Итоговое сальдо:</strong><br/>
              По себестоимости: <strong>${summary.netCostSum >= 0 ? '+' : ''}${summary.netCostSum.toLocaleString('ru-RU')} ₽</strong><br/>
              По рознице: <strong>${summary.netRetailSum >= 0 ? '+' : ''}${summary.netRetailSum.toLocaleString('ru-RU')} ₽</strong>
            </div>
          </div>

          <h3>Товары с выявленными расхождениями (${items.filter((it) => it.actualQty !== null && it.diff !== 0).length} поз.)</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th>Наименование товара</th>
                <th>Штрихкод</th>
                <th style="text-align: right;">Расчетный</th>
                <th style="text-align: right;">Факт</th>
                <th style="text-align: right;">Расхождение</th>
                <th style="text-align: right;">Закупка (₽)</th>
                <th style="text-align: right;">Сумма закупка</th>
                <th style="text-align: right;">Розница (₽)</th>
                <th style="text-align: right;">Сумма розница</th>
              </tr>
            </thead>
            <tbody>
              ${discrepancyRows || '<tr><td colspan="10" style="text-align: center; padding: 20px;">Расхождений не выявлено. Фактические остатки совпадают с расчетными.</td></tr>'}
            </tbody>
          </table>

          <div class="signatures">
            <div>
              Члены комиссии / Проверяющий:
              <div class="sig-line"></div>
              <small>(${authorName})</small>
            </div>
            <div>
              Материально ответственное лицо (Кассир):
              <div class="sig-line"></div>
              <small>(С результатами сличительной ведомости ознакомлен)</small>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-7xl h-[96vh] flex flex-col overflow-hidden animate-in zoom-in-95">
          {/* Header */}
          <div className="p-4 sm:p-5 bg-slate-900 dark:bg-slate-950 text-white shrink-0 flex items-center justify-between gap-3 border-b border-slate-800">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-sm shrink-0">
                <ClipboardCheck className="w-5 h-5 text-indigo-100" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-sm sm:text-base">Инвентаризация товаров (МойСклад)</h3>
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    {docNumber}
                  </span>
                  {status === 'posted' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      <Lock className="w-3 h-3" />
                      <span>Проведен (Заблокирован)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      <span>Черновик</span>
                    </span>
                  )}
                  {/* Active Hardware Scanner Badge */}
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 hidden sm:inline-flex"
                    title="Глобальный сканер активен: считывание штрихкода в любой момент найдет товар и сфокусирует ввод фактического остатка"
                  >
                    <ScanLine className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span>Сканер штрихкодов активен</span>
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  Постраничный рендеринг (порциями по {pageSize}), аппаратный сканер и расчет недостачи для кассы
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition"
                title="Печать сличительной ведомости и отчета для кассира"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Печать</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scanner Feedback Notification Toast */}
          {scannedFeedback && (
            <div
              className={`p-2.5 text-xs font-bold flex items-center justify-between shrink-0 animate-in fade-in transition ${
                scannedFeedback.isError
                  ? 'bg-rose-500 text-white'
                  : 'bg-emerald-600 text-white shadow-md'
              }`}
            >
              <div className="flex items-center gap-2">
                <ScanLine className="w-4 h-4 shrink-0" />
                <span>{scannedFeedback.text}</span>
              </div>
              <button
                onClick={() => setScannedFeedback(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Warning when attempting to scan archived product */}
          {archivedAlertProduct && (
            <div className="p-3.5 bg-rose-600 text-white font-bold text-xs flex items-center justify-between shrink-0 animate-in fade-in shadow-lg border-b border-rose-700">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-200 shrink-0" />
                <div>
                  <span className="block font-black">
                    Внимание! Этот товар находится в архиве. Перейдите в карточку товара, чтобы восстановить его
                  </span>
                  <span className="text-[11px] font-normal text-rose-100">
                    Товар: {archivedAlertProduct.name} {archivedAlertProduct.barcode ? `(${archivedAlertProduct.barcode})` : ''}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProductCard({ id: archivedAlertProduct.id, name: archivedAlertProduct.name });
                    setArchivedAlertProduct(null);
                  }}
                  className="px-3 py-1.5 bg-white text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-black shadow-xs transition cursor-pointer"
                >
                  Перейти в карточку
                </button>
                <button
                  type="button"
                  onClick={() => setArchivedAlertProduct(null)}
                  className="p-1 text-rose-200 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Success / Info Feedback Banner */}
          {actionSuccessMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-bold flex items-center justify-between shrink-0 animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{actionSuccessMsg}</span>
              </div>
              <button
                onClick={() => setActionSuccessMsg(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Error Feedback Banner */}
          {actionErrorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs font-bold flex items-center justify-between shrink-0 animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{actionErrorMsg}</span>
              </div>
              <button
                onClick={() => setActionErrorMsg(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Document Parameters & Automation Links */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 shrink-0 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Дата проведения
                </label>
                <input
                  type="date"
                  disabled={status === 'posted'}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-900/40 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Ответственный сотрудник
                </label>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-semibold text-xs">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{authorName}</span>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Примечание к описи
                </label>
                <input
                  type="text"
                  disabled={status === 'posted'}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Причина инвентаризации, номер приказа, зона пересчета..."
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-900/40 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* If Posted: Show automation badge links for created write-off and receipt */}
            {status === 'posted' && (writeOffDocNumber || receiptDocNumber) && (
              <div className="p-2.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200 font-bold">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Складские корректировки проведены:</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {writeOffDocNumber && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 font-mono font-bold text-xs border border-rose-200 dark:border-rose-800">
                      <ArrowDownRight className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      <span>Списание недостач: {writeOffDocNumber}</span>
                    </span>
                  )}
                  {receiptDocNumber && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 font-mono font-bold text-xs border border-emerald-200 dark:border-emerald-800">
                      <PackagePlus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Оприходование излишков: {receiptDocNumber}</span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Search, Filter Bar and Helpers */}
          <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Поиск по названию или штрихкоду (Enter для перехода)..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-700 dark:text-slate-200"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Filter Buttons */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => handleFilterTypeChange('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  filterType === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Все ({items.length})
              </button>
              <button
                type="button"
                onClick={() => handleFilterTypeChange('discrepancies')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  filterType === 'discrepancies'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                }`}
              >
                Расхождения ({summary.shortageCount + summary.surplusCount})
              </button>
              <button
                type="button"
                onClick={() => handleFilterTypeChange('shortages')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  filterType === 'shortages'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                }`}
              >
                Недостачи ({summary.shortageCount})
              </button>
              <button
                type="button"
                onClick={() => handleFilterTypeChange('surpluses')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  filterType === 'surpluses'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                }`}
              >
                Излишки ({summary.surplusCount})
              </button>
              <button
                type="button"
                onClick={() => handleFilterTypeChange('uncounted')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  filterType === 'uncounted'
                    ? 'bg-slate-800 dark:bg-slate-600 text-white shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Не посчитано ({summary.uncountedCount})
              </button>
            </div>

            {/* Quick Fill Helpers (Draft only) */}
            {status !== 'posted' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleFillAllWithBook}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
                  title="Скопировать расчетный остаток в фактический для всех товаров"
                >
                  Заполнить по расчетным
                </button>
                <button
                  type="button"
                  onClick={handleClearAllActual}
                  className="px-2 py-1 text-[11px] font-bold text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                  title="Очистить все введенные фактические остатки"
                >
                  Очистить
                </button>
              </div>
            )}
          </div>

          {/* Table Container with Strictly 7 MoySklad Columns */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50/50 dark:bg-slate-950/50">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase font-bold sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 select-none shadow-2xs">
                <tr>
                  <th className="py-2.5 px-3 w-8 text-center text-slate-400">#</th>
                  <th className="py-2.5 px-3 min-w-[220px]">Наименование</th>
                  <th className="py-2.5 px-3 w-32 font-mono">Штрихкод</th>
                  <th className="py-2.5 px-3 text-right w-28">Расчетный остаток</th>
                  <th className="py-2.5 px-3 text-center w-36">
                    Фактический остаток <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-normal">(ввод)</span>
                  </th>
                  <th className="py-2.5 px-3 text-right w-32">Расхождение (шт)</th>
                  <th className="py-2.5 px-3 text-right w-36">Разница по себестоимости</th>
                  <th className="py-2.5 px-4 text-right w-36">Разница по рознице</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {pagedItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Товары не найдены по выбранным фильтрам
                    </td>
                  </tr>
                ) : (
                  pagedItems.map((it, idx) => {
                    const globalIdx = (safeCurrentPage - 1) * pageSize + idx + 1;
                    const isCounted = it.actualQty !== null && it.actualQty !== undefined;
                    const diff = it.diff ?? 0;
                    const isShortage = isCounted && diff < 0;
                    const isSurplus = isCounted && diff > 0;
                    const isExact = isCounted && diff === 0;
                    const isHighlighted = highlightedProdId === it.productId;

                    let rowBg = 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50';
                    if (isHighlighted) {
                      rowBg = 'bg-amber-100/70 dark:bg-amber-950/60 ring-2 ring-indigo-500 animate-pulse';
                    } else if (isShortage) {
                      rowBg = 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70 dark:hover:bg-rose-950/40';
                    } else if (isSurplus) {
                      rowBg = 'bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40';
                    }

                    return (
                      <tr key={it.productId} className={`transition ${rowBg}`}>
                        {/* 0. Index */}
                        <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-400">
                          {globalIdx}
                        </td>

                        {/* 1. Наименование (Clickable Product Card Link) */}
                        <td className="py-2 px-3 min-w-[220px]">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedProductCard({
                                id: it.productId,
                                name: it.name,
                              })
                            }
                            className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer text-left transition block truncate max-w-md"
                            title="Открыть карточку товара"
                          >
                            {it.name}
                          </button>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                            <span>Категория: {it.category || 'Общее'}</span>
                            <span>• Закупка: {it.price.toLocaleString('ru-RU')} ₽</span>
                            <span>• Розница: {(it.retailPrice || 0).toLocaleString('ru-RU')} ₽</span>
                          </div>
                        </td>

                        {/* 2. Штрихкод */}
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {it.barcode ? (
                            <span className="inline-flex items-center gap-1">
                              <Barcode className="w-3.5 h-3.5 text-slate-400" />
                              <span>{it.barcode}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>

                        {/* 3. Расчетный остаток (из базы) */}
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {it.bookQty} шт.
                        </td>

                        {/* 4. Фактический остаток (input) */}
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <input
                            ref={(el) => {
                              inputRefs.current[it.productId] = el;
                            }}
                            type="number"
                            min="0"
                            step="1"
                            disabled={status === 'posted'}
                            placeholder="—"
                            value={it.actualQty !== null && it.actualQty !== undefined ? it.actualQty : ''}
                            onChange={(e) => handleActualQtyChange(it.productId, e.target.value)}
                            onKeyDown={(e) => handleInputKeyDown(e, it.productId)}
                            className={`w-24 text-center py-1 px-2 text-xs font-mono font-bold rounded-lg border transition focus:outline-none focus:ring-2 ${
                              status === 'posted'
                                ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-300 cursor-not-allowed select-none'
                                : isShortage
                                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200 focus:ring-rose-500'
                                : isSurplus
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 focus:ring-emerald-500'
                                : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-indigo-500 hover:border-indigo-400'
                            }`}
                          />
                        </td>

                        {/* 5. Расхождение (шт) */}
                        <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap">
                          {!isCounted ? (
                            <span className="text-slate-300 dark:text-slate-600 text-[11px] font-normal">— не посчитан</span>
                          ) : isShortage ? (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 font-black">
                              <TrendingDown className="w-3 h-3" />
                              <span>{diff} шт.</span>
                            </span>
                          ) : isSurplus ? (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 font-black">
                              <TrendingUp className="w-3 h-3" />
                              <span>+{diff} шт.</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">0 (точно)</span>
                          )}
                        </td>

                        {/* 6. Разница по себестоимости (₽) */}
                        <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap">
                          {!isCounted ? (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          ) : isShortage ? (
                            <span className="text-rose-700 dark:text-rose-400 font-bold">
                              {(it.diffCost || 0).toLocaleString('ru-RU')} ₽
                            </span>
                          ) : isSurplus ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                              +{(it.diffCost || 0).toLocaleString('ru-RU')} ₽
                            </span>
                          ) : (
                            <span className="text-slate-400">0 ₽</span>
                          )}
                        </td>

                        {/* 7. Разница по рознице (₽) */}
                        <td className="py-2 px-4 text-right font-mono font-bold whitespace-nowrap">
                          {!isCounted ? (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          ) : isShortage ? (
                            <span className="text-rose-700 dark:text-rose-400 font-black">
                              {(it.diffRetail || 0).toLocaleString('ru-RU')} ₽
                            </span>
                          ) : isSurplus ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-black">
                              +{(it.diffRetail || 0).toLocaleString('ru-RU')} ₽
                            </span>
                          ) : (
                            <span className="text-slate-400">0 ₽</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Navigation Bar (Prevents Lag on 1000s of Products) */}
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 select-none">
            <div className="flex items-center gap-3">
              <span className="text-slate-500 dark:text-slate-400">
                Показано{' '}
                <strong className="text-slate-800 dark:text-slate-200 font-mono">
                  {filteredItems.length === 0
                    ? 0
                    : `${(safeCurrentPage - 1) * pageSize + 1}–${Math.min(
                        safeCurrentPage * pageSize,
                        filteredItems.length
                      )}`}
                </strong>{' '}
                из <strong className="text-slate-800 dark:text-slate-200 font-mono">{filteredItems.length}</strong> позиций
              </span>

              {/* Page Size Selector (50, 100, 200) */}
              <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 dark:border-slate-700 pl-3">
                <span className="text-slate-400 text-[11px]">Порциями:</span>
                {[50, 100, 200].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => {
                      setPageSize(sz);
                      setCurrentPage(1);
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono transition ${
                      pageSize === sz
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Pagination Buttons */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage(1)}
                  className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Первая страница"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Назад</span>
                </button>

                <span className="px-3 py-1 font-mono font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                  {safeCurrentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center gap-1"
                >
                  <span>Вперед</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Последняя страница"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Sticky Bottom Section: Financial Summaries & Prominent Cashier Callout */}
          <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-xl shrink-0 p-4 sm:p-5 space-y-3">
            {/* Prominent Cashier Accountability Box */}
            <div className="bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 dark:text-rose-300 block">
                    Итоговый отчет для кассира (Сумма к удержанию за недостачу)
                  </span>
                  <div className="text-lg sm:text-2xl font-black font-mono text-rose-700 dark:text-rose-300 tracking-tight mt-0.5">
                    Сумма недостачи по розничным ценам:{' '}
                    <span className="underline decoration-rose-400 underline-offset-2">
                      {summary.shortageRetailSum.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                  <p className="text-xs text-rose-800 dark:text-rose-200 mt-1">
                    Именно эту сумму по розничным ценам магазин предъявляет кассиру / смене для компенсации недостачи в торговом зале.
                  </p>
                </div>
              </div>

              {/* Counts of shortages */}
              <div className="text-right sm:border-l sm:border-rose-200 dark:sm:border-rose-800 sm:pl-4 shrink-0">
                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 block">
                  Позиций с недостачей: {summary.shortageCount} шт.
                </span>
                <span className="text-[11px] font-mono text-rose-600 dark:text-rose-400 block">
                  Всего единиц: -{summary.shortagePcs} шт.
                </span>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block">
                  По закупке: -{summary.shortageCostSum.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            </div>

            {/* General Totals Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Прогресс счета</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
                  {summary.countedCount} из {summary.totalItems} позиций (
                  {Math.round((summary.countedCount / (summary.totalItems || 1)) * 100)}%)
                </span>
                {summary.uncountedCount > 0 && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block">
                    Осталось: {summary.uncountedCount} поз.
                  </span>
                )}
              </div>

              <div className="bg-emerald-50/50 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase block">
                  Выявленные излишки
                </span>
                <span className="font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-0.5 block">
                  +{summary.surplusRetailSum.toLocaleString('ru-RU')} ₽ (розница)
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono block">
                  +{summary.surplusPcs} шт. (+{summary.surplusCostSum.toLocaleString('ru-RU')} ₽ закупка)
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  Итоговое сальдо (Себестоимость)
                </span>
                <span
                  className={`font-black font-mono text-sm mt-0.5 block ${
                    summary.netCostSum < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {summary.netCostSum >= 0 ? '+' : ''}
                  {summary.netCostSum.toLocaleString('ru-RU')} ₽
                </span>
                <span className="text-[10px] text-slate-400 block">Разница излишков и недостач</span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  Итоговое сальдо (Розница)
                </span>
                <span
                  className={`font-black font-mono text-sm mt-0.5 block ${
                    summary.netRetailSum < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {summary.netRetailSum >= 0 ? '+' : ''}
                  {summary.netRetailSum.toLocaleString('ru-RU')} ₽
                </span>
                <span className="text-[10px] text-slate-400 block">Финансовый итог для зала</span>
              </div>
            </div>

            {/* Bottom Action Buttons: Draft vs Posted */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2 flex-wrap">
                {status === 'posted' ? (
                  <>
                    {/* Automated Write-Off Button */}
                    <button
                      type="button"
                      disabled={isSubmitting || summary.shortageCount === 0 || !!writeOffDocNumber}
                      onClick={handleCreateWriteOff}
                      className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
                      title={
                        writeOffDocNumber
                          ? `Списание уже создано: ${writeOffDocNumber}`
                          : 'Сформировать документ списания недостач и скорректировать остатки'
                      }
                    >
                      <ArrowDownRight className="w-4 h-4" />
                      <span>
                        {writeOffDocNumber
                          ? `Списание ${writeOffDocNumber} создано`
                          : `Создать списание (${summary.shortageCount} поз.)`}
                      </span>
                    </button>

                    {/* Automated Receipt Button */}
                    <button
                      type="button"
                      disabled={isSubmitting || summary.surplusCount === 0 || !!receiptDocNumber}
                      onClick={handleCreateReceipt}
                      className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
                      title={
                        receiptDocNumber
                          ? `Оприходование уже создано: ${receiptDocNumber}`
                          : 'Сформировать документ оприходования излишков и скорректировать остатки'
                      }
                    >
                      <PackagePlus className="w-4 h-4" />
                      <span>
                        {receiptDocNumber
                          ? `Оприходование ${receiptDocNumber} создано`
                          : `Создать оприходование (${summary.surplusCount} поз.)`}
                      </span>
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Заполните фактические остатки и проведите инвентаризацию для автоматического создания документов
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Закрыть
                </button>

                {status !== 'posted' && (
                  <>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleSaveDraft}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="w-4 h-4 text-slate-500" />
                      <span>{isSubmitting ? 'Сохранение...' : 'Сохранить черновик'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleCommitAudit}
                      className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-black transition shadow-md active:scale-95 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isSubmitting ? 'Проведение...' : 'Провести инвентаризацию'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Card Modal on clicking product name */}
      <ProductCardModal
        isOpen={!!selectedProductCard}
        onClose={() => setSelectedProductCard(null)}
        productId={selectedProductCard?.id || null}
        products={products}
        fallbackName={selectedProductCard?.name}
      />

      {/* Unknown Barcode Confirmation Modal */}
      <UnknownBarcodeModal
        isOpen={isUnknownBarcodeModalOpen}
        barcode={unknownBarcode || ''}
        onCreateProduct={(code) => {
          setIsUnknownBarcodeModalOpen(false);
          setNewCardInitialBarcode(code || unknownBarcode || '');
          setIsCreateCardModalOpen(true);
        }}
        onClose={() => {
          setIsUnknownBarcodeModalOpen(false);
          setUnknownBarcode(null);
        }}
      />

      {/* Product Card Modal for Creating New Product from Unknown Barcode */}
      <ProductCardModal
        isOpen={isCreateCardModalOpen}
        onClose={() => {
          setIsCreateCardModalOpen(false);
          setNewCardInitialBarcode(undefined);
          setUnknownBarcode(null);
        }}
        productId={null}
        initialBarcode={newCardInitialBarcode}
        products={products}
      />
    </>
  );
};
