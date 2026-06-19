import { useEffect, useMemo, useState } from 'react';
import {
  getProjectActivity,
  getProjectMessages,
  getProjectQuote,
  postProjectMessage,
} from '../api/client';
import type {
  ProjectActivityCategory,
  ProjectActivityEntry,
  ProjectMessage,
  ProjectQuoteSummary,
  RecordFieldChange,
} from '../types';
import { Button, FormField, textareaClass } from './Layout';
import { RecordChangeDiff } from './RecordChangeDiff';
import { formatCurrency, formatDate } from '../lib/labels';
import { useAuth } from '../context/AuthContext';
import {
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  MessageSquare,
  Package,
  Pencil,
  Send,
  Shield,
  Truck,
  User,
} from 'lucide-react';

type ActivityFilter = 'all' | ProjectActivityCategory;

const FILTER_OPTIONS: { value: ActivityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'origin', label: 'Origin' },
  { value: 'approval', label: 'Approvals' },
  { value: 'update', label: 'Updates' },
  { value: 'schedule', label: 'Pickups & Jobs' },
  { value: 'document', label: 'Documents' },
  { value: 'communication', label: 'Messages' },
];

function activityIcon(entry: ProjectActivityEntry) {
  switch (entry.type) {
    case 'quote':
    case 'project_created':
      return ClipboardList;
    case 'signoff':
      return CheckCircle2;
    case 'document':
      return FileText;
    case 'job':
    case 'pickup':
      return Truck;
    case 'message':
      return MessageSquare;
    case 'record_edit':
      return Pencil;
    default:
      return Package;
  }
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface ProjectAuditPanelProps {
  projectId: string;
}

export function ProjectAuditPanel({ projectId }: ProjectAuditPanelProps) {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<ProjectActivityEntry[]>([]);
  const [quote, setQuote] = useState<ProjectQuoteSummary | null>(null);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [messageBody, setMessageBody] = useState('');
  const [internalNote, setInternalNote] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      getProjectActivity(projectId),
      getProjectQuote(projectId),
      getProjectMessages(projectId),
    ])
      .then(([a, q, m]) => {
        setActivity(a);
        setQuote(q);
        setMessages(m);
      })
      .catch(() => setError('Unable to load project record.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const filteredActivity = useMemo(() => {
    if (filter === 'all') return activity;
    return activity.filter((e) => e.category === filter);
  }, [activity, filter]);

  const handlePostMessage = async () => {
    const body = messageBody.trim();
    if (!body) return;
    setPosting(true);
    try {
      await postProjectMessage(projectId, {
        body,
        isInternal: isAdmin ? internalNote : undefined,
      });
      setMessageBody('');
      setInternalNote(false);
      load();
    } catch {
      setError('Unable to post message.');
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2">{error}</p>
      )}

      <section>
        <h3 className="text-sm uppercase tracking-wider font-medium mb-3 flex items-center gap-2">
          <ClipboardList size={16} className="text-gold" /> Quote & Origin
        </h3>
        {quote ? (
          <div className="bg-white border border-cream-dark p-4 md:p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider border border-cream-dark px-2 py-0.5 text-charcoal/60">
                {quote.statusLabel}
              </span>
              {quote.quotedAmount != null && (
                <span className="text-sm font-medium">{formatCurrency(quote.quotedAmount)} quoted</span>
              )}
              {quote.estimatedTotal != null && quote.quotedAmount == null && (
                <span className="text-sm text-charcoal/60">Est. {formatCurrency(quote.estimatedTotal)}</span>
              )}
            </div>
            <p className="text-sm text-charcoal/80">{quote.projectDescription}</p>
            <div className="grid sm:grid-cols-2 gap-3 text-xs text-charcoal/60">
              <p><span className="text-charcoal/40">Contact:</span> {quote.contactName} · {quote.email}</p>
              {quote.propertyAddress && <p><span className="text-charcoal/40">Property:</span> {quote.propertyAddress}</p>}
              {quote.pickupAddress && <p><span className="text-charcoal/40">Pickup:</span> {quote.pickupAddress}</p>}
              {quote.preferredDate && <p><span className="text-charcoal/40">Preferred date:</span> {formatDate(quote.preferredDate)}</p>}
              {quote.storageLocationName && <p><span className="text-charcoal/40">Warehouse:</span> {quote.storageLocationName}</p>}
              <p><span className="text-charcoal/40">Submitted:</span> {formatDate(quote.createdAt.slice(0, 10))}</p>
            </div>
            {quote.lineItems && quote.lineItems.length > 0 && (
              <div className="border-t border-cream-dark pt-3">
                <p className="text-[10px] uppercase tracking-wider text-charcoal/40 mb-2">Line items</p>
                <ul className="text-xs text-charcoal/70 space-y-1">
                  {quote.lineItems.slice(0, 8).map((item, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span>{item.description} × {item.quantity}</span>
                      <span>{formatCurrency(item.amount)}</span>
                    </li>
                  ))}
                  {quote.lineItems.length > 8 && (
                    <li className="text-charcoal/40">+ {quote.lineItems.length - 8} more items</li>
                  )}
                </ul>
              </div>
            )}
            {isAdmin && quote.internalNotes && (
              <div className="border-t border-cream-dark pt-3">
                <p className="text-[10px] uppercase tracking-wider text-charcoal/40 mb-1 flex items-center gap-1">
                  <Shield size={12} /> Internal notes
                </p>
                <p className="text-xs text-charcoal/70 whitespace-pre-wrap">{quote.internalNotes}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-charcoal/50 bg-white border border-cream-dark px-4 py-6">
            No linked quote — this project was created directly, not from a client quote request.
          </p>
        )}
      </section>

      <section>
        <h3 className="text-sm uppercase tracking-wider font-medium mb-3 flex items-center gap-2">
          <MessageSquare size={16} className="text-gold" /> Project Discussion
        </h3>
        <div className="bg-white border border-cream-dark">
          <div className="max-h-80 overflow-y-auto divide-y divide-cream-dark">
            {messages.length === 0 && (
              <p className="px-4 py-8 text-sm text-charcoal/50 text-center">
                No messages yet — use this thread for designer, client, and team coordination.
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`px-4 py-3 ${m.isInternal ? 'bg-amber-50/50' : ''}`}
              >
                <div className="flex items-center gap-2 text-xs text-charcoal/50 mb-1 flex-wrap">
                  <User size={12} />
                  <span className="font-medium text-charcoal/70">{m.authorName}</span>
                  <span className="uppercase tracking-wider text-[10px]">{m.authorRole}</span>
                  {m.isInternal && (
                    <span className="text-[10px] uppercase tracking-wider text-amber-700 border border-amber-200 px-1">
                      Internal
                    </span>
                  )}
                  <span className="ml-auto">{formatWhen(m.createdAt)}</span>
                </div>
                <p className="text-sm text-charcoal/80 whitespace-pre-wrap">{m.body}</p>
              </div>
            ))}
          </div>

          {user && (
            <div className="border-t border-cream-dark p-4 space-y-3">
              <FormField label="Add a message">
                <textarea
                  className={textareaClass}
                  rows={3}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder="Updates for the team, client questions, install notes…"
                  maxLength={5000}
                />
              </FormField>
              {isAdmin && (
                <label className="flex items-center gap-2 text-xs text-charcoal/60 min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={internalNote}
                    onChange={(e) => setInternalNote(e.target.checked)}
                  />
                  Internal note (admin only — not visible to designer or client)
                </label>
              )}
              <Button
                onClick={handlePostMessage}
                loading={posting}
                disabled={!messageBody.trim()}
                className="min-h-[44px]"
              >
                <Send size={14} className="mr-2" /> Post Message
              </Button>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <h3 className="text-sm uppercase tracking-wider font-medium flex items-center gap-2">
            <CheckCircle2 size={16} className="text-gold" /> Activity Audit
          </h3>
          <p className="text-xs text-charcoal/50">{filteredActivity.length} event(s)</p>
        </div>

        <div className="flex gap-1 overflow-x-auto mb-4 -mx-4 px-4 scrollbar-hide">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={`shrink-0 px-3 py-2 text-[10px] uppercase tracking-wider min-h-[40px] border transition-colors ${
                filter === opt.value
                  ? 'bg-charcoal text-cream border-charcoal'
                  : 'bg-white border-cream-dark text-charcoal/50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative border-l border-cream-dark ml-3 space-y-0">
          {filteredActivity.length === 0 && (
            <p className="text-sm text-charcoal/50 pl-6 py-6">No activity in this category.</p>
          )}
          {filteredActivity.map((entry) => {
            const Icon = activityIcon(entry);
            const changes = entry.metadata?.changes as RecordFieldChange[] | undefined;
            return (
              <div key={entry.id} className="relative pl-6 pb-6 last:pb-0">
                <span className="absolute -left-[7px] top-1 w-3.5 h-3.5 rounded-full bg-white border-2 border-gold" />
                <div className="bg-white border border-cream-dark p-3 md:p-4">
                  <div className="flex items-start gap-2">
                    <Icon size={14} className="text-gold mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-charcoal">{entry.title}</p>
                      {entry.summary && entry.type !== 'record_edit' && (
                        <p className="text-xs text-charcoal/60 mt-1">{entry.summary}</p>
                      )}
                      {changes && changes.length > 0 && (
                        <RecordChangeDiff changes={changes} />
                      )}
                      <p className="text-[10px] text-charcoal/40 mt-2">
                        {formatWhen(entry.occurredAt)}
                        {entry.actor ? ` · ${entry.actor}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
