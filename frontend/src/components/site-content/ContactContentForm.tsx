import type { ContactContent } from '../../types/siteContent';
import { SectionHeading, TextAreaInput, TextInput } from './formHelpers';
import { RichTextField } from './RichTextField';
import { SeoFieldsForm } from './SeoFieldsForm';

type ContactContentFormProps = {
  value: ContactContent;
  onChange: (value: ContactContent) => void;
};

export function ContactContentForm({ value, onChange }: ContactContentFormProps) {
  const update = (patch: Partial<ContactContent>) => onChange({ ...value, ...patch });

  const updatePageHeader = (patch: Partial<ContactContent['pageHeader']>) =>
    update({ pageHeader: { ...value.pageHeader, ...patch } });

  return (
    <div className="space-y-10">
      <SeoFieldsForm value={value.seo} onChange={(seo) => update({ seo })} />

      <div className="space-y-4">
        <SectionHeading title="Page header" />
        <TextInput label="Eyebrow" value={value.pageHeader.eyebrow} onChange={(eyebrow) => updatePageHeader({ eyebrow })} />
        <TextInput label="Title" value={value.pageHeader.title} onChange={(title) => updatePageHeader({ title })} required />
        <RichTextField
          label="Subtitle"
          value={value.pageHeader.subtitle}
          onChange={(subtitle) => updatePageHeader({ subtitle })}
        />
      </div>

      <div className="space-y-4">
        <SectionHeading title="Form messages" description="Shown after submit success or failure." />
        <TextAreaInput
          label="Success message"
          value={value.successMessage}
          onChange={(successMessage) => update({ successMessage })}
        />
        <TextAreaInput
          label="Error message"
          value={value.errorMessage}
          onChange={(errorMessage) => update({ errorMessage })}
        />
      </div>
    </div>
  );
}
