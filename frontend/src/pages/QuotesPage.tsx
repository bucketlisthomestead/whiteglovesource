import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminQuotes, updateQuote } from '../api/client';
import type { QuoteRequest, QuoteStatus } from '../types';
import { SearchField, matchesSearch } from '../components/SearchField';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { formatCurrency, formatDate, QUOTE_STATUS_LABELS } from '../lib/labels';
import { formatDashboardDateRange } from '../lib/dashboardDates';
import { useDateRangeFilter } from '../lib/useDateRangeFilter';
import { Loader2, FileText } from 'lucide-react';

const STATUS_FILTERS: { value: QuoteStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'lead', label: 'Lead' },
  { value: 'pending', label: 'Pending' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
];

export function QuotesPage() {
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const {
    preset: datePreset,
    handlePresetChange: handleDatePresetChange,
    customFrom,
    customTo,
    setCustomFrom,
    setCustomTo,
    applyCustom,
    appliedRange,
  } = useDateRangeFilter('next6');

  const load = () => {
    setLoading(true);
    getAdminQuotes({
      includeArchived: showArchived,
      from: appliedRange.from,
      to: appliedRange.to,
      status: statusFilter === 'all' ? undefined : statusFilter,
    })
      .then((res) => setQuotes(res.quotes))
      .catch(() => setQuotes([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [showArchived, appliedRange.from, appliedRange.to, statusFilter]);

  const filteredQuotes = useMemo(
    () =>
      quotes.filter((q) =>
        matchesSearch(search, q.contactName, q.email, q.serviceType, q.status, q.propertyAddress),
      ),
    [quotes, search],
  );

  const handleArchiveQuote = async (quote: QuoteRequest, isActive: boolean) => {
    setActionLoading(true);
    try {
      await updateQuote(quote.id, { isActive });
      load();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-2xl md:text-3xl text-charcoal">All Quotes</h1>
        <p className="text-sm text-charcoal/60 mt-1">
          Every quote request · {formatDashboardDateRange(appliedRange)}
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <DateRangeFilter
          preset={datePreset}
          onPresetChange={handleDatePresetChange}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
          onApplyCustom={applyCustom}
          appliedRange={appliedRange}
          hint="Filtered by preferred date, or submitted date when none is set."
        />

        <div className="bg-white border border-cream-dark p-4 md:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search quotes…"
              className="sm:max-w-xs"
            />
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="text-xs uppercase tracking-wider text-charcoal/50 hover:text-gold min-h-[44px] px-3"
            >
              {showArchived ? 'Hide archived' : 'Show archived'}
            </button>
          </div>

          <div className="flex gap-1 overflow-x-auto -mx-1 px-1 scrollbar-hide">
          {STATUS_FILTERS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={`shrink-0 px-3 py-2 text-[10px] uppercase tracking-wider min-h-[40px] border transition-colors ${
                statusFilter === opt.value
                  ? 'bg-charcoal text-cream border-charcoal'
                  : 'bg-white border-cream-dark text-charcoal/50'
              }`}
            >
              {opt.label}
            </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-cream-dark">
        <div className="px-4 py-3 border-b border-cream-dark flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-gold" />
            <h2 className="text-sm uppercase tracking-wider font-medium">
              {filteredQuotes.length} quote{filteredQuotes.length === 1 ? '' : 's'}
            </h2>
          </div>
          <Link to="/admin" className="text-xs uppercase tracking-wider text-gold hover:underline">
            Back to dashboard
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-gold" size={28} />
          </div>
        ) : filteredQuotes.length === 0 ? (
          <p className="px-4 py-10 text-sm text-charcoal/50 text-center">No quotes match your filters.</p>
        ) : (
          <div className="divide-y divide-cream-dark">
            {filteredQuotes.map((q) => (
              <div
                key={q.id}
                className={`flex items-stretch gap-1 ${q.isActive === false ? 'bg-cream/40 opacity-70' : ''}`}
              >
                <Link
                  to={`/admin/quotes/${q.id}`}
                  className="flex-1 text-left px-4 py-3 hover:bg-cream/50 transition-colors min-w-0"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <p className="text-sm font-medium">{q.contactName}</p>
                    {q.isActive === false && (
                      <span className="text-[10px] uppercase tracking-wider text-charcoal/40 border border-cream-dark px-1.5 py-0.5">
                        Archived
                      </span>
                    )}
                    {q.projectId && (
                      <span className="text-[10px] uppercase tracking-wider text-emerald-700 border border-emerald-200 px-1.5 py-0.5">
                        Project created
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-charcoal/50">
                    {q.serviceType} — {QUOTE_STATUS_LABELS[q.status] || q.status}
                  </p>
                  <p className="text-xs text-charcoal/50 truncate">{q.email}</p>
                  {q.propertyAddress && (
                    <p className="text-xs text-charcoal/40 truncate mt-0.5">{q.propertyAddress}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-charcoal/40">
                    <span>Submitted {formatDate(q.createdAt)}</span>
                    {q.preferredDate && <span>Preferred {formatDate(q.preferredDate)}</span>}
                    {q.quotedAmount != null && (
                      <span className="text-gold">Quoted {formatCurrency(Number(q.quotedAmount))}</span>
                    )}
                    {q.quotedAmount == null && q.estimatedTotal != null && (
                      <span className="text-gold">Est. {formatCurrency(Number(q.estimatedTotal))}</span>
                    )}
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => handleArchiveQuote(q, q.isActive === false)}
                  disabled={actionLoading}
                  className="shrink-0 px-3 text-[10px] uppercase tracking-wider text-gold hover:bg-cream/50 min-w-[72px]"
                >
                  {q.isActive === false ? 'Restore' : 'Archive'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
