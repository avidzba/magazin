import React, { useState, useRef, useEffect } from 'react';
import {
  StoreProduct,
  StoreCustomer,
  CartItem,
  OrderItem,
  PaymentMethod,
  StoreShift,
  StoreSupplier,
} from '../types';
import { processCheckout } from '../services/storeService';
import { CashPaymentModal } from './CashPaymentModal';
import { DebtCustomerModal } from './DebtCustomerModal';
import { ReceiptSlipModal } from './ReceiptSlipModal';
import { CashFlowModal } from './CashFlowModal';
import { OpenShiftModal } from './OpenShiftModal';
import { CloseShiftModal } from './CloseShiftModal';
import { CameraScannerModal } from './CameraScannerModal';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { ResizableSplitPane } from './common/ResizableSplitPane';
import { ThemeToggleButton } from '../context/ThemeContext';
import { PWAInstallButton } from './common/PWAInstallButton';
import { UnknownBarcodeModal } from './common/UnknownBarcodeModal';
import { ProductCardModal } from './admin/ProductCardModal';
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Clock,
  UserCheck,
  UserX,
  Layers,
  LayoutGrid,
  List,
  AlertCircle,
  Flame,
  Camera,
  ArrowDownRight,
  FileCheck2,
  Play,
  Lock,
  LogOut,
  ArrowLeft,
} from 'lucide-react';

interface CashierScreenProps {
  products: StoreProduct[];
  customers: StoreCustomer[];
  suppliers?: StoreSupplier[];
  currentShift: StoreShift | null;
  lastClosedShift: StoreShift | null;
  onOpenCustomerDebtScreen: () => void;
  onOpenShift: (startCash: number, cashierName: string) => Promise<void>;
  onCloseShift: (expectedCash: number, actualCash: number) => Promise<void>;
  onAddCashFlow: (data: {
    type: 'in' | 'out';
    amount: number;
    category: string;
    note?: string;
    supplierId?: string;
    supplierName?: string;
  }) => Promise<void>;
  onLogout?: () => void;
  onBackToAdmin?: () => void;
}

export const CashierScreen: React.FC<CashierScreenProps> = ({
  products,
  customers,
  suppliers = [],
  currentShift,
  lastClosedShift,
  onOpenCustomerDebtScreen,
  onOpenShift,
  onCloseShift,
  onAddCashFlow,
  onLogout,
  onBackToAdmin,
}) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Все');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [attachedCustomer, setAttachedCustomer] = useState<StoreCustomer | null>(null);

  // Modals
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isCashFlowModalOpen, setIsCashFlowModalOpen] = useState(false);
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [isUnknownBarcodeModalOpen, setIsUnknownBarcodeModalOpen] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState('');
  const [archivedWarningProduct, setArchivedWarningProduct] = useState<StoreProduct | null>(null);
  const [cardModalProductId, setCardModalProductId] = useState<string | null>(null);
  const [cardModalInitialBarcode, setCardModalInitialBarcode] = useState<string | undefined>(undefined);
  const [isProductCardOpen, setIsProductCardOpen] = useState(false);

  const [lastOrderDetails, setLastOrderDetails] = useState<{
    receiptNumber: string;
    items: OrderItem[];
    totalAmount: number;
    paymentMethod: PaymentMethod;
    customerName?: string | null;
    receivedAmount?: number;
    changeAmount?: number;
  } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Play subtle beep tone when barcode is scanned
  const playScanBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 1046.5; // C6
      gain.gain.value = 0.08;
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (_) {}
  };

  // Global shift status flag (shift is open strictly when currentShift.status === 'open')
  const isShiftOpen = !!currentShift && currentShift.status === 'open';

  // Add product to cart helper
  const addToCart = (product: StoreProduct) => {
    // Hard block if shift is closed
    if (!isShiftOpen) {
      setIsOpenShiftModalOpen(true);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          barcode: product.barcode,
          stockQuantity: product.stockQuantity,
        },
      ];
    });
  };

  // Handle scanned barcode (from USB/Bluetooth hook or Camera)
  const handleBarcodeScanned = (scannedCode: string) => {
    // Hard block if shift is closed
    if (!isShiftOpen) {
      setIsOpenShiftModalOpen(true);
      return;
    }

    const cleanCode = scannedCode.trim().toLowerCase();
    const product = products.find(
      (p) =>
        (p.barcode && p.barcode.toLowerCase() === cleanCode) ||
        (Array.isArray(p.barcodes) && p.barcodes.some((b) => b.toLowerCase() === cleanCode)) ||
        p.id.toLowerCase() === cleanCode
    );

    if (product) {
      const isArchived = product.isActive === false || product.isArchived === true;
      if (isArchived) {
        setArchivedWarningProduct(product);
        setFeedbackMsg({
          type: 'error',
          text: 'Внимание! Этот товар находится в архиве. Перейдите в карточку товара, чтобы восстановить его',
        });
        return;
      }

      setArchivedWarningProduct(null);
      addToCart(product);
      playScanBeep();
      setFeedbackMsg({
        type: 'success',
        text: `Сканирован товар: ${product.name} (+1 в чек)`,
      });
      setTimeout(() => setFeedbackMsg(null), 3000);
    } else {
      // FORBID automatic creation. Show UnknownBarcodeModal
      setUnknownBarcode(scannedCode.trim());
      setIsUnknownBarcodeModalOpen(true);
    }
  };

  // Mount Hardware USB / Bluetooth Scanner Listener
  useBarcodeScanner({
    onScan: (scannedBarcode) => {
      handleBarcodeScanned(scannedBarcode);
    },
  });

  // Categories list
  const categories = ['Все', ...Array.from(new Set(products.map((p) => p.category || 'Общее')))];
  const hotProducts = products.filter((p) => p.isHot && p.isActive !== false && !p.isArchived);

  // Cart totals
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce((sum, item) => sum + item.quantity * item.price, 0);

  // Reactive Shift Counters
  const currentCashInDrawer = currentShift
    ? currentShift.startCash +
      currentShift.totalCash +
      (currentShift.totalCashIn || 0) -
      (currentShift.totalCashOut || 0)
    : 0;
  const currentCardTotal = currentShift ? currentShift.totalCard : 0;
  const currentDebtTotal = currentShift ? currentShift.totalDebt : 0;

  const updateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity: newQty } : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setAttachedCustomer(null);
  };

  // Keyboard Enter in Search Bar
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!isShiftOpen) {
        setIsOpenShiftModalOpen(true);
        return;
      }

      const q = searchQuery.trim().toLowerCase();
      if (!q) return;

      const exact = products.find(
        (p) =>
          (p.barcode && p.barcode.toLowerCase() === q) ||
          (Array.isArray(p.barcodes) && p.barcodes.some((b) => b.toLowerCase() === q)) ||
          p.name.toLowerCase() === q
      );

      if (exact) {
        const isArchived = exact.isActive === false || exact.isArchived === true;
        if (isArchived) {
          setArchivedWarningProduct(exact);
          setFeedbackMsg({
            type: 'error',
            text: 'Внимание! Этот товар находится в архиве. Перейдите в карточку товара, чтобы восстановить его',
          });
          return;
        }
        setArchivedWarningProduct(null);
        addToCart(exact);
        setSearchQuery('');
        return;
      }

      const activeFiltered = filteredProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
      );

      if (activeFiltered.length >= 1) {
        addToCart(activeFiltered[0]);
        setSearchQuery('');
      } else {
        if (q.length >= 3) {
          setUnknownBarcode(searchQuery.trim());
          setIsUnknownBarcodeModalOpen(true);
        }
      }
    }
  };

  // Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (e.key === 'Escape') {
        if (isCashModalOpen) setIsCashModalOpen(false);
        else if (isDebtModalOpen) setIsDebtModalOpen(false);
        else if (isReceiptModalOpen) setIsReceiptModalOpen(false);
        else if (isCashFlowModalOpen) setIsCashFlowModalOpen(false);
        else if (isOpenShiftModalOpen) setIsOpenShiftModalOpen(false);
        else if (isCloseShiftModalOpen) setIsCloseShiftModalOpen(false);
        else if (isCameraScannerOpen) setIsCameraScannerOpen(false);
        else if (cart.length > 0) {
          clearCart();
        }
        return;
      }

      // Hard block sales hotkeys when shift is closed
      if (!isShiftOpen) return;

      if (e.key === 'F2' || (!isInput && e.key === '/')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0) {
          setIsDebtModalOpen(true);
        }
        return;
      }

      if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0) {
          setIsCashModalOpen(true);
        }
        return;
      }

      if (e.key === 'F10') {
        e.preventDefault();
        if (cart.length > 0) {
          handleCardCheckout();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isShiftOpen,
    cart,
    isCashModalOpen,
    isDebtModalOpen,
    isReceiptModalOpen,
    isCashFlowModalOpen,
    isOpenShiftModalOpen,
    isCloseShiftModalOpen,
    isCameraScannerOpen,
  ]);

  // Complete sale
  const completeSale = async (
    paymentMethod: PaymentMethod,
    customer?: StoreCustomer | null,
    receivedAmount?: number,
    changeAmount?: number
  ) => {
    if (!isShiftOpen) {
      setIsOpenShiftModalOpen(true);
      return;
    }
    if (cart.length === 0) return;

    setIsProcessing(true);
    setFeedbackMsg(null);

    const orderItems: OrderItem[] = cart.map((it) => ({
      productId: it.productId,
      name: it.name,
      price: it.price,
      quantity: it.quantity,
      sum: it.quantity * it.price,
    }));

    const cust = customer || attachedCustomer;

    try {
      const receiptNumber = await processCheckout({
        items: orderItems,
        totalAmount,
        paymentMethod,
        customerId: cust?.id || null,
        customerName: cust?.name || null,
        receivedAmount,
        changeAmount,
        shiftId: currentShift ? currentShift.id : null,
      });

      setLastOrderDetails({
        receiptNumber,
        items: orderItems,
        totalAmount,
        paymentMethod,
        customerName: cust?.name,
        receivedAmount,
        changeAmount,
      });

      setCart([]);
      setAttachedCustomer(null);
      setIsCashModalOpen(false);
      setIsDebtModalOpen(false);
      setIsReceiptModalOpen(true);

      setFeedbackMsg({
        type: 'success',
        text: `Чек ${receiptNumber} успешно проведен!`,
      });
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Ошибка при оформлении чека',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCardCheckout = () => {
    if (cart.length === 0) return;
    completeSale('card', attachedCustomer);
  };

  const handleCashConfirm = (received: number, change: number) => {
    completeSale('cash', attachedCustomer, received, change);
  };

  const handleDebtConfirm = (customer: StoreCustomer) => {
    completeSale('debt', customer);
  };

  const filteredProducts = products.filter((p) => {
    // Hide archived items from POS showcase
    if (p.isActive === false || p.isArchived === true) return false;
    const matchesCategory = selectedCategory === 'Все' || p.category === selectedCategory;
    const matchesQuery =
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (Array.isArray(p.barcodes) && p.barcodes.some((b) => b.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="relative flex-1 flex flex-col w-full h-[calc(100vh-3.5rem)] overflow-hidden bg-slate-100">
      {/* Hard Shift Blocking Overlay when shift is closed */}
      {!isShiftOpen && (
        <div className="absolute inset-x-0 bottom-0 top-[52px] z-30 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-20 h-20 rounded-3xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 mx-auto flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-inner">
              <Lock className="w-10 h-10 stroke-[2.2]" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Кассовая смена закрыта
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                Добавление товаров в чек, сканирование штрихкодов и операции продажи заблокированы.
                Откройте смену для начала работы кассы.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsOpenShiftModalOpen(true)}
              className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white rounded-2xl font-black text-base shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-3 transition cursor-pointer"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>Открыть смену</span>
            </button>
          </div>
        </div>
      )}

      {/* TOP BAR: Reactive Shift Counters & Cash Operations */}
      <div className="shrink-0 bg-slate-900 border-b border-slate-800 px-3 py-2 text-white flex flex-wrap items-center justify-between gap-3 shadow-sm select-none">
        {/* 3 Reactive Shift Counters */}
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar py-0.5">
          {/* Counter 1: Cash in Drawer */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700/80 shadow-xs"
            title="Фактические наличные в кассе: остаток на утро + продажи нал + внесения - изъятия"
          >
            <div className="w-7 h-7 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">
                Наличные в кассе
              </span>
              <span className="text-sm font-black text-emerald-400 font-mono leading-none">
                {currentCashInDrawer.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>

          {/* Counter 2: Card / Bank */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700/80 shadow-xs"
            title="Продажи по карте / переводу за текущую смену"
          >
            <div className="w-7 h-7 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">
                Безнал (Карта)
              </span>
              <span className="text-sm font-black text-blue-400 font-mono leading-none">
                {currentCardTotal.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>

          {/* Counter 3: Debt */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700/80 shadow-xs cursor-pointer hover:bg-slate-700/50 transition"
            onClick={onOpenCustomerDebtScreen}
            title="Продажи в долг за смену (нажмите, чтобы открыть Клиенты и Долги)"
          >
            <div className="w-7 h-7 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">
                В долг (смена)
              </span>
              <span className="text-sm font-black text-amber-400 font-mono leading-none">
                {currentDebtTotal.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>
        </div>

        {/* Shift Actions: In/Out, Open/Close */}
        <div className="flex items-center gap-2">
          {isShiftOpen ? (
            <>
              {/* Cash Movement button */}
              <button
                onClick={() => setIsCashFlowModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition active:scale-95 cursor-pointer"
                title="Внесение или изъятие наличных (оплата поставщику, инкассация, з/п)"
              >
                <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                <span>Изъятие / Внесение</span>
              </button>

              {/* Close Shift (Z-Report) */}
              <button
                onClick={() => setIsCloseShiftModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-xs font-semibold text-slate-200 hover:text-rose-300 border border-slate-700 hover:border-rose-500/50 transition active:scale-95 cursor-pointer"
                title="Закрыть смену и сформировать Z-отчет с переходящим остатком"
              >
                <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Закрыть смену (Z-отчет)</span>
              </button>
            </>
          ) : (
            /* Open Shift Button if closed */
            <button
              onClick={() => setIsOpenShiftModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-sm transition active:scale-95 animate-pulse cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Открыть смену</span>
            </button>
          )}

          {/* PWA Install Button (Windows / iPhone) */}
          <PWAInstallButton variant="cashier" />

          {/* Theme Toggle (Sun / Moon) */}
          <ThemeToggleButton variant="dark-bar" showLabel />

          {/* Optional Return to Admin Back-Office (if user is admin) */}
          {onBackToAdmin && (
            <button
              onClick={onBackToAdmin}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs active:scale-95 ml-1 cursor-pointer"
              title="Вернуться в панель управления (Бэк-офис)"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">В Бэк-офис</span>
            </button>
          )}

          {/* Logout Button */}
          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/70 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/50 transition active:scale-95 text-xs font-bold ml-1 cursor-pointer"
              title="Завершить сеанс и выйти"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Выйти</span>
            </button>
          )}
        </div>
      </div>

      {/* Main POS Interface (Left Showcase + Right Cart & Checkout with Resizable Split Pane) */}
      <ResizableSplitPane
        defaultRightWidth={400}
        minRightWidth={300}
        maxRightWidthRatio={0.5}
        storageKey="pos_receipt_width"
        leftContent={
          <div className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-hidden h-full">
            {/* Search, Barcode & Camera Trigger Bar */}
            <div className="p-3 bg-white border-b border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Поиск по названию или сканируйте штрихкод [F2]..."
                  className="w-full pl-9 pr-20 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <Barcode className="w-4 h-4 text-slate-400" />
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-200/70 px-1.5 py-0.5 rounded">
                    USB/BT
                  </span>
                </div>
              </div>

              {/* Camera Scanner Button */}
              <button
                type="button"
                onClick={() => setIsCameraScannerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 transition shrink-0 active:scale-95"
                title="Сканировать штрихкод камерой смартфона / веб-камерой"
              >
                <Camera className="w-4 h-4 text-blue-600" />
                <span className="hidden sm:inline">Камера</span>
              </button>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300 shrink-0">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition ${
                    viewMode === 'grid'
                      ? 'bg-white shadow-2xs text-blue-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Сетка карточек (для планшетов/тач)"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded-md transition ${
                    viewMode === 'table'
                      ? 'bg-white shadow-2xs text-blue-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Компактный список"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Category Chips */}
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Prominent Red Archived Warning Banner */}
          {archivedWarningProduct && (
            <div className="mx-3 my-2 p-3.5 bg-rose-600 text-white rounded-2xl shadow-lg flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertCircle className="w-5 h-5 shrink-0 text-white" />
                <div className="text-xs sm:text-sm font-bold leading-tight">
                  <p>Внимание! Этот товар находится в архиве. Перейдите в карточку товара, чтобы восстановить его</p>
                  <p className="text-rose-200 text-xs font-normal font-mono truncate mt-0.5">
                    {archivedWarningProduct.name} ({archivedWarningProduct.barcode || 'без штрихкода'})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setCardModalProductId(archivedWarningProduct.id);
                    setCardModalInitialBarcode(undefined);
                    setIsProductCardOpen(true);
                  }}
                  className="px-3 py-1.5 bg-white text-rose-700 hover:bg-rose-50 text-xs font-black rounded-xl transition shadow-xs cursor-pointer"
                >
                  Карточка товара
                </button>
                <button
                  type="button"
                  onClick={() => setArchivedWarningProduct(null)}
                  className="p-1 text-rose-200 hover:text-white rounded-lg transition"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Feedback message banner if any */}
          {feedbackMsg && !archivedWarningProduct && (
            <div
              className={`px-4 py-2 text-xs flex items-center justify-between animate-in fade-in ${
                feedbackMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                  : feedbackMsg.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border-b border-rose-200'
                  : 'bg-blue-50 text-blue-800 border-b border-blue-200'
              }`}
            >
              <span className="font-semibold">{feedbackMsg.text}</span>
              <button
                onClick={() => setFeedbackMsg(null)}
                className="font-bold ml-2 text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>
          )}

          {/* Scrollable Catalog Area with Hot Products Block (Independent internal scroll) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {/* 4. "Горячие" товары (Избранное для быстрой продажи на сенсорном экране) */}
            {hotProducts.length > 0 && selectedCategory === 'Все' && !searchQuery && (
              <div>
                <div className="flex items-center gap-1.5 mb-2 px-1">
                  <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Частые покупки (Горячие клавиши)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-2">
                  {hotProducts.map((prod) => {
                    const inCart = cart.find((it) => it.productId === prod.id);
                    const tileBg = prod.hotColor || '#2563eb';

                    return (
                      <button
                        key={prod.id}
                        onClick={() => addToCart(prod)}
                        style={{ backgroundColor: tileBg }}
                        className="relative p-3 rounded-xl text-white shadow-sm hover:opacity-95 active:scale-95 transition flex flex-col justify-between text-left h-24 select-none overflow-hidden group cursor-pointer"
                      >
                        {inCart && (
                          <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white text-slate-900 font-black text-[11px] flex items-center justify-center shadow-md">
                            {inCart.quantity}
                          </span>
                        )}

                        <span className="font-bold text-xs line-clamp-2 leading-tight drop-shadow-xs">
                          {prod.name}
                        </span>

                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-sm font-black font-mono drop-shadow-xs">
                            {prod.price.toLocaleString('ru-RU')} ₽
                          </span>
                          <span className="text-[10px] bg-black/25 px-1.5 py-0.5 rounded font-medium">
                            {prod.stockQuantity} шт
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Standard Catalog Listing */}
            <div>
              {hotProducts.length > 0 && selectedCategory === 'Все' && !searchQuery && (
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
                  Весь каталог товаров
                </div>
              )}

              {filteredProducts.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 py-12">
                  <Layers className="w-12 h-12 stroke-[1.5] text-slate-300 mb-2" />
                  <p className="text-sm font-medium">Товары не найдены</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Попробуйте изменить поисковый запрос или добавьте товары в каталог.
                  </p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5">
                  {filteredProducts.map((prod) => {
                    const inCart = cart.find((it) => it.productId === prod.id);

                    // 5. Цветовая индикация остатков (Складской контроль):
                    // - > 5: обычный дизайн
                    // - > 0 && <= 5: желтая рамка (ring-2 ring-yellow-400) и плашка "Осталось: [X]"
                    // - <= 0: полупрозрачная (opacity-50), красная рамка (ring-2 ring-red-400) и плашка "Нет в наличии"
                    const isOutOfStock = prod.stockQuantity <= 0;
                    const isLowStock = prod.stockQuantity > 0 && prod.stockQuantity <= 5;

                    let stockCardClasses = 'border-slate-200 bg-white hover:border-blue-400';
                    if (isOutOfStock) {
                      stockCardClasses = 'opacity-55 border-rose-300 ring-2 ring-rose-400/40 bg-rose-50/10';
                    } else if (isLowStock) {
                      stockCardClasses = 'border-amber-400 ring-2 ring-amber-400/80 bg-amber-50/20';
                    }

                    return (
                      <div
                        key={prod.id}
                        onClick={() => addToCart(prod)}
                        className={`relative p-3 rounded-xl border cursor-pointer select-none transition shadow-2xs hover:shadow-md active:scale-[0.98] flex flex-col justify-between ${stockCardClasses} ${
                          inCart ? 'ring-2 ring-blue-500 border-blue-500' : ''
                        }`}
                      >
                        {inCart && (
                          <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-md animate-in zoom-in-75">
                            {inCart.quantity}
                          </span>
                        )}

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">
                              {prod.category || 'Общее'}
                            </span>
                            {prod.barcode && (
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 rounded">
                                {prod.barcode}
                              </span>
                            )}
                          </div>

                          <h4 className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug">
                            {prod.name}
                          </h4>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-baseline justify-between">
                          <div className="text-sm font-extrabold text-slate-900 font-mono">
                            {prod.price.toLocaleString('ru-RU')} ₽
                          </div>

                          {/* Stock Badges */}
                          {isOutOfStock ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-300">
                              Нет в наличии
                            </span>
                          ) : isLowStock ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                              Осталось: {prod.stockQuantity}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {prod.stockQuantity} шт
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Table View */
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200 select-none">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Наименование</th>
                        <th className="py-2.5 px-3 font-semibold">Категория</th>
                        <th className="py-2.5 px-3 font-semibold">Штрихкод</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Остаток</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Цена</th>
                        <th className="py-2.5 px-3 text-center">Добавить</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProducts.map((prod) => {
                        const isOutOfStock = prod.stockQuantity <= 0;
                        const isLowStock = prod.stockQuantity > 0 && prod.stockQuantity <= 5;

                        return (
                          <tr
                            key={prod.id}
                            onClick={() => addToCart(prod)}
                            className={`hover:bg-blue-50/50 cursor-pointer transition group ${
                              isOutOfStock ? 'opacity-50 bg-rose-50/20' : isLowStock ? 'bg-amber-50/20' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3 font-medium text-slate-900 group-hover:text-blue-700">
                              {prod.name}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">{prod.category || 'Общее'}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-400">{prod.barcode || '—'}</td>
                            <td className="py-2.5 px-3 text-right">
                              {isOutOfStock ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                                  Нет в наличии
                                </span>
                              ) : isLowStock ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                                  Осталось: {prod.stockQuantity}
                                </span>
                              ) : (
                                <span className="text-slate-700 font-semibold">{prod.stockQuantity} шт</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                              {prod.price.toLocaleString('ru-RU')} ₽
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                className="p-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      }
      rightContent={
          <div className="flex flex-col h-full bg-gray-50 select-none min-h-0">
          {/* Receipt Header (Pinned) */}
          <div className="shrink-0 p-3.5 bg-slate-900 text-white flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight">Текущий чек</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                  {cart.length > 0 ? `${totalQuantity} шт.` : 'Пусто'}
                </span>
              </div>
              {attachedCustomer ? (
                <div className="flex items-center gap-1.5 text-xs text-amber-300 mt-0.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span className="font-semibold truncate max-w-[180px]">{attachedCustomer.name}</span>
                  <button
                    onClick={() => setAttachedCustomer(null)}
                    className="text-slate-400 hover:text-white text-[11px]"
                    title="Открепить клиента"
                  >
                    <UserX className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <span className="text-[11px] text-slate-400">Розничный покупатель</span>
              )}
            </div>

            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 transition"
                title="Очистить чек (Esc)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Очистить (Esc)</span>
              </button>
            )}
          </div>

          {/* Cart Line Items (Scrollable upper section: flex-1 overflow-y-auto) */}
          <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-100 min-h-0 bg-white">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                <Clock className="w-10 h-10 text-slate-200 mb-2" />
                <p className="text-sm font-medium text-slate-500">Чек пуст</p>
                <p className="text-xs text-slate-400 text-center max-w-[220px] mt-1">
                  Выберите товары слева, нажмите на плитку или отсканируйте штрихкод.
                </p>
              </div>
            ) : (
              cart.map((item) => {
                const liveProduct = products.find((p) => p.id === item.productId);
                const currentStock = liveProduct !== undefined ? liveProduct.stockQuantity : item.stockQuantity;
                const isOverStock = currentStock < item.quantity;

                return (
                  <div
                    key={item.productId}
                    className="py-2.5 flex items-center justify-between gap-2 group"
                  >
                    <div className="flex-1 min-w-0">
                      <h5 className="text-xs font-semibold text-slate-900 truncate">
                        {item.name}
                      </h5>
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 flex-wrap">
                        <span>{item.price.toLocaleString('ru-RU')} ₽ / шт.</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            currentStock <= 0
                              ? 'bg-rose-100 text-rose-700'
                              : isOverStock
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          Склад: {currentStock} шт
                        </span>
                      </div>
                    </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateQuantity(item.productId, parseInt(e.target.value) || 1)
                      }
                      className="w-10 text-center text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-md py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Line Total */}
                  <div className="w-20 text-right shrink-0">
                    <div className="text-xs font-bold text-slate-900 font-mono">
                      {(item.quantity * item.price).toLocaleString('ru-RU')} ₽
                    </div>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="text-[10px] text-slate-400 hover:text-rose-500"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              );
            })
          )}
          </div>

          {/* Cart Summary & Checkout Footer (ALWAYS PINNED TO BOTTOM: mt-auto shrink-0 bg-white border-t p-4) */}
          <div className="mt-auto shrink-0 bg-white border-t border-slate-200 p-4 shadow-sm">
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-xs uppercase font-bold text-slate-500">
                ИТОГО К ОПЛАТЕ:
              </span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {totalAmount.toLocaleString('ru-RU')} ₽
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {/* Cash Button */}
                <button
                  type="button"
                  disabled={cart.length === 0 || isProcessing}
                  onClick={() => setIsCashModalOpen(true)}
                  className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 shadow-sm transition active:scale-95"
                >
                  <div className="flex items-center gap-1.5">
                    <Banknote className="w-4 h-4" />
                    <span>Наличные</span>
                  </div>
                  <span className="text-[10px] text-emerald-200 font-normal">F9</span>
                </button>

                {/* Card / Transfer Button */}
                <button
                  type="button"
                  disabled={cart.length === 0 || isProcessing}
                  onClick={handleCardCheckout}
                  className="py-3 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 shadow-sm transition active:scale-95"
                >
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4" />
                    <span>Карта / Перевод</span>
                  </div>
                  <span className="text-[10px] text-blue-200 font-normal">F10</span>
                </button>
              </div>

              {/* Debt Button */}
              <button
                type="button"
                disabled={cart.length === 0 || isProcessing}
                onClick={() => setIsDebtModalOpen(true)}
                className="w-full py-3 px-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:pointer-events-none text-slate-950 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 border border-amber-600/30"
              >
                <AlertCircle className="w-4 h-4 text-slate-950" />
                <span>В ДОЛГ (КЛИЕНТУ)</span>
                <span className="text-[10px] bg-amber-600/30 px-1.5 py-0.5 rounded text-slate-950 font-mono">
                  F8
                </span>
              </button>
            </div>
          </div>
        </div>
      }
    />

      {/* Cash Calculation Modal */}
      <CashPaymentModal
        isOpen={isCashModalOpen}
        onClose={() => setIsCashModalOpen(false)}
        totalAmount={totalAmount}
        onConfirm={handleCashConfirm}
      />

      {/* Debt Customer Selection Modal */}
      <DebtCustomerModal
        isOpen={isDebtModalOpen}
        onClose={() => setIsDebtModalOpen(false)}
        customers={customers}
        totalAmount={totalAmount}
        onSelectCustomerAndConfirm={handleDebtConfirm}
      />

      {/* Printable Receipt Modal */}
      {lastOrderDetails && (
        <ReceiptSlipModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          receiptNumber={lastOrderDetails.receiptNumber}
          items={lastOrderDetails.items}
          totalAmount={lastOrderDetails.totalAmount}
          paymentMethod={lastOrderDetails.paymentMethod}
          customerName={lastOrderDetails.customerName}
          receivedAmount={lastOrderDetails.receivedAmount}
          changeAmount={lastOrderDetails.changeAmount}
        />
      )}

      {/* Cash Flow Modal (Изъятие / Внесение) */}
      {currentShift && (
        <CashFlowModal
          isOpen={isCashFlowModalOpen}
          onClose={() => setIsCashFlowModalOpen(false)}
          shiftId={currentShift.id}
          suppliers={suppliers}
          onConfirm={onAddCashFlow}
        />
      )}

      {/* Open Shift Modal */}
      <OpenShiftModal
        isOpen={isOpenShiftModalOpen}
        onClose={() => setIsOpenShiftModalOpen(false)}
        lastClosedShift={lastClosedShift}
        onOpenShift={onOpenShift}
      />

      {/* Close Shift Modal (Z-Report) */}
      {currentShift && (
        <CloseShiftModal
          isOpen={isCloseShiftModalOpen}
          onClose={() => setIsCloseShiftModalOpen(false)}
          shift={currentShift}
          onCloseShift={onCloseShift}
        />
      )}

      {/* Camera Barcode Scanner Modal */}
      <CameraScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScan={handleBarcodeScanned}
      />

      {/* Unknown Barcode Prevention Modal */}
      <UnknownBarcodeModal
        isOpen={isUnknownBarcodeModalOpen}
        onClose={() => setIsUnknownBarcodeModalOpen(false)}
        barcode={unknownBarcode}
        onCreateProduct={(bc) => {
          setCardModalProductId(null);
          setCardModalInitialBarcode(bc);
          setIsProductCardOpen(true);
        }}
      />

      {/* Product Card / Creation Modal */}
      <ProductCardModal
        isOpen={isProductCardOpen}
        onClose={() => {
          setIsProductCardOpen(false);
          setCardModalProductId(null);
          setCardModalInitialBarcode(undefined);
          setArchivedWarningProduct(null);
        }}
        productId={cardModalProductId}
        products={products}
        initialBarcode={cardModalInitialBarcode}
      />
    </div>
  );
};
