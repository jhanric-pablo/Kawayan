import React from 'react';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Radio } from '@base-ui/react/radio';
import { Image as ImageIcon, Type, Video } from 'lucide-react';
import { ContentIdea } from '../../types';

export type PostFormat = ContentIdea['format'];

const FORMATS: { key: PostFormat; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'Image', Icon: ImageIcon },
  { key: 'Video', Icon: Video },
  { key: 'Text', Icon: Type },
];

interface Props {
  value: PostFormat;
  onChange: (format: PostFormat) => void;
  disabled?: boolean;
}

/** The post format as pill buttons: a Base UI radio group (arrow keys move the choice, one tab stop). */
const FormatPicker: React.FC<Props> = ({ value, onChange, disabled }) => (
  <RadioGroup
    value={value}
    onValueChange={(v) => onChange(v as PostFormat)}
    disabled={disabled}
    aria-label="Post format"
    className="inline-flex flex-wrap gap-1.5"
  >
    {FORMATS.map(({ key, Icon }) => (
      <Radio.Root
        key={key}
        value={key}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-alt)] px-3 py-1.5 text-xs font-semibold text-[var(--fg-muted)] outline-none transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] data-[checked]:border-brand/60 data-[checked]:bg-brand/10 data-[checked]:text-[var(--primary)] data-[disabled]:opacity-50"
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {key}
      </Radio.Root>
    ))}
  </RadioGroup>
);

export default FormatPicker;
