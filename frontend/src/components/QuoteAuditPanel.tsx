import { useEffect, useState } from 'react';
import { getQuoteActivity, getQuoteMessages, postQuoteMessage } from '../api/client';
import type { QuoteActivityEntry, QuoteMessage } from '../types';
import { Button, FormField, textareaClass } from './Layout';
import { RecordChangeDiff } from './RecordChangeDiff';
import { useAuth } from '../context/AuthContext';
import { Loader2, MessageSquare, Pencil, Send, User } from 'lucide-react';

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface QuoteAuditPanelProps {
  quoteId: string;
  refreshKey?: number;
}

export function QuoteAuditPanel({ quoteId, refreshKey = 0 }: QuoteAuditPanelProps) {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<QuoteActivityEntry[]>([]);
  const [messages, setMessages] = useState<QuoteMessage[]>([]);
  const [messageBody, setMessageBody] = useState('');
  const [internalNote, setInternalNote] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([getQuoteActivity(quoteId), getQuoteMessages(quoteId)])
      .then(([a, m]) => {
        setActivity(a);
        setMessages(m);
      })
      .catch(() => setError('Unable to load quote record.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [quoteId, refreshKey]);

  const handlePost = async () => {
    const body = messageBody.trim();
    if (!body) return;
    setPosting(true);
    try {
      await postQuoteMessage(quoteId, {
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
      <div className="space-y-6">
        <AuditSection title="Discussion" icon={MessageSquare}>
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-gold" size={24} />
          </div>
        </AuditSection>
        <AuditSection title="Audit trail" icon={Pencil}>
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-gold" size={24} />
          </div>
        </AuditSection>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="px-4 py-3 bg-red-50 text-red-800 text-sm border border-red-200">{error}</p>
      )}

      <AuditSection title="Discussion" icon={MessageSquare}>
        <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-sm text-charcoal/50">No messages yet.</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`border p-3 text-sm ${
                  m.isInternal ? 'border-amber-200 bg-amber-50/50' : 'border-cream-dark'
                }`}
              >
                <div className="flex items-center gap-2 text-xs text-charcoal/50 mb-1">
                  <User size={12} />
                  {m.authorName}
                  {m.isInternal && (
                    <span className="uppercase tracking-wider text-[10px] text-amber-700">
                      Internal
                    </span>
                  )}
                  <span className="ml-auto">{formatWhen(m.createdAt)}</span>
                </div>
                <p className="text-charcoal/80 whitespace-pre-wrap">{m.body}</p>
              </div>
            ))
          )}
        </div>
        <FormField label="Add a message">
          <textarea
            className={textareaClass}
            rows={3}
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            placeholder="Notes for the team or client follow-up…"
          />
        </FormField>
        {isAdmin && (
          <label className="flex items-center gap-2 text-xs text-charcoal/60 mt-2 mb-3">
            <input
              type="checkbox"
              checked={internalNote}
              onChange={(e) => setInternalNote(e.target.checked)}
            />
            Internal note (admin only)
          </label>
        )}
        <Button
          onClick={() => void handlePost()}
          loading={posting}
          disabled={!messageBody.trim()}
          className="min-h-[44px]"
        >
          <Send size={14} className="mr-2" />
          Post message
        </Button>
      </AuditSection>

      <AuditSection title="Audit trail" icon={Pencil}>
        {activity.length === 0 ? (
          <p className="text-sm text-charcoal/50">No activity recorded yet.</p>
        ) : (
          <ul className="space-y-4">
            {activity.map((entry) => (
              <li key={entry.id} className="border-l-2 border-gold/40 pl-4">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <p className="text-sm font-medium text-charcoal">{entry.title}</p>
                  <span className="text-[10px] text-charcoal/40">{formatWhen(entry.occurredAt)}</span>
                </div>
                {entry.actor && (
                  <p className="text-xs text-charcoal/50 mt-0.5">By {entry.actor}</p>
                )}
                {entry.summary && !entry.changes?.length && (
                  <p className="text-xs text-charcoal/60 mt-1 whitespace-pre-wrap">{entry.summary}</p>
                )}
                {entry.changes && entry.changes.length > 0 && (
                  <RecordChangeDiff changes={entry.changes} />
                )}
              </li>
            ))}
          </ul>
        )}
      </AuditSection>
    </div>
  );
}

function AuditSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof MessageSquare;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-cream-dark p-5 md:p-6">
      <h2 className="text-sm uppercase tracking-wider text-charcoal/50 mb-4 flex items-center gap-2">
        <Icon size={16} className="text-gold" />
        {title}
      </h2>
      {children}
    </section>
  );
}
