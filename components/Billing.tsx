import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, Package, AlertTriangle, Plus, Loader2, Download, X, Smartphone, XCircle, RefreshCw } from 'lucide-react';
import { paymentService, Wallet } from '../services/paymentService';

const Billing: React.FC = () => {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  
  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState({ type: 'GCASH', number: '' });

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    setLoading(true);
    
    // Trigger verification check before loading data
    try {
      await paymentService.verifyPayment();
    } catch (e) {
      console.warn("Auto-verification failed:", e);
    }

    const data = await paymentService.getWalletData();
    setWallet(data);
    setLoading(false);
  };

  const handleVerifyManual = async () => {
    setProcessing(true);
    try {
      const result = await paymentService.verifyPayment();
      alert(result.message);
      await loadWallet();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleTopUp = async () => {
    if (!topUpAmount || isNaN(Number(topUpAmount))) return;
    setProcessing(true);
    try {
      const { checkoutUrl } = await paymentService.initiateTopUp(Number(topUpAmount));
      
      // Redirect to Xendit Checkout
      window.location.href = checkoutUrl;
    } catch (error: any) {
      alert(error.message || "Payment Initialization Failed.");
    } finally {
      setProcessing(false);
      setTopUpAmount('');
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
    if (!confirm("Are you sure you want to cancel this pending transaction?")) return;
    setCancellingId(id);
    try {
      const updatedWallet = await paymentService.cancelTransaction(id);
      setWallet(updatedWallet);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setCancellingId(null);
    }
  };

  const handleSavePaymentMethod = () => {
    // In a real app, this would tokenise with Xendit
    alert(`Payment Method Saved: ${newPaymentMethod.type} - ${newPaymentMethod.number}`);
    setShowPaymentModal(false);
  };

  const handleSwitchPlan = async (plan: 'FREE' | 'PRO') => {
    if (plan === wallet?.subscription) return;
    
    if (plan === 'PRO') {
       const cost = 499;
       if ((wallet?.balance || 0) < cost) {
         alert("Insufficient balance. Please top up first.");
         return;
       }
       const confirm = window.confirm(`Upgrade to PRO for ₱499/mo? This will be deducted from your wallet.`);
       if (confirm) {
         await paymentService.purchaseSubscription('PRO', cost);
         await loadWallet();
         setShowPlanModal(false);
       }
    } else {
       await paymentService.cancelSubscription();
       await loadWallet();
       setShowPlanModal(false);
    }
  };

  if (loading || !wallet) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* Payment Method Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg dark:text-white">Update Payment Method</h3>
                <button onClick={() => setShowPaymentModal(false)}><X className="w-5 h-5 text-slate-400"/></button>
              </div>
              <div className="space-y-4">
                 <div>
                   <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Method</label>
                   <select 
                     value={newPaymentMethod.type}
                     onChange={(e) => setNewPaymentMethod({...newPaymentMethod, type: e.target.value})}
                     className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                   >
                     <option value="GCASH">GCash</option>
                     <option value="MAYA">Maya</option>
                     <option value="CARD">Credit/Debit Card</option>
                   </select>
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Account/Card Number</label>
                   <input 
                     type="text" 
                     placeholder="0917..." 
                     value={newPaymentMethod.number}
                     onChange={(e) => setNewPaymentMethod({...newPaymentMethod, number: e.target.value})}
                     className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                   />
                 </div>
                 <button onClick={handleSavePaymentMethod} className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700">Save Method</button>
              </div>
           </div>
        </div>
      )}

      {/* Plan Selection Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg dark:text-white">Change Subscription Plan</h3>
                <button onClick={() => setShowPlanModal(false)}><X className="w-5 h-5 text-slate-400"/></button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className={`p-4 rounded-xl border-2 cursor-pointer transition ${wallet.subscription === 'FREE' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-700'}`} onClick={() => handleSwitchPlan('FREE')}>
                    <h4 className="font-bold dark:text-white">Free Trial</h4>
                    <p className="text-sm text-slate-500">8 posts/mo</p>
                    <p className="font-bold mt-2">₱0</p>
                 </div>
                 <div className={`p-4 rounded-xl border-2 cursor-pointer transition ${wallet.subscription === 'PRO' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-700'}`} onClick={() => handleSwitchPlan('PRO')}>
                    <h4 className="font-bold dark:text-white">Pro Plan</h4>
                    <p className="text-sm text-slate-500">16 posts/mo + Analytics</p>
                    <p className="font-bold mt-2">₱499/mo</p>
                 </div>
              </div>
           </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Billing & Wallet</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage your credits and subscription.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Wallet Balance Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-8 shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full blur-[100px] opacity-20"></div>
           
           <div className="relative z-10">
             <div className="flex justify-between items-start mb-8">
               <div>
                 <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${wallet.subscription === 'PRO' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700 text-slate-300'}`}>
                   {wallet.subscription} Plan
                 </span>
                 <h2 className="text-sm font-medium text-slate-400 mt-4 uppercase tracking-wider">Available Balance</h2>
                 <p className="text-4xl font-bold mt-1">₱{wallet.balance.toFixed(2)}</p>
               </div>
               <button onClick={() => setShowPlanModal(true)} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition">Change Plan</button>
             </div>

             <div className="flex gap-4 items-end">
               <div className="flex-1">
                 <label className="text-xs text-slate-400 mb-1 block">Amount to Load</label>
                 <input 
                   type="number" 
                   value={topUpAmount}
                   onChange={(e) => setTopUpAmount(e.target.value)}
                   placeholder="0.00"
                   className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-emerald-500 transition"
                 />
               </div>
               <button 
                 onClick={handleTopUp}
                 disabled={processing || !topUpAmount}
                 className="bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-600 transition shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {processing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>}
                 Top Up
               </button>
             </div>
           </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 dark:text-white">Transaction History</h3>
          <button 
            onClick={downloadInvoice}
            disabled={wallet.transactions.length === 0}
            className="text-xs flex items-center gap-1 text-emerald-600 font-bold hover:text-emerald-700 disabled:opacity-50"
          >
            <Download className="w-3 h-3" /> Download CSV
          </button>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-100 dark:border-slate-700">
            <tr>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Description</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
            {wallet.transactions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                  No transactions yet. Top up to get started.
                </td>
              </tr>
            ) : (
              wallet.transactions.map((txn) => (
                <tr key={txn.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{new Date(txn.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-medium text-slate-800 dark:text-white">{txn.description}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                        txn.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 
                        txn.status === 'PENDING' ? 'bg-orange-100 text-orange-700' : 
                        txn.status === 'CANCELLED' ? 'bg-slate-100 text-slate-700' :
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {txn.status}
                      </span>
                      {txn.status === 'PENDING' && (
                        <div className="flex gap-1">
                          <button 
                            onClick={handleVerifyManual}
                            disabled={processing}
                            className="text-xs text-emerald-500 hover:text-emerald-700 flex items-center gap-1 transition disabled:opacity-50"
                            title="Verify Payment Status"
                          >
                             <RefreshCw className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`}/>
                          </button>
                          <button 
                            onClick={() => handleCancelTransaction(txn.id)}
                            disabled={cancellingId === txn.id}
                            className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 transition disabled:opacity-50"
                            title="Cancel Transaction"
                          >
                             {cancellingId === txn.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <XCircle className="w-4 h-4"/>}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-right font-bold ${txn.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {txn.type === 'CREDIT' ? '+' : '-'}₱{txn.amount.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Billing;
