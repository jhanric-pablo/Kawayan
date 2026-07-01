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

const FONT_LABELS = ['Default', 'Large', 'Larger', 'Largest'] as const;

const ToggleRow: React.FC<{
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: React.ReactNode;
}> = ({ id, label, description, checked, onChange, icon }) => (
  <label
    htmlFor={id}
    className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors hover:bg-[#2B5748]/5 dark:hover:bg-[#9CB080]/10"
  >
    <span
      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
      style={{ background: 'rgba(43,87,72,0.1)', color: 'var(--kw-green, #2B5748)' }}
      aria-hidden
    >
      {icon}
    </span>
    <span className="flex-1 min-w-0">
      <span className="block text-sm font-semibold" style={{ color: 'var(--fg)' }}>
        {label}
      </span>
      <span className="block text-xs mt-0.5 leading-snug" style={{ color: 'var(--fg-muted)' }}>
        {description}
      </span>
    </span>
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-2 w-4 h-4 accent-[#2B5748] shrink-0"
    />
  </label>
);

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
    <div className="a11y-widget-root fixed bottom-6 left-6 z-[60] flex flex-col items-start gap-3">
      {isOpen && (
        <div
          ref={panelRef}
          id="a11y-widget-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="a11y-widget-title"
          className="a11y-widget-panel w-[min(100vw-3rem,320px)] rounded-2xl border shadow-xl overflow-hidden"
          style={{
            background: 'var(--glass-bg-strong, #fff)',
            borderColor: 'var(--glass-border, rgba(43,87,72,0.2))',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2">
              <Accessibility className="w-5 h-5" style={{ color: 'var(--kw-green, #2B5748)' }} aria-hidden />
              <h2 id="a11y-widget-title" className="text-sm font-bold" style={{ color: 'var(--fg)' }}>
                Accessibility
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              aria-label="Close accessibility panel"
            >
              <X className="w-4 h-4" style={{ color: 'var(--fg-muted)' }} />
            </button>
          </div>

          <div className="p-3 space-y-1 max-h-[min(70vh,480px)] overflow-y-auto">
            <div className="px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--fg-muted)' }}>
                Text size
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => patch({ fontLevel: Math.max(0, fontLevel - 1) as AccessibilitySettings['fontLevel'] })}
                  disabled={fontLevel === 0}
                  className="btn btn-glass !p-2 !min-w-0 disabled:opacity-40"
                  aria-label="Decrease text size"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span
                  className="flex-1 text-center text-sm font-medium py-2 rounded-xl"
                  style={{ background: 'rgba(43,87,72,0.08)', color: 'var(--fg)' }}
                  aria-live="polite"
                >
                  {FONT_LABELS[fontLevel]}
                </span>
                <button
                  type="button"
                  onClick={() => patch({ fontLevel: Math.min(3, fontLevel + 1) as AccessibilitySettings['fontLevel'] })}
                  disabled={fontLevel === 3}
                  className="btn btn-glass !p-2 !min-w-0 disabled:opacity-40"
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

          <div className="px-3 pb-3 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium py-2.5 rounded-xl transition-colors hover:bg-[#2B5748]/8"
              style={{ color: 'var(--kw-green, #2B5748)' }}
            >
              <RotateCcw className="w-4 h-4" aria-hidden />
              Reset accessibility settings
            </button>
            <p className="text-[10px] text-center mt-2 px-2 leading-snug" style={{ color: 'var(--fg-subtle)' }}>
              Settings are saved in your browser for this device.
            </p>
          </div>
        </div>
      )}

      <button
        ref={toggleRef}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="a11y-widget-toggle w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{
          background: 'var(--kw-green, #2B5748)',
          color: '#fff',
          boxShadow: '0 8px 24px rgba(43,87,72,0.35)',
        }}
        aria-expanded={isOpen}
        aria-controls="a11y-widget-panel"
        aria-label={isOpen ? 'Close accessibility options' : 'Open accessibility options'}
        title="Accessibility options"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Accessibility className="w-6 h-6" />}
      </button>
    </div>
  );
};

export default AccessibilityWidget;
