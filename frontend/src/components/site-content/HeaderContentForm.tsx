import type { HeaderContent } from '../../types/siteContent';
import { SectionHeading, TextInput } from './formHelpers';

type HeaderContentFormProps = {
  value: HeaderContent;
  onChange: (value: HeaderContent) => void;
};

export function HeaderContentForm({ value, onChange }: HeaderContentFormProps) {
  const update = (patch: Partial<HeaderContent>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Site header"
        description="Brand text shown in the navigation bar."
      />
      <TextInput
        label="Brand primary"
        value={value.brandPrimary}
        onChange={(brandPrimary) => update({ brandPrimary })}
        required
      />
      <TextInput
        label="Brand secondary"
        value={value.brandSecondary}
        onChange={(brandSecondary) => update({ brandSecondary })}
      />
    </div>
  );
}
