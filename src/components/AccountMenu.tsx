import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, ChevronDown, CreditCard, LifeBuoy, LogOut, Settings as SettingsIcon } from 'lucide-react';
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
}

/** Avatar + name button → who you're signed in as, your plan, Switch account, Settings, Help and Sign out. */
const AccountMenu: React.FC<Props> = ({ user, onSignOut, onSwitchAccount, onSettings, onBilling, showHelp, plan: knownPlan }) => {
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
    <div className="am" ref={rootRef}>
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
        <span className="hidden min-w-0 text-left leading-tight sm:block" aria-hidden>
          <b className="block max-w-[150px] truncate text-[12.5px] font-semibold text-(--fg)">{name}</b>
          <span className="block text-[10.5px] text-(--fg-muted)">{roleLabel}</span>
        </span>
        <ChevronDown className="am__chev" aria-hidden />
      </button>

      {open && (
        <div className="am__menu" role="menu" aria-label="Account" onKeyDown={moveFocus}>
          <div className="am__who">
            <b>{name}</b>
            {user.businessName && <span>{user.email}</span>}
            {user.role === 'user' && plan && (
              <span className="am__plan">
                {plan === 'FREE' ? 'Free plan' : 'Pro plan'}
                {plan === 'FREE' && onBilling && (
                  <button type="button" onClick={run(onBilling)}>Upgrade</button>
                )}
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
              <CreditCard aria-hidden /> Billing
            </button>
          )}
          {showHelp && (
            <button type="button" role="menuitem" className="am__item" onClick={run(() => window.dispatchEvent(new Event(HELP_EVENT)))}>
              <LifeBuoy aria-hidden /> Help and support
            </button>
          )}
          <button type="button" role="menuitem" className="am__item am__item--out" onClick={run(onSignOut)}>
            <LogOut aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
};

export default AccountMenu;
