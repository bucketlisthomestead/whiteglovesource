import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getPreviewSiteContent, getPublicSiteContent } from '../api/client';
import { useAuth } from './AuthContext';
import { SITE_CONTENT_DEFAULTS } from '../lib/siteContentDefaults';
import { PERMISSIONS } from '../lib/permissions';
import type { SiteContentBundle } from '../types/siteContent';

type SiteContentContextValue = {
  content: SiteContentBundle;
  loading: boolean;
  isPreviewingDraft: boolean;
  isViewingLiveOverride: boolean;
  hasUnpublishedDraft: boolean;
};

const SiteContentContext = createContext<SiteContentContextValue>({
  content: SITE_CONTENT_DEFAULTS,
  loading: true,
  isPreviewingDraft: false,
  isViewingLiveOverride: false,
  hasUnpublishedDraft: false,
});

function mergeBundle(partial: Partial<SiteContentBundle>): SiteContentBundle {
  return {
    home: { ...SITE_CONTENT_DEFAULTS.home, ...partial.home },
    services: { ...SITE_CONTENT_DEFAULTS.services, ...partial.services },
    contact: { ...SITE_CONTENT_DEFAULTS.contact, ...partial.contact },
    header: { ...SITE_CONTENT_DEFAULTS.header, ...partial.header },
    footer: { ...SITE_CONTENT_DEFAULTS.footer, ...partial.footer },
  };
}

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, hasPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const liveOverride = searchParams.get('live') === '1';
  const [content, setContent] = useState<SiteContentBundle>(SITE_CONTENT_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [isPreviewingDraft, setIsPreviewingDraft] = useState(false);
  const [isViewingLiveOverride, setIsViewingLiveOverride] = useState(false);
  const [hasUnpublishedDraft, setHasUnpublishedDraft] = useState(false);

  const canPreviewDraft = Boolean(
    user && hasPermission(PERMISSIONS.SITE_CONTENT_PREVIEW),
  );

  useEffect(() => {
    if (authLoading) return;

    let active = true;
    setLoading(true);

    const load = async () => {
      try {
        if (canPreviewDraft) {
          try {
            const preview = await getPreviewSiteContent();
            if (!active) return;
            const published = await getPublicSiteContent();
            if (!active) return;
            const previewMerged = mergeBundle(preview as Partial<SiteContentBundle>);
            const publishedMerged = mergeBundle(published as Partial<SiteContentBundle>);
            const hasDraft =
              JSON.stringify(previewMerged) !== JSON.stringify(publishedMerged);
            setHasUnpublishedDraft(hasDraft);

            if (liveOverride) {
              setContent(publishedMerged);
              setIsPreviewingDraft(false);
              setIsViewingLiveOverride(hasDraft);
              return;
            }

            setContent(previewMerged);
            setIsPreviewingDraft(hasDraft);
            setIsViewingLiveOverride(false);
            return;
          } catch {
            // Fall back to published content if preview is unavailable
          }
        }

        const data = await getPublicSiteContent();
        if (!active) return;
        setContent(mergeBundle(data as Partial<SiteContentBundle>));
        setIsPreviewingDraft(false);
        setIsViewingLiveOverride(false);
        setHasUnpublishedDraft(false);
      } catch {
        if (!active) return;
        setContent(SITE_CONTENT_DEFAULTS);
        setIsPreviewingDraft(false);
        setIsViewingLiveOverride(false);
        setHasUnpublishedDraft(false);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [authLoading, canPreviewDraft, liveOverride, user?.id]);

  const value = useMemo(
    () => ({
      content,
      loading,
      isPreviewingDraft,
      isViewingLiveOverride,
      hasUnpublishedDraft,
    }),
    [content, loading, isPreviewingDraft, isViewingLiveOverride, hasUnpublishedDraft],
  );

  return (
    <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>
  );
}

export function useSiteContent() {
  return useContext(SiteContentContext);
}

export function useSiteContentSection<K extends keyof SiteContentBundle>(key: K) {
  const { content, loading } = useSiteContent();
  return { data: content[key], loading };
}
