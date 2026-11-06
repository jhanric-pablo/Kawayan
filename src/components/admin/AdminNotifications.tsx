import React, { useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import clsx from 'clsx';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '../ui/popover';
import { timeAgo } from '../../utils/adminJobs';

export interface AdminNote {
  key: string;
  Icon: React.ElementType;
  tone: 'amber' | 'red' | 'green' | 'muted';
  title: string;
  body: string;
  /** ISO time it happened. */
  at?: string;
  actionLabel: string;
  onAction: () => void;
}

const TONE = {
  amber: 'bg-(--amber-soft) text-(--amber)',
  red: 'bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-(--danger)',
  green: 'bg-(--green-soft) text-(--green-ink)',
  muted: 'bg-(--muted) text-(--fg)',
};

/** The admin bell: everything waiting on staff (permits, payments, tickets) plus new sign-ups. The red count is what needs action. */
const AdminNotifications: React.FC<{ notes: AdminNote[]; needsAction: number }> = ({ notes, needsAction }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={needsAction ? `Notifications, ${needsAction} need action` : 'Notifications'}
        className="relative grid h-9 w-9 place-items-center rounded-lg text-(--fg) transition-colors hover:bg-(--muted) data-popup-open:bg-(--muted)"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
        {needsAction > 0 && (
          <span className="mono absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#d93025] px-1 text-[11px] font-semibold leading-none text-white ring-2 ring-(--bg)" aria-hidden>
            {needsAction > 9 ? '9+' : needsAction}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(92vw,380px)] gap-0 overflow-hidden rounded-xl p-0">
        <div className="flex items-center justify-between gap-3 border-b border-(--border) px-3.5 py-2.5">
          <PopoverTitle className="font-sans text-[15px] font-semibold tracking-tight">Notifications</PopoverTitle>
          {needsAction > 0 && <span className="text-xs text-(--fg-muted)"><b className="mono text-(--danger)">{needsAction}</b> need action</span>}
        </div>
        {notes.length ? (
          <ul className="max-h-[min(60vh,420px)] overflow-y-auto">
            {notes.map((n) => (
              <li key={n.key} className="flex items-start gap-3 border-b border-(--border) px-3.5 py-3 last:border-b-0 hover:bg-(--muted)">
                <span className={clsx('grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg', TONE[n.tone])}>
                  <n.Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-ui font-medium text-(--fg)">{n.title}</p>
                  <p className="truncate text-xs text-(--fg-muted)">{n.body}</p>
                  <div className="mt-1 flex items-center gap-2">
                    {n.at && <span className="mono text-xs text-(--fg-muted)">{timeAgo(n.at)}</span>}
                    <button
                      type="button"
                      onClick={() => { setOpen(false); n.onAction(); }}
                      className="text-xs font-medium text-(--fg) underline underline-offset-2 hover:text-(--green-ink)"
                    >
                      {n.actionLabel}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid justify-items-center gap-2 px-6 py-10 text-center">
            <BellOff className="h-6 w-6 text-(--fg-muted)" strokeWidth={1.75} aria-hidden />
            <p className="text-sm font-semibold">All caught up</p>
            <p className="text-xs text-(--fg-muted)">New sign-ups, permits, payments and tickets show up here.</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default AdminNotifications;
