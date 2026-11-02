import React, { createContext, useContext, useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch (_) {
    // Ignore localStorage access errors
  }
  return 'light';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
      root.style.colorScheme = 'light';
    }

    try {
      localStorage.setItem('theme', theme);
    } catch (_) {
      // Ignore storage errors
    }
  }, [theme]);

  // Listen for OS system theme changes if the user hasn't explicitly locked a choice yet
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      try {
        const stored = localStorage.getItem('theme');
        if (!stored) {
          setThemeState(e.matches ? 'dark' : 'light');
        }
      } catch (_) {}
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}

interface ThemeToggleButtonProps {
  variant?: 'header' | 'dark-bar' | 'sidebar';
  showLabel?: boolean;
  className?: string;
}

export const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({
  variant = 'header',
  showLabel = false,
  className = '',
}) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  if (variant === 'dark-bar') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        title={isDark ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
        aria-label="Переключить тему"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95 text-xs font-semibold ${className}`}
      >
        {isDark ? (
          <>
            <Sun className="w-4 h-4 text-amber-400" />
            {showLabel && <span>Светлая</span>}
          </>
        ) : (
          <>
            <Moon className="w-4 h-4 text-blue-300" />
            {showLabel && <span>Темная</span>}
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
      aria-label="Переключить тему"
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition active:scale-95 ${
        isDark
          ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
      } ${className}`}
    >
      {isDark ? (
        <>
          <Sun className="w-4 h-4 text-amber-400" />
          {showLabel && <span className="hidden sm:inline">Светлая</span>}
        </>
      ) : (
        <>
          <Moon className="w-4 h-4 text-slate-600" />
          {showLabel && <span className="hidden sm:inline">Темная</span>}
        </>
      )}
    </button>
  );
};
