import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronsUpDown, LogOut } from 'lucide-react';
import type { ThemePref } from '../utils/sessionView';
import { User } from '../types';
import { paymentService } from '../services/paymentService';
import './appShell.css';

interface Props {
  user: User;
  onSignOut: () => void;
  /** The plan when the caller already knows it; otherwise it's fetched on open. */
  plan?: string | null;
  /** 'sidebar': full-width row at the foot of the sidebar, menu opens upward. */
  placement?: 'header' | 'sidebar';
  /** Appearance: Light / Dark / System. */
  themePref?: ThemePref;
  onChooseTheme?: (pref: ThemePref) => void;
}

/**
 * Avatar + name button → who you're signed in as (name, email, plan), Appearance, and Log out.
 * Settings, Channels, Plan and billing and Help desk live in the sidebar, so they aren't repeated here.
 */
const AccountMenu: React.FC<Props> = ({ user, onSignOut, plan: knownPlan, placement = 'header', themePref, onChooseTheme }) => {
  const inSidebar = placement === 'sidebar';
  const [open, setOpen] = useState(false);
  const [fetchedPlan, setPlan] = useState<string | null>(null);
  const plan = knownPlan ?? fetchedPlan;
  const roleLabel =
    user.role === 'admin' ? 'Administrator' : user.role === 'support' ? 'Support' : plan ? (plan === 'FREE' ? 'Free plan' : 'Pro plan') : 'Business';
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const name = user.businessName || user.email;

  useEffect(() => {
    if (!open) return;
    if (user.role === 'user' && plan === null) {
      paymentService.getWalletData().then((w) => setPlan(w.subscription)).catch(() => undefined);
    }
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: MouseEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const run = (fn?: () => void) => () => {
    setOpen(false);
    fn?.();
  };

  const moveFocus = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items: HTMLElement[] = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <div className={inSidebar ? 'am am--side' : 'am'} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="am__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="am__avatar" aria-hidden>{name[0]?.toUpperCase()}</span>
        <span className={inSidebar ? 'am__text min-w-0 flex-1 text-left leading-tight' : 'hidden min-w-0 text-left leading-tight sm:block'} aria-hidden>
          <b className="block max-w-[150px] truncate text-sm font-semibold text-(--fg)">{name}</b>
          <span className="block truncate text-xs text-(--fg-muted)">{inSidebar && user.businessName ? user.email : roleLabel}</span>
        </span>
        {inSidebar ? <ChevronsUpDown className="am__chev" aria-hidden /> : <ChevronDown className="am__chev" aria-hidden />}
      </button>

      {open && (
        <div className="am__menu" role="menu" aria-label="Account" onKeyDown={moveFocus}>
          <div className="am__who">
            <span className="am__avatar" aria-hidden>{name[0]?.toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <b>{name}</b>
              {user.businessName && <span>{user.email}</span>}
            </span>
            {user.role === 'user' && plan && <span className={plan === 'FREE' ? 'badge badge-sage' : 'badge badge-green'}>{plan === 'FREE' ? 'Free' : plan === 'ENTERPRISE' ? 'Enterprise' : 'Pro'}</span>}
          </div>
          {onChooseTheme && (
            <div className="am__seg">
              <p className="am__seg-label" id="am-theme-label">Appearance</p>
              <div className="kw-seg w-full" role="radiogroup" aria-labelledby="am-theme-label">
                {(['light', 'dark', 'system'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={themePref === t}
                    aria-pressed={themePref === t}
                    className="flex-1"
                    onClick={() => onChooseTheme(t)}
                  >
                    {t === 'light' ? 'Light' : t === 'dark' ? 'Dark' : 'System'}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button type="button" role="menuitem" className="am__item am__item--out" onClick={run(onSignOut)}>
            <LogOut aria-hidden /> Log out
          </button>
        </div>
      )}
    </div>
  );
};

export default AccountMenu;
