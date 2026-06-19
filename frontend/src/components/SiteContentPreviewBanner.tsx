import { useState } from 'react';
import { Eye, Globe, MessageSquare, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { addSiteContentDraftFeedback } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSiteContent } from '../context/SiteContentContext';
import { Button, FormField, textareaClass } from './Layout';
import { PERMISSIONS } from '../lib/permissions';
import {
  adminEditorPathForContentKey,
  contentKeyForPublicPath,
  publicPathWithoutLiveOverride,
  publicPathWithLiveOverride,
} from '../lib/siteContentPreview';

export function SiteContentPreviewBanner() {
  const { pathname, search } = useLocation();
  const { isPreviewingDraft, isViewingLiveOverride, hasUnpublishedDraft } = useSiteContent();
  const { hasPermission } = useAuth();
  const [showFeedback, setShowFeedback] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isPreviewingDraft && !(isViewingLiveOverride && hasUnpublishedDraft)) {
    return null;
  }

  const canFeedback = hasPermission(PERMISSIONS.SITE_CONTENT_FEEDBACK);
  const canEdit = hasPermission(PERMISSIONS.SITE_CONTENT_EDIT);
  const liveVersionPath = publicPathWithLiveOverride(pathname + search);
  const draftPreviewPath = publicPathWithoutLiveOverride(pathname, search);

  const handleSubmitFeedback = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setNotice(null);
    try {
      await addSiteContentDraftFeedback({ message: trimmed });
      setMessage('');
      setNotice('Feedback submitted. Editors will see it before publish.');
    } catch {
      setNotice('Unable to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isViewingLiveOverride) {
    return (
      <div className="bg-slate-50 border-b border-slate-200 text-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-start gap-2 text-sm">
            <Globe size={16} className="mt-0.5 shrink-0 text-slate-600" />
            <div>
              <p className="font-medium">Viewing published version</p>
              <p className="text-xs text-slate-600/80 mt-0.5">
                You are seeing the live site. Unpublished draft changes are hidden.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={draftPreviewPath}
              className="text-xs uppercase tracking-wider px-3 py-2 border border-slate-300 hover:bg-slate-100 transition-colors"
            >
              View draft changes
            </Link>
            {canEdit && (
              <Link
                to={adminEditorPathForContentKey(contentKeyForPublicPath(pathname))}
                className="text-xs uppercase tracking-wider px-3 py-2 border border-slate-300 hover:bg-slate-100 transition-colors"
              >
                Open editor
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-950">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-start gap-2 text-sm">
          <Eye size={16} className="mt-0.5 shrink-0 text-amber-700" />
          <div>
            <p className="font-medium">Previewing unpublished changes</p>
            <p className="text-xs text-amber-800/80 mt-0.5">
              Only users with preview permission see this draft. Visitors still see the published site.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={liveVersionPath}
            className="text-xs uppercase tracking-wider px-3 py-2 border border-amber-300 hover:bg-amber-100 transition-colors"
          >
            View live version
          </Link>
          {canFeedback && (
            <Button variant="outline" onClick={() => setShowFeedback((v) => !v)}>
              <MessageSquare size={14} className="mr-1" />
              Leave feedback
            </Button>
          )}
          {canEdit && (
            <Link
              to={adminEditorPathForContentKey(contentKeyForPublicPath(pathname))}
              className="text-xs uppercase tracking-wider px-3 py-2 border border-amber-300 hover:bg-amber-100 transition-colors"
            >
              Open editor
            </Link>
          )}
        </div>
      </div>

      {showFeedback && canFeedback && (
        <div className="max-w-6xl mx-auto px-4 pb-4">
          <div className="bg-white border border-amber-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Overall draft feedback</p>
              <button type="button" onClick={() => setShowFeedback(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <FormField label="Your comment">
              <textarea
                className={`${textareaClass} min-h-[96px]`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Share notes for the editor before publish"
              />
            </FormField>
            <div className="mt-3 flex items-center gap-3">
              <Button onClick={handleSubmitFeedback} loading={submitting} disabled={!message.trim()}>
                Submit feedback
              </Button>
              {notice && <p className="text-xs text-amber-800">{notice}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
