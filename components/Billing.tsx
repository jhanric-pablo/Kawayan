import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, Plus, Loader2, Download, X, XCircle, RefreshCw } from 'lucide-react';
import { paymentService, Wallet } from '../services/paymentService';
import { useOrganicDialog } from './OrganicDialog';
import XenditCheckoutModal, { PaymentReceipt } from './XenditCheckoutModal';

const QUICK_AMOUNTS = [100, 500, 1000];

const Billing: React.FC = () => {
  const dialog = useOrganicDialog();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  const [checkoutModal, setCheckoutModal] = useState<{
    open: boolean;
    mode: 'topup' | 'subscription';
    amount: number;
    plan?: 'PRO';
  }>({ open: false, mode: 'topup', amount: 0 });
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState({ type: 'GCASH', number: '' });

  useEffect(() => {
    loadWallet();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      setShowSuccessPopup(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const loadWallet = async () => {
    setLoading(true);
    try {
      await paymentService.verifyPayment();
    } catch (e) {
      console.warn('Payment verification skipped:', e);
    }
    const data = await paymentService.getWalletData();
    setWallet(data);
    setLoading(false);
  };

  const handleCheckoutSuccess = (updated: Wallet, _receipt: PaymentReceipt) => {
    setWallet(updated);
  };

  const handleTopUp = () => {
    const amount = Number(topUpAmount);
    if (!amount || amount <= 0) return;
    setCheckoutModal({ open: true, mode: 'topup', amount });
  };

  const handleVerifyManual = async () => {
    setProcessing(true);
    try {
      const result = await paymentService.verifyPayment();
      await dialog.alert(result.message);
      await loadWallet();
    } catch (error: any) {
      await dialog.alert(error.message);
    } finally {
      setProcessing(false);
    }
  };

  const downloadInvoice = () => {
    if (!wallet) return;
    const headers = "Date,ID,Description,Status,Amount\n";
    const rows = wallet.transactions.map(t => 
      `${new Date(t.date).toLocaleDateString()},${t.id},"${t.description}",${t.status},${t.type === 'CREDIT' ? '+' : '-'}₱${t.amount}`
    ).join("\n");
    
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kawayan_Invoices_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleCancelTransaction = async (id: string) => {
    const confirmed = await dialog.confirm("Are you sure you want to cancel this pending transaction?");
    if (!confirmed) return;
    setCancellingId(id);
    try {
      const updatedWallet = await paymentService.cancelTransaction(id);
      setWallet(updatedWallet);
    } catch (error: any) {
      await dialog.alert(error.message);
    } finally {
      setCancellingId(null);
    }
  };

  const handleSavePaymentMethod = async () => {
    await dialog.alert(`Payment method saved: ${newPaymentMethod.type} — ${newPaymentMethod.number}`);
    setShowPaymentModal(false);
  };

  const handleSwitchPlan = async (plan: 'FREE' | 'PRO') => {
    if (plan === wallet?.subscription) return;
    
    if (plan === 'PRO') {
       const cost = 499;
       if ((wallet?.balance || 0) < cost) {
         await dialog.alert('Insufficient balance. Please top up your wallet via Xendit first.');
         return;
       }
       setShowPlanModal(false);
       setCheckoutModal({ open: true, mode: 'subscription', amount: cost, plan: 'PRO' });
    } else {
       await paymentService.cancelSubscription();
       await loadWallet();
       setShowPlanModal(false);
    }
  };

  if (loading || !wallet) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in relative">

      <XenditCheckoutModal
        open={checkoutModal.open}
        mode={checkoutModal.mode}
        amount={checkoutModal.amount}
        plan={checkoutModal.plan}
        onClose={() => {
          setCheckoutModal((p) => ({ ...p, open: false }));
          setTopUpAmount('');
        }}
        onSuccess={handleCheckoutSuccess}
      />

      {/* Success popup */}
      {showSuccessPopup && (
        <div className="kw-overlay" onClick={() => setShowSuccessPopup(false)}>
          <div className="kw-sheet w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div style={{ height: 3, background: 'var(--success)' }} />
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-[var(--r-lg)] flex items-center justify-center mx-auto mb-5"
                style={{ background: 'color-mix(in srgb, var(--success) 12%, transparent)' }}>
                <CheckCircle className="w-8 h-8" style={{ color: 'var(--success)' }} />
              </div>
              <h3 className="font-display text-xl font-semibold mb-2" style={{ color: 'var(--fg)' }}>Payment successful</h3>
              <p className="text-sm mb-7" style={{ color: 'var(--fg-muted)' }}>
                Your Xendit payment was received. Wallet balance updated.
              </p>
              <button onClick={() => setShowSuccessPopup(false)} className="btn btn-primary w-full">
                Great, thanks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment method modal */}
      {showPaymentModal && (
        <div className="kw-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="kw-sheet w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div style={{ height: 3, background: 'var(--kw-green)' }} />
            <div className="p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-display text-lg font-semibold" style={{ color: 'var(--fg)' }}>Payment method (Xendit)</h3>
                <button onClick={() => setShowPaymentModal(false)} className="btn btn-ghost btn-sm !p-1.5" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.08em] mb-1.5" style={{ color: 'var(--fg-muted)' }}>Method</label>
                  <select
                    value={newPaymentMethod.type}
                    onChange={(e) => setNewPaymentMethod({ ...newPaymentMethod, type: e.target.value })}
                    className="input"
                  >
                    <option value="GCASH">GCash</option>
                    <option value="MAYA">Maya</option>
                    <option value="CARD">Credit/Debit Card</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.08em] mb-1.5" style={{ color: 'var(--fg-muted)' }}>Account number</label>
                  <input
                    type="text"
                    placeholder="0917..."
                    value={newPaymentMethod.number}
                    onChange={(e) => setNewPaymentMethod({ ...newPaymentMethod, number: e.target.value })}
                    className="input"
                  />
                </div>
                <button onClick={handleSavePaymentMethod} className="btn btn-primary w-full">
                  Save method
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan change modal */}
      {showPlanModal && (
        <div className="kw-overlay" onClick={() => setShowPlanModal(false)}>
          <div className="kw-sheet w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div style={{ height: 3, background: 'var(--kw-green)' }} />
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-display text-lg font-semibold" style={{ color: 'var(--fg)' }}>Change subscription plan</h3>
                <button onClick={() => setShowPlanModal(false)} className="btn btn-ghost btn-sm !p-1.5" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {([
                  { id: 'FREE', name: 'Free Trial', posts: '8 posts/mo', price: '₱0' },
                  { id: 'PRO', name: 'Pro Plan', posts: '16 posts/mo + Analytics', price: '₱499/mo' },
                ] as const).map((plan) => {
                  const active = wallet.subscription === plan.id;
                  return (
                    <button key={plan.id} onClick={() => handleSwitchPlan(plan.id)}
                      className="p-5 rounded-[var(--r-lg)] border text-left transition-all"
                      style={{
                        borderColor: active ? 'var(--primary)' : 'var(--border)',
                        background: active ? 'color-mix(in srgb, var(--primary) 7%, transparent)' : 'var(--card)',
                        boxShadow: active ? 'var(--shadow-sm)' : 'var(--shadow-xs)',
                      }}>
                      <div className="font-bold mb-1 flex items-center gap-2" style={{ color: active ? 'var(--primary)' : 'var(--fg)' }}>
                        {plan.name}
                        {active && <span className="badge badge-green">Current</span>}
                      </div>
                      <div className="text-xs mb-2" style={{ color: 'var(--fg-muted)' }}>{plan.posts}</div>
                      <div className="font-display text-lg font-semibold" style={{ color: 'var(--fg)' }}>{plan.price}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="page-head">
        <div>
          <h1 className="page-head__title">Billing &amp; Wallet</h1>
          <p className="page-head__sub">Top up and subscribe via Xendit — GCash, Maya, cards.</p>
        </div>
      </div>

      {/* Wallet card */}
      <div className="rounded-[var(--r-xl)] overflow-hidden relative"
        style={{
          background: 'linear-gradient(140deg, #15352A 0%, #2B5748 60%, #1E4638 100%)',
          boxShadow: 'var(--shadow-lg)',
        }}>
        <div className="absolute inset-0 dot-pattern-dark opacity-30" />
        <div className="absolute top-[-40px] right-[-40px] w-56 h-56 rounded-full opacity-10 blur-3xl bg-[#9CB080]" />

        <div className="relative z-10 p-7">
          <div className="flex justify-between items-start mb-7 gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.08em]"
                style={{ background: wallet.subscription === 'PRO' ? 'rgba(156,176,128,0.22)' : 'rgba(255,255,255,0.12)', color: wallet.subscription === 'PRO' ? '#C5D9BB' : 'rgba(255,255,255,0.75)' }}>
                {wallet.subscription === 'PRO' && <span className="w-1.5 h-1.5 rounded-full bg-[#9CB080]" />}
                {wallet.subscription} Plan
              </span>
              <p className="text-[11px] text-white/50 mt-5 uppercase tracking-[0.14em] font-bold">Available balance</p>
              <p className="font-display text-4xl font-semibold text-white mt-1">₱{wallet.balance.toFixed(2)}</p>
            </div>
            <button onClick={() => setShowPlanModal(true)}
              className="px-3 py-1.5 rounded-[var(--r)] text-xs font-semibold transition-all"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.18)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}>
              Change plan
            </button>
          </div>

          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/50 mb-1.5 block">Amount to load</label>
              <input
                type="number"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2.5 rounded-[var(--r)] border text-white text-sm font-medium focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.18)' }}
              />
            </div>
            <div className="flex gap-1.5 pb-0.5">
              {QUICK_AMOUNTS.map((amt) => (
                <button key={amt} type="button" onClick={() => setTopUpAmount(String(amt))}
                  className="text-xs font-bold px-3 py-2 rounded-[var(--r)] transition-all"
                  style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.18)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}>
                  ₱{amt}
                </button>
              ))}
            </div>
            <button
              onClick={handleTopUp}
              disabled={processing || !topUpAmount}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--r-pill)] font-bold text-sm transition-all disabled:opacity-50"
              style={{ background: '#C2D6B6', color: '#15352A', boxShadow: '0 8px 20px -8px rgba(0,0,0,0.45)' }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => e.currentTarget.style.transform = ''}>
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Top up via Xendit
            </button>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="surface overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-display text-base font-semibold" style={{ color: 'var(--fg)' }}>Transaction history</h3>
          <button
            onClick={downloadInvoice}
            disabled={wallet.transactions.length === 0}
            className="btn btn-ghost btn-sm disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" /> Download CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead style={{ background: 'var(--bg-alt)', borderBottom: '1px solid var(--border)' }}>
              <tr>
                {['Date', 'Description', 'Status', 'Amount'].map(h => (
                  <th key={h} className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-[0.1em]"
                    style={{ color: 'var(--fg-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {wallet.transactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-sm" style={{ color: 'var(--fg-subtle)' }}>
                    No transactions yet. Top up via Xendit to get started.
                  </td>
                </tr>
              ) : (
                wallet.transactions.map((txn) => (
                  <tr key={txn.id} className="transition-colors"
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-alt)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--fg-muted)' }}>
                      {new Date(txn.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-medium" style={{ color: 'var(--fg)' }}>
                      {txn.description}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`badge ${
                          txn.status === 'COMPLETED' ? 'badge-green' :
                          txn.status === 'PENDING' ? 'badge-amber' :
                          txn.status === 'CANCELLED' ? 'badge-sage' :
                          'badge-red'
                        }`}>
                          {txn.status}
                        </span>
                        {txn.status === 'PENDING' && (
                          <div className="flex gap-1">
                            <button onClick={handleVerifyManual} disabled={processing} title="Verify with Xendit"
                              className="p-1 rounded transition disabled:opacity-50"
                              style={{ color: 'var(--primary)' }}>
                              <RefreshCw className={`w-3.5 h-3.5 ${processing ? 'animate-spin' : ''}`} />
                            </button>
                            <button onClick={() => handleCancelTransaction(txn.id)} disabled={cancellingId === txn.id} title="Cancel"
                              className="p-1 rounded transition disabled:opacity-50"
                              style={{ color: 'var(--danger)' }}>
                              {cancellingId === txn.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold" style={{ color: txn.type === 'CREDIT' ? 'var(--success)' : 'var(--danger)' }}>
                      {txn.type === 'CREDIT' ? '+' : '-'}₱{txn.amount.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Billing;
