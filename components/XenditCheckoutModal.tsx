import React, { useEffect, useState } from 'react';
import { CheckCircle, CreditCard, Loader2, Smartphone, X, ShieldCheck, Receipt } from 'lucide-react';
import { paymentService, Wallet } from '../services/paymentService';

export type PaymentMethod = 'GCASH' | 'MAYA' | 'CARD';

export interface PaymentReceipt {
  referenceId: string;
  method: PaymentMethod;
  amount: number;
  type: 'topup' | 'subscription';
  plan?: string;
  completedAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  mode: 'topup' | 'subscription';
  amount: number;
  plan?: 'PRO';
  onSuccess: (wallet: Wallet, receipt: PaymentReceipt) => void;
}

const METHODS: { id: PaymentMethod; label: string; sub: string; color: string }[] = [
  { id: 'GCASH', label: 'GCash', sub: 'via Xendit', color: '#007DFE' },
  { id: 'MAYA', label: 'Maya', sub: 'via Xendit', color: '#00B14F' },
  { id: 'CARD', label: 'Card', sub: 'Visa / Mastercard', color: '#2B5748' },
];

const XenditCheckoutModal: React.FC<Props> = ({
  open,
  onClose,
  mode,
  amount,
  plan,
  onSuccess,
}) => {
  const [step, setStep] = useState<'method' | 'processing' | 'success'>('method');
  const [method, setMethod] = useState<PaymentMethod>('GCASH');
  const [processingLabel, setProcessingLabel] = useState('Connecting to Xendit…');
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep('method');
      setMethod('GCASH');
      setReceipt(null);
      setError(null);
    }
  }, [open, amount, mode]);

  if (!open) return null;

  const title = mode === 'topup' ? 'Wallet Top-up' : 'Pro Subscription';

  const handlePay = async () => {
    setStep('processing');
    setError(null);
    const labels = [
      'Connecting to Xendit…',
      'Securing payment channel…',
      'Authorizing transaction…',
      'Updating your Kawayan wallet…',
    ];
    for (let i = 0; i < labels.length; i++) {
      setProcessingLabel(labels[i]);
      await new Promise((r) => setTimeout(r, 650));
    }

    try {
      const result = await paymentService.xenditCheckout({
        type: mode,
        amount,
        method,
        plan,
      });

      if (result.mode === 'redirect' && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }

      if (result.wallet && result.receipt) {
        setReceipt(result.receipt as PaymentReceipt);
        setStep('success');
        onSuccess(result.wallet, result.receipt as PaymentReceipt);
      }
    } catch (e: any) {
      setError(e.message || 'Payment could not be completed');
      setStep('method');
    }
  };

  return (
    <div className="fixed inset-0 bg-[#273338]/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#FFFFFF] dark:bg-[#273338] w-full max-w-md rounded-[2rem] shadow-float border border-[#273338]/10 dark:border-[#9CB080]/20 overflow-hidden relative">
        <div className="h-1 bg-gradient-to-r from-[#2B5748] via-[#618764] to-[#9CB080]" />

        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#618764] mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Secured by Xendit
              </p>
              <h3 className="font-display text-xl font-bold text-[#273338] dark:text-white">{title}</h3>
            </div>
            {step !== 'processing' && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 hover:bg-[#273338]/5 dark:hover:bg-white/5 transition"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-[#273338] dark:text-white" />
              </button>
            )}
          </div>

          {step === 'method' && (
            <>
              <div className="rounded-[1.25rem] bg-[#2B5748]/5 dark:bg-white/5 border border-[#2B5748]/15 p-4 mb-5 text-center">
                <p className="text-xs text-[#273338]/60 dark:text-white/50 uppercase tracking-wider">Amount due</p>
                <p className="font-display text-3xl font-black text-[#2B5748] dark:text-[#9CB080] mt-1">
                  ₱{amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {mode === 'subscription' && (
                  <p className="text-xs text-[#618764] mt-1">Pro Plan · 16 posts/mo + analytics</p>
                )}
              </div>

              <p className="text-xs font-bold uppercase tracking-wider text-[#273338]/70 dark:text-white/60 mb-3">
                Pay with
              </p>
              <div className="space-y-2 mb-5">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-[1rem] border transition-all text-left ${
                      method === m.id
                        ? 'border-[#2B5748] dark:border-[#9CB080] bg-[#2B5748]/5 dark:bg-[#9CB080]/10'
                        : 'border-[#273338]/10 dark:border-[#9CB080]/20 hover:border-[#618764]/40'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                      style={{ background: m.color }}
                    >
                      {m.id === 'CARD' ? <CreditCard className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-[#273338] dark:text-white">{m.label}</p>
                      <p className="text-[11px] text-[#273338]/50 dark:text-white/50">{m.sub}</p>
                    </div>
                  </button>
                ))}
              </div>

              {error && (
                <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-full px-3 py-2 mb-3 text-center">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={handlePay}
                className="w-full py-3.5 rounded-full font-bold text-white organic-btn-primary shadow-accent-sm hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                Pay ₱{amount.toFixed(2)}
              </button>
              <p className="text-[10px] text-center text-[#273338]/40 dark:text-white/40 mt-3 leading-relaxed">
                Payments are processed through Xendit (GCash, Maya, cards, and QR).
              </p>
            </>
          )}

          {step === 'processing' && (
            <div className="py-12 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-[#2B5748]/10 flex items-center justify-center mb-5">
                <Loader2 className="w-8 h-8 text-[#2B5748] dark:text-[#9CB080] animate-spin" />
              </div>
              <p className="font-display text-lg text-[#273338] dark:text-white">Processing payment…</p>
              <p className="text-sm text-[#618764] mt-2 animate-pulse">{processingLabel}</p>
            </div>
          )}

          {step === 'success' && receipt && (
            <div className="py-4 text-center animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-9 h-9 text-emerald-600" />
              </div>
              <h4 className="font-display text-xl font-bold text-[#273338] dark:text-white">Payment Successful</h4>
              <p className="text-sm text-[#273338]/60 dark:text-white/60 mt-1 mb-5">
                {mode === 'topup' ? 'Your wallet has been credited.' : 'Pro subscription is now active.'}
              </p>

              <div className="rounded-[1.25rem] border border-dashed border-[#618764]/40 bg-[#273338]/[0.03] dark:bg-white/[0.04] p-4 text-left space-y-2 mb-5">
                <div className="flex items-center gap-2 text-[#2B5748] dark:text-[#9CB080] font-bold text-xs uppercase tracking-wider">
                  <Receipt className="w-4 h-4" /> Xendit Receipt
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#273338]/50 dark:text-white/50">Invoice ref</span>
                  <span className="font-mono font-bold text-[#273338] dark:text-white text-[10px]">{receipt.referenceId}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#273338]/50 dark:text-white/50">Channel</span>
                  <span className="font-semibold text-[#273338] dark:text-white">{receipt.method}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#273338]/50 dark:text-white/50">Amount</span>
                  <span className="font-bold text-emerald-600">₱{receipt.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#273338]/50 dark:text-white/50">Status</span>
                  <span className="font-bold text-emerald-600">PAID</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-full font-bold text-white organic-btn-primary"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default XenditCheckoutModal;
