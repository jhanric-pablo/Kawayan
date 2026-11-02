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
    note: 'Rice paper & forest green',
    c: { canvas: '#EAE8E1', surface: '#F6F5F0', border: '#D9D5CB', ink: '#151D19', button: '#224739', accent: '#2B5748', today: 'rgba(43,87,72,0.12)' },
  },
  {
    id: 'dark',
    name: 'Dark',
    note: 'Deep bamboo',
    c: { canvas: '#0B0F0E', surface: '#121816', border: '#1F2925', ink: '#E8EDEA', button: '#10B981', accent: '#10B981', today: 'rgba(16,185,129,0.16)' },
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
          className="group rounded-2xl border border-(--border-strong) bg-(--card) p-2 text-left outline-hidden transition-[border-color,box-shadow] hover:border-(--fg-subtle) focus-visible:ring-2 focus-visible:ring-(--ring) data-checked:border-2 data-checked:border-brand data-checked:p-[7px] data-checked:ring-2 data-checked:ring-brand/20"
        >
          <Preview c={t.c} />
          <div className="flex items-center gap-2 px-1 pb-0.5 pt-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-ui font-semibold text-(--fg)">{t.name}</p>
              <p className="truncate text-xs text-(--fg-muted)">{t.note}</p>
            </div>
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-(--border-strong) text-on-brand transition-colors group-data-checked:border-brand group-data-checked:bg-brand">
              <Check className="h-3 w-3 opacity-0 group-data-checked:opacity-100" strokeWidth={3} aria-hidden />
            </span>
          </div>
        </Radio.Root>
      ))}
    </RadioGroup>
  );
};

export default SettingsAppearance;
