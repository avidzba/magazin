import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  StoreProduct,
  StoreCustomer,
  StoreOrder,
  FinanceTransaction,
  StoreShift,
  StoreInventoryDoc,
} from '../../types';
import { RevenueDynamicsChart } from './dashboard/RevenueDynamicsChart';
import { CategorySalesPieChart } from './dashboard/CategorySalesPieChart';
import {
  TrendingUp,
  Banknote,
  AlertCircle,
  Boxes,
  ShoppingCart,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  PackagePlus,
  PlusCircle,
} from 'lucide-react';

interface DashboardScreenProps {
  products: StoreProduct[];
  customers: StoreCustomer[];
  orders: StoreOrder[];
  transactions: FinanceTransaction[];
  shifts: StoreShift[];
  inventoryDocs: StoreInventoryDoc[];
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  products,
  customers,
  orders,
  transactions,
  shifts,
  inventoryDocs,
}) => {
  // Current active shift & cash in drawer
  const currentShift = shifts.find((s) => s.status === 'open') || null;
  const cashInDrawer = currentShift
    ? currentShift.startCash +
      currentShift.totalCash +
      currentShift.totalCashIn -
      currentShift.totalCashOut
    : 0;

  // Revenue today & this month
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const getOrderTime = (o: StoreOrder) => {
    return o.date?.toDate?.()?.getTime() || (typeof o.date === 'string' ? new Date(o.date).getTime() : 0);
  };

  const revenueToday = orders
    .filter((o) => getOrderTime(o) >= startOfToday)
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const revenueMonth = orders
    .filter((o) => getOrderTime(o) >= startOfMonth)
    .reduce((sum, o) => sum + o.totalAmount, 0);

  // Total store stock value (at purchase price or selling price)
  const totalStockItems = products.reduce((sum, p) => sum + Math.max(0, p.stockQuantity), 0);
  const totalStockValue = products.reduce(
    (sum, p) => sum + Math.max(0, p.stockQuantity) * (p.purchasePrice || p.price * 0.7),
    0
  );

  // Total customer debts
  const totalDebts = customers.reduce((sum, c) => sum + Math.max(0, c.totalDebt), 0);
  const debtorCount = customers.filter((c) => c.totalDebt > 0).length;

  // Low stock products count
  const lowStockCount = products.filter((p) => p.stockQuantity <= 5).length;
  const outOfStockCount = products.filter((p) => p.stockQuantity <= 0).length;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Welcome & Summary Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Сводка магазина и ключевые метрики
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Оперативные показатели продаж, кассы, остатков склада и взаиморасчетов
          </p>
        </div>

        <div className="flex items-center gap-2">
          <NavLink
            to="/pos"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Касса POS</span>
          </NavLink>
          <NavLink
            to="/admin/inventory"
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
          >
            <PackagePlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Приемка товаров</span>
          </NavLink>
        </div>
      </div>

      {/* 4 Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Revenue Today */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Выручка за сегодня
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
              {revenueToday.toLocaleString('ru-RU')} ₽
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <span>За месяц:</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {revenueMonth.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2: Cash in Till */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Наличные в кассе
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
              {cashInDrawer.toLocaleString('ru-RU')} ₽
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {currentShift ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Смена открыта
                </span>
              ) : (
                <span className="text-slate-400">Смена закрыта</span>
              )}
            </div>
          </div>
        </div>

        {/* KPI 3: Stock Valuation */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Остатки на складе
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
              {totalStockItems} шт.
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Себестоимость: ~{Math.round(totalStockValue).toLocaleString('ru-RU')} ₽
            </div>
          </div>
        </div>

        {/* KPI 4: Customer Debts */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Долги покупателей
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
              {totalDebts.toLocaleString('ru-RU')} ₽
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Должников: {debtorCount} чел.
            </div>
          </div>
        </div>
      </div>

      {/* Visual Analytics with Recharts: Revenue Dynamics (Line/Area) & Category Sales (Donut/Pie) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RevenueDynamicsChart orders={orders} />
        <CategorySalesPieChart orders={orders} products={products} />
      </div>

      {/* Grid: Recent Orders & Stock Warnings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden transition-colors">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Последние кассовые чеки</h3>
            </div>
            <NavLink
              to="/admin/orders"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline transition"
            >
              Все чеки ({orders.length}) →
            </NavLink>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-x-auto">
            {orders.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Пока нет пробитых чеков. Нажмите «Касса POS», чтобы начать продажи.
              </div>
            ) : (
              orders.slice(0, 6).map((order) => {
                const orderDate = order.date?.toDate?.()
                  ? order.date.toDate().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                  : 'Сегодня';

                return (
                  <div
                    key={order.id}
                    className="p-3.5 sm:px-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono font-bold text-xs text-slate-700 dark:text-slate-300 shrink-0">
                        #{order.receiptNumber.slice(-3)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                            Чек № {order.receiptNumber}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{orderDate}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {order.items?.length || 0} позиций {order.customerName ? `• ${order.customerName}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-black font-mono text-slate-900 dark:text-slate-100 block">
                        {order.totalAmount.toLocaleString('ru-RU')} ₽
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded inline-block ${
                          order.paymentMethod === 'cash'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : order.paymentMethod === 'card'
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {order.paymentMethod === 'cash'
                          ? 'Наличные'
                          : order.paymentMethod === 'card'
                          ? 'Безнал'
                          : 'В долг'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Stock Alerts & Inventory Actions (1 col) */}
        <div className="space-y-4">
          {/* Inventory Movement Shortcuts */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs space-y-3 transition-colors">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">
              Складские операции
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <NavLink
                to="/admin/inventory"
                className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 text-left transition active:scale-95 group cursor-pointer"
              >
                <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                  <span>Приемка</span>
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-[10px] text-emerald-900/70 dark:text-emerald-300/70 block mt-1">
                  Оприходование товаров
                </span>
              </NavLink>

              <NavLink
                to="/admin/inventory"
                className="p-3 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-left transition active:scale-95 group cursor-pointer"
              >
                <div className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center justify-between">
                  <span>Списание</span>
                  <ArrowDownRight className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                </div>
                <span className="text-[10px] text-rose-900/70 dark:text-rose-300/70 block mt-1">
                  Брак / порча / нужды
                </span>
              </NavLink>
            </div>
          </div>

          {/* Low Stock Warning Box */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>Контроль остатков</span>
              </div>
              <NavLink to="/admin/inventory" className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                Каталог →
              </NavLink>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs font-medium border border-amber-200/50 dark:border-amber-800/40">
                <span>Заканчиваются (≤ 5 шт.):</span>
                <span className="font-bold px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-100 font-mono">
                  {lowStockCount}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 text-xs font-medium border border-rose-200/50 dark:border-rose-800/40">
                <span>Нет в наличии (0 шт.):</span>
                <span className="font-bold px-2 py-0.5 rounded-full bg-rose-200/80 dark:bg-rose-900/80 text-rose-900 dark:text-rose-100 font-mono">
                  {outOfStockCount}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
