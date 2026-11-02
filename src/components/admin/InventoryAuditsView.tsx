import React, { useState, useMemo } from 'react';
import { StoreProduct, StoreInventoryDoc } from '../../types';
import { InventoryAuditModal } from './InventoryAuditModal';
import {
  ClipboardCheck,
  Plus,
  Search,
  Calendar,
  User,
  CheckCircle2,
  Lock,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  FileText,
  ArrowDownRight,
  PackagePlus,
  Sparkles,
  Printer,
  Scale,
} from 'lucide-react';

interface InventoryAuditsViewProps {
  products: StoreProduct[];
  inventoryDocs: StoreInventoryDoc[];
  authorName?: string;
  authorId?: string;
}

export const InventoryAuditsView: React.FC<InventoryAuditsViewProps> = ({
  products,
  inventoryDocs,
  authorName = 'Администратор',
  authorId = '',
}) => {
  const [selectedAudit, setSelectedAudit] = useState<StoreInventoryDoc | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'posted' | 'draft'>('all');

  // Filter only inventory audit documents (type === 'inventory')
  const audits = useMemo(() => {
    return inventoryDocs.filter((d) => d.type === 'inventory');
  }, [inventoryDocs]);

  // Key metrics
  const metrics = useMemo(() => {
    const totalAudits = audits.length;
    const postedAudits = audits.filter((a) => a.status === 'posted');
    const drafts = audits.filter((a) => a.status === 'draft');

    let totalShortageRetail = 0;
    let totalSurplusRetail = 0;
    let lastDate: Date | null = null;

    for (const a of audits) {
      totalShortageRetail += Number(a.shortageRetailSum) || 0;
      totalSurplusRetail += Number(a.surplusRetailSum) || 0;

      let d: Date | null = null;
      if (a.date?.toDate) d = a.date.toDate();
      else if (typeof a.date === 'string') d = new Date(a.date);

      if (d && !isNaN(d.getTime())) {
        if (!lastDate || d > lastDate) lastDate = d;
      }
    }

    return {
      totalAudits,
      postedCount: postedAudits.length,
      draftCount: drafts.length,
      totalShortageRetail,
      totalSurplusRetail,
      lastDateText: lastDate ? lastDate.toLocaleDateString('ru-RU') : 'Еще не проводилась',
    };
  }, [audits]);

  // Filtered audits
  const filteredAudits = useMemo(() => {
    return audits.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNum = a.docNumber?.toLowerCase().includes(q);
        const matchesAuthor = a.authorName?.toLowerCase().includes(q);
        const matchesComment = a.comment?.toLowerCase().includes(q);
        if (!matchesNum && !matchesAuthor && !matchesComment) return false;
      }

      return true;
    });
  }, [audits, statusFilter, searchQuery]);

  // Open modal for new audit
  const handleStartNewAudit = () => {
    setSelectedAudit(null);
    setIsModalOpen(true);
  };

  // Open modal for existing audit
  const handleOpenExistingAudit = (doc: StoreInventoryDoc) => {
    setSelectedAudit(doc);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <ClipboardCheck className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Инвентаризация и Сличительные ведомости
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Сверка фактического наличия товаров в торговом зале, выявление недостач кассиров и автогенерация списаний/оприходований
          </p>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={handleStartNewAudit}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-black transition shadow-md cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>Провести инвентаризацию</span>
        </button>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Всего инвентаризаций
          </span>
          <span className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white mt-1 block">
            {metrics.totalAudits}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
            {metrics.postedCount} проведенных, {metrics.draftCount} черновиков
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Последняя ревизия
          </span>
          <span className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200 mt-1 block">
            {metrics.lastDateText}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
            Регулярность проверок
          </span>
        </div>

        <div className="bg-rose-50/60 dark:bg-rose-950/30 p-4 rounded-2xl border border-rose-200 dark:border-rose-900 shadow-2xs">
          <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider block">
            Всего недостач (в рознице)
          </span>
          <span className="text-xl sm:text-2xl font-black font-mono text-rose-700 dark:text-rose-300 mt-1 block">
            {metrics.totalShortageRetail.toLocaleString('ru-RU')} ₽
          </span>
          <span className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5 block">
            Сумма к удержанию с кассы
          </span>
        </div>

        <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
            Всего излишков (в рознице)
          </span>
          <span className="text-xl sm:text-2xl font-black font-mono text-emerald-700 dark:text-emerald-300 mt-1 block">
            +{metrics.totalSurplusRetail.toLocaleString('ru-RU')} ₽
          </span>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 block">
            Выявленная пересортица в плюс
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по номеру документа, автору или примечанию..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              statusFilter === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Все ({audits.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('posted')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              statusFilter === 'posted'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Проведенные ({metrics.postedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('draft')}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              statusFilter === 'draft'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Черновики ({metrics.draftCount})
          </button>
        </div>
      </div>

      {/* Audits Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase font-bold border-b border-slate-200 dark:border-slate-800 select-none">
              <tr>
                <th className="py-3 px-4">Номер документа</th>
                <th className="py-3 px-3">Дата</th>
                <th className="py-3 px-3">Ответственный</th>
                <th className="py-3 px-3">Позиций</th>
                <th className="py-3 px-4 text-right">Недостача (кассир)</th>
                <th className="py-3 px-4 text-right">Излишек</th>
                <th className="py-3 px-3 text-center">Статус</th>
                <th className="py-3 px-3">Складские документы</th>
                <th className="py-3 px-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredAudits.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <ClipboardCheck className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2 stroke-1" />
                      <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Инвентаризации не найдены</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Нажмите кнопку «Провести инвентаризацию», чтобы запустить новую сверку фактических остатков
                      </p>
                      <button
                        type="button"
                        onClick={handleStartNewAudit}
                        className="mt-4 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold transition"
                      >
                        + Провести инвентаризацию
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAudits.map((doc) => {
                  const docDate = doc.date?.toDate?.()
                    ? doc.date.toDate().toLocaleDateString('ru-RU')
                    : typeof doc.date === 'string'
                    ? new Date(doc.date).toLocaleDateString('ru-RU')
                    : 'Недавно';

                  const shortageRetail = doc.shortageRetailSum ?? 0;
                  const surplusRetail = doc.surplusRetailSum ?? 0;
                  const isPosted = doc.status === 'posted';

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => handleOpenExistingAudit(doc)}
                      className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 cursor-pointer transition group"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100 font-mono group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                        {doc.docNumber}
                      </td>
                      <td className="py-3.5 px-3 text-slate-500 dark:text-slate-400 font-medium">{docDate}</td>
                      <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300 font-medium">
                        {doc.authorName || 'Администратор'}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400 font-mono">
                        {doc.items.length} поз.
                      </td>

                      {/* Shortage */}
                      <td className="py-3.5 px-4 text-right">
                        {shortageRetail > 0 ? (
                          <div>
                            <span className="font-black font-mono text-rose-600 dark:text-rose-400 block text-xs">
                              -{shortageRetail.toLocaleString('ru-RU')} ₽
                            </span>
                            <span className="text-[10px] text-rose-500 dark:text-rose-400 block">
                              {doc.shortageCount || 0} поз.
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-mono">0 ₽</span>
                        )}
                      </td>

                      {/* Surplus */}
                      <td className="py-3.5 px-4 text-right">
                        {surplusRetail > 0 ? (
                          <div>
                            <span className="font-black font-mono text-emerald-600 dark:text-emerald-400 block text-xs">
                              +{surplusRetail.toLocaleString('ru-RU')} ₽
                            </span>
                            <span className="text-[10px] text-emerald-500 dark:text-emerald-400 block">
                              {doc.surplusCount || 0} поз.
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-mono">0 ₽</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center">
                        {isPosted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
                            <Lock className="w-3 h-3" />
                            <span>Проведен</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                            <span>Черновик</span>
                          </span>
                        )}
                      </td>

                      {/* Automation Document Badges */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {doc.writeOffDocNumber && (
                            <span
                              className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                              title="Документ списания недостач"
                            >
                              СП: {doc.writeOffDocNumber}
                            </span>
                          )}
                          {doc.receiptDocNumber && (
                            <span
                              className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              title="Документ оприходования излишков"
                            >
                              ПР: {doc.receiptDocNumber}
                            </span>
                          )}
                          {!doc.writeOffDocNumber && !doc.receiptDocNumber && (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500">—</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-2 text-center text-slate-300 dark:text-slate-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Inventory Audit Modal */}
      {isModalOpen && (
        <InventoryAuditModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          auditDoc={selectedAudit}
          products={products}
          authorName={authorName}
          authorId={authorId}
        />
      )}
    </div>
  );
};
