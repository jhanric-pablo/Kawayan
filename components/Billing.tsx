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
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#2B5748', borderTopColor: 'transparent' }} />
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card p-8 w-full max-w-sm text-center animate-scale-in">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: 'rgba(34,197,94,0.12)' }}>
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--fg)' }}>Payment Successful!</h3>
            <p className="text-sm mb-7" style={{ color: 'var(--fg-muted)' }}>
              Your Xendit payment was received. Wallet balance updated.
            </p>
            <button
              onClick={() => setShowSuccessPopup(false)}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white"
              style={{ background: 'linear-gradient(135deg, #2B5748, #3A7362)', boxShadow: '0 4px 16px -4px rgba(43,87,72,0.35)' }}
            >
              Great!
            </button>
          </div>
        </div>
      )}

      {/* Payment method modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card p-6 w-full max-w-md animate-scale-in">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-lg" style={{ color: 'var(--fg)' }}>Payment Method (Xendit)</h3>
              <button onClick={() => setShowPaymentModal(false)} className="p-1.5 rounded-lg transition"
                style={{ color: 'var(--fg-muted)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--fg-subtle)' }}>Method</label>
                <select
                  value={newPaymentMethod.type}
                  onChange={(e) => setNewPaymentMethod({ ...newPaymentMethod, type: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm"
                  style={{ background: 'var(--card)', borderColor: 'var(--border-strong)', color: 'var(--fg)' }}
                >
                  <option value="GCASH">GCash</option>
                  <option value="MAYA">Maya</option>
                  <option value="CARD">Credit/Debit Card</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--fg-subtle)' }}>Account Number</label>
                <input
                  type="text"
                  placeholder="0917..."
                  value={newPaymentMethod.number}
                  onChange={(e) => setNewPaymentMethod({ ...newPaymentMethod, number: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{ background: 'var(--card)', borderColor: 'var(--border-strong)', color: 'var(--fg)' }}
                />
              </div>
              <button onClick={handleSavePaymentMethod}
                className="w-full py-3 rounded-xl font-bold text-sm text-white"
                style={{ background: 'linear-gradient(135deg, #2B5748, #3A7362)', boxShadow: '0 4px 16px -4px rgba(43,87,72,0.3)' }}>
                Save Method
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan change modal */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card p-6 w-full max-w-lg animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg" style={{ color: 'var(--fg)' }}>Change Subscription Plan</h3>
              <button onClick={() => setShowPlanModal(false)} className="p-1.5 rounded-lg transition"
                style={{ color: 'var(--fg-muted)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {([
                { id: 'FREE', name: 'Free Trial', posts: '8 posts/mo', price: '₱0' },
                { id: 'PRO', name: 'Pro Plan', posts: '16 posts/mo + Analytics', price: '₱499/mo' },
              ] as const).map((plan) => (
                <button key={plan.id} onClick={() => handleSwitchPlan(plan.id)}
                  className="p-5 rounded-xl border-2 text-left transition-all"
                  style={{
                    borderColor: wallet.subscription === plan.id ? '#2B5748' : 'var(--border)',
                    background: wallet.subscription === plan.id ? 'rgba(43,87,72,0.07)' : 'var(--card)',
                  }}>
                  <div className="font-bold mb-1" style={{ color: wallet.subscription === plan.id ? '#2B5748' : 'var(--fg)' }}>
                    {plan.name}
                    {wallet.subscription === plan.id && <span className="ml-2 badge badge-green text-[10px]">Current</span>}
                  </div>
                  <div className="text-xs mb-2" style={{ color: 'var(--fg-muted)' }}>{plan.posts}</div>
                  <div className="font-bold text-lg" style={{ color: 'var(--fg)' }}>{plan.price}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--fg)' }}>Billing & Wallet</h1>
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
            Top up and subscribe via Xendit (GCash, Maya, cards).
          </p>
        </div>
      </div>

      {/* Wallet card */}
      <div className="rounded-2xl overflow-hidden relative"
        style={{
          background: 'linear-gradient(135deg, #1A3D30 0%, #2B5748 50%, #1F4034 100%)',
          boxShadow: '0 16px 48px -8px rgba(26,43,38,0.4)',
        }}>
        <div className="absolute inset-0 dot-pattern-dark opacity-30" />
        <div className="absolute top-[-40px] right-[-40px] w-56 h-56 rounded-full opacity-10 blur-3xl bg-[#9CB080]" />

        <div className="relative z-10 p-7">
          <div className="flex justify-between items-start mb-7">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: wallet.subscription === 'PRO' ? 'rgba(156,176,128,0.2)' : 'rgba(255,255,255,0.1)', color: wallet.subscription === 'PRO' ? '#9CB080' : 'rgba(255,255,255,0.7)' }}>
                {wallet.subscription === 'PRO' && <span className="w-1.5 h-1.5 rounded-full bg-[#9CB080]" />}
                {wallet.subscription} Plan
              </span>
              <p className="text-sm text-white/50 mt-5 uppercase tracking-widest font-bold text-[11px]">Available Balance</p>
              <p className="text-4xl font-bold text-white mt-1">₱{wallet.balance.toFixed(2)}</p>
            </div>
            <button onClick={() => setShowPlanModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.15)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>
              Change Plan
            </button>
          </div>

          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-1.5 block">Amount to Load</label>
              <input
                type="number"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2.5 rounded-xl border text-white text-sm font-medium focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.15)' }}
              />
            </div>
            <div className="flex gap-1.5 pb-0.5">
              {QUICK_AMOUNTS.map((amt) => (
                <button key={amt} type="button" onClick={() => setTopUpAmount(String(amt))}
                  className="text-xs font-bold px-3 py-2 rounded-xl transition-all"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.15)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>
                  ₱{amt}
                </button>
              ))}
            </div>
            <button
              onClick={handleTopUp}
              disabled={processing || !topUpAmount}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50"
              style={{ background: '#9CB080', color: '#1A3D30', boxShadow: '0 4px 16px -4px rgba(156,176,128,0.4)' }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => e.currentTarget.style.transform = ''}>
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Top Up via Xendit
            </button>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-bold" style={{ color: 'var(--fg)' }}>Transaction History</h3>
          <button
            onClick={downloadInvoice}
            disabled={wallet.transactions.length === 0}
            className="flex items-center gap-1.5 text-xs font-semibold transition-colors disabled:opacity-40"
            style={{ color: '#2B5748' }}
            onMouseEnter={e => e.currentTarget.style.color = '#1A3D30'}
            onMouseLeave={e => e.currentTarget.style.color = '#2B5748'}>
            <Download className="w-3.5 h-3.5" /> Download CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead style={{ background: 'var(--bg-alt)', borderBottom: '1px solid var(--border)' }}>
              <tr>
                {['Date', 'Description', 'Status', 'Amount'].map(h => (
                  <th key={h} className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest"
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
                              style={{ color: '#2B5748' }}>
                              <RefreshCw className={`w-3.5 h-3.5 ${processing ? 'animate-spin' : ''}`} />
                            </button>
                            <button onClick={() => handleCancelTransaction(txn.id)} disabled={cancellingId === txn.id} title="Cancel"
                              className="p-1 rounded transition disabled:opacity-50"
                              style={{ color: '#C0392B' }}>
                              {cancellingId === txn.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${txn.type === 'CREDIT' ? 'text-green-600' : 'text-red-500'}`}>
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
