import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { StoreOrder } from '../../../types';
import { useTheme } from '../../../context/ThemeContext';
import { TrendingUp, Calendar, Receipt, Award } from 'lucide-react';

interface RevenueDynamicsChartProps {
  orders: StoreOrder[];
}

interface DailyRevenuePoint {
  dateKey: string;
  label: string;
  fullDate: string;
  revenue: number;
  orderCount: number;
  avgReceipt: number;
}

export const RevenueDynamicsChart: React.FC<RevenueDynamicsChartProps> = ({ orders }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [metricView, setMetricView] = useState<'revenue' | 'orders'>('revenue');

  // Compute 30 days of data ending today
  const { chartData, totalRevenue, totalOrders, avgDailyRevenue, bestDay } = useMemo<{
    chartData: DailyRevenuePoint[];
    totalRevenue: number;
    totalOrders: number;
    avgDailyRevenue: number;
    bestDay: DailyRevenuePoint | null;
  }>(() => {
    const points: DailyRevenuePoint[] = [];
    const pointsMap = new Map<string, DailyRevenuePoint>();

    const now = new Date();
    // Build array of last 30 calendar days
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      const label = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      const fullDate = d.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      const point: DailyRevenuePoint = {
        dateKey,
        label,
        fullDate,
        revenue: 0,
        orderCount: 0,
        avgReceipt: 0,
      };

      points.push(point);
      pointsMap.set(dateKey, point);
    }

    // Accumulate orders into day buckets
    orders.forEach((order) => {
      if (order.status === 'cancelled') return;

      let orderDate: Date | null = null;
      if (order.date?.toDate) {
        orderDate = order.date.toDate();
      } else if (typeof order.date === 'string') {
        orderDate = new Date(order.date);
      } else if (typeof order.date === 'number') {
        orderDate = new Date(order.date);
      } else if (typeof order.date?.seconds === 'number') {
        orderDate = new Date(order.date.seconds * 1000);
      }

      if (!orderDate || isNaN(orderDate.getTime())) return;

      const dateKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(orderDate.getDate()).padStart(2, '0')}`;

      const point = pointsMap.get(dateKey);
      if (point) {
        point.revenue += Number(order.totalAmount) || 0;
        point.orderCount += 1;
      }
    });

    // Calculate averages and best day
    let sumRevenue = 0;
    let sumOrders = 0;
    let maxRev = -1;
    let maxDay: DailyRevenuePoint | null = null;

    points.forEach((p) => {
      p.avgReceipt = p.orderCount > 0 ? Math.round(p.revenue / p.orderCount) : 0;
      sumRevenue += p.revenue;
      sumOrders += p.orderCount;
      if (p.revenue > maxRev) {
        maxRev = p.revenue;
        maxDay = p;
      }
    });

    const avgDaily = Math.round(sumRevenue / 30);

    return {
      chartData: points,
      totalRevenue: sumRevenue,
      totalOrders: sumOrders,
      avgDailyRevenue: avgDaily,
      bestDay: maxDay,
    };
  }, [orders]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-2xs flex flex-col justify-between transition-colors">
      {/* Header & Metric View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              Динамика выручки за последние 30 дней
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Ежедневный доход магазина и количество пробитых чеков
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMetricView('revenue')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              metricView === 'revenue'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Выручка (₽)
          </button>
          <button
            type="button"
            onClick={() => setMetricView('orders')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              metricView === 'orders'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Чеки (шт.)
          </button>
        </div>
      </div>

      {/* Mini Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3.5">
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            За 30 дней
          </span>
          <span className="font-mono font-black text-sm sm:text-base text-slate-900 dark:text-slate-100 block mt-0.5">
            {totalRevenue.toLocaleString('ru-RU')} ₽
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            В среднем в день
          </span>
          <span className="font-mono font-black text-sm sm:text-base text-indigo-600 dark:text-indigo-400 block mt-0.5">
            {avgDailyRevenue.toLocaleString('ru-RU')} ₽
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Всего чеков
          </span>
          <span className="font-mono font-black text-sm sm:text-base text-emerald-600 dark:text-emerald-400 block mt-0.5">
            {totalOrders} шт.
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
            Лучший день ({bestDay?.label || '—'})
          </span>
          <span className="font-mono font-black text-sm sm:text-base text-amber-600 dark:text-amber-400 block mt-0.5 truncate">
            {bestDay && bestDay.revenue > 0 ? `${bestDay.revenue.toLocaleString('ru-RU')} ₽` : '0 ₽'}
          </span>
        </div>
      </div>

      {/* Main Recharts Area */}
      <div className="w-full h-72 sm:h-80 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={isDark ? 0.45 : 0.35} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={isDark ? 0.45 : 0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={isDark ? '#334155' : '#f1f5f9'}
            />

            <XAxis
              dataKey="label"
              stroke={isDark ? '#64748b' : '#94a3b8'}
              tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: isDark ? '#334155' : '#e2e8f0' }}
              interval="preserveStartEnd"
              minTickGap={24}
            />

            <YAxis
              stroke={isDark ? '#64748b' : '#94a3b8'}
              tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
              tickLine={false}
              axisLine={false}
              width={metricView === 'revenue' ? 65 : 40}
              tickFormatter={(val) => {
                if (metricView === 'orders') return `${val}`;
                if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M ₽`;
                if (val >= 1000) return `${Math.round(val / 1000)}k ₽`;
                return `${val} ₽`;
              }}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const point = payload[0].payload as DailyRevenuePoint;

                return (
                  <div className="bg-slate-900/95 dark:bg-slate-950/95 text-white p-3 rounded-xl shadow-xl border border-slate-700/80 backdrop-blur-xs text-xs space-y-1.5 min-w-44 animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex items-center gap-1.5 text-slate-300 font-medium pb-1 border-b border-slate-800">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{point.fullDate}</span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-400">Выручка:</span>
                      <span className="font-mono font-black text-indigo-300 text-sm">
                        {point.revenue.toLocaleString('ru-RU')} ₽
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-400">Чеков:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {point.orderCount} шт.
                      </span>
                    </div>

                    {point.orderCount > 0 && (
                      <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800/80 text-[11px]">
                        <span className="text-slate-400">Средний чек:</span>
                        <span className="font-mono font-semibold text-amber-300">
                          {point.avgReceipt.toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                    )}
                  </div>
                );
              }}
            />

            {metricView === 'revenue' ? (
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#6366f1"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#revenueGradient)"
                activeDot={{
                  r: 6,
                  stroke: '#6366f1',
                  strokeWidth: 2,
                  fill: isDark ? '#1e1b4b' : '#ffffff',
                }}
              />
            ) : (
              <Area
                type="monotone"
                dataKey="orderCount"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#ordersGradient)"
                activeDot={{
                  r: 6,
                  stroke: '#10b981',
                  strokeWidth: 2,
                  fill: isDark ? '#064e3b' : '#ffffff',
                }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
