import * as React from 'react';
import { cn } from 'cn';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

export interface KwOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

interface Props {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly KwOption[];
  placeholder?: string;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  disabled?: boolean;
  /** 'sm' for dense toolbars and table rails. */
  size?: 'sm' | 'default';
  className?: string;
  /** Ref to the trigger button (e.g. a popover's initial focus). */
  triggerRef?: React.Ref<HTMLButtonElement>;
}

/**
 * The app's dropdown (shadcn Select on Base UI), used everywhere a native <select> used to be,
 * so no browser menu appears. Styled like `.input`; a check marks the chosen option.
 */
const KwSelect: React.FC<Props> = ({ value, onValueChange, options, placeholder, id, disabled, size = 'default', className, triggerRef, ...aria }) => (
  <Select
    value={value}
    onValueChange={(v) => v != null && onValueChange(String(v))}
    items={options.map((o) => ({ value: o.value, label: o.label }))}
    disabled={disabled}
  >
    <SelectTrigger
      ref={triggerRef}
      id={id}
      size={size}
      aria-label={aria['aria-label']}
      aria-labelledby={aria['aria-labelledby']}
      className={cn(
        'kw-select w-full justify-between border-(--border-strong) bg-(--card) text-(--fg) shadow-xs hover:border-(--fg-subtle) focus-visible:border-(--green) dark:bg-(--card)',
        size === 'default' ? 'h-10! px-3 text-sm' : 'h-8! px-2 text-[13px]',
        className,
      )}
    >
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent className="kw-select__menu min-w-(--anchor-width) p-1" alignItemWithTrigger={false}>
      {options.map((o) => (
        <SelectItem key={o.value} value={o.value} disabled={o.disabled} className="min-h-8 rounded-md px-2 text-sm">
          {o.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

export default KwSelect;
