import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import {
  Download,
  MonitorDown,
  Smartphone,
  Share,
  PlusSquare,
  X,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'cashier' | 'admin-header' | 'sidebar' | 'login' | 'banner';
  className?: string;
  showIconOnlyOnMobile?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'cashier',
  className = '',
  showIconOnlyOnMobile = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running in standalone mode (installed), don't show prompt
  if (isInstalled) {
    return null;
  }

  // Handle Windows / Android / Desktop Install click
  const handleInstallClick = async () => {
    if (isInstallable) {
      setIsInstalling(true);
      try {
        await install();
      } finally {
        setIsInstalling(false);
      }
    } else {
      // In case beforeinstallprompt hasn't fired yet or browser requires address-bar install
      setShowHelpModal(true);
    }
  };

  // 1. iOS Device Button (iPhone / iPad)
  if (isIOS) {
    const iosButtonClasses = (() => {
      switch (variant) {
        case 'cashier':
          return 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer border border-indigo-400/30';
        case 'admin-header':
          return 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer';
        case 'sidebar':
          return 'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-bold transition border border-indigo-500/30 active:scale-95 cursor-pointer';
        case 'login':
          return 'flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer';
        default:
          return 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold';
      }
    })();

    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSModal(true)}
          className={`${iosButtonClasses} ${className}`}
          title="Инструкция по установке кассы на iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span className={showIconOnlyOnMobile ? 'hidden sm:inline' : ''}>Установить на iPhone</span>
        </button>

        {/* iOS Step-by-Step Installation Modal */}
        {showIOSModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Установка на iPhone (PWA)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-900 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block mb-0.5">
                      Кнопка «Поделиться»
                    </span>
                    Нажмите кнопку <strong className="text-indigo-600 dark:text-indigo-400">«Поделиться»</strong> (иконка квадрата со стрелкой вверх{' '}
                    <Share className="w-3.5 h-3.5 inline text-indigo-600 dark:text-indigo-400" />) в нижней панели браузера Safari.
                  </div>
                </div>

                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-900 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block mb-0.5">
                      На экран «Домой»
                    </span>
                    В открывшемся меню прокрутите вниз и выберите{' '}
                    <strong className="text-indigo-600 dark:text-indigo-400">
                      «На экран Домой»
                    </strong>{' '}
                    <PlusSquare className="w-3.5 h-3.5 inline text-indigo-600 dark:text-indigo-400" />.
                  </div>
                </div>

                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-900 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block mb-0.5">
                      Подтверждение
                    </span>
                    Нажмите <strong className="text-indigo-600 dark:text-indigo-400">«Добавить»</strong> в правом верхнем углу. Значок кассы появится на рабочем столе iPhone и будет открываться без рамок браузера!
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm transition active:scale-98 cursor-pointer"
              >
                Понятно
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // 2. Windows / Android / Desktop Button
  // Show prominently if beforeinstallprompt has fired (isInstallable === true)
  // Or in cashier/admin if user can trigger installation
  if (!isInstallable && variant !== 'login' && variant !== 'sidebar') {
    // If not installable and not on a screen where we want to keep a gentle helper, return null
    return null;
  }

  const desktopButtonClasses = (() => {
    switch (variant) {
      case 'cashier':
        return 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer border border-blue-400/30';
      case 'admin-header':
        return 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer';
      case 'sidebar':
        return 'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-bold transition border border-blue-500/30 active:scale-95 cursor-pointer';
      case 'login':
        return 'flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer';
      default:
        return 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold';
    }
  })();

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        disabled={isInstalling}
        className={`${desktopButtonClasses} ${className}`}
        title="Установить приложение кассы на ПК (Windows / Chrome / Edge)"
      >
        <MonitorDown className="w-3.5 h-3.5 shrink-0" />
        <span className={showIconOnlyOnMobile ? 'hidden sm:inline' : ''}>
          {isInstalling ? 'Установка...' : 'Установить кассу на ПК'}
        </span>
      </button>

      {/* Fallback Help Modal if clicked before beforeinstallprompt fired */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <MonitorDown className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Установка кассы на ПК (Windows)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              <p>
                Для установки приложения в Google Chrome или Microsoft Edge:
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 dark:text-blue-400">1.</span>
                  <span>
                    Обратите внимание на правую часть адресной строки браузера — там находится иконка <strong>«Установить»</strong> (<Download className="w-3 h-3 inline text-blue-600" /> или иконка монитора со стрелочкой).
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 dark:text-blue-400">2.</span>
                  <span>
                    Либо откройте меню браузера (три точки <strong>⋮</strong> в правом верхнем углу) и выберите <strong>«Установить приложение МойСклад Касса POS»</strong>.
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>После установки касса запустится в отдельном окне без адресной строки.</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-sm transition active:scale-98 cursor-pointer"
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </>
  );
};
