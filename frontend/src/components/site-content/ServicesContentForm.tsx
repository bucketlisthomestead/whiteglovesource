import { Plus } from 'lucide-react';
import type { ServicesContent } from '../../types/siteContent';
import {
  ArrayItemShell,
  SectionHeading,
  StringListEditor,
  TextInput,
} from './formHelpers';
import { RichTextField } from './RichTextField';
import { SeoFieldsForm } from './SeoFieldsForm';

type ServicesContentFormProps = {
  value: ServicesContent;
  onChange: (value: ServicesContent) => void;
};

export function ServicesContentForm({ value, onChange }: ServicesContentFormProps) {
  const update = (patch: Partial<ServicesContent>) => onChange({ ...value, ...patch });

  const updatePageHeader = (patch: Partial<ServicesContent['pageHeader']>) =>
    update({ pageHeader: { ...value.pageHeader, ...patch } });

  const updateBottomCta = (patch: Partial<ServicesContent['bottomCta']>) =>
    update({ bottomCta: { ...value.bottomCta, ...patch } });

  const updateDetail = (index: number, patch: Partial<ServicesContent['serviceDetails'][number]>) => {
    const serviceDetails = [...value.serviceDetails];
    serviceDetails[index] = { ...serviceDetails[index], ...patch };
    update({ serviceDetails });
  };

  const moveDetail = (index: number, direction: -1 | 1) => {
    const serviceDetails = [...value.serviceDetails];
    const target = index + direction;
    if (target < 0 || target >= serviceDetails.length) return;
    [serviceDetails[index], serviceDetails[target]] = [serviceDetails[target], serviceDetails[index]];
    update({ serviceDetails });
  };

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
        <SectionHeading title="Service details" description="Detailed service blocks with includes lists." />
        {value.serviceDetails.map((service, index) => (
          <ArrayItemShell
            key={index}
            title="Service"
            index={index}
            total={value.serviceDetails.length}
            onMoveUp={() => moveDetail(index, -1)}
            onMoveDown={() => moveDetail(index, 1)}
            onRemove={() =>
              update({ serviceDetails: value.serviceDetails.filter((_, i) => i !== index) })
            }
          >
            <TextInput label="Title" value={service.title} onChange={(title) => updateDetail(index, { title })} />
            <RichTextField
              label="Description"
              value={service.description}
              onChange={(description) => updateDetail(index, { description })}
            />
            <StringListEditor
              label="Includes"
              items={service.includes}
              onChange={(includes) => updateDetail(index, { includes })}
              addLabel="Add include"
              placeholder="What's included"
            />
          </ArrayItemShell>
        ))}
        <button
          type="button"
          onClick={() =>
            update({
              serviceDetails: [
                ...value.serviceDetails,
                { title: '', description: '', includes: [] },
              ],
            })
          }
          className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-gold hover:text-charcoal"
        >
          <Plus size={14} />
          Add service detail
        </button>
      </div>

      <div className="space-y-4">
        <SectionHeading title="Bottom CTA" />
        <TextInput label="Title" value={value.bottomCta.title} onChange={(title) => updateBottomCta({ title })} />
        <RichTextField
          label="Subtitle"
          value={value.bottomCta.subtitle}
          onChange={(subtitle) => updateBottomCta({ subtitle })}
        />
        <TextInput label="CTA label" value={value.bottomCta.cta} onChange={(cta) => updateBottomCta({ cta })} />
      </div>
    </div>
  );
}
