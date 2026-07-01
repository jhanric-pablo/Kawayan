export interface AccessibilitySettings {
  fontLevel: 0 | 1 | 2 | 3;
  highContrast: boolean;
  highlightLinks: boolean;
  readableFont: boolean;
  reduceMotion: boolean;
}

const STORAGE_KEY = 'kawayan_a11y';

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  fontLevel: 0,
  highContrast: false,
  highlightLinks: false,
  readableFont: false,
  reduceMotion: false,
};

const FONT_CLASSES = ['a11y-font-0', 'a11y-font-1', 'a11y-font-2', 'a11y-font-3'] as const;

export function loadAccessibilitySettings(): AccessibilitySettings {
  if (typeof window === 'undefined') return { ...DEFAULT_ACCESSIBILITY_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ACCESSIBILITY_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AccessibilitySettings>;
    return {
      fontLevel: [0, 1, 2, 3].includes(parsed.fontLevel as number)
        ? (parsed.fontLevel as AccessibilitySettings['fontLevel'])
        : 0,
      highContrast: !!parsed.highContrast,
      highlightLinks: !!parsed.highlightLinks,
      readableFont: !!parsed.readableFont,
      reduceMotion: !!parsed.reduceMotion,
    };
  } catch {
    return { ...DEFAULT_ACCESSIBILITY_SETTINGS };
  }
}

export function saveAccessibilitySettings(settings: AccessibilitySettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function applyAccessibilitySettings(settings: AccessibilitySettings): void {
  const root = document.documentElement;

  FONT_CLASSES.forEach((cls) => root.classList.remove(cls));
  root.classList.add(`a11y-font-${settings.fontLevel}`);

  root.classList.toggle('a11y-high-contrast', settings.highContrast);
  root.classList.toggle('a11y-highlight-links', settings.highlightLinks);
  root.classList.toggle('a11y-readable-font', settings.readableFont);
  root.classList.toggle('a11y-reduce-motion', settings.reduceMotion);
}

export function initAccessibility(): AccessibilitySettings {
  const settings = loadAccessibilitySettings();
  applyAccessibilitySettings(settings);
  return settings;
}

export function updateAccessibilitySettings(
  patch: Partial<AccessibilitySettings>
): AccessibilitySettings {
  const next = { ...loadAccessibilitySettings(), ...patch };
  saveAccessibilitySettings(next);
  applyAccessibilitySettings(next);
  return next;
}

export function resetAccessibilitySettings(): AccessibilitySettings {
  const next = { ...DEFAULT_ACCESSIBILITY_SETTINGS };
  saveAccessibilitySettings(next);
  applyAccessibilitySettings(next);
  return next;
}
