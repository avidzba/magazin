import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition active:scale-95"
        title="Установить приложение кассы на устройство"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Установить POS (PWA)</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 transition"
        >
          <Smartphone className="w-3.5 h-3.5 text-blue-500" />
          <span>На экран iPad / iPhone</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-900">Установка на iPad / iPhone</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                1. Нажмите кнопку <strong>Поделиться</strong> (иконка квадрата со стрелкой) в Safari.<br />
                2. Прокрутите меню вниз и выберите <strong>«На экран Домой»</strong>.<br />
                3. Касса будет запускаться в полноэкранном режиме офлайн.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Понятно
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
