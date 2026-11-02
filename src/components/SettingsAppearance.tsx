import React from 'react';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Radio } from '@base-ui/react/radio';
import { Check } from 'lucide-react';

type ThemeId = 'light' | 'dark';

interface Swatch {
  canvas: string;
  surface: string;
  border: string;
  ink: string;
  button: string;
  accent: string;
  today: string;
}

/** Each theme's own colours, for its preview card. The live tokens are in styles/theme.css. */
const THEMES: { id: ThemeId; name: string; note: string; c: Swatch }[] = [
  {
    id: 'light',
    name: 'Light',
    note: 'White and grey, a touch of green',
    c: { canvas: '#F4F4F5', surface: '#FFFFFF', border: '#E4E4E7', ink: '#0A0A0A', button: '#0B7A4E', accent: '#0B7A4E', today: 'rgba(11,122,78,0.08)' },
  },
  {
    id: 'dark',
    name: 'Dark',
    note: 'Near-black, mint accents',
    c: { canvas: '#09090B', surface: '#111113', border: '#27272A', ink: '#FAFAFA', button: '#34D399', accent: '#34D399', today: 'rgba(52,211,153,0.12)' },
  },
];

/** A tiny app in the theme's colours: sidebar, header with its button, and a timeline. */
const Preview: React.FC<{ c: Swatch }> = ({ c }) => (
  <div className="flex h-28 gap-1.5 rounded-xl p-1.5" style={{ background: c.canvas }} aria-hidden>
    <div className="flex w-[30%] flex-col gap-1 rounded-lg border p-1.5" style={{ background: c.surface, borderColor: c.border }}>
      <span className="mb-1 h-2 w-2 rounded-full" style={{ background: c.button }} />
      <span className="h-2 rounded" style={{ background: c.today }} />
      <span className="h-1.5 w-4/5 rounded-full" style={{ background: c.border }} />
      <span className="h-1.5 w-3/5 rounded-full" style={{ background: c.border }} />
      <span className="h-1.5 w-2/3 rounded-full" style={{ background: c.border }} />
    </div>
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex h-4 shrink-0 items-center justify-between rounded-md border px-1.5" style={{ background: c.surface, borderColor: c.border }}>
        <span className="h-1 w-8 rounded-full" style={{ background: c.ink, opacity: 0.25 }} />
        <span className="h-2 w-7 rounded-full" style={{ background: c.button }} />
      </div>
      <div className="relative flex flex-1 overflow-hidden rounded-md border" style={{ background: c.surface, borderColor: c.border }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="flex-1 border-l first:border-l-0" style={{ borderColor: c.border, background: i === 1 ? c.today : undefined }} />
        ))}
        <span className="absolute inset-y-0 left-[37%] w-0.5" style={{ background: c.accent }} />
        <span className="absolute left-[6%] top-2 h-2 w-[26%] rounded-full" style={{ background: c.accent }} />
        <span className="absolute left-[54%] top-5 h-2.5 w-[30%] rounded-full border border-dashed" style={{ borderColor: c.accent }} />
        <span className="absolute bottom-2 left-[6%] h-1 w-[38%] rounded-full" style={{ background: c.ink, opacity: 0.25 }} />
      </div>
    </div>
  </div>
);

interface Props {
  darkMode: boolean;
  /** Id of the visible label for the picker (the settings row title). */
  labelId: string;
  /** Dark mode lives on the account, so it syncs across devices. */
  toggleDarkMode: () => void;
}

/** Settings → Appearance: light or dark, from miniature previews. */
const SettingsAppearance: React.FC<Props> = ({ darkMode, toggleDarkMode, labelId }) => {
  return (
    <RadioGroup
      value={darkMode ? 'dark' : 'light'}
      onValueChange={(v) => (v === 'dark') !== darkMode && toggleDarkMode()}
      aria-labelledby={labelId}
      className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2"
    >
      {THEMES.map((t) => (
        <Radio.Root
          key={t.id}
          value={t.id}
          className="group rounded-xl border border-(--border) bg-(--card) p-2 text-left outline-hidden transition-[border-color,box-shadow] hover:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--ring) data-checked:border-(--green) data-checked:shadow-[0_0_0_1px_var(--green)]"
        >
          <Preview c={t.c} />
          <div className="flex items-center gap-2 px-1 pb-0.5 pt-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-ui font-medium text-(--fg)">{t.name}</p>
              <p className="truncate text-xs text-(--fg-muted)">{t.note}</p>
            </div>
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-(--border-strong) text-(--green-fg) transition-colors group-data-checked:border-(--green) group-data-checked:bg-(--green)">
              <Check className="h-3 w-3 opacity-0 group-data-checked:opacity-100" strokeWidth={3} aria-hidden />
            </span>
          </div>
        </Radio.Root>
      ))}
    </RadioGroup>
  );
};

export default SettingsAppearance;
