import type { SiteContentSeoFields } from '../../types/siteContent';
import { SectionHeading, TextAreaInput, TextInput } from './formHelpers';

type SeoFieldsFormProps = {
  value: SiteContentSeoFields | undefined;
  onChange: (value: SiteContentSeoFields) => void;
};

export function SeoFieldsForm({ value, onChange }: SeoFieldsFormProps) {
  const seo = value ?? {};

  const update = (patch: Partial<SiteContentSeoFields>) => {
    onChange({ ...seo, ...patch });
  };

  return (
    <div className="space-y-4">
      <SectionHeading
        title="SEO"
        description="Optional meta title and description for search engines."
      />
      <TextInput
        label="Meta title"
        value={seo.metaTitle ?? ''}
        onChange={(metaTitle) => update({ metaTitle })}
        placeholder="Page title for search results"
      />
      <TextAreaInput
        label="Meta description"
        value={seo.metaDescription ?? ''}
        onChange={(metaDescription) => update({ metaDescription })}
        placeholder="120–160 character summary for search results"
        rows={3}
      />
    </div>
  );
}
