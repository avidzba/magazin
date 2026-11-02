import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ThemeToggleButton } from '../context/ThemeContext';
import { PWAInstallButton } from './common/PWAInstallButton';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  ShieldCheck,
  User,
  KeyRound,
  LogIn,
  Sparkles,
  AlertCircle,
  Building2,
} from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { loginWithEmail, loginWithGoogle, loginAsDemo, isLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Пожалуйста, введите Email и пароль.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await loginWithEmail(email, password);
      // Navigation is handled automatically by routes
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Неверный Email или пароль. Проверьте данные или используйте Демо-вход.');
      } else {
        setError(err.message || 'Ошибка авторизации. Попробуйте еще раз.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError('Не удалось войти через Google. Попробуйте Демо-вход.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async (role: 'admin' | 'cashier') => {
    setError(null);
    setSubmitting(true);
    try {
      await loginAsDemo(role);
      navigate(role === 'admin' ? '/admin' : '/pos');
    } catch (err: any) {
      setError('Ошибка демо-входа.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 sm:p-6 text-slate-800">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-700/30 overflow-hidden">
        {/* Header Branding */}
        <div className="bg-slate-950 p-6 text-white text-center border-b border-slate-800 relative">
          <div className="absolute right-4 top-4">
            <ThemeToggleButton variant="dark-bar" />
          </div>
          <div className="inline-flex p-3 bg-blue-600 rounded-xl shadow-lg mb-3">
            <ShoppingCart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">МойСклад POS & Бэк-офис</h1>
          <p className="text-xs text-slate-400 mt-1">
            Кассовый терминал и складской управленческий учет
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Рабочий Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@store.ru или cashier@store.ru"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Пароль
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || isLoading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition shadow-sm active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              <span>{submitting ? 'Авторизация...' : 'Войти в систему'}</span>
            </button>
          </form>

          {/* Google Auth Button */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider absolute">
              или
            </span>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={submitting || isLoading}
            className="w-full py-2 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Войти через Google</span>
          </button>

          {/* Quick Demo Role Switcher for instant testing */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 mb-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Быстрый тест (Мгновенный Демо-вход):</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin('admin')}
                disabled={submitting}
                className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-left transition group active:scale-95"
              >
                <div className="flex items-center gap-1.5 text-blue-700 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Администратор</span>
                </div>
                <p className="text-[10px] text-blue-900/70 mt-1 line-clamp-1">
                  Полный Бэк-офис: склад, финансы, сотрудники
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('cashier')}
                disabled={submitting}
                className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-left transition group active:scale-95"
              >
                <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span>Кассир (POS)</span>
                </div>
                <p className="text-[10px] text-emerald-900/70 mt-1 line-clamp-1">
                  Только терминал пробития чеков (/pos)
                </p>
              </button>
            </div>
          </div>

          {/* PWA Install Button (Windows / iPhone) */}
          <div className="pt-2">
            <PWAInstallButton variant="login" />
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-500">
          Ролевой доступ (RBAC) • Защищенные разделы Firestore
        </div>
      </div>
    </div>
  );
};
