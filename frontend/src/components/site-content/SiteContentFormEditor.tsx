import { SITE_CONTENT_DEFAULTS } from '../../lib/siteContentDefaults';
import type {
  ContactContent,
  FooterContent,
  HeaderContent,
  HomeContent,
  ServicesContent,
  SiteContentBundle,
} from '../../types/siteContent';
import { ContactContentForm } from './ContactContentForm';
import { FooterContentForm } from './FooterContentForm';
import { HeaderContentForm } from './HeaderContentForm';
import { HomeContentForm } from './HomeContentForm';
import { ServicesContentForm } from './ServicesContentForm';

type SiteContentFormEditorProps = {
  contentKey: string;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
};

function mergeSection<K extends keyof SiteContentBundle>(
  key: K,
  value: Record<string, unknown>,
): SiteContentBundle[K] {
  return { ...SITE_CONTENT_DEFAULTS[key], ...value } as SiteContentBundle[K];
}

export function SiteContentFormEditor({ contentKey, value, onChange }: SiteContentFormEditorProps) {
  switch (contentKey) {
    case 'home':
      return (
        <HomeContentForm
          value={mergeSection('home', value) as HomeContent}
          onChange={(content) => onChange(content as unknown as Record<string, unknown>)}
        />
      );
    case 'services':
      return (
        <ServicesContentForm
          value={mergeSection('services', value) as ServicesContent}
          onChange={(content) => onChange(content as unknown as Record<string, unknown>)}
        />
      );
    case 'contact':
      return (
        <ContactContentForm
          value={mergeSection('contact', value) as ContactContent}
          onChange={(content) => onChange(content as unknown as Record<string, unknown>)}
        />
      );
    case 'header':
      return (
        <HeaderContentForm
          value={mergeSection('header', value) as HeaderContent}
          onChange={(content) => onChange(content as unknown as Record<string, unknown>)}
        />
      );
    case 'footer':
      return (
        <FooterContentForm
          value={mergeSection('footer', value) as FooterContent}
          onChange={(content) => onChange(content as unknown as Record<string, unknown>)}
        />
      );
    default:
      return (
        <p className="text-sm text-charcoal/60">
          No visual editor for this section. Switch to JSON mode to edit.
        </p>
      );
  }
}
