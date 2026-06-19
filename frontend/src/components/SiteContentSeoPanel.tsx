import { ChevronDown, ChevronRight, Lightbulb, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { analyzeSiteContent } from '../lib/seo/analyzeSiteContent';
import type { SeoAnalysisResult, SeoSummaryItem } from '../lib/seo/seo.types';

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'B':
      return 'text-emerald-800 bg-emerald-50/80 border-emerald-200';
    case 'C':
      return 'text-amber-800 bg-amber-50 border-amber-200';
    case 'D':
      return 'text-orange-800 bg-orange-50 border-orange-200';
    default:
      return 'text-red-800 bg-red-50 border-red-200';
  }
}

function scoreRingColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function statusDot(status: string): string {
  switch (status) {
    case 'good':
      return 'bg-emerald-500';
    case 'warning':
      return 'bg-amber-500';
    default:
      return 'bg-red-500';
  }
}

function priorityBadge(priority: string): string {
  switch (priority) {
    case 'high':
      return 'text-red-700 bg-red-50 border-red-200';
    case 'medium':
      return 'text-amber-800 bg-amber-50 border-amber-200';
    default:
      return 'text-charcoal/60 bg-cream border-cream-dark';
  }
}

type SiteContentSeoPanelProps = {
  contentKey: string | null;
  content: Record<string, unknown> | null;
  parseError?: boolean;
  summary?: SeoSummaryItem[] | null;
  summaryLoading?: boolean;
};

export function SiteContentSeoPanel({
  contentKey,
  content,
  parseError,
  summary,
  summaryLoading,
}: SiteContentSeoPanelProps) {
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [tipsOpen, setTipsOpen] = useState(true);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const analysis: SeoAnalysisResult | null = useMemo(() => {
    if (!contentKey || !content || parseError) return null;
    return analyzeSiteContent(contentKey, content);
  }, [contentKey, content, parseError]);

  if (!contentKey) return null;

  return (
    <section className="bg-white border border-cream-dark p-5 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Search size={18} className="text-gold" />
        <h2 className="text-sm uppercase tracking-wider font-medium">SEO Coach</h2>
      </div>

      {parseError ? (
        <p className="text-sm text-red-700">
          Fix JSON syntax errors to see SEO analysis for this section.
        </p>
      ) : !analysis ? (
        <p className="text-sm text-charcoal/50">Loading SEO analysis…</p>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div
                className={`flex flex-col items-center justify-center w-20 h-20 border-2 rounded-full ${scoreRingColor(analysis.score)} border-current`}
              >
                <span className="text-2xl font-serif leading-none">{analysis.score}</span>
                <span className="text-[10px] uppercase tracking-wider opacity-70">/ 100</span>
              </div>
              <div>
                <span
                  className={`inline-block px-2 py-0.5 text-xs font-medium uppercase tracking-wider border ${gradeColor(analysis.grade)}`}
                >
                  Grade {analysis.grade}
                </span>
                <p className="text-sm text-charcoal/60 mt-2 max-w-md">
                  Heuristic score based on titles, descriptions, structure, length, readability,
                  keywords, CTAs, and image alt text.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <button
              type="button"
              onClick={() => setCategoriesOpen((v) => !v)}
              className="flex items-center gap-2 text-xs uppercase tracking-wider text-charcoal/70 hover:text-gold w-full text-left"
            >
              {categoriesOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Category Breakdown
            </button>
            {categoriesOpen && (
              <ul className="mt-3 space-y-2">
                {analysis.categories.map((cat) => {
                  const pct = cat.maxScore > 0 ? Math.round((cat.score / cat.maxScore) * 100) : 0;
                  return (
                    <li key={cat.id} className="border border-cream-dark p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm text-charcoal flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(cat.status)}`} />
                          {cat.label}
                        </span>
                        <span className="text-xs text-charcoal/50 font-mono">
                          {cat.score}/{cat.maxScore} ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-cream rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            cat.status === 'good'
                              ? 'bg-emerald-500'
                              : cat.status === 'warning'
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setTipsOpen((v) => !v)}
              className="flex items-center gap-2 text-xs uppercase tracking-wider text-charcoal/70 hover:text-gold w-full text-left"
            >
              {tipsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Coaching Tips ({analysis.tips.length})
            </button>
            {tipsOpen && (
              <div className="mt-3 space-y-3">
                {analysis.tips.length === 0 ? (
                  <p className="text-sm text-emerald-700 flex items-center gap-2">
                    <Lightbulb size={14} />
                    No major issues — this section looks strong for on-page SEO.
                  </p>
                ) : (
                  analysis.tips.map((tip, index) => (
                    <div
                      key={`${tip.category}-${index}`}
                      className="border border-cream-dark p-3 bg-cream/30"
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 border ${priorityBadge(tip.priority)}`}
                        >
                          {tip.priority}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-charcoal/40">
                          {tip.category}
                        </span>
                        {tip.fieldPath && (
                          <span className="text-[10px] font-mono text-gold">{tip.fieldPath}</span>
                        )}
                      </div>
                      <p className="text-sm text-charcoal font-medium">{tip.message}</p>
                      <p className="text-sm text-charcoal/60 mt-1">{tip.suggestion}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}

      {(summary !== undefined || summaryLoading) && (
        <div className="mt-6 pt-6 border-t border-cream-dark">
          <button
            type="button"
            onClick={() => setSummaryOpen((v) => !v)}
            className="flex items-center gap-2 text-xs uppercase tracking-wider text-charcoal/70 hover:text-gold w-full text-left"
          >
            {summaryOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            All Pages Summary
          </button>
          {summaryOpen && (
            <div className="mt-3">
              {summaryLoading ? (
                <p className="text-sm text-charcoal/50">Loading page scores…</p>
              ) : summary && summary.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {summary.map((item) => (
                    <div
                      key={item.key}
                      className={`border p-3 ${
                        item.key === contentKey ? 'border-gold bg-gold/5' : 'border-cream-dark'
                      }`}
                    >
                      <p className="text-xs text-charcoal/50 uppercase tracking-wider">{item.label}</p>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-xl font-serif">{item.score}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 border uppercase tracking-wider ${gradeColor(item.grade)}`}
                        >
                          {item.grade}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-charcoal/50">No page scores available.</p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
