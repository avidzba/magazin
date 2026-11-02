import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { StoreOrder, StoreProduct } from '../../../types';
import { useTheme } from '../../../context/ThemeContext';
import { PieChart as PieIcon, Layers, Tag, ShoppingBag } from 'lucide-react';

interface CategorySalesPieChartProps {
  orders: StoreOrder[];
  products: StoreProduct[];
}

interface CategorySlice {
  name: string;
  revenue: number;
  quantity: number;
  color: string;
  percent: number;
}

// Harmonious distinctive color palette for product categories
const PALETTE = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#0ea5e9', // Sky blue
  '#ec4899', // Pink / Rose
  '#8b5cf6', // Violet
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#64748b', // Slate for "Прочие"
];

export const CategorySalesPieChart: React.FC<CategorySalesPieChartProps> = ({
  orders,
  products,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [metricView, setMetricView] = useState<'revenue' | 'quantity'>('revenue');
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // Map products by ID for fast category lookup
  const productCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => {
      map.set(p.id, p.category || 'Без категории');
    });
    return map;
  }, [products]);

  // Aggregate sales by category
  const { slices, totalRevenue, totalQuantity } = useMemo(() => {
    const catMap = new Map<string, { revenue: number; quantity: number }>();

    orders.forEach((order) => {
      if (order.status === 'cancelled') return;

      order.items?.forEach((item) => {
        const cat =
          productCategoryMap.get(item.productId) || (item as any).category || 'Без категории';
        const itemSum = Number(item.sum) || Number(item.price) * Number(item.quantity) || 0;
        const itemQty = Number(item.quantity) || 0;

        const current = catMap.get(cat) || { revenue: 0, quantity: 0 };
        current.revenue += itemSum;
        current.quantity += itemQty;
        catMap.set(cat, current);
      });
    });

    let sumRev = 0;
    let sumQty = 0;
    const rawList: { name: string; revenue: number; quantity: number }[] = [];

    catMap.forEach((val, key) => {
      sumRev += val.revenue;
      sumQty += val.quantity;
      rawList.push({
        name: key,
        revenue: val.revenue,
        quantity: val.quantity,
      });
    });

    // Sort by selected metric descending
    rawList.sort((a, b) => b.revenue - a.revenue);

    // Limit to top 7 categories, collapse rest into "Прочие" if many
    let finalSlices: CategorySlice[] = [];
    if (rawList.length > 7) {
      const top = rawList.slice(0, 6);
      const rest = rawList.slice(6);
      const otherRevenue = rest.reduce((s, r) => s + r.revenue, 0);
      const otherQuantity = rest.reduce((s, r) => s + r.quantity, 0);

      top.forEach((it, idx) => {
        const baseVal = it.revenue;
        finalSlices.push({
          name: it.name,
          revenue: it.revenue,
          quantity: it.quantity,
          color: PALETTE[idx % PALETTE.length],
          percent: sumRev > 0 ? (baseVal / sumRev) * 100 : 0,
        });
      });

      finalSlices.push({
        name: 'Прочие категории',
        revenue: otherRevenue,
        quantity: otherQuantity,
        color: '#64748b',
        percent: sumRev > 0 ? (otherRevenue / sumRev) * 100 : 0,
      });
    } else {
      finalSlices = rawList.map((it, idx) => ({
        name: it.name,
        revenue: it.revenue,
        quantity: it.quantity,
        color: PALETTE[idx % PALETTE.length],
        percent: sumRev > 0 ? (it.revenue / sumRev) * 100 : 0,
      }));
    }

    // Recalculate percent based on active metricView
    finalSlices.forEach((sl) => {
      if (metricView === 'revenue') {
        sl.percent = sumRev > 0 ? (sl.revenue / sumRev) * 100 : 0;
      } else {
        sl.percent = sumQty > 0 ? (sl.quantity / sumQty) * 100 : 0;
      }
    });

    return {
      slices: finalSlices,
      totalRevenue: sumRev,
      totalQuantity: sumQty,
    };
  }, [orders, productCategoryMap, metricView]);

  // Format Recharts data
  const chartData = useMemo(() => {
    return slices.map((s) => ({
      name: s.name,
      value: metricView === 'revenue' ? s.revenue : s.quantity,
      color: s.color,
      percent: s.percent,
      revenue: s.revenue,
      quantity: s.quantity,
    }));
  }, [slices, metricView]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-2xs flex flex-col justify-between transition-colors">
      {/* Header & Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 flex items-center justify-center">
              <PieIcon className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              Распределение продаж по категориям
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Структура выручки и спроса по товарным группам
          </p>
        </div>

        {/* View switcher */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMetricView('revenue')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              metricView === 'revenue'
                ? 'bg-white dark:bg-slate-700 text-pink-600 dark:text-pink-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            По сумме (₽)
          </button>
          <button
            type="button"
            onClick={() => setMetricView('quantity')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              metricView === 'quantity'
                ? 'bg-white dark:bg-slate-700 text-pink-600 dark:text-pink-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            По кол-ву (шт.)
          </button>
        </div>
      </div>

      {slices.length === 0 ? (
        <div className="h-72 flex flex-col items-center justify-center text-center p-6 text-slate-400">
          <Layers className="w-10 h-10 mb-2 text-slate-300 dark:text-slate-700" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
            Нет данных о продажах
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
            Пробейте первые кассовые чеки в кассе POS, чтобы увидеть распределение по категориям
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center pt-3">
          {/* Donut Chart with Center Total */}
          <div className="md:col-span-6 relative w-full h-64 sm:h-72 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  onMouseEnter={(_, index) => setHoveredCategory(chartData[index]?.name || null)}
                  onMouseLeave={() => setHoveredCategory(null)}
                >
                  {chartData.map((entry, index) => {
                    const isHovered = hoveredCategory === entry.name;
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke={isDark ? '#0f172a' : '#ffffff'}
                        strokeWidth={isHovered ? 3 : 1.5}
                        className="transition-all duration-200 cursor-pointer"
                        opacity={hoveredCategory && !isHovered ? 0.6 : 1}
                      />
                    );
                  })}
                </Pie>

                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const item = payload[0].payload as any;

                    return (
                      <div className="bg-slate-900/95 dark:bg-slate-950/95 text-white p-3 rounded-xl shadow-xl border border-slate-700/80 backdrop-blur-xs text-xs space-y-1.5 min-w-44 animate-in fade-in zoom-in-95 duration-100">
                        <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-bold text-slate-200 truncate">{item.name}</span>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-400">Сумма продаж:</span>
                          <span className="font-mono font-black text-indigo-300">
                            {item.revenue.toLocaleString('ru-RU')} ₽
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-400">Продано шт.:</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {item.quantity} шт.
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800/80 text-[11px]">
                          <span className="text-slate-400">Доля в продажах:</span>
                          <span className="font-mono font-bold text-amber-300">
                            {item.percent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Summary Indicator inside donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {metricView === 'revenue' ? 'Всего' : 'Штук'}
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-slate-100">
                {metricView === 'revenue'
                  ? `${Math.round(totalRevenue).toLocaleString('ru-RU')} ₽`
                  : `${totalQuantity} шт.`}
              </span>
            </div>
          </div>

          {/* Interactive Legend List */}
          <div className="md:col-span-6 space-y-2 max-h-72 overflow-y-auto pr-1">
            {slices.map((slice) => {
              const isHovered = hoveredCategory === slice.name;

              return (
                <div
                  key={slice.name}
                  onMouseEnter={() => setHoveredCategory(slice.name)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  className={`p-2 rounded-xl border transition-all cursor-pointer ${
                    isHovered
                      ? 'bg-slate-50 dark:bg-slate-800/80 border-indigo-300 dark:border-indigo-600 shadow-2xs'
                      : 'bg-white dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {slice.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 font-mono">
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                        {metricView === 'revenue'
                          ? `${slice.revenue.toLocaleString('ru-RU')} ₽`
                          : `${slice.quantity} шт.`}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400 w-11 text-right">
                        {slice.percent.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Percentage Progress Bar */}
                  <div className="w-full bg-slate-100 dark:bg-slate-700/60 rounded-full h-1.5 mt-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(2, slice.percent))}%`,
                        backgroundColor: slice.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
