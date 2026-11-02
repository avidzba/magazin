import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'F1', desc: 'Перейти на экран Кассы' },
    { key: 'F2 или /', desc: 'Фокус в строку поиска / Сканер штрихкодов' },
    { key: 'F3', desc: 'Раздел «Клиенты и Долги»' },
    { key: 'F4', desc: 'Раздел «Товары и Склад»' },
    { key: 'F5', desc: 'Журнал чеков' },
    { key: 'F6', desc: 'Учет финансов (Транзакции)' },
    { key: 'F8', desc: 'Оформить продажу В ДОЛГ (выбор клиента)' },
    { key: 'F9', desc: 'Оплата НАЛИЧНЫМИ (калькулятор сдачи)' },
    { key: 'F10', desc: 'Оплата КАРТОЙ / ПЕРЕВОДОМ' },
    { key: 'Esc', desc: 'Очистить текущий чек / Закрыть модальное окно' },
    { key: 'Enter', desc: 'Подтвердить ввод / Добавить штрихкод в чек' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-sm tracking-wide">Быстрые горячие клавиши кассира</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-slate-500 mb-3">
            Клавиши работают на клавиатуре кассы для моментального обслуживания без мыши:
          </p>
          <div className="divide-y divide-slate-100">
            {shortcuts.map((sc, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between">
                <span className="text-sm text-slate-700 font-medium">{sc.desc}</span>
                <kbd className="px-2.5 py-1 text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300 rounded shadow-xs">
                  {sc.key}
                </kbd>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            <strong>Совет по сканеру:</strong> Обычные USB и Bluetooth сканеры штрихкодов эмулируют клавиатуру с нажатием Enter на конце. На кассе сканирование сразу добавит товар в чек!
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            Закрыть (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
