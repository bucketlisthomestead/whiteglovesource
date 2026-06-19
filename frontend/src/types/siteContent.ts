export type HomeServiceItem = {
  icon: string;
  title: string;
  description: string;
};

export type HomeSampleItem = {
  piece: string;
  stage: string;
  room: string;
  condition: string;
};

export type SiteContentSeoFields = {
  metaTitle?: string;
  metaDescription?: string;
};

export type HomeContent = {
  seo?: SiteContentSeoFields;
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
  };
  servicesSection: {
    eyebrow: string;
    title: string;
    items: HomeServiceItem[];
  };
  portalSection: {
    eyebrow: string;
    title: string;
    description: string;
    bullets: string[];
    cta: string;
    sampleCaption: string;
    sampleItems: HomeSampleItem[];
  };
  ctaSection: {
    title: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
  };
};

export type ServicesContent = {
  seo?: SiteContentSeoFields;
  pageHeader: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  serviceDetails: Array<{
    title: string;
    description: string;
    includes: string[];
  }>;
  bottomCta: {
    title: string;
    subtitle: string;
    cta: string;
  };
};

export type ContactContent = {
  seo?: SiteContentSeoFields;
  pageHeader: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  successMessage: string;
  errorMessage: string;
};

export type HeaderContent = {
  brandPrimary: string;
  brandSecondary: string;
};

export type FooterContent = {
  brandName: string;
  tagline: string;
  contact: {
    location: string;
    region: string;
    phone: string;
    phoneHref: string;
    email: string;
  };
  copyrightTagline: string;
};

export type SiteContentBundle = {
  home: HomeContent;
  services: ServicesContent;
  contact: ContactContent;
  header: HeaderContent;
  footer: FooterContent;
};

export type SiteContentFileMeta = {
  key: string;
  label: string;
  description: string;
  group: string;
  filename: string;
};

export type SiteContentVersionSummary = {
  id: string;
  contentKey: string;
  changedByUserId: string;
  changedByName: string;
  changeNote: string | null;
  isRestore: boolean;
  restoredFromVersionId: string | null;
  isPublish: boolean;
  draftId: string | null;
  createdAt: string;
};

export type SiteContentVersionDetail = SiteContentVersionSummary & {
  content: string;
  parsedContent: Record<string, unknown>;
};

export type SiteContentDraftSummary = {
  id: string;
  status: 'active' | 'published' | 'discarded';
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  changedKeys: string[];
  entryCount: number;
  feedbackCount: number;
};

export type SiteContentFeedbackItem = {
  id: string;
  draftId: string;
  contentKey: string | null;
  authorUserId: string;
  authorName: string;
  message: string;
  createdAt: string;
};

export type SiteContentAdminSection = {
  key: string;
  content: Record<string, unknown>;
  publishedContent: Record<string, unknown>;
  hasDraftChanges: boolean;
};

export type { SeoAnalysisResult, SeoSummaryItem } from '../lib/seo/seo.types';
