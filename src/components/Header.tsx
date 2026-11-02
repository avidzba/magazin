import React from 'react';
import {
  ShoppingCart,
  Users,
  Package,
  Receipt,
  TrendingUp,
  Wifi,
  WifiOff,
  Keyboard,
  Sparkles,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

export type ActiveTab = 'cashier' | 'customers' | 'products' | 'orders' | 'finance';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isOnline: boolean;
  totalCustomerDebt: number;
  debtorCount: number;
  onOpenShortcuts: () => void;
  onSeedDemoData: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isOnline,
  totalCustomerDebt,
  debtorCount,
  onOpenShortcuts,
  onSeedDemoData,
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 select-none shadow-md">
      <div className="max-w-[1920px] mx-auto px-3 sm:px-5">
        <div className="flex items-center justify-between h-14">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('cashier')}>
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-inner">
                <ShoppingCart className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight text-white">МойСклад</span>
                  <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 bg-blue-500/20 text-blue-300 rounded border border-blue-400/30">
                    Касса POS
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 leading-none">Розничная точка</span>
              </div>
            </div>

            {/* Network / Offline Indicator */}
            <div className="ml-2 sm:ml-4 flex items-center">
              {isOnline ? (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-[11px] font-medium text-emerald-300"
                  title="Подключено к серверу Firestore. Данные синхронизированы."
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <span className="hidden md:inline">Онлайн</span>
                </div>
              ) : (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950/90 border border-rose-500/60 text-[11px] font-medium text-rose-300 animate-pulse"
                  title="Интернет отсутствует. Включен автономный режим IndexedDB: чеки сохраняются локально и синхронизируются при связи."
                >
                  <WifiOff className="w-3 h-3 text-rose-400" />
                  <span>Офлайн. Сохраняем локально</span>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setActiveTab('cashier')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                activeTab === 'cashier'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Касса</span>
              <span className="text-[10px] text-blue-200 hidden lg:inline">F1</span>
            </button>

            <button
              onClick={() => setActiveTab('customers')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition relative ${
                activeTab === 'customers'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Клиенты и Долги</span>
              <span className="text-[10px] text-blue-200 hidden lg:inline">F3</span>
              {totalCustomerDebt > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-slate-900 rounded-full text-[10px] font-bold">
                  {totalCustomerDebt.toLocaleString('ru-RU')} ₽
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('products')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                activeTab === 'products'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Товары и Склад</span>
              <span className="text-[10px] text-blue-200 hidden lg:inline">F4</span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                activeTab === 'orders'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Чеки</span>
              <span className="text-[10px] text-blue-200 hidden lg:inline">F5</span>
            </button>

            <button
              onClick={() => setActiveTab('finance')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                activeTab === 'finance'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Учет финансов</span>
              <span className="text-[10px] text-blue-200 hidden lg:inline">F6</span>
            </button>
          </nav>

          {/* Right actions: Shortcuts, PWA, Demo */}
          <div className="flex items-center gap-2">
            <button
              onClick={onSeedDemoData}
              className="hidden xl:flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 hover:text-amber-300 hover:bg-slate-800 rounded border border-slate-700 transition"
              title="Заполнить демо-каталог товарами и клиентами для быстрого тестирования"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Демо-данные</span>
            </button>

            <button
              onClick={onOpenShortcuts}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition"
              title="Горячие клавиши кассира"
            >
              <Keyboard className="w-4 h-4" />
            </button>

            <PWAInstallButton />
          </div>
        </div>
      </div>
    </header>
  );
};
