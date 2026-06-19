import type { FooterContent } from '../../types/siteContent';
import { SectionHeading, TextInput } from './formHelpers';
import { RichTextField } from './RichTextField';

type FooterContentFormProps = {
  value: FooterContent;
  onChange: (value: FooterContent) => void;
};

export function FooterContentForm({ value, onChange }: FooterContentFormProps) {
  const update = (patch: Partial<FooterContent>) => onChange({ ...value, ...patch });

  const updateContact = (patch: Partial<FooterContent['contact']>) =>
    update({ contact: { ...value.contact, ...patch } });

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <SectionHeading title="Brand" />
        <TextInput label="Brand name" value={value.brandName} onChange={(brandName) => update({ brandName })} required />
        <RichTextField label="Tagline" value={value.tagline} onChange={(tagline) => update({ tagline })} />
      </div>

      <div className="space-y-4">
        <SectionHeading title="Contact info" />
        <TextInput label="Location" value={value.contact.location} onChange={(location) => updateContact({ location })} />
        <TextInput label="Region" value={value.contact.region} onChange={(region) => updateContact({ region })} />
        <TextInput label="Phone display" value={value.contact.phone} onChange={(phone) => updateContact({ phone })} />
        <TextInput
          label="Phone link (href)"
          value={value.contact.phoneHref}
          onChange={(phoneHref) => updateContact({ phoneHref })}
          mono
          placeholder="tel:+13365550100"
        />
        <TextInput
          label="Email"
          value={value.contact.email}
          onChange={(email) => updateContact({ email })}
          mono
        />
      </div>

      <div className="space-y-4">
        <SectionHeading title="Copyright" />
        <TextInput
          label="Copyright tagline"
          value={value.copyrightTagline}
          onChange={(copyrightTagline) => update({ copyrightTagline })}
        />
      </div>
    </div>
  );
}
