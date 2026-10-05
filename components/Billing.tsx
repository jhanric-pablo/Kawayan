import React, { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { paymentService, Wallet, Transaction } from '../services/paymentService';
import { useOrganicDialog } from './OrganicDialog';
import { useToast } from './ui/Toast';
import { ADDON_POST_PRICE_PHP, PRO_POST_LIMIT, PRO_PRICE_PHP, TRIAL_POST_LIMIT } from '../utils/tierLimits';

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

const Billing: React.FC = () => {
  const dialog = useOrganicDialog();
  const toast = useToast();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [amount, setAmount] = useState('500');
  const [busy, setBusy] = useState<'topup' | 'plan' | 'cancel' | null>(null);

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
      if (result?.status === 'COMPLETED') toast.success(`${peso(result.amount || 0)} added to your wallet`);
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

  const handleUpgrade = async () => {
    if (!wallet) return;
    if (wallet.balance < PRO_PRICE_PHP && wallet.transactions.some((t) => t.status === 'PENDING')) {
      await dialog.alert({
        title: 'Payment in progress',
        message: `Your balance is ${peso(wallet.balance)}, short of ${peso(PRO_PRICE_PHP)}. Finish or cancel your pending top-up first, then upgrade.`,
      });
      return;
    }
    if (wallet.balance < PRO_PRICE_PHP) {
      const shortfall = Math.max(TOPUP_MIN, Math.ceil((PRO_PRICE_PHP - wallet.balance) / 100) * 100);
      const ok = await dialog.confirm({
        title: 'Add funds first',
        message: `Pro is ${peso(PRO_PRICE_PHP)} a month, paid from your wallet. Your balance is ${peso(wallet.balance)}. Add ${peso(shortfall)} now?`,
        confirmLabel: `Add ${peso(shortfall)}`,
      });
      if (ok) await startTopUp(shortfall);
      return;
    }
    const ok = await dialog.confirm({
      title: 'Upgrade to Pro',
      message: `${peso(PRO_PRICE_PHP)} will be taken from your wallet balance. You'll get ${PRO_POST_LIMIT} posts a month.`,
      confirmLabel: 'Upgrade',
    });
    if (!ok) return;
    setBusy('plan');
    try {
      await paymentService.purchaseSubscription('PRO', PRO_PRICE_PHP);
      await refresh();
      toast.success("You're on Pro");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
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
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--fg-subtle)' }} />
      </div>
    );
  }

  const isPro = wallet.subscription === 'PRO' || wallet.subscription === 'ENTERPRISE';
  const pending = wallet.transactions.find((t) => t.status === 'PENDING');
  const labelStyle = { color: 'var(--fg-muted)' };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-head__title">Billing</h1>
          <p className="page-head__sub">Your plan, wallet balance and payment history.</p>
        </div>
      </div>

      {wallet.paymentsTestMode && (
        <p className="text-[13px] -mt-2" style={{ color: 'var(--fg-muted)' }}>
          <span className="inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle" style={{ background: 'var(--warning)' }} />
          Test mode: payments use PayMongo's sandbox, so no real money is charged.
        </p>
      )}

      {pending && (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--r-lg)] px-4 py-3"
          style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)' }}
          role="status"
        >
          <p className="flex-1 min-w-[14rem] text-sm" style={{ color: 'var(--fg)' }}>
            A {peso(pending.amount)} top-up is waiting for payment.
          </p>
          {checkoutUrl && (
            <a href={checkoutUrl} className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>
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

      <div className="grid gap-4 md:grid-cols-2">
        {/* Plan */}
        <section className="surface p-6 flex flex-col">
          <p className="text-[13px] font-medium" style={labelStyle}>Current plan</p>
          <h2 className="font-display text-2xl font-semibold mt-1" style={{ color: 'var(--fg)' }}>{isPro ? 'Pro' : 'Free'}</h2>
          <p className="text-sm mt-1" style={labelStyle}>
            {isPro ? `${PRO_POST_LIMIT} posts a month · ${peso(PRO_PRICE_PHP)}/month` : `${TRIAL_POST_LIMIT} posts a month · ₱0`}
          </p>

          <div className="mt-6 pt-5 flex-1 flex flex-col" style={{ borderTop: '1px solid var(--border)' }}>
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-[13px]" style={labelStyle}>
                  <th className="text-left font-medium pb-2" />
                  <th className="text-right font-medium pb-2 w-20" style={!isPro ? { color: 'var(--fg)' } : undefined}>Free</th>
                  <th className="text-right font-medium pb-2 w-24" style={isPro ? { color: 'var(--fg)' } : undefined}>Pro</th>
                </tr>
              </thead>
              <tbody style={{ color: 'var(--fg)' }}>
                {[
                  ['Posts each month', String(TRIAL_POST_LIMIT), String(PRO_POST_LIMIT)],
                  ['Extra posts', `₱${ADDON_POST_PRICE_PHP} each`, `₱${ADDON_POST_PRICE_PHP} each`],
                  ['Price', '₱0', `₱${PRO_PRICE_PHP}/mo`],
                ].map(([label, free, pro]) => (
                  <tr key={label} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="py-2" style={labelStyle}>{label}</td>
                    <td className="py-2 text-right" style={isPro ? labelStyle : undefined}>{free}</td>
                    <td className="py-2 text-right" style={!isPro ? labelStyle : undefined}>{pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-auto pt-5">
              {isPro ? (
                <button onClick={handleDowngrade} disabled={busy === 'plan'} className="btn btn-outline btn-sm">
                  Switch to Free
                </button>
              ) : (
                <button onClick={handleUpgrade} disabled={busy === 'plan'} className="btn btn-primary btn-sm">
                  {busy === 'plan' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Upgrade to Pro · {peso(PRO_PRICE_PHP)}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Wallet */}
        <section className="surface p-6">
          <p className="text-[13px] font-medium" style={labelStyle}>Wallet balance</p>
          <p className="font-display text-3xl font-semibold mt-1 tabular-nums" style={{ color: 'var(--fg)' }}>{peso(wallet.balance)}</p>
          <p className="text-sm mt-1" style={labelStyle}>Pays for Pro and extra posts.</p>

          <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
            <label htmlFor="topup-amount" className="text-[13px] font-medium" style={labelStyle}>Add funds</label>
            <div className="flex gap-2 mt-2">
              {QUICK_AMOUNTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(String(v))}
                  className="flex-1 rounded-[var(--r)] py-1.5 text-sm font-medium tabular-nums transition-colors"
                  style={
                    amount === String(v)
                      ? { border: '1px solid var(--primary)', color: 'var(--primary)', background: 'var(--card)' }
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
                className="input !pl-7 tabular-nums"
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
              Continue to payment
            </button>
          </div>
        </section>
      </div>

      {/* History */}
      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>Payment history</h2>
          <button onClick={exportCsv} disabled={wallet.transactions.length === 0} className="btn btn-ghost btn-sm disabled:opacity-40">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
        {wallet.transactions.length === 0 ? (
          <p className="px-6 py-10 text-sm text-center" style={{ color: 'var(--fg-subtle)' }}>
            No payments yet.
          </p>
        ) : (
          <ul>
            {wallet.transactions.map((t, i) => {
              const { title, ref } = describe(t);
              const status = STATUS_LABEL[t.status];
              const credit = t.type === 'CREDIT';
              return (
                <li
                  key={t.id}
                  className="flex items-start justify-between gap-4 px-6 py-3.5"
                  style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: status ? 'var(--fg-muted)' : 'var(--fg)' }}>{title}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--fg-subtle)' }}>
                      {new Date(t.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {ref && <> · <span className="font-mono">{ref.length > 18 ? `${ref.slice(0, 18)}…` : ref}</span></>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`text-sm font-semibold tabular-nums ${t.status === 'FAILED' || t.status === 'CANCELLED' ? 'line-through decoration-1' : ''}`}
                      style={{ color: status ? 'var(--fg-subtle)' : credit ? 'var(--primary)' : 'var(--fg)' }}
                    >
                      {credit ? '+' : '−'}{peso(t.amount)}
                    </p>
                    {status && (
                      <p className="text-xs mt-0.5 flex items-center justify-end gap-1.5" style={{ color: 'var(--fg-muted)' }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.color }} aria-hidden />
                        {status.text}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

export default Billing;
