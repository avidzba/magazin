import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    localStorage.removeItem('moysklad_demo_role');
    window.location.href = '/login';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 text-center shadow-2xl">
            <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h1 className="text-xl font-bold text-white mb-2">Произошла ошибка при загрузке</h1>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              Приложение столкнулось с непредвиденной ошибкой. Попробуйте обновить страницу или сбросить текущую сессию.
            </p>

            {this.state.error?.message && (
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-rose-400/90 font-mono text-left mb-6 overflow-auto max-h-32">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-blue-500/20 active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Обновить страницу</span>
              </button>
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition active:scale-95"
              >
                <Home className="w-4 h-4" />
                <span>На экран входа</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
