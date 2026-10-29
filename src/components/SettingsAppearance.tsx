import React, { useState } from 'react';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Radio } from '@base-ui/react/radio';
import { Check } from 'lucide-react';

type ThemeId = 'rice-paper' | 'cool-slate' | 'terracotta' | 'dark-zinc';
type Palette = Exclude<ThemeId, 'dark-zinc'>;

/** Also read by the inline script in index.html, so the palette applies before first paint. */
const KEY = 'kawayan_theme';

interface Swatch {
  canvas: string;
  surface: string;
  border: string;
  ink: string;
  button: string;
  accent: string;
  today: string;
}

/** Each palette's own colours, for its preview card. The live tokens are in index.html. */
const THEMES: { id: ThemeId; name: string; note: string; c: Swatch }[] = [
  {
    id: 'rice-paper',
    name: 'Rice Paper & Forest',
    note: 'Warm green · natural',
    c: { canvas: '#EAE8E1', surface: '#F6F5F0', border: '#D9D5CB', ink: '#151D19', button: '#224739', accent: '#2B5748', today: 'rgba(43,87,72,0.12)' },
  },
  {
    id: 'cool-slate',
    name: 'Cool Slate & Cobalt',
    note: 'Executive blue · crisp',
    c: { canvas: '#E8ECF1', surface: '#F5F7FA', border: '#D3DAE3', ink: '#0F172A', button: '#0F172A', accent: '#225BD8', today: 'rgba(37,99,235,0.12)' },
  },
  {
    id: 'terracotta',
    name: 'Oatmeal & Terracotta',
    note: 'Warm bronze · earthy',
    c: { canvas: '#EEE9E0', surface: '#F8F5F0', border: '#DDD6CA', ink: '#1C1917', button: '#C2410C', accent: '#AF3A0B', today: 'rgba(194,65,12,0.12)' },
  },
  {
    id: 'dark-zinc',
    name: 'Deep Bamboo Dark',
    note: 'Dark mode',
    c: { canvas: '#0B0F0E', surface: '#121816', border: '#1F2925', ink: '#E8EDEA', button: '#10B981', accent: '#10B981', today: 'rgba(16,185,129,0.16)' },
  },
];

const readPalette = (): Palette => {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === 'cool-slate' || saved === 'terracotta' ? saved : 'rice-paper';
  } catch {
    return 'rice-paper';
  }
};

const applyPalette = (p: Palette) => {
  document.documentElement.setAttribute('data-theme', p);
  try {
    localStorage.setItem(KEY, p);
  } catch {
    /* private mode: applies for this visit only */
  }
};

/** A tiny app in the palette's colours: sidebar, header with its button, and a timeline. */
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
  /** Dark mode lives on the account (and syncs across devices); light palettes live on this device. */
  toggleDarkMode: () => void;
}

/** Settings → Appearance: pick one of four palettes from miniature previews. */
const SettingsAppearance: React.FC<Props> = ({ darkMode, toggleDarkMode }) => {
  const [palette, setPalette] = useState<Palette>(readPalette);

  const pick = (id: ThemeId) => {
    if (id === 'dark-zinc') {
      if (!darkMode) toggleDarkMode();
      return;
    }
    setPalette(id);
    applyPalette(id);
    if (darkMode) toggleDarkMode();
  };

  return (
    <div>
      <span className="st-label" id="st-theme-label">Theme</span>
      <RadioGroup
        value={darkMode ? 'dark-zinc' : palette}
        onValueChange={(v) => pick(v as ThemeId)}
        aria-labelledby="st-theme-label"
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
                <p className="truncate text-[13px] font-semibold text-(--fg)">{t.name}</p>
                <p className="truncate text-[11.5px] text-(--fg-muted)">{t.note}</p>
              </div>
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-(--border-strong) text-on-brand transition-colors group-data-checked:border-brand group-data-checked:bg-brand">
                <Check className="h-3 w-3 opacity-0 group-data-checked:opacity-100" strokeWidth={3} aria-hidden />
              </span>
            </div>
          </Radio.Root>
        ))}
      </RadioGroup>
      <p className="mt-2 text-xs text-(--fg-muted)">Light palettes are saved on this device. Dark mode follows your account.</p>
    </div>
  );
};

export default SettingsAppearance;
