import React from 'react';
import clsx from 'clsx';

/** The id of the section Settings is showing; the others render nothing. */
export const SettingsActive = React.createContext<string | null>(null);

/**
 * A card of settings rows. Only the one picked in the Settings menu shows, and that menu item already
 * names it, so the card has no title of its own (screen readers still get the name and description).
 */
export const SettingsSection: React.FC<{ id: string; title: string; description: string; children: React.ReactNode }> = ({
  id,
  title,
  description,
  children,
}) => React.useContext(SettingsActive) === id && (
  <section id={id} aria-label={title} aria-description={description} className="scroll-mt-32">
    <div className="surface overflow-hidden">
      <div className="divide-y divide-(--border)">{children}</div>
    </div>
  </section>
);

/**
 * One setting: what it is on the left, the control on the right (stacked on phones).
 * `wide` gives the control the full row for big pickers.
 */
export const SettingRow: React.FC<{
  label: string;
  hint?: React.ReactNode;
  htmlFor?: string;
  labelId?: string;
  wide?: boolean;
  children: React.ReactNode;
}> = ({ label, hint, htmlFor, labelId, wide, children }) => {
  const Label = htmlFor ? 'label' : 'p';
  return (
    <div className={clsx('grid gap-3 p-4 sm:px-5', !wide && 'md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-8')}>
      <div className="min-w-0">
        <Label {...(htmlFor ? { htmlFor } : {})} id={labelId} className="block text-[15px] font-semibold tracking-tight text-(--fg)">{label}</Label>
        {hint && <div className="mt-1 text-ui leading-relaxed text-(--fg-muted)">{hint}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
};

/** A value that can't be edited here: plain text, not a greyed-out box (only typeable fields get borders). */
export const LockedValue: React.FC<{ id: string; value: string; badge?: React.ReactNode }> = ({ id, value, badge }) => (
  <div className="flex min-h-[38px] flex-wrap items-center gap-2">
    <span id={id} className="min-w-0 text-[15px] font-medium text-(--fg)">{value || '—'}</span>
    {badge}
  </div>
);
