import React, { useEffect, useState } from 'react';
import { Check, Download, Loader2, Plus, Wallet as WalletIcon } from 'lucide-react';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { readCachedUser } from '../utils/authSession';
import { countPostsInMonth } from '../utils/tierLimits';
import { paymentService, Wallet, Transaction } from '../services/paymentService';
import { useOrganicDialog } from './OrganicDialog';
import { useToast } from './ui/Toast';
import { ADDON_POST_PRICE_PHP, PRO_POST_LIMIT, PRO_PRICE_PHP, TRIAL_POST_LIMIT } from '../utils/tierLimits';
import PageSkeleton from './PageSkeleton';

const QUICK_AMOUNTS = [100, 500, 1000];
const TOPUP_MIN = 100;
const TOPUP_MAX = 50000;

const peso = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// "Wallet top-up via PayMongo (cs_abc)" -> title + provider reference.
function describe(txn: Transaction) {
  const ref = /\(((?:cs|invoice)_[^)]+)\)\s*$/.exec(txn.description)?.[1];
  if (/^Xendit Invoice:/.test(txn.description)) return { title: 'Wallet top-up', ref: txn.description.replace('Xendit Invoice: ', '') };
  const title = txn.description.replace(/\s*via PayMongo/, '').replace(/\s*\([^)]*\)\s*$/, '');
  return { title, ref };
}

const STATUS_LABEL: Record<Transaction['status'], { text: string; color: string } | null> = {
  COMPLETED: null,
  PENDING: { text: 'Pending', color: 'var(--warning)' },
  FAILED: { text: 'Failed', color: 'var(--danger)' },
  CANCELLED: { text: 'Cancelled', color: 'var(--fg-subtle)' },
};

interface Props {
  /** "Buy 1 extra post": opens the Post studio's new-post flow, where the extra post is paid when it's written. */
  onBuyExtra?: () => void;
  /** Enterprise "Talk to us": opens the Help desk. */
  onTalkToUs?: () => void;
}

const Billing: React.FC<Props> = ({ onBuyExtra, onTalkToUs }) => {
  const dialog = useOrganicDialog();
  const toast = useToast();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [amount, setAmount] = useState('500');
  const [busy, setBusy] = useState<'topup' | 'plan' | 'cancel' | null>(null);
  // This month's posts, for the usage bar (same count as the sidebar quota).
  const [postsUsed, setPostsUsed] = useState<number | null>(null);
  useEffect(() => {
    const userId = readCachedUser()?.id;
    if (!userId) return;
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    new UniversalDatabaseService().getUserPosts(userId, key).then((p) => setPostsUsed(countPostsInMonth(p, now))).catch(() => undefined);
  }, []);

  const refresh = async (returnedFrom?: 'success' | 'cancelled') => {
    let result: Awaited<ReturnType<typeof paymentService.verifyTopUp>> | null = null;
    try {
      result = await paymentService.verifyTopUp();
    } catch {
      // payments not configured: still show the wallet
    }
    setWallet(await paymentService.getWalletData());
    setCheckoutUrl(result?.status === 'PENDING' ? result.checkoutUrl || null : null);

    if (returnedFrom === 'success') {
      if (result?.status === 'COMPLETED') {
        toast.success(result.plan ? `You're on Pro. ${PRO_POST_LIMIT} posts a month starts now.` : `${peso(result.amount || 0)} added to your wallet`);
      }
      else if (result?.status === 'PENDING') toast.info("We haven't received confirmation from PayMongo yet. Check back in a minute.");
    }
    if (returnedFrom === 'cancelled') toast.info('Payment cancelled. You were not charged.');
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnedFrom = params.get('success') === 'true' ? 'success' : params.get('cancelled') === 'true' ? 'cancelled' : undefined;
    if (returnedFrom) window.history.replaceState({}, '', window.location.pathname);
    refresh(returnedFrom).catch(() => toast.error('Could not load your billing details.'));
  }, []);

  const startTopUp = async (value: number) => {
    setBusy('topup');
    try {
      await paymentService.startTopUp(value); // navigates away to PayMongo
    } catch (e: any) {
      toast.error(e.message);
      setBusy(null);
    }
  };

  const amountValue = Number(amount);
  const amountValid = Number.isInteger(amountValue) && amountValue >= TOPUP_MIN && amountValue <= TOPUP_MAX;

  // One click: straight to a PayMongo checkout for Pro. The wallet is only for extra posts.
  const handleUpgrade = async () => {
    setBusy('plan');
    try {
      await paymentService.startPlanCheckout('PRO'); // navigates away to PayMongo
    } catch (e: any) {
      toast.error(e.message);
      setBusy(null);
    }
  };

  const handleDowngrade = async () => {
    const ok = await dialog.confirm({
      title: 'Switch to Free',
      message: `You'll go back to ${TRIAL_POST_LIMIT} posts a month. This month's Pro payment isn't refunded.`,
      confirmLabel: 'Switch to Free',
    });
    if (!ok) return;
    setBusy('plan');
    try {
      await paymentService.cancelSubscription();
      await refresh();
      toast.success("You're on the Free plan");
    } finally {
      setBusy(null);
    }
  };

  const handleCancelPending = async (txn: Transaction) => {
    if (!(await dialog.confirm(`Cancel the ${peso(txn.amount)} payment? You won't be charged.`))) return;
    setBusy('cancel');
    try {
      setWallet(await paymentService.cancelTransaction(txn.id));
      setCheckoutUrl(null);
    } catch (e: any) {
      toast.error(e.message);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = () => {
    if (!wallet) return;
    const rows = wallet.transactions.map(
      (t) => `${new Date(t.date).toLocaleDateString()},${t.id},"${t.description}",${t.status},${t.type === 'CREDIT' ? '' : '-'}${t.amount}`
    );
    const blob = new Blob([`Date,ID,Description,Status,Amount (PHP)\n${rows.join('\n')}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kawayan-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!wallet) {
    return (
      <div className="grid gap-5" role="status" aria-label="Loading">
        <div className="kw-skel h-7 w-48 rounded-md" />
        <div className="grid gap-5 md:grid-cols-2"><div className="kw-skel h-64 rounded-xl" /><div className="kw-skel h-64 rounded-xl" /></div>
        <div className="kw-skel h-56 rounded-xl" />
      </div>
    );
  }

  const isPro = wallet.subscription === 'PRO' || wallet.subscription === 'ENTERPRISE';
  const pending = wallet.transactions.find((t) => t.status === 'PENDING');
  const labelStyle = { color: 'var(--fg-muted)' };

  const monthName = new Date().toLocaleDateString('en-PH', { month: 'long' });
  const limit = isPro ? PRO_POST_LIMIT : TRIAL_POST_LIMIT;
  const resets = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  const method = (t: Transaction) => {
    const { ref } = describe(t);
    if (ref?.startsWith('cs_')) return 'PayMongo';
    if (ref?.startsWith('invoice_') || /^Xendit/.test(t.description)) return 'Xendit';
    return t.type === 'DEBIT' ? 'Wallet' : '—';
  };
  const statusBadge = (t: Transaction) =>
    t.status === 'COMPLETED' ? <span className="badge badge-green"><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />Paid</span>
    : t.status === 'PENDING' ? <span className="badge badge-amber"><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />Pending</span>
    : t.status === 'FAILED' ? <span className="badge badge-red"><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />Failed</span>
    : <span className="badge badge-sage">Cancelled</span>;
  const copyRef = async (ref: string) => {
    try {
      await navigator.clipboard.writeText(ref);
      toast.success('Payment reference copied');
    } catch {
      toast.error(`Reference: ${ref}`);
    }
  };
  const PLANS = [
    { id: 'FREE', name: 'Free Trial', price: '₱0', items: [`${TRIAL_POST_LIMIT} posts a month`, 'Captions and images', 'Content calendar'] },
    { id: 'PRO', name: 'Pro', price: `₱${PRO_PRICE_PHP}`, items: [`${PRO_POST_LIMIT} posts a month`, 'Insights and comparison', `Extra posts ₱${ADDON_POST_PRICE_PHP} each`] },
    { id: 'ENTERPRISE', name: 'Enterprise', price: 'Custom', items: ['For chains and franchises', 'Talk to us about volume'] },
  ] as const;

  return (
    <div className="max-w-5xl space-y-5 animate-fade-in">
      <div className="kw-page-h">
        <div>
          <h1>Plan and billing</h1>
          <p>Your plan, wallet balance and payment history.</p>
        </div>
      </div>

      {wallet.paymentsTestMode && (
        <p className="text-ui -mt-2" style={{ color: 'var(--fg-muted)' }}>
          <span className="inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle" style={{ background: 'var(--warning)' }} />
          Test mode: payments use PayMongo's sandbox, so no real money is charged. Pay with card 4343 4343 4343 4345 (any future
          expiry, any CVC), or pick GCash or Maya and click Authorize on PayMongo's test page.
        </p>
      )}

      {pending && (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-(--radius-lg) px-4 py-3"
          style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)' }}
          role="status"
        >
          <p className="flex-1 min-w-56 text-sm" style={{ color: 'var(--fg)' }}>
            {pending.type === 'DEBIT' && /^Pro plan/.test(pending.description)
              ? `Your ${peso(pending.amount)} Pro payment is waiting.`
              : `A ${peso(pending.amount)} top-up is waiting for payment.`}
          </p>
          {checkoutUrl && (
            <a href={checkoutUrl} className="btn btn-primary btn-sm">
              Continue payment
            </a>
          )}
          <button
            onClick={() => handleCancelPending(pending)}
            disabled={busy === 'cancel'}
            className="text-sm font-medium disabled:opacity-50"
            style={{ color: 'var(--fg-muted)' }}
          >
            {busy === 'cancel' ? 'Cancelling…' : 'Cancel'}
          </button>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {/* Current plan (mockup .plan-hero) */}
        <section className="surface flex flex-col gap-3.5 p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-ui font-medium" style={labelStyle}>Current plan</p>
            <span className="badge badge-green"><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />Active</span>
          </div>
          <p className="text-[34px] font-semibold leading-none tracking-tight tabular-nums" style={{ color: 'var(--fg)' }}>
            {isPro ? `Pro · ${peso(PRO_PRICE_PHP).replace('.00', '')}` : 'Free · ₱0'} <small className="text-sm font-normal tracking-normal" style={labelStyle}>/ month</small>
          </p>
          <div>
            <div className="mb-1.5 flex justify-between text-ui">
              <span>{monthName} posts</span>
              <b className="mono font-medium">{postsUsed == null ? '—' : `${postsUsed} of ${limit}`}</b>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg)_9%,transparent)]" role="progressbar" aria-label={`${monthName} posts used`} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={postsUsed ?? 0}>
              <div className="h-full rounded-full bg-(--green)" style={{ width: `${Math.min(100, ((postsUsed ?? 0) / limit) * 100)}%` }} />
            </div>
          </div>
          <p className="text-xs" style={labelStyle}>Your post count resets {resets}. Extra posts are ₱{ADDON_POST_PRICE_PHP} each, paid from the wallet.</p>
          <div className="mt-auto flex flex-wrap gap-2">
            {onBuyExtra && (
              <button type="button" className="btn btn-outline btn-sm" onClick={onBuyExtra}>Buy 1 extra post · ₱{ADDON_POST_PRICE_PHP}</button>
            )}
            {isPro ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleDowngrade} disabled={busy === 'plan'} title="Takes effect right away">Switch to Free</button>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" onClick={handleUpgrade} disabled={busy === 'plan' || !!pending}>
                {busy === 'plan' && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Upgrade to Pro · {peso(PRO_PRICE_PHP)}/month
              </button>
            )}
          </div>
        </section>

        {/* Wallet: the mockup's inverted card */}
        <section className="surface kw-wallet p-6">
          <div className="flex items-center justify-between gap-2"><p className="flex items-center gap-2 text-ui font-medium" style={labelStyle}><WalletIcon className="h-4 w-4" aria-hidden /> Wallet balance</p><span className="text-xs" style={labelStyle}>PayMongo</span></div>
          <p className="text-[34px] leading-tight font-semibold tracking-tight mt-1 tabular-nums" style={{ color: 'var(--fg)' }}>{peso(wallet.balance)}</p>
          <p className="text-sm mt-1" style={labelStyle}>Use it for extra posts beyond your plan, ₱{ADDON_POST_PRICE_PHP} each.</p>

          <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
            <label htmlFor="topup-amount" className="text-ui font-medium" style={labelStyle}>Add funds</label>
            <div className="flex gap-2 mt-2">
              {QUICK_AMOUNTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(String(v))}
                  className="flex-1 rounded-(--radius) py-1.5 text-sm font-medium tabular-nums transition-colors"
                  style={
                    amount === String(v)
                      ? { border: '1px solid var(--fg)', color: 'var(--fg)', background: 'var(--muted)' }
                      : { border: '1px solid var(--border)', color: 'var(--fg-muted)', background: 'var(--card)' }
                  }
                >
                  ₱{v.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="relative mt-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={labelStyle}>₱</span>
              <input
                id="topup-amount"
                type="number"
                inputMode="numeric"
                min={TOPUP_MIN}
                max={TOPUP_MAX}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input pl-7! tabular-nums"
                aria-describedby="topup-hint"
              />
            </div>
            <p id="topup-hint" className="text-xs mt-1.5" style={{ color: amount && !amountValid ? 'var(--danger)' : 'var(--fg-subtle)' }}>
              {amount && !amountValid
                ? `Enter a whole amount from ₱${TOPUP_MIN} to ₱${TOPUP_MAX.toLocaleString()}.`
                : pending
                  ? 'Finish or cancel the payment above before adding more.'
                  : 'GCash, Maya or card, processed securely by PayMongo.'}
            </p>
            <button
              onClick={() => startTopUp(amountValue)}
              disabled={!amountValid || busy === 'topup' || !!pending}
              className="btn btn-primary btn-sm w-full mt-3"
              title={pending ? 'Finish or cancel the payment in progress first' : undefined}
            >
              {busy === 'topup' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <Plus className="w-3.5 h-3.5" /> Add funds
            </button>
          </div>
        </section>
      </div>

      {/* Plans (mockup .cells .prices) */}
      <div className="kw-cells kw-cells--3" aria-label="Plans">
        {PLANS.map((pl) => {
          const current = pl.id === (wallet.subscription ?? 'FREE');
          return (
            <div key={pl.id} className={current ? 'is-hl' : undefined}>
              <h3 className="flex items-center gap-2 text-base font-semibold">{pl.name}{current && <span className="badge badge-green">Your plan</span>}</h3>
              <p className="text-[30px] font-semibold leading-none tracking-tight tabular-nums">{pl.price}</p>
              <ul className="flex flex-col gap-2 text-sm">
                {pl.items.map((it) => <li key={it} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-(--green-ink)" aria-hidden />{it}</li>)}
              </ul>
              <div className="mt-auto">
                {current ? (
                  <button type="button" className="btn btn-outline w-full" disabled>Current plan</button>
                ) : pl.id === 'FREE' ? (
                  <button type="button" className="btn btn-outline w-full" onClick={handleDowngrade} disabled={busy === 'plan'}>Switch to Free</button>
                ) : pl.id === 'PRO' ? (
                  <button type="button" className="btn btn-primary w-full" onClick={handleUpgrade} disabled={busy === 'plan' || !!pending}>Upgrade to Pro</button>
                ) : (
                  <button type="button" className="btn btn-outline w-full" onClick={onTalkToUs} disabled={!onTalkToUs}>Talk to us</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!isPro && <p className="kw-hint -mt-2">Pay with GCash, Maya or card. Your wallet isn’t used for the plan.</p>}

      {/* History (mockup .tbl) */}
      <section className="surface overflow-hidden">
        <div className="kw-card-h">
          <h3>Payment history</h3>
          <button onClick={exportCsv} disabled={wallet.transactions.length === 0} className="btn btn-ghost btn-sm disabled:opacity-40">
            <Download className="w-3.5 h-3.5" /> Download all
          </button>
        </div>
        {wallet.transactions.length === 0 ? (
          <p className="px-6 py-10 text-sm text-center" style={{ color: 'var(--fg-muted)' }}>No payments yet.</p>
        ) : (
          <div className="scroll-x">
            <table className="kw-tbl kw-tbl--static">
              <thead>
                <tr><th>Date</th><th>Description</th><th>Method</th><th className="text-right">Amount</th><th>Status</th><th>Receipt</th></tr>
              </thead>
              <tbody>
                {wallet.transactions.map((t) => {
                  const { title, ref } = describe(t);
                  const credit = t.type === 'CREDIT';
                  return (
                    <tr key={t.id}>
                      <td className="mono whitespace-nowrap" style={labelStyle}>{new Date(t.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td>{title}</td>
                      <td style={labelStyle}>{method(t)}</td>
                      <td className={`mono text-right whitespace-nowrap ${t.status === 'FAILED' || t.status === 'CANCELLED' ? 'line-through decoration-1' : ''}`}>{credit ? '+' : '−'}{peso(t.amount)}</td>
                      <td>{statusBadge(t)}</td>
                      <td>
                        {t.status === 'COMPLETED' && ref ? (
                          <button type="button" className="text-xs underline underline-offset-2" style={labelStyle} onClick={() => copyRef(ref)} title={ref}>Copy ref</button>
                        ) : t.status === 'PENDING' ? (
                          <span className="flex gap-1.5">
                            {checkoutUrl && <a href={checkoutUrl} className="btn btn-outline btn-sm">Continue</a>}
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleCancelPending(t)} disabled={busy === 'cancel'}>Cancel</button>
                          </span>
                        ) : t.status === 'FAILED' && credit ? (
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => startTopUp(t.amount)} disabled={busy === 'topup' || !!pending}>Retry</button>
                        ) : t.status === 'FAILED' && /^Pro plan/.test(t.description) ? (
                          <button type="button" className="btn btn-outline btn-sm" onClick={handleUpgrade} disabled={busy === 'plan' || !!pending}>Retry</button>
                        ) : (
                          <span style={labelStyle}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default Billing;
