import React, { useId, useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import clsx from 'clsx';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { INDUSTRY_OPTIONS, NICHE_MAX, isLegacyIndustry, joinIndustry, splitIndustry } from '../../constants/industries';

interface Props {
  id?: string;
  /** The stored industry ("Food & Beverage", "Other: Pet grooming", or an older free-text value). */
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

/**
 * Industry / Niche: a searchable combobox (shadcn Popover + Command) over the fixed industry
 * list. Picking "Other" shows "What's your niche?" underneath; the typed niche is saved with this
 * profile only (as "Other: <niche>") and never added to the list.
 */
const IndustryPicker: React.FC<Props> = ({ id, value, onChange, autoFocus }) => {
  const [open, setOpen] = useState(false);
  const nicheId = useId();
  const { choice, niche } = splitIndustry(value);
  const legacy = isLegacyIndustry(value);
  const options = [...(legacy ? [value] : []), ...INDUSTRY_OPTIONS];

  const pick = (next: string) => {
    onChange(next === 'Other' ? joinIndustry('Other', niche) : next);
    setOpen(false);
  };

  return (
    <div className="grid gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          role="combobox"
          aria-expanded={open}
          autoFocus={autoFocus}
          className="kw-select flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-(--border-strong) bg-(--card) px-3 text-left text-sm text-(--fg) shadow-xs outline-none hover:border-(--fg-subtle) focus-visible:border-(--green) focus-visible:ring-3 focus-visible:ring-(--ring)"
        >
          <span className={clsx('truncate', !choice && 'text-(--fg-muted)')}>{choice || 'Select an industry…'}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-(--fg-muted)" aria-hidden />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--anchor-width) min-w-60 p-0">
          <Command>
            <CommandInput placeholder="Search industries…" />
            <CommandList>
              <CommandEmpty>No industry matches.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem key={o} value={o} onSelect={() => pick(o)} data-checked={o === choice}>
                    {o}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {choice === 'Other' && (
        <div className="grid gap-1">
          <label htmlFor={nicheId} className="text-xs font-medium text-(--fg-muted)">What’s your niche?</label>
          <input
            id={nicheId}
            className="input"
            maxLength={NICHE_MAX}
            placeholder="e.g. Pet grooming, Plant shop"
            value={niche}
            onChange={(e) => onChange(joinIndustry('Other', e.target.value))}
          />
          <span className="text-xs text-(--fg-muted)">Only for your account. {niche.length}/{NICHE_MAX}</span>
        </div>
      )}
    </div>
  );
};

export default IndustryPicker;
