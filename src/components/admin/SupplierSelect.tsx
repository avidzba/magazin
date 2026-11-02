import React, { useState, useEffect, useRef } from 'react';
import { StoreSupplier } from '../../types';
import { subscribeSuppliers, createSupplier } from '../../services/storeService';
import {
  Truck,
  Search,
  Plus,
  Check,
  X,
  Phone,
  FileText,
  Building2,
  ChevronDown,
} from 'lucide-react';

interface SupplierSelectProps {
  value: string;
  onChange: (supplierName: string) => void;
  onSupplierIdChange?: (supplierId: string) => void;
  selectedSupplierId?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export const SupplierSelect: React.FC<SupplierSelectProps> = ({
  value,
  onChange,
  onSupplierIdChange,
  selectedSupplierId,
  placeholder = 'Выберите или найдите поставщика...',
  className = '',
  required = false,
}) => {
  const [suppliers, setSuppliers] = useState<StoreSupplier[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(value || '');
  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState(false);

  // New Supplier Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newInn, setNewInn] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newComment, setNewComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync search input with value from props
  useEffect(() => {
    setSearchQuery(value || '');
  }, [value]);

  // Realtime subscription to suppliers
  useEffect(() => {
    const unsub = subscribeSuppliers(
      (list) => {
        setSuppliers(list);
      },
      (err) => {
        console.warn('Suppliers subscription note:', err);
      }
    );
    return () => unsub();
  }, []);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter suppliers based on search query
  const filteredSuppliers = suppliers.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.phone && s.phone.includes(q)) ||
      (s.inn && s.inn.includes(q))
    );
  });

  const handleSelect = (sup: StoreSupplier) => {
    onChange(sup.name);
    onSupplierIdChange?.(sup.id);
    setSearchQuery(sup.name);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    onChange(val);
    // Find matching supplier id if exact name match
    const found = suppliers.find((s) => s.name.trim().toLowerCase() === val.trim().toLowerCase());
    onSupplierIdChange?.(found ? found.id : '');
    if (!isOpen) setIsOpen(true);
  };

  const handleCreateNewSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSaving(true);
    try {
      const createdId = await createSupplier({
        name: newName.trim(),
        phone: newPhone.trim() || undefined,
        inn: newInn.trim() || undefined,
        email: newEmail.trim() || undefined,
        comment: newComment.trim() || undefined,
      });

      const createdName = newName.trim();
      onChange(createdName);
      onSupplierIdChange?.(createdId);
      setSearchQuery(createdName);
      setIsNewSupplierModalOpen(false);
      setIsOpen(false);

      // Reset form
      setNewName('');
      setNewPhone('');
      setNewInn('');
      setNewEmail('');
      setNewComment('');
    } catch (err: any) {
      alert(`Ошибка создания поставщика: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const openNewModalWithQuery = () => {
    setNewName(searchQuery.trim());
    setIsNewSupplierModalOpen(true);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Combobox Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <Truck className="w-4 h-4" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          required={required}
          className="w-full pl-9 pr-14 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                onChange('');
                onSupplierIdChange?.('');
                inputRef.current?.focus();
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
              title="Очистить"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded"
            title="Показать список"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Autocomplete Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-64 flex flex-col animate-in fade-in zoom-in-95 duration-100">
          {/* Header Action: Add new */}
          <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
              Поставщики ({filteredSuppliers.length})
            </span>
            <button
              type="button"
              onClick={openNewModalWithQuery}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 rounded-lg transition active:scale-95"
            >
              <Plus className="w-3 h-3" />
              <span>Создать нового</span>
            </button>
          </div>

          {/* Suppliers List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredSuppliers.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs text-slate-500">
                  Поставщик <strong className="text-slate-800">«{searchQuery}»</strong> не найден
                </p>
                <button
                  type="button"
                  onClick={openNewModalWithQuery}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить «{searchQuery || 'Новый'}» в базу</span>
                </button>
              </div>
            ) : (
              filteredSuppliers.map((sup) => {
                const isSelected = value === sup.name;
                return (
                  <button
                    key={sup.id}
                    type="button"
                    onClick={() => handleSelect(sup)}
                    className={`w-full px-3 py-2.5 text-left text-xs flex items-center justify-between hover:bg-blue-50/70 transition group ${
                      isSelected ? 'bg-blue-50 font-bold text-blue-800' : 'text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 shrink-0" />
                        <span className="truncate">{sup.name}</span>
                      </div>
                      {(sup.inn || sup.phone) && (
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 ml-5 font-mono">
                          {sup.inn && <span>ИНН: {sup.inn}</span>}
                          {sup.phone && <span>Тел: {sup.phone}</span>}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Quick Add Supplier Modal */}
      {isNewSupplierModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-600 rounded-lg">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <h4 className="font-bold text-sm">Новый поставщик</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsNewSupplierModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewSupplier} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Наименование / Название организации *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="ООО АльфаТрейд, ИП Смирнов..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ИНН (необязательно)
                  </label>
                  <input
                    type="text"
                    value={newInn}
                    onChange={(e) => setNewInn(e.target.value)}
                    placeholder="7701234567"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Телефон
                  </label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+7 999 123-45-67"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="order@supplier.ru"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Примечание / Контакты менеджера
                </label>
                <textarea
                  rows={2}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Доставка по вторникам, менеджер Алексей..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewSupplierModalOpen(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !newName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Сохранение...' : 'Создать и выбрать'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
