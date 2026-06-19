import { Plus } from 'lucide-react';
import type { HomeContent, HomeSampleItem, HomeServiceItem } from '../../types/siteContent';
import { ICON_MAP } from '../../lib/siteContentIcons';
import { FormField, selectClass } from '../Layout';
import {
  ArrayItemShell,
  SectionHeading,
  StringListEditor,
  TextInput,
} from './formHelpers';
import { RichTextField } from './RichTextField';
import { SeoFieldsForm } from './SeoFieldsForm';

type HomeContentFormProps = {
  value: HomeContent;
  onChange: (value: HomeContent) => void;
};

const ICON_OPTIONS = Object.keys(ICON_MAP);

export function HomeContentForm({ value, onChange }: HomeContentFormProps) {
  const update = (patch: Partial<HomeContent>) => onChange({ ...value, ...patch });

  const updateHero = (patch: Partial<HomeContent['hero']>) =>
    update({ hero: { ...value.hero, ...patch } });

  const updateServicesSection = (patch: Partial<HomeContent['servicesSection']>) =>
    update({ servicesSection: { ...value.servicesSection, ...patch } });

  const updatePortalSection = (patch: Partial<HomeContent['portalSection']>) =>
    update({ portalSection: { ...value.portalSection, ...patch } });

  const updateCtaSection = (patch: Partial<HomeContent['ctaSection']>) =>
    update({ ctaSection: { ...value.ctaSection, ...patch } });

  const updateServiceItem = (index: number, patch: Partial<HomeServiceItem>) => {
    const items = [...value.servicesSection.items];
    items[index] = { ...items[index], ...patch };
    updateServicesSection({ items });
  };

  const moveServiceItem = (index: number, direction: -1 | 1) => {
    const items = [...value.servicesSection.items];
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    updateServicesSection({ items });
  };

  const updateSampleItem = (index: number, patch: Partial<HomeSampleItem>) => {
    const sampleItems = [...value.portalSection.sampleItems];
    sampleItems[index] = { ...sampleItems[index], ...patch };
    updatePortalSection({ sampleItems });
  };

  const moveSampleItem = (index: number, direction: -1 | 1) => {
    const sampleItems = [...value.portalSection.sampleItems];
    const target = index + direction;
    if (target < 0 || target >= sampleItems.length) return;
    [sampleItems[index], sampleItems[target]] = [sampleItems[target], sampleItems[index]];
    updatePortalSection({ sampleItems });
  };

  return (
    <div className="space-y-10">
      <SeoFieldsForm value={value.seo} onChange={(seo) => update({ seo })} />

      <div className="space-y-4">
        <SectionHeading title="Hero" description="Main headline and call-to-action buttons." />
        <TextInput label="Eyebrow" value={value.hero.eyebrow} onChange={(eyebrow) => updateHero({ eyebrow })} />
        <TextInput label="Title" value={value.hero.title} onChange={(title) => updateHero({ title })} required />
        <RichTextField
          label="Subtitle"
          value={value.hero.subtitle}
          onChange={(subtitle) => updateHero({ subtitle })}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextInput label="Primary CTA" value={value.hero.primaryCta} onChange={(primaryCta) => updateHero({ primaryCta })} />
          <TextInput label="Secondary CTA" value={value.hero.secondaryCta} onChange={(secondaryCta) => updateHero({ secondaryCta })} />
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeading title="Services grid" description="Cards shown on the home page." />
        <TextInput
          label="Eyebrow"
          value={value.servicesSection.eyebrow}
          onChange={(eyebrow) => updateServicesSection({ eyebrow })}
        />
        <TextInput
          label="Title"
          value={value.servicesSection.title}
          onChange={(title) => updateServicesSection({ title })}
        />
        <div className="space-y-4">
          {value.servicesSection.items.map((item, index) => (
            <ArrayItemShell
              key={index}
              title="Service"
              index={index}
              total={value.servicesSection.items.length}
              onMoveUp={() => moveServiceItem(index, -1)}
              onMoveDown={() => moveServiceItem(index, 1)}
              onRemove={() =>
                updateServicesSection({
                  items: value.servicesSection.items.filter((_, i) => i !== index),
                })
              }
            >
              <FormField label="Icon">
                <select
                  className={selectClass}
                  value={item.icon}
                  onChange={(e) => updateServiceItem(index, { icon: e.target.value })}
                >
                  {ICON_OPTIONS.map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
              </FormField>
              <TextInput label="Title" value={item.title} onChange={(title) => updateServiceItem(index, { title })} />
              <RichTextField
                label="Description"
                value={item.description}
                onChange={(description) => updateServiceItem(index, { description })}
              />
            </ArrayItemShell>
          ))}
          <button
            type="button"
            onClick={() =>
              updateServicesSection({
                items: [
                  ...value.servicesSection.items,
                  { icon: 'Package', title: '', description: '' },
                ],
              })
            }
            className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-gold hover:text-charcoal"
          >
            <Plus size={14} />
            Add service
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeading title="Portal section" description="Project portal highlight and sample inventory." />
        <TextInput label="Eyebrow" value={value.portalSection.eyebrow} onChange={(eyebrow) => updatePortalSection({ eyebrow })} />
        <TextInput label="Title" value={value.portalSection.title} onChange={(title) => updatePortalSection({ title })} />
        <RichTextField
          label="Description"
          value={value.portalSection.description}
          onChange={(description) => updatePortalSection({ description })}
        />
        <StringListEditor
          label="Bullets"
          items={value.portalSection.bullets}
          onChange={(bullets) => updatePortalSection({ bullets })}
          addLabel="Add bullet"
        />
        <TextInput label="CTA label" value={value.portalSection.cta} onChange={(cta) => updatePortalSection({ cta })} />
        <TextInput
          label="Sample caption"
          value={value.portalSection.sampleCaption}
          onChange={(sampleCaption) => updatePortalSection({ sampleCaption })}
        />
        <div className="space-y-4">
          {value.portalSection.sampleItems.map((item, index) => (
            <ArrayItemShell
              key={index}
              title="Sample item"
              index={index}
              total={value.portalSection.sampleItems.length}
              onMoveUp={() => moveSampleItem(index, -1)}
              onMoveDown={() => moveSampleItem(index, 1)}
              onRemove={() =>
                updatePortalSection({
                  sampleItems: value.portalSection.sampleItems.filter((_, i) => i !== index),
                })
              }
            >
              <TextInput label="Piece" value={item.piece} onChange={(piece) => updateSampleItem(index, { piece })} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <TextInput label="Stage" value={item.stage} onChange={(stage) => updateSampleItem(index, { stage })} />
                <TextInput label="Room" value={item.room} onChange={(room) => updateSampleItem(index, { room })} />
                <TextInput label="Condition" value={item.condition} onChange={(condition) => updateSampleItem(index, { condition })} />
              </div>
            </ArrayItemShell>
          ))}
          <button
            type="button"
            onClick={() =>
              updatePortalSection({
                sampleItems: [
                  ...value.portalSection.sampleItems,
                  { piece: '', stage: '', room: '', condition: '' },
                ],
              })
            }
            className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-gold hover:text-charcoal"
          >
            <Plus size={14} />
            Add sample item
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeading title="Bottom CTA" />
        <TextInput label="Title" value={value.ctaSection.title} onChange={(title) => updateCtaSection({ title })} />
        <RichTextField
          label="Subtitle"
          value={value.ctaSection.subtitle}
          onChange={(subtitle) => updateCtaSection({ subtitle })}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextInput label="Primary CTA" value={value.ctaSection.primaryCta} onChange={(primaryCta) => updateCtaSection({ primaryCta })} />
          <TextInput label="Secondary CTA" value={value.ctaSection.secondaryCta} onChange={(secondaryCta) => updateCtaSection({ secondaryCta })} />
        </div>
      </div>
    </div>
  );
}
