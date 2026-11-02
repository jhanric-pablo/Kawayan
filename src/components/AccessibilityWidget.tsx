import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Accessibility,
  Contrast,
  Link2,
  BookOpen,
  PauseCircle,
  RotateCcw,
  X,
  Minus,
  Plus,
} from 'lucide-react';
import {
  AccessibilitySettings,
  initAccessibility,
  resetAccessibilitySettings,
  updateAccessibilitySettings,
} from '../utils/accessibility';
import { Switch } from './ui/switch';

const FONT_LABELS = ['Default', 'Large', 'Larger', 'Largest'] as const;

const ToggleRow: React.FC<{
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: React.ReactNode;
}> = ({ id, label, description, checked, onChange, icon }) => (
  // The whole row toggles; the switch itself carries the name and description for screen readers.
  <div
    onClick={(e) => { if (!(e.target as HTMLElement).closest('[role="switch"]')) onChange(!checked); }}
    className="flex min-h-11 items-center gap-3 rounded-lg p-2.5 cursor-pointer transition-colors hover:bg-(--muted)"
  >
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-(--border) bg-(--card) text-(--fg)" aria-hidden>
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span id={`${id}-label`} className="block text-sm font-medium text-(--fg)">{label}</span>
      <span id={`${id}-desc`} className="mt-0.5 block text-xs leading-snug text-(--fg-muted)">{description}</span>
    </span>
    <Switch id={id} checked={checked} onCheckedChange={onChange} aria-labelledby={`${id}-label`} aria-describedby={`${id}-desc`} />
  </div>
);

/** Text size, contrast, link, font and motion options. Lives in Settings → Appearance. */
export const AccessibilityOptions: React.FC = () => {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => initAccessibility());
  const patch = useCallback((next: Partial<AccessibilitySettings>) => {
    setSettings(updateAccessibilitySettings(next));
  }, []);
  const fontLevel = settings.fontLevel;

  return (
    <div className="space-y-1">
      <div className="px-3 py-2">
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--fg)' }}>Text size</p>
        <div className="flex items-center gap-2 max-w-xs">
          <button
            type="button"
            onClick={() => patch({ fontLevel: Math.max(0, fontLevel - 1) as AccessibilitySettings['fontLevel'] })}
            disabled={fontLevel === 0}
            className="btn btn-outline btn-sm px-2.5! disabled:opacity-40"
            aria-label="Decrease text size"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span
            className="flex-1 text-center text-sm font-medium py-1.5 rounded-(--radius)"
            style={{ background: 'var(--muted)', color: 'var(--fg)' }}
            aria-live="polite"
          >
            {FONT_LABELS[fontLevel]}
          </span>
          <button
            type="button"
            onClick={() => patch({ fontLevel: Math.min(3, fontLevel + 1) as AccessibilitySettings['fontLevel'] })}
            disabled={fontLevel === 3}
            className="btn btn-outline btn-sm px-2.5! disabled:opacity-40"
            aria-label="Increase text size"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
      <ToggleRow id="a11y-high-contrast" label="High contrast" description="Stronger text and border contrast for easier reading." checked={settings.highContrast} onChange={(highContrast) => patch({ highContrast })} icon={<Contrast className="w-4 h-4" />} />
      <ToggleRow id="a11y-highlight-links" label="Highlight links" description="Underline all links across the site." checked={settings.highlightLinks} onChange={(highlightLinks) => patch({ highlightLinks })} icon={<Link2 className="w-4 h-4" />} />
      <ToggleRow id="a11y-readable-font" label="Readable font" description="Use a simple system font for body text." checked={settings.readableFont} onChange={(readableFont) => patch({ readableFont })} icon={<BookOpen className="w-4 h-4" />} />
      <ToggleRow id="a11y-reduce-motion" label="Reduce motion" description="Minimize animations and transitions." checked={settings.reduceMotion} onChange={(reduceMotion) => patch({ reduceMotion })} icon={<PauseCircle className="w-4 h-4" />} />
      <div className="px-3 pt-2">
        <button
          type="button"
          onClick={() => setSettings(resetAccessibilitySettings())}
          className="inline-flex items-center gap-2 text-sm font-medium"
          style={{ color: 'var(--fg)' }}
        >
          <RotateCcw className="w-4 h-4" aria-hidden /> Reset to defaults
        </button>
        <p className="text-xs mt-1" style={{ color: 'var(--fg-subtle)' }}>Saved in this browser.</p>
      </div>
    </div>
  );
};

/** Floating button on public pages (signed-in users get the options in Settings). */
const AccessibilityWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<AccessibilitySettings>(() => initAccessibility());
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const patch = useCallback((next: Partial<AccessibilitySettings>) => {
    setSettings(updateAccessibilitySettings(next));
  }, []);

  const handleReset = useCallback(() => {
    setSettings(resetAccessibilitySettings());
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        toggleRef.current?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const fontLevel = settings.fontLevel;

  return (
    <div className="a11y-widget-root fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-60 flex flex-col items-start gap-3">
      {isOpen && (
        <div
          ref={panelRef}
          id="a11y-widget-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="a11y-widget-title"
          className="a11y-widget-panel w-[min(100vw-2rem,320px)] rounded-xl border overflow-hidden animate-scale-in motion-reduce:animate-none"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2">
              <Accessibility className="w-4 h-4" style={{ color: 'var(--green-ink)' }} aria-hidden />
              <h2 id="a11y-widget-title" className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--fg)' }}>
                Accessibility
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-lg hover:bg-(--muted) transition-colors"
              aria-label="Close accessibility panel"
            >
              <X className="w-4 h-4" style={{ color: 'var(--fg-muted)' }} />
            </button>
          </div>

          <div className="p-3 space-y-1 max-h-[min(70vh,480px)] overflow-y-auto">
            <div className="px-3 py-2">
              <p className="eyebrow mb-2" style={{ color: 'var(--fg-muted)' }}>
                Text size
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => patch({ fontLevel: Math.max(0, fontLevel - 1) as AccessibilitySettings['fontLevel'] })}
                  disabled={fontLevel === 0}
                  className="btn btn-outline w-9 px-0! disabled:opacity-40"
                  aria-label="Decrease text size"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span
                  className="flex-1 text-center text-sm font-medium py-2 rounded-lg"
                  style={{ background: 'var(--muted)', color: 'var(--fg)' }}
                  aria-live="polite"
                >
                  {FONT_LABELS[fontLevel]}
                </span>
                <button
                  type="button"
                  onClick={() => patch({ fontLevel: Math.min(3, fontLevel + 1) as AccessibilitySettings['fontLevel'] })}
                  disabled={fontLevel === 3}
                  className="btn btn-outline w-9 px-0! disabled:opacity-40"
                  aria-label="Increase text size"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <ToggleRow
              id="a11y-high-contrast"
              label="High contrast"
              description="Stronger text and border contrast for easier reading."
              checked={settings.highContrast}
              onChange={(highContrast) => patch({ highContrast })}
              icon={<Contrast className="w-4 h-4" />}
            />
            <ToggleRow
              id="a11y-highlight-links"
              label="Highlight links"
              description="Underline all links across the site."
              checked={settings.highlightLinks}
              onChange={(highlightLinks) => patch({ highlightLinks })}
              icon={<Link2 className="w-4 h-4" />}
            />
            <ToggleRow
              id="a11y-readable-font"
              label="Readable font"
              description="Use a simple system font for body text."
              checked={settings.readableFont}
              onChange={(readableFont) => patch({ readableFont })}
              icon={<BookOpen className="w-4 h-4" />}
            />
            <ToggleRow
              id="a11y-reduce-motion"
              label="Reduce motion"
              description="Minimize animations and transitions."
              checked={settings.reduceMotion}
              onChange={(reduceMotion) => patch({ reduceMotion })}
              icon={<PauseCircle className="w-4 h-4" />}
            />
          </div>

          <div className="px-3 pb-3 pt-2 border-t" style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
            <button
              type="button"
              onClick={handleReset}
              className="btn btn-outline w-full"

            >
              <RotateCcw className="w-4 h-4" aria-hidden />
              Reset accessibility settings
            </button>
            <p className="text-xs text-center mt-2 px-2 leading-snug" style={{ color: 'var(--fg-muted)' }}>
              Settings are saved in your browser for this device.
            </p>
          </div>
        </div>
      )}

      <button
        ref={toggleRef}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="a11y-widget-toggle w-11 h-11 sm:w-12 sm:h-12 rounded-full border flex items-center justify-center transition-transform active:scale-95"
        style={{
          background: 'var(--card)',
          color: 'var(--fg)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--shadow-md)',
        }}
        aria-expanded={isOpen}
        aria-controls="a11y-widget-panel"
        aria-label={isOpen ? 'Close accessibility options' : 'Open accessibility options'}
        title="Accessibility options"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Accessibility className="w-5 h-5" />}
      </button>
    </div>
  );
};

export default AccessibilityWidget;
