import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, ChevronDown, ChevronsUpDown, CreditCard, LifeBuoy, LogOut, Map as MapIcon, Settings as SettingsIcon } from 'lucide-react';
import type { ThemePref } from '../utils/sessionView';
import { User } from '../types';
import { paymentService } from '../services/paymentService';
import { HELP_EVENT } from '../utils/usePhone';
import './appShell.css';

interface Props {
  user: User;
  onSignOut: () => void;
  /** Sign out and go straight to the sign-in screen. */
  onSwitchAccount?: () => void;
  onSettings?: () => void;
  onBilling?: () => void;
  /** Phones have no sidebar help button, so help lives here. */
  showHelp?: boolean;
  /** The plan when the caller already knows it; otherwise it's fetched on open. */
  plan?: string | null;
  /** 'sidebar': full-width row at the foot of the sidebar, menu opens upward. */
  placement?: 'header' | 'sidebar';
  /** Opens the Help desk (owner accounts). */
  onHelpDesk?: () => void;
  /** Replays the product walkthrough. */
  onTour?: () => void;
  /** Appearance: Light / Dark / System. */
  themePref?: ThemePref;
  onChooseTheme?: (pref: ThemePref) => void;
}

/** Avatar + name button → who you're signed in as, your plan, Switch account, Settings, Help and Sign out. */
const AccountMenu: React.FC<Props> = ({ user, onSignOut, onSwitchAccount, onSettings, onBilling, showHelp, plan: knownPlan, placement = 'header', onHelpDesk, onTour, themePref, onChooseTheme }) => {
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
            <span className="flex items-center justify-between gap-2">
              <b>{name}</b>
              {user.role === 'user' && plan && <span className={plan === 'FREE' ? 'badge badge-sage' : 'badge badge-green'}>{plan === 'FREE' ? 'Free' : 'Pro'}</span>}
            </span>
            {user.businessName && <span>{user.email}</span>}
            {user.role === 'user' && plan === 'FREE' && onBilling && (
              <span className="am__plan">
                Free plan
                <button type="button" onClick={run(onBilling)}>Upgrade</button>
              </span>
            )}
          </div>
          {onSwitchAccount && (
            <button type="button" role="menuitem" className="am__item" onClick={run(onSwitchAccount)}>
              <ArrowLeftRight aria-hidden /> Switch account
            </button>
          )}
          {onSettings && (
            <button type="button" role="menuitem" className="am__item" onClick={run(onSettings)}>
              <SettingsIcon aria-hidden /> Settings
            </button>
          )}
          {onBilling && (
            <button type="button" role="menuitem" className="am__item" onClick={run(onBilling)}>
              <CreditCard aria-hidden /> Plan and billing
            </button>
          )}
          {(onHelpDesk || showHelp) && (
            <button type="button" role="menuitem" className="am__item" onClick={run(onHelpDesk ?? (() => window.dispatchEvent(new Event(HELP_EVENT))))}>
              <LifeBuoy aria-hidden /> Help desk
            </button>
          )}
          {onTour && (
            <button type="button" role="menuitem" className="am__item" onClick={run(onTour)}>
              <MapIcon aria-hidden /> Take the tour
            </button>
          )}
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
