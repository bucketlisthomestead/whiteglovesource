import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Code2,
  Eye,
  FileText,
  Globe,
  History,
  LayoutTemplate,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
import {
  addSiteContentDraftFeedback,
  discardSiteContentDraft,
  getAdminSiteContent,
  getAdminSiteContentFiles,
  getSiteContentDraft,
  getSiteContentDraftFeedback,
  getSiteContentSeoSummary,
  getSiteContentVersion,
  getSiteContentVersions,
  publishSiteContentDraft,
  restoreSiteContentVersion,
  saveAdminSiteContent,
} from '../api/client';
import { SiteContentSeoPanel } from '../components/SiteContentSeoPanel';
import { SiteContentFormEditor } from '../components/site-content/SiteContentFormEditor';
import { Button, FormField, inputClass, textareaClass } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { PERMISSIONS } from '../lib/permissions';
import {
  PAGE_CONTENT_SECTION_KEYS,
  publicPathForContentKey,
  publicPathWithLiveOverride,
} from '../lib/siteContentPreview';
import type {
  SeoSummaryItem,
  SiteContentDraftSummary,
  SiteContentFeedbackItem,
  SiteContentFileMeta,
  SiteContentVersionDetail,
  SiteContentVersionSummary,
} from '../types/siteContent';

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function formatWhen(value: string) {
  return new Date(value).toLocaleString();
}

type EditorMode = 'visual' | 'json';

function parseContentObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function contentKeyLabel(key: string | null, files: SiteContentFileMeta[]) {
  if (!key) return 'Overall';
  return files.find((file) => file.key === key)?.label ?? key;
}

export function SiteContentPage() {
  const [searchParams] = useSearchParams();
  const sectionParam = searchParams.get('section');
  const { hasPermission } = useAuth();
  const canPublish = hasPermission(PERMISSIONS.SITE_CONTENT_PUBLISH);
  const canFeedback = hasPermission(PERMISSIONS.SITE_CONTENT_FEEDBACK);
  const canPreviewSite =
    hasPermission(PERMISSIONS.SITE_CONTENT_PREVIEW) ||
    hasPermission(PERMISSIONS.SITE_CONTENT_EDIT);

  const [files, setFiles] = useState<SiteContentFileMeta[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>('visual');
  const [editorValue, setEditorValue] = useState('');
  const [formContent, setFormContent] = useState<Record<string, unknown>>({});
  const [publishedValue, setPublishedValue] = useState('');
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const [changeNote, setChangeNote] = useState('');
  const [versions, setVersions] = useState<SiteContentVersionSummary[]>([]);
  const [previewVersion, setPreviewVersion] = useState<SiteContentVersionDetail | null>(null);
  const [draft, setDraft] = useState<SiteContentDraftSummary | null>(null);
  const [feedback, setFeedback] = useState<SiteContentFeedbackItem[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [publishNote, setPublishNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [seoSummary, setSeoSummary] = useState<SeoSummaryItem[] | null>(null);
  const [seoSummaryLoading, setSeoSummaryLoading] = useState(false);

  const debouncedEditorValue = useDebouncedValue(editorValue, 400);

  const parsedEditorContent = useMemo(() => {
    const fromJson = parseContentObject(debouncedEditorValue);
    if (fromJson) {
      return { content: fromJson, error: false as const };
    }
    return { content: null, error: true as const };
  }, [debouncedEditorValue]);

  const handleFormContentChange = useCallback((content: Record<string, unknown>) => {
    setFormContent(content);
    setEditorValue(JSON.stringify(content, null, 2));
  }, []);

  const handleJsonChange = useCallback((value: string) => {
    setEditorValue(value);
    const parsed = parseContentObject(value);
    if (parsed) {
      setFormContent(parsed);
    }
  }, []);

  const switchEditorMode = useCallback(
    (mode: EditorMode) => {
      if (mode === editorMode) return;
      if (mode === 'json') {
        setEditorValue(JSON.stringify(formContent, null, 2));
      } else {
        const parsed = parseContentObject(editorValue);
        if (parsed) {
          setFormContent(parsed);
        }
      }
      setEditorMode(mode);
    },
    [editorMode, editorValue, formContent],
  );

  const refreshSeoSummary = useCallback(async () => {
    if (!hasPermission(PERMISSIONS.SITE_CONTENT_EDIT) &&
        !hasPermission(PERMISSIONS.SITE_CONTENT_PREVIEW)) {
      return;
    }
    setSeoSummaryLoading(true);
    try {
      const summary = await getSiteContentSeoSummary();
      setSeoSummary(summary);
    } catch {
      setSeoSummary(null);
    } finally {
      setSeoSummaryLoading(false);
    }
  }, [hasPermission]);

  const refreshDraft = useCallback(async () => {
    const [draftSummary, feedbackItems] = await Promise.all([
      getSiteContentDraft(),
      getSiteContentDraftFeedback(),
    ]);
    setDraft(draftSummary);
    setFeedback(feedbackItems);
    return draftSummary;
  }, []);

  useEffect(() => {
    Promise.all([getAdminSiteContentFiles(), refreshDraft()])
      .then(([items]) => {
        setFiles(items);
      })
      .catch(() => setNotice({ type: 'error', text: 'Unable to load editable content files.' }))
      .finally(() => setLoading(false));
  }, [refreshDraft]);

  useEffect(() => {
    if (!files.length) return;
    const fromUrl =
      sectionParam && files.some((file) => file.key === sectionParam)
        ? sectionParam
        : files[0].key;
    setSelectedKey(fromUrl);
  }, [sectionParam, files]);

  useEffect(() => {
    if (!loading) refreshSeoSummary();
  }, [loading, refreshSeoSummary]);

  useEffect(() => {
    if (!selectedKey) return;
    setLoadingContent(true);
    setPreviewVersion(null);
    setNotice(null);
    Promise.all([
      getAdminSiteContent(selectedKey),
      getSiteContentVersions(selectedKey),
    ])
      .then(([current, history]) => {
        const serialized = JSON.stringify(current.content, null, 2);
        setEditorValue(serialized);
        setFormContent(current.content);
        setPublishedValue(JSON.stringify(current.publishedContent, null, 2));
        setHasDraftChanges(current.hasDraftChanges);
        setVersions(history);
      })
      .catch(() => setNotice({ type: 'error', text: 'Unable to load content for this section.' }))
      .finally(() => setLoadingContent(false));
  }, [selectedKey]);

  const groupedFiles = useMemo(() => {
    const groups = new Map<string, SiteContentFileMeta[]>();
    for (const file of files) {
      const list = groups.get(file.group) ?? [];
      list.push(file);
      groups.set(file.group, list);
    }
    return [...groups.entries()];
  }, [files]);

  const selectedMeta = files.find((file) => file.key === selectedKey);
  const draftHasChanges = (draft?.changedKeys?.length ?? 0) > 0;
  const isPageSection =
    selectedKey != null &&
    (PAGE_CONTENT_SECTION_KEYS as readonly string[]).includes(selectedKey);
  const sectionHasDraftChanges =
    hasDraftChanges || (selectedKey != null && draft?.changedKeys?.includes(selectedKey));
  const showPreviewChangesButton =
    canPreviewSite && (isPageSection || sectionHasDraftChanges);
  const previewPublicPath = publicPathForContentKey(selectedKey);
  const livePublicPath = publicPathWithLiveOverride(previewPublicPath);

  const handleSave = async () => {
    if (!selectedKey) return;
    const parsed = editorMode === 'visual' ? formContent : parseContentObject(editorValue);
    if (!parsed) {
      setNotice({ type: 'error', text: 'Content must be valid JSON object syntax.' });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      await saveAdminSiteContent(selectedKey, {
        content: parsed,
        changeNote: changeNote.trim() || undefined,
      });
      await refreshDraft();
      const current = await getAdminSiteContent(selectedKey);
      const serialized = JSON.stringify(current.content, null, 2);
      setEditorValue(serialized);
      setFormContent(current.content);
      setPublishedValue(JSON.stringify(current.publishedContent, null, 2));
      setHasDraftChanges(current.hasDraftChanges);
      setChangeNote('');
      setNotice({ type: 'success', text: 'Draft saved. Changes are not live until published.' });
      refreshSeoSummary();
    } catch {
      setNotice({ type: 'error', text: 'Save failed. Check JSON and try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!window.confirm('Publish all pending draft changes to the live site?')) return;
    setPublishing(true);
    setNotice(null);
    try {
      await publishSiteContentDraft(publishNote.trim() || undefined);
      await refreshDraft();
      if (selectedKey) {
        const current = await getAdminSiteContent(selectedKey);
        const serialized = JSON.stringify(current.content, null, 2);
        setEditorValue(serialized);
        setFormContent(current.content);
        setPublishedValue(JSON.stringify(current.publishedContent, null, 2));
        setHasDraftChanges(current.hasDraftChanges);
        const history = await getSiteContentVersions(selectedKey);
        setVersions(history);
      }
      setPublishNote('');
      setNotice({ type: 'success', text: 'Draft published. Live site files were updated.' });
    } catch {
      setNotice({ type: 'error', text: 'Publish failed. Ensure there are pending changes.' });
    } finally {
      setPublishing(false);
    }
  };

  const handleDiscard = async () => {
    if (!window.confirm('Discard the entire pending draft? This cannot be undone.')) return;
    setDiscarding(true);
    setNotice(null);
    try {
      await discardSiteContentDraft();
      await refreshDraft();
      if (selectedKey) {
        const current = await getAdminSiteContent(selectedKey);
        const serialized = JSON.stringify(current.content, null, 2);
        setEditorValue(serialized);
        setFormContent(current.content);
        setPublishedValue(JSON.stringify(current.publishedContent, null, 2));
        setHasDraftChanges(current.hasDraftChanges);
      }
      setNotice({ type: 'success', text: 'Pending draft discarded.' });
    } catch {
      setNotice({ type: 'error', text: 'Unable to discard draft.' });
    } finally {
      setDiscarding(false);
    }
  };

  const handleSubmitFeedback = async () => {
    const trimmed = feedbackMessage.trim();
    if (!trimmed) return;
    setSubmittingFeedback(true);
    setNotice(null);
    try {
      await addSiteContentDraftFeedback({
        contentKey: selectedKey,
        message: trimmed,
      });
      setFeedbackMessage('');
      await refreshDraft();
      setNotice({ type: 'success', text: 'Feedback added for this section.' });
    } catch {
      setNotice({ type: 'error', text: 'Unable to submit feedback.' });
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handlePreviewVersion = async (versionId: string) => {
    if (!selectedKey) return;
    try {
      const detail = await getSiteContentVersion(selectedKey, versionId);
      setPreviewVersion(detail);
    } catch {
      setNotice({ type: 'error', text: 'Unable to load that version.' });
    }
  };

  const handleRestore = async (versionId: string) => {
    if (!selectedKey) return;
    if (!window.confirm('Load this version into the pending draft? Live site will not change until publish.')) return;
    setRestoringId(versionId);
    setNotice(null);
    try {
      await restoreSiteContentVersion(selectedKey, versionId);
      await refreshDraft();
      const [current, history] = await Promise.all([
        getAdminSiteContent(selectedKey),
        getSiteContentVersions(selectedKey),
      ]);
      const serialized = JSON.stringify(current.content, null, 2);
      setEditorValue(serialized);
      setFormContent(current.content);
      setPublishedValue(JSON.stringify(current.publishedContent, null, 2));
      setHasDraftChanges(current.hasDraftChanges);
      setVersions(history);
      setPreviewVersion(null);
      setNotice({ type: 'success', text: 'Version loaded into draft.' });
    } catch {
      setNotice({ type: 'error', text: 'Restore failed.' });
    } finally {
      setRestoringId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pb-24">
      <div className="mb-8">
        <Link to="/admin" className="text-sm text-charcoal/50 hover:text-gold">
          ← Dashboard
        </Link>
        <h1 className="font-serif text-3xl mt-2">Site Content</h1>
        <p className="text-sm text-charcoal/60 mt-2 max-w-2xl">
          Edit marketing copy as a pending draft. Preview users can review changes on public pages.
          Publishing writes JSON files to disk and records version history.
        </p>
      </div>

      {notice && (
        <div
          className={`mb-6 flex items-center gap-2 p-4 text-sm border ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {notice.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {notice.text}
        </div>
      )}

      <section className="mb-6 bg-white border border-cream-dark p-5 md:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Eye size={18} className="text-gold" />
              <h2 className="text-sm uppercase tracking-wider font-medium">Draft Status</h2>
            </div>
            {draftHasChanges ? (
              <>
                <p className="text-sm text-charcoal">
                  Pending changes in {draft?.changedKeys?.length} section
                  {draft?.changedKeys?.length === 1 ? '' : 's'}:
                  {' '}
                  {draft?.changedKeys?.join(', ')}
                </p>
                <p className="text-xs text-charcoal/50 mt-1">
                  Last updated {draft ? formatWhen(draft.updatedAt) : '—'}
                  {draft?.feedbackCount ? ` · ${draft.feedbackCount} feedback comment(s)` : ''}
                </p>
              </>
            ) : (
              <p className="text-sm text-charcoal/60">No pending draft changes. Edits will start a new draft.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {canPublish && (
              <Button
                onClick={handlePublish}
                loading={publishing}
                disabled={!draftHasChanges}
              >
                <Send size={14} className="mr-1" />
                Publish
              </Button>
            )}
            {(canPublish || hasPermission(PERMISSIONS.SITE_CONTENT_EDIT)) && (
              <Button
                variant="outline"
                onClick={handleDiscard}
                loading={discarding}
                disabled={!draft}
              >
                <Trash2 size={14} className="mr-1" />
                Discard draft
              </Button>
            )}
          </div>
        </div>
        {canPublish && draftHasChanges && (
          <div className="mt-4">
            <FormField label="Publish note (optional)">
              <input
                className={inputClass}
                value={publishNote}
                onChange={(e) => setPublishNote(e.target.value)}
                placeholder="Note recorded in version history"
              />
            </FormField>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        <aside className="bg-white border border-cream-dark p-4 h-fit">
          <p className="text-xs uppercase tracking-wider text-charcoal/50 mb-3">Sections</p>
          <div className="space-y-4">
            {groupedFiles.map(([group, items]) => (
              <div key={group}>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gold mb-2">{group}</p>
                <div className="space-y-1">
                  {items.map((file) => {
                    const isChanged = draft?.changedKeys?.includes(file.key);
                    return (
                      <button
                        key={file.key}
                        type="button"
                        onClick={() => setSelectedKey(file.key)}
                        className={`w-full text-left px-3 py-2 text-sm border transition-colors ${
                          selectedKey === file.key
                            ? 'border-gold bg-gold/10 text-charcoal'
                            : 'border-transparent hover:border-cream-dark text-charcoal/70'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <FileText size={14} className="text-gold shrink-0" />
                          <span className="flex-1">{file.label}</span>
                          {isChanged && (
                            <span className="text-[10px] uppercase tracking-wider text-amber-700">Draft</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="space-y-6">
          <section className="bg-white border border-cream-dark p-5 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
              <div>
                <h2 className="font-serif text-2xl">{selectedMeta?.label ?? 'Content'}</h2>
                <p className="text-sm text-charcoal/60 mt-1">{selectedMeta?.description}</p>
                <p className="text-xs text-charcoal/40 mt-2 font-mono">{selectedMeta?.filename}</p>
                {hasDraftChanges && (
                  <p className="text-xs text-amber-700 mt-2">This section has unpublished draft changes.</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {showPreviewChangesButton && (
                  <>
                    <a
                      href={previewPublicPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1 px-4 py-2 text-sm border border-cream-dark text-charcoal hover:border-gold/40 transition-colors"
                    >
                      <Eye size={14} />
                      Preview changes
                    </a>
                    <a
                      href={livePublicPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1 px-4 py-2 text-sm border border-cream-dark text-charcoal hover:border-gold/40 transition-colors"
                    >
                      <Globe size={14} />
                      View live version
                    </a>
                  </>
                )}
                <Button onClick={handleSave} loading={saving} disabled={loadingContent || !selectedKey}>
                  Save to draft
                </Button>
              </div>
            </div>

            {loadingContent ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="animate-spin text-gold" size={28} />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 border-b border-cream-dark pb-4">
                  <button
                    type="button"
                    onClick={() => switchEditorMode('visual')}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider border transition-colors ${
                      editorMode === 'visual'
                        ? 'border-gold bg-gold/10 text-charcoal'
                        : 'border-cream-dark text-charcoal/60 hover:border-gold/40'
                    }`}
                  >
                    <LayoutTemplate size={14} />
                    Visual editor
                  </button>
                  <button
                    type="button"
                    onClick={() => switchEditorMode('json')}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider border transition-colors ${
                      editorMode === 'json'
                        ? 'border-gold bg-gold/10 text-charcoal'
                        : 'border-cream-dark text-charcoal/60 hover:border-gold/40'
                    }`}
                  >
                    <Code2 size={14} />
                    JSON (advanced)
                  </button>
                </div>

                {editorMode === 'visual' ? (
                  selectedKey && (
                    <SiteContentFormEditor
                      contentKey={selectedKey}
                      value={formContent}
                      onChange={handleFormContentChange}
                    />
                  )
                ) : (
                  <FormField label="JSON Content (draft)">
                    <textarea
                      className={`${textareaClass} font-mono text-xs min-h-[360px]`}
                      value={editorValue}
                      onChange={(e) => handleJsonChange(e.target.value)}
                      spellCheck={false}
                    />
                  </FormField>
                )}

                <FormField label="Change note (optional)">
                  <input
                    className={inputClass}
                    value={changeNote}
                    onChange={(e) => setChangeNote(e.target.value)}
                    placeholder="Describe what you changed"
                  />
                </FormField>
                {hasDraftChanges && (
                  <details className="border border-cream-dark p-3">
                    <summary className="text-xs uppercase tracking-wider text-charcoal/60 cursor-pointer">
                      Compare with published
                    </summary>
                    <pre className="mt-3 text-xs font-mono whitespace-pre-wrap overflow-auto max-h-48 text-charcoal/70">
                      {publishedValue}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </section>

          <SiteContentSeoPanel
            contentKey={selectedKey}
            content={parsedEditorContent.content}
            parseError={parsedEditorContent.error}
            summary={seoSummary}
            summaryLoading={seoSummaryLoading}
          />

          <section className="bg-white border border-cream-dark p-5 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare size={18} className="text-gold" />
              <h2 className="text-sm uppercase tracking-wider font-medium">Draft Feedback</h2>
            </div>

            {feedback.length === 0 ? (
              <p className="text-sm text-charcoal/50">No feedback on the current draft yet.</p>
            ) : (
              <div className="space-y-3 mb-4">
                {feedback.map((item) => (
                  <div key={item.id} className="border-b border-cream-dark pb-3 last:border-0">
                    <p className="text-xs text-charcoal/50">
                      {contentKeyLabel(item.contentKey, files)} · {item.authorName} · {formatWhen(item.createdAt)}
                    </p>
                    <p className="text-sm text-charcoal mt-1 whitespace-pre-wrap">{item.message}</p>
                  </div>
                ))}
              </div>
            )}

            {canFeedback && draft && (
              <div className="space-y-3 border-t border-cream-dark pt-4">
                <FormField label={`Feedback on ${selectedMeta?.label ?? 'section'}`}>
                  <textarea
                    className={`${textareaClass} min-h-[96px]`}
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    placeholder="Comment for editors before publish"
                  />
                </FormField>
                <Button
                  variant="outline"
                  onClick={handleSubmitFeedback}
                  loading={submittingFeedback}
                  disabled={!feedbackMessage.trim()}
                >
                  Add feedback
                </Button>
              </div>
            )}
          </section>

          <section className="bg-white border border-cream-dark p-5 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <History size={18} className="text-gold" />
              <h2 className="text-sm uppercase tracking-wider font-medium">Version History</h2>
            </div>

            {versions.length === 0 ? (
              <p className="text-sm text-charcoal/50">No published versions yet. Publish a draft to start history.</p>
            ) : (
              <div className="space-y-3">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-cream-dark last:border-0"
                  >
                    <div>
                      <p className="text-sm text-charcoal flex items-center gap-2">
                        <Clock size={14} className="text-charcoal/40" />
                        {formatWhen(version.createdAt)}
                      </p>
                      <p className="text-xs text-charcoal/50 mt-1">
                        {version.changedByName}
                        {version.isPublish ? ' · publish' : ''}
                        {version.isRestore ? ' · restore' : ''}
                      </p>
                      {version.changeNote && (
                        <p className="text-xs text-charcoal/60 mt-1">{version.changeNote}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => handlePreviewVersion(version.id)}>
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleRestore(version.id)}
                        loading={restoringId === version.id}
                      >
                        <RotateCcw size={14} className="mr-1" />
                        Load to draft
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {previewVersion && (
              <div className="mt-6 border border-gold/30 bg-gold/5 p-4">
                <p className="text-xs uppercase tracking-wider text-gold mb-2">Version Preview</p>
                <pre className="text-xs font-mono whitespace-pre-wrap overflow-auto max-h-64 text-charcoal/80">
                  {JSON.stringify(previewVersion.parsedContent, null, 2)}
                </pre>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
