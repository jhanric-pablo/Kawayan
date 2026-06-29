import React, { useRef, useState } from 'react';
import { Clock, CheckCircle, XCircle, Upload, FileText, X, RefreshCw, LogOut, Shield, ArrowRight } from 'lucide-react';
import { VerificationStatus as VStatus } from '../types';

interface Props {
  status: VStatus;
  rejectionReason?: string;
  businessName?: string;
  onLogout: () => void;
  onResubmit?: () => void;
}

const VerificationStatus: React.FC<Props> = ({ status, rejectionReason, businessName, onLogout, onResubmit }) => {
  const [document, setDocument] = useState<File | null>(null);
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [resubmitted, setResubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFirstSubmit = status === 'none';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowed.includes(file.type)) { setUploadError('Only JPG, PNG, or PDF files are accepted.'); return; }
    if (file.size > 5 * 1024 * 1024) { setUploadError('File must be smaller than 5MB.'); return; }
    setUploadError('');
    setDocument(file);
  };

  const handleSubmitDocument = async () => {
    if (!document) return;
    if (isFirstSubmit) {
      if (!businessAddress.trim()) { setUploadError('Business address is required.'); return; }
      if (!businessPhone.trim()) { setUploadError('Business phone / contact number is required.'); return; }
    }
    setUploading(true);
    setUploadError('');
    try {
      const session = localStorage.getItem('kawayan_session');
      const userId = session ? JSON.parse(session).id : null;
      const token = localStorage.getItem('kawayan_jwt');
      if (!userId || !token) throw new Error('Not authenticated');

      const formData = new FormData();
      formData.append('userId', userId);
      formData.append('document', document);
      if (isFirstSubmit) {
        formData.append('businessAddress', businessAddress.trim());
        formData.append('businessPhone', businessPhone.trim());
      }

      const endpoint = isFirstSubmit ? '/api/verification/submit' : '/api/verification/resubmit';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }

      setResubmitted(true);
      setDocument(null);
      if (onResubmit) onResubmit();
    } catch (err: any) {
      setUploadError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const statusConfig = {
    pending: {
      icon: <Clock className="w-7 h-7" />,
      iconBg: 'rgba(245,158,11,0.12)',
      iconColor: '#D97706',
      accentBar: '#F59E0B',
      title: 'Verification Pending',
      body: 'Your document is under review by our admin team. This usually takes 1–2 business days.',
      badgeBg: 'rgba(245,158,11,0.1)',
      badgeColor: '#B45309',
      badgeText: 'Under Review',
    },
    verified: {
      icon: <CheckCircle className="w-7 h-7" />,
      iconBg: 'rgba(34,197,94,0.1)',
      iconColor: '#16A34A',
      accentBar: '#22C55E',
      title: 'Business Verified',
      body: 'Your business has been verified. You now have full access to Kawayan AI.',
      badgeBg: 'rgba(34,197,94,0.1)',
      badgeColor: '#15803D',
      badgeText: 'Verified',
    },
    rejected: {
      icon: <XCircle className="w-7 h-7" />,
      iconBg: 'rgba(239,68,68,0.1)',
      iconColor: '#DC2626',
      accentBar: '#EF4444',
      title: 'Verification Failed',
      body: "Your submitted document was not accepted. Please upload a valid business registration document (Mayor's Permit, DTI, or SEC Registration).",
      badgeBg: 'rgba(239,68,68,0.1)',
      badgeColor: '#B91C1C',
      badgeText: 'Not Approved',
    },
    none: {
      icon: <Shield className="w-7 h-7" />,
      iconBg: 'rgba(43,87,72,0.1)',
      iconColor: '#2B5748',
      accentBar: '#2B5748',
      title: 'Verification Required',
      body: 'Please submit your business registration document to unlock full access to Kawayan AI.',
      badgeBg: 'rgba(43,87,72,0.09)',
      badgeColor: '#2B5748',
      badgeText: 'Action Needed',
    },
  };

  const cfg = statusConfig[status] ?? statusConfig.none;

  const inputClass = `
    w-full px-4 py-3 rounded-xl border text-sm
    bg-white/70 dark:bg-[#111E18]/60
    border-[#2B5748]/15 dark:border-[#9CB080]/15
    text-[#1A2B26] dark:text-[#E8F0EC]
    placeholder-[#1A2B26]/35 dark:placeholder-[#E8F0EC]/25
    focus:outline-none focus:border-[#2B5748] dark:focus:border-[#9CB080]
    transition-all duration-200
  `.trim();

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      {/* Background blobs */}
      <div className="fixed top-[5%] right-[5%] w-[400px] h-[400px] rounded-full opacity-[0.05] blur-[80px] pointer-events-none"
        style={{ background: cfg.accentBar }} />
      <div className="fixed bottom-[5%] left-[5%] w-[300px] h-[300px] rounded-full opacity-[0.04] blur-[70px] bg-[#2B5748] pointer-events-none" />

      <div className="w-full max-w-md animate-scale-in">
        {/* Kawayan brand header */}
        <div className="flex items-center justify-center gap-2 mb-7">
          <img src="/logo.png" alt="Kawayan" className="w-8 h-8 rounded-xl opacity-80" />
          <span className="font-display text-lg font-bold" style={{ color: 'var(--fg)' }}>
            Kawayan<span style={{ color: 'var(--kw-green)' }}>.</span>
          </span>
        </div>

        {/* Main card */}
        <div className="glass-card overflow-hidden">
          {/* Accent top bar */}
          <div className="h-1" style={{ background: `linear-gradient(90deg, ${cfg.accentBar}, ${cfg.accentBar}88)` }} />

          <div className="p-7 text-center">
            {/* Status icon */}
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: cfg.iconBg }}>
              <span style={{ color: cfg.iconColor }}>{cfg.icon}</span>
            </div>

            {/* Status badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4"
              style={{ background: cfg.badgeBg, color: cfg.badgeColor }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: cfg.accentBar }} />
              {cfg.badgeText}
            </div>

            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--fg)' }}>{cfg.title}</h2>

            {businessName && (
              <p className="text-sm font-semibold mb-2" style={{ color: cfg.iconColor }}>{businessName}</p>
            )}

            <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--fg-muted)' }}>{cfg.body}</p>

            {/* Rejection reason */}
            {status === 'rejected' && rejectionReason && (
              <div className="text-left p-3.5 rounded-xl mb-5"
                style={{ background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.16)' }}>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#B91C1C' }}>Admin Note:</p>
                <p className="text-xs" style={{ color: '#C0392B' }}>{rejectionReason}</p>
              </div>
            )}

            {/* Resubmit UI */}
            {(status === 'rejected' || status === 'none') && !resubmitted && (
              <div className="text-left space-y-3.5 mb-5">
                <div className="h-px" style={{ background: 'var(--border)' }} />

                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--fg-subtle)' }}>
                  {isFirstSubmit ? 'Submit Verification' : 'Upload New Document'}
                </p>

                {isFirstSubmit && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--fg-subtle)' }}>
                        Business Address
                      </label>
                      <input
                        type="text"
                        value={businessAddress}
                        onChange={(e) => setBusinessAddress(e.target.value)}
                        placeholder="e.g. 123 Rizal St, Quezon City"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--fg-subtle)' }}>
                        Contact Number
                      </label>
                      <input
                        type="tel"
                        value={businessPhone}
                        onChange={(e) => setBusinessPhone(e.target.value)}
                        placeholder="e.g. 09171234567"
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}

                <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
                  Mayor's Permit, DTI, or SEC Registration (JPG, PNG, PDF — max 5MB)
                </p>

                {document ? (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(43,87,72,0.06)', border: '1px solid rgba(43,87,72,0.15)' }}>
                    <FileText className="w-4 h-4 shrink-0 text-[#2B5748]" />
                    <span className="text-sm flex-1 truncate font-medium" style={{ color: 'var(--fg)' }}>{document.name}</span>
                    <button type="button"
                      onClick={() => { setDocument(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="p-1 rounded-lg transition"
                      style={{ color: 'var(--fg-muted)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-5 rounded-xl border-2 border-dashed flex flex-col items-center gap-2 transition-all group"
                    style={{ borderColor: 'rgba(43,87,72,0.2)' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#2B5748'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(43,87,72,0.2)'}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(43,87,72,0.08)' }}>
                      <Upload className="w-4 h-4 text-[#2B5748]/60 group-hover:text-[#2B5748] transition-colors" />
                    </div>
                    <span className="text-xs font-semibold group-hover:text-[#2B5748] transition-colors"
                      style={{ color: 'var(--fg-subtle)' }}>
                      Click to upload document
                    </span>
                  </button>
                )}

                <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={handleFileChange} />

                {uploadError && (
                  <p className="text-xs font-medium" style={{ color: '#C0392B' }}>{uploadError}</p>
                )}

                {document && (
                  <button
                    onClick={handleSubmitDocument}
                    disabled={uploading}
                    className="w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #2B5748, #3A7362)', boxShadow: '0 4px 16px -4px rgba(43,87,72,0.35)' }}
                    onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
                  >
                    {uploading ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Submitting...</>
                    ) : isFirstSubmit ? (
                      <><ArrowRight className="w-4 h-4" /> Submit for Review</>
                    ) : (
                      <><ArrowRight className="w-4 h-4" /> Resubmit for Review</>
                    )}
                  </button>
                )}
              </div>
            )}

            {resubmitted && (
              <div className="flex items-center gap-2.5 justify-center p-4 rounded-xl mb-5"
                style={{ background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Document submitted — now pending review.
                </span>
              </div>
            )}

            {status === 'pending' && (
              <div className="flex items-center gap-2.5 justify-center p-4 rounded-xl mb-5"
                style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <Clock className="w-4 h-4 animate-pulse text-amber-600" />
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  You'll receive access once our admin reviews your document.
                </span>
              </div>
            )}

            <button
              onClick={onLogout}
              className="flex items-center gap-2 mx-auto text-xs font-semibold transition-colors"
              style={{ color: 'var(--fg-subtle)' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#C0392B'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--fg-subtle)'; }}
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerificationStatus;
