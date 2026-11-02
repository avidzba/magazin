import React, { useState, useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom';
import {
  StoreProduct,
  StoreCustomer,
  StoreSupplier,
  StorePurchaseOrder,
  StoreOrder,
  FinanceTransaction,
  StoreShift,
  StoreCashFlow,
  StoreInventoryDoc,
  AppUser,
} from './types';
import {
  subscribeProducts,
  subscribeCustomers,
  subscribeSuppliers,
  subscribePurchaseOrders,
  subscribeOrders,
  subscribeTransactions,
  subscribeShifts,
  subscribeInventoryDocs,
  subscribeUsers,
  openShift,
  closeShift,
  addCashFlow,
  seedDemoData,
} from './services/storeService';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { LoginScreen } from './components/LoginScreen';
import { AdminLayout } from './components/admin/AdminLayout';
import { DashboardScreen } from './components/admin/DashboardScreen';
import { ProductsScreen } from './components/admin/ProductsScreen';
import { InventoryScreen } from './components/admin/InventoryScreen';
import { InventoryAuditsView } from './components/admin/InventoryAuditsView';
import { SuppliersScreen } from './components/admin/SuppliersScreen';
import { ShiftsScreen } from './components/admin/ShiftsScreen';
import { AdminFinanceScreen } from './components/admin/AdminFinanceScreen';
import { UsersScreen } from './components/admin/UsersScreen';
import { CustomersDebtScreen } from './components/CustomersDebtScreen';
import { OrdersScreen } from './components/OrdersScreen';
import { CashierScreen } from './components/CashierScreen';
import { ShortcutsModal } from './components/ShortcutsModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WifiOff, Sparkles } from 'lucide-react';

/**
 * Main application content with route logic
 */
function AppRoutes() {
  const { user, isLoading: isAuthLoading, isAdmin, isCashier, logout } = useAuth();
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [customers, setCustomers] = useState<StoreCustomer[]>([]);
  const [suppliers, setSuppliers] = useState<StoreSupplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<StorePurchaseOrder[]>([]);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [shifts, setShifts] = useState<StoreShift[]>([]);
  const [inventoryDocs, setInventoryDocs] = useState<StoreInventoryDoc[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);

  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Subscribe to all Firestore collections with offline persistence only when authenticated
  useEffect(() => {
    if (!user) {
      setIsDataLoading(false);
      return;
    }

    let isMounted = true;
    let loadedProducts = false;
    let loadedCustomers = false;

    const checkLoading = () => {
      if (!isMounted) return;
      if (loadedProducts && loadedCustomers) {
        setIsDataLoading(false);
      }
    };

    // Safety timeout: Never stay stuck on spinner for more than 2.5 seconds
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        setIsDataLoading(false);
      }
    }, 2500);

    const unsubProducts = subscribeProducts(
      (data) => {
        if (!isMounted) return;
        setProducts(data);
        loadedProducts = true;
        checkLoading();
      },
      () => {
        if (!isMounted) return;
        loadedProducts = true;
        checkLoading();
      }
    );

    const unsubCustomers = subscribeCustomers(
      (data) => {
        if (!isMounted) return;
        setCustomers(data);
        loadedCustomers = true;
        checkLoading();
      },
      () => {
        if (!isMounted) return;
        loadedCustomers = true;
        checkLoading();
      }
    );

    const unsubOrders = subscribeOrders(
      (data) => isMounted && setOrders(data),
      () => {}
    );

    const unsubTransactions = subscribeTransactions(
      (data) => isMounted && setTransactions(data),
      () => {}
    );

    const unsubShifts = subscribeShifts(
      (data) => isMounted && setShifts(data),
      () => {}
    );

    const unsubInventoryDocs = subscribeInventoryDocs(
      (data) => isMounted && setInventoryDocs(data),
      () => {}
    );

    const unsubSuppliers = subscribeSuppliers(
      (data) => isMounted && setSuppliers(data),
      () => {}
    );

    const unsubPurchaseOrders = subscribePurchaseOrders(
      (data) => isMounted && setPurchaseOrders(data),
      () => {}
    );

    const unsubUsers = subscribeUsers(
      (data) => isMounted && setUsers(data),
      () => {}
    );

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      unsubProducts();
      unsubCustomers();
      unsubSuppliers();
      unsubPurchaseOrders();
      unsubOrders();
      unsubTransactions();
      unsubShifts();
      unsubInventoryDocs();
      unsubUsers();
    };
  }, [user?.uid]);

  // Shift helpers
  const currentShift = shifts.find((s) => s.status === 'open') || null;
  const lastClosedShift = shifts.find((s) => s.status === 'closed') || null;

  const handleOpenShift = async (startCash: number, cashierName: string) => {
    await openShift(startCash, cashierName || user?.displayName || 'Кассир');
  };

  const handleCloseShift = async (expectedCash: number, actualCash: number) => {
    if (currentShift) {
      await closeShift({
        shiftId: currentShift.id,
        expectedCash,
        actualCash,
      });
    }
  };

  const handleAddCashFlow = async (data: {
    type: 'in' | 'out';
    amount: number;
    category: string;
    note?: string;
    supplierId?: string;
    supplierName?: string;
  }) => {
    if (currentShift) {
      await addCashFlow({
        shiftId: currentShift.id,
        ...data,
      });
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await seedDemoData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (isAuthLoading || (user && isDataLoading)) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-300">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-sm font-bold text-white tracking-tight">Загрузка МойСклад POS...</span>
        <span className="text-xs text-slate-400 mt-1">Проверка прав доступа и синхронизация</span>
      </div>
    );
  }

  // Derive cash flows from shifts or transactions
  const cashFlows: StoreCashFlow[] = [];

  return (
    <>
      <Routes>
        {/* Login Page */}
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to={user.role === 'admin' ? '/admin' : '/pos'} replace />
            ) : (
              <LoginScreen />
            )
          }
        />

        {/* POS Station: Cashier Terminal */}
        <Route
          path="/pos"
          element={
            !user ? (
              <Navigate to="/login" replace />
            ) : (
              <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
                {/* Seed banner if database empty */}
                {products.length === 0 && (
                  <div className="p-3 bg-amber-50 border-b border-amber-300 text-amber-900 flex items-center justify-between text-xs px-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>Каталог товаров пуст. Заполните демо-данными для мгновенного теста кассы:</span>
                    </div>
                    <button
                      onClick={handleSeed}
                      disabled={isSeeding}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold"
                    >
                      {isSeeding ? 'Загрузка...' : 'Заполнить демо-каталог'}
                    </button>
                  </div>
                )}

                <CashierScreen
                  products={products.filter((p) => !p.isArchived)}
                  customers={customers}
                  suppliers={suppliers}
                  currentShift={currentShift}
                  lastClosedShift={lastClosedShift}
                  onOpenCustomerDebtScreen={() => {
                    if (isAdmin) {
                      navigate('/admin/customers');
                    }
                  }}
                  onOpenShift={handleOpenShift}
                  onCloseShift={handleCloseShift}
                  onAddCashFlow={handleAddCashFlow}
                  onLogout={handleLogout}
                  onBackToAdmin={isAdmin ? () => navigate('/admin') : undefined}
                />
              </div>
            )
          }
        />

        {/* Admin Back-Office (Protected Route: strict block for cashier role!) */}
        <Route
          path="/admin"
          element={
            !user ? (
              <Navigate to="/login" replace />
            ) : user.role === 'cashier' ? (
              // Cashier is strictly forbidden from accessing /admin, redirected to /pos
              <Navigate to="/pos" replace />
            ) : (
              <AdminLayout />
            )
          }
        >
          {/* Default Admin Dashboard */}
          <Route
            index
            element={
              <DashboardScreen
                products={products}
                customers={customers}
                orders={orders}
                transactions={transactions}
                shifts={shifts}
                inventoryDocs={inventoryDocs}
              />
            }
          />
          <Route
            path="dashboard"
            element={
              <DashboardScreen
                products={products}
                customers={customers}
                orders={orders}
                transactions={transactions}
                shifts={shifts}
                inventoryDocs={inventoryDocs}
              />
            }
          />

          {/* Products (Nomenclature Catalog) */}
          <Route
            path="products"
            element={
              <div className="h-full flex flex-col p-4 sm:p-6">
                <ProductsScreen products={products} suppliers={suppliers} />
              </div>
            }
          />

          {/* Sklad & Inventory Movement */}
          <Route
            path="inventory"
            element={
              <InventoryScreen
                products={products}
                inventoryDocs={inventoryDocs}
              />
            }
          />

          {/* Dedicated Inventory Audits Module */}
          <Route
            path="audits"
            element={
              <div className="h-full flex flex-col p-4 sm:p-6">
                <InventoryAuditsView
                  products={products}
                  inventoryDocs={inventoryDocs}
                  authorName={user?.displayName || 'Администратор'}
                  authorId={user?.uid}
                />
              </div>
            }
          />
          <Route path="inventory-audits" element={<Navigate to="/admin/audits" replace />} />

          {/* Suppliers CRM */}
          <Route
            path="suppliers"
            element={
              <div className="h-full flex flex-col p-4 sm:p-6">
                <SuppliersScreen
                  suppliers={suppliers}
                  inventoryDocs={inventoryDocs}
                  products={products}
                  purchaseOrders={purchaseOrders}
                  transactions={transactions}
                  currentShift={currentShift}
                  authorName={user?.displayName || 'Администратор'}
                  authorId={user?.uid}
                />
              </div>
            }
          />

          {/* Shifts Journal and Receipts Dashboard */}
          <Route
            path="shifts"
            element={
              <div className="h-full flex flex-col p-4 sm:p-6">
                <ShiftsScreen
                  shifts={shifts}
                  orders={orders}
                  products={products}
                />
              </div>
            }
          />

          {/* Finance Management */}
          <Route
            path="finance"
            element={
              <AdminFinanceScreen
                transactions={transactions}
                shifts={shifts}
                cashFlows={cashFlows}
                orders={orders}
              />
            }
          />

          {/* Customers & Debts */}
          <Route
            path="customers"
            element={
              <div className="h-full flex flex-col p-4 sm:p-6">
                <CustomersDebtScreen customers={customers} currentShift={currentShift} />
              </div>
            }
          />

          {/* Order Receipts History */}
          <Route
            path="orders"
            element={
              <div className="h-full flex flex-col p-4 sm:p-6">
                <OrdersScreen orders={orders} />
              </div>
            }
          />

          {/* Staff & RBAC Accounts */}
          <Route
            path="users"
            element={<UsersScreen users={users} />}
          />
        </Route>

        {/* Root Redirect based on user state and role */}
        <Route
          path="/"
          element={
            !user ? (
              <Navigate to="/login" replace />
            ) : user.role === 'admin' ? (
              <Navigate to="/admin" replace />
            ) : (
              <Navigate to="/pos" replace />
            )
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Non-intrusive Offline Toast when disconnected */}
      {!isOnline && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xl animate-in slide-in-from-bottom-2">
          <WifiOff className="w-4 h-4 text-white" />
          <span>Офлайн-режим. Данные сохраняются локально в IndexedDB и синхронизируются при связи.</span>
        </div>
      )}

      {/* Keyboard Shortcuts Reference Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
