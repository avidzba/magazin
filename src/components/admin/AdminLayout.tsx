import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggleButton } from '../../context/ThemeContext';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Users,
  Wallet,
  Receipt,
  UserCheck,
  LogOut,
  Menu,
  X,
  Wifi,
  WifiOff,
  ExternalLink,
  ChevronRight,
  Truck,
  Package,
  Clock,
  ClipboardCheck,
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    {
      to: '/admin',
      end: true,
      label: 'Дашборд',
      icon: LayoutDashboard,
    },
    {
      to: '/admin/products',
      label: 'Товары (Номенклатура)',
      icon: Package,
    },
    {
      to: '/admin/inventory',
      label: 'Склад и Документы',
      icon: Boxes,
    },
    {
      to: '/admin/audits',
      label: 'Инвентаризация',
      icon: ClipboardCheck,
    },
    {
      to: '/admin/suppliers',
      label: 'Поставщики (CRM)',
      icon: Truck,
    },
    {
      to: '/admin/shifts',
      label: 'Кассовые смены',
      icon: Clock,
    },
    {
      to: '/admin/finance',
      label: 'Финансы магазина',
      icon: Wallet,
    },
    {
      to: '/admin/customers',
      label: 'Клиенты и Долги',
      icon: UserCheck,
    },
    {
      to: '/admin/orders',
      label: 'История чеков',
      icon: Receipt,
    },
    {
      to: '/admin/users',
      label: 'Сотрудники (RBAC)',
      icon: Users,
    },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Compute current page title
  const currentNav = navItems.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  );
  const pageTitle = currentNav ? currentNav.label : 'Бэк-офис МойСклад';

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 antialiased overflow-hidden">
      {/* SIDEBAR: Modern Dark Sidebar (MoySklad style) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-200 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Brand & Store Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white shadow-md">
              <Boxes className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm text-white tracking-tight">МойСклад</span>
                <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-400/30">
                  Бэк-офис
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block leading-tight">
                Управление магазином
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Link to Cashier POS Station */}
        <div className="p-3">
          <NavLink
            to="/pos"
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition group active:scale-95"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-100" />
              <span>Открыть Кассу (POS)</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-blue-200 group-hover:translate-x-0.5 transition" />
          </NavLink>
        </div>

        {/* Navigation Menu Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Разделы управления
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* PWA Install in Sidebar */}
        <div className="px-3 pb-2">
          <PWAInstallButton variant="sidebar" />
        </div>

        {/* User Card & Logout Footer */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-blue-400 text-xs shrink-0">
                {user?.displayName?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block truncate">
                  {user?.displayName || 'Администратор'}
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold block leading-none">
                  Администратор
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-800 hover:bg-rose-950/50 hover:text-rose-300 text-slate-300 rounded-lg text-xs font-semibold transition active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Выйти из аккаунта</span>
          </button>
        </div>
      </aside>

      {/* Backdrop for Mobile Sidebar */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* MAIN VIEWPORT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 hidden sm:inline">Бэк-офис</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline" />
              <h2 className="text-sm font-bold text-slate-800 tracking-tight">{pageTitle}</h2>
            </div>
          </div>

          {/* Right Header Badges */}
          <div className="flex items-center gap-2.5">
            {/* PWA Install Button (Windows / iPhone) */}
            <PWAInstallButton variant="admin-header" />

            {/* Theme Toggle Button (Sun / Moon) */}
            <ThemeToggleButton variant="header" showLabel />

            {/* Online/Offline Status Indicator */}
            {isOnline ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Онлайн</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-semibold">
                <WifiOff className="w-3.5 h-3.5 text-rose-600" />
                <span>Офлайн</span>
              </div>
            )}

            {/* Quick POS Button */}
            <NavLink
              to="/pos"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition active:scale-95"
            >
              <ShoppingCart className="w-3.5 h-3.5 text-blue-600" />
              <span>Касса [POS]</span>
            </NavLink>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto min-h-0 bg-slate-100 dark:bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
