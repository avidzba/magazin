import React, { useState } from 'react';
import { AppUser, UserRole } from '../../types';
import { createStaffAccount } from '../../services/authService';
import { updateUserRole, deleteStaffUser } from '../../services/storeService';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Building2,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Mail,
  User,
  Sparkles,
} from 'lucide-react';

interface UsersScreenProps {
  users: AppUser[];
}

export const UsersScreen: React.FC<UsersScreenProps> = ({ users }) => {
  const { user: currentUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const handleRoleToggle = async (targetUser: AppUser) => {
    if (targetUser.uid === currentUser?.uid) {
      alert('Вы не можете изменить свою собственную роль администратора.');
      return;
    }
    const newRole: UserRole = targetUser.role === 'admin' ? 'cashier' : 'admin';
    try {
      await updateUserRole(targetUser.uid, newRole);
      setFeedback({
        type: 'success',
        message: `Роль сотрудника ${targetUser.displayName} изменена на «${
          newRole === 'admin' ? 'Администратор' : 'Кассир'
        }».`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleDelete = async (targetUser: AppUser) => {
    if (targetUser.uid === currentUser?.uid) {
      alert('Нельзя удалить свой собственный аккаунт.');
      return;
    }
    if (!confirm(`Удалить доступ сотрудника «${targetUser.displayName}»?`)) return;

    try {
      await deleteStaffUser(targetUser.uid);
      setFeedback({
        type: 'success',
        message: `Сотрудник ${targetUser.displayName} удален из базы.`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Сотрудники и Ролевой доступ (RBAC)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Управление учетными записями персонала: кассиры имеют доступ только к кассе (/pos), администраторы — ко всей системе.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Создать сотрудника</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Staff Accounts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900">Учетные записи персонала</h3>
          </div>
          <span className="text-xs text-slate-400">Всего: {users.length} чел.</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 select-none">
              <tr>
                <th className="py-3 px-4">Сотрудник</th>
                <th className="py-3 px-3">Email (Логин)</th>
                <th className="py-3 px-3">Роль (RBAC)</th>
                <th className="py-3 px-3">Доступ к разделам</th>
                <th className="py-3 px-3">Создан</th>
                <th className="py-3 px-3 text-center">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((staff) => {
                const isCurrent = staff.uid === currentUser?.uid;
                const isAdmin = staff.role === 'admin';
                const createdStr = staff.createdAt?.toDate?.()
                  ? staff.createdAt.toDate().toLocaleDateString('ru-RU')
                  : '—';

                return (
                  <tr key={staff.uid} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            isAdmin
                              ? 'bg-blue-100 text-blue-700 border border-blue-300'
                              : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                          }`}
                        >
                          {staff.displayName?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">
                              {staff.displayName || staff.email.split('@')[0]}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                                Вы
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 font-mono text-slate-600">{staff.email}</td>

                    <td className="py-3.5 px-3">
                      {isAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                          Администратор
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                          Кассир
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-slate-500">
                      {isAdmin ? (
                        <span className="text-slate-800 font-medium">
                          Полный доступ (Касса + Бэк-офис)
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-medium">
                          Только Касса (/pos)
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-slate-400 font-mono">{createdStr}</td>

                    <td className="py-3.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRoleToggle(staff)}
                          disabled={isCurrent}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition disabled:opacity-30 disabled:pointer-events-none"
                          title="Сменить роль сотрудника"
                        >
                          Сменить на {isAdmin ? 'Кассира' : 'Админа'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(staff)}
                          disabled={isCurrent}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 transition disabled:opacity-30 disabled:pointer-events-none"
                          title="Удалить сотрудника"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Staff Account */}
      {isModalOpen && (
        <CreateUserModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={(name) => {
            setFeedback({
              type: 'success',
              message: `Аккаунт сотрудника ${name} успешно создан в Firebase Auth и Firestore!`,
            });
            setTimeout(() => setFeedback(null), 5000);
          }}
        />
      )}
    </div>
  );
};

/* =========================================================================
   MODAL: Create Staff Account (With Secondary Firebase App to protect admin session)
========================================================================= */
interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (name: string) => void;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>('cashier');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Заполните Email и пароль.');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      // Uses isolated secondary Firebase App instance so current admin is NOT signed out
      await createStaffAccount(email.trim(), password, displayName.trim(), role);
      onSuccess(displayName || email);
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Пользователь с таким Email уже зарегистрирован в системе.');
      } else {
        setError(err.message || 'Ошибка создания пользователя.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-sm">Новый сотрудник магазина</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ФИО / Имя сотрудника
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Иванов Иван"
                required
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Рабочий Email (Логин для входа) *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cashier1@store.ru"
                required
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Временный пароль (мин. 6 символов) *
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
              />
            </div>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Назначаемая роль (RBAC) *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('cashier')}
                className={`p-3 rounded-xl border text-left transition ${
                  role === 'cashier'
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-700">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span>Кассир</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Доступ только к экрану пробития чеков (/pos). Бэк-офис скрыт.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`p-3 rounded-xl border text-left transition ${
                  role === 'admin'
                    ? 'border-blue-500 bg-blue-50/70 text-blue-950 ring-1 ring-blue-500'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-blue-700">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Администратор</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Полный доступ ко всем разделам склада, финансов и сотрудников.
                </p>
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-sm"
            >
              {submitting ? 'Создание в Auth...' : 'Создать аккаунт'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
