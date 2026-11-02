import React from 'react';
import clsx from 'clsx';

/** A titled card of settings rows. `id` is the scroll target for the section index. */
export const SettingsSection: React.FC<{ id: string; title: string; description: string; children: React.ReactNode }> = ({
  id,
  title,
  description,
  children,
}) => (
  <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-32">
    <div className="surface overflow-hidden">
      <header className="border-b border-(--border) px-5 py-4 sm:px-6">
        <h2 id={`${id}-title`} className="text-lg font-bold text-(--fg)">{title}</h2>
        <p className="mt-0.5 text-sm text-(--fg-muted)">{description}</p>
      </header>
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
    <div className={clsx('grid gap-3 px-5 py-5 sm:px-6', !wide && 'md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-8')}>
      <div className="min-w-0">
        <Label {...(htmlFor ? { htmlFor } : {})} id={labelId} className="block text-sm font-semibold text-(--fg)">{label}</Label>
        {hint && <div className="mt-1 text-ui leading-relaxed text-(--fg-muted)">{hint}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
};

/** A read-only value with a short reason it can't be edited here. */
export const LockedValue: React.FC<{ id: string; value: string; badge?: React.ReactNode }> = ({ id, value, badge }) => (
  <div className="flex items-center gap-2 rounded-(--radius-md) border border-(--border) bg-(--bg-alt) px-3.5 py-2.5">
    <span id={id} className="min-w-0 flex-1 truncate text-sm text-(--fg)">{value || '—'}</span>
    {badge}
  </div>
);
