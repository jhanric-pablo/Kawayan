import React, { useRef, useState } from 'react';
import { Clock, CheckCircle, XCircle, Upload, FileText, X, RefreshCw, LogOut } from 'lucide-react';
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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [resubmitted, setResubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowed.includes(file.type)) { setUploadError('Only JPG, PNG, or PDF files are accepted.'); return; }
    if (file.size > 5 * 1024 * 1024) { setUploadError('File must be smaller than 5MB.'); return; }
    setUploadError('');
    setDocument(file);
  };

  const handleResubmit = async () => {
    if (!document) return;
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

      const res = await fetch('/api/verification/resubmit', {
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
      icon: <Clock className="w-10 h-10" style={{ color: '#F59E0B' }} />,
      bg: 'rgba(245,158,11,0.08)',
      border: 'rgba(245,158,11,0.2)',
      title: 'Verification Pending',
      titleColor: '#B45309',
      body: 'Your business registration document has been submitted and is currently under review by our admin team. This usually takes 1–2 business days.',
    },
    verified: {
      icon: <CheckCircle className="w-10 h-10" style={{ color: '#22C55E' }} />,
      bg: 'rgba(34,197,94,0.08)',
      border: 'rgba(34,197,94,0.2)',
      title: 'Business Verified!',
      titleColor: '#15803D',
      body: 'Your business has been verified. You now have full access to Kawayan AI.',
    },
    rejected: {
      icon: <XCircle className="w-10 h-10" style={{ color: '#EF4444' }} />,
      bg: 'rgba(239,68,68,0.08)',
      border: 'rgba(239,68,68,0.2)',
      title: 'Verification Failed',
      titleColor: '#B91C1C',
      body: 'Your submitted document was not accepted. Please upload a valid business registration document (Mayor\'s Permit, DTI, or SEC Registration).',
    },
    none: {
      icon: <Clock className="w-10 h-10 text-slate-300" />,
      bg: 'rgba(100,116,139,0.08)',
      border: 'rgba(100,116,139,0.2)',
      title: 'Verification Required',
      titleColor: '#475569',
      body: 'Please submit your business registration document to access Kawayan AI features.',
    },
  };

  const cfg = statusConfig[status] ?? statusConfig.none;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Card */}
        <div
          className="rounded-[2.5rem] rounded-tl-[4.5rem] rounded-br-[4.5rem] border p-8 text-center relative overflow-hidden bg-white/90 dark:bg-[#0F172A]"
          style={{ borderColor: cfg.border, boxShadow: '0 16px 48px -12px rgba(0, 82, 255,0.1)' }}
        >
          {/* Kawayan brand bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#0052FF]" />

          <div className="flex justify-center mb-5 mt-2">{cfg.icon}</div>

          <h2 className="font-display text-2xl mb-2" style={{ color: cfg.titleColor }}>{cfg.title}</h2>

          {businessName && (
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">{businessName}</p>
          )}

          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">{cfg.body}</p>

          {/* Rejection reason */}
          {status === 'rejected' && rejectionReason && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-3 mb-5 text-left">
              <p className="text-xs font-bold text-red-600 dark:text-red-400 mb-1">Admin Note:</p>
              <p className="text-xs text-red-500 dark:text-red-300">{rejectionReason}</p>
            </div>
          )}

          {/* Resubmit — shown for rejected (and none) */}
          {(status === 'rejected' || status === 'none') && !resubmitted && (
            <div className="text-left space-y-3 mb-5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Upload New Document
              </p>
              <p className="text-xs text-slate-400">Mayor's Permit, DTI, or SEC Registration (JPG, PNG, or PDF — max 5MB)</p>

              {document ? (
                <div className="flex items-center gap-3 p-3 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
                  <FileText className="w-4 h-4 shrink-0" style={{ color: '#0052FF' }} />
                  <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 truncate">{document.name}</span>
                  <button type="button" onClick={() => { setDocument(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}><X className="w-3.5 h-3.5 text-slate-400" /></button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 rounded-full border-2 border-dashed border-slate-200 dark:border-[#4D7CFF]/20 flex flex-col items-center gap-2 hover:border-[#0052FF] transition-colors group"
                >
                  <Upload className="w-5 h-5 text-slate-300 group-hover:text-[#0052FF] transition-colors" />
                  <span className="text-xs text-slate-400 group-hover:text-[#0052FF] font-medium">Click to upload</span>
                </button>
              )}

              <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={handleFileChange} />

              {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}

              {document && (
                <button
                  onClick={handleResubmit}
                  disabled={uploading}
                  className="w-full py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-50 bg-[#0052FF]"
                  style={{ boxShadow: '0 4px 16px -4px rgba(0, 82, 255,0.35)' }}
                >
                  {uploading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Submitting...</> : 'Resubmit for Review'}
                </button>
              )}
            </div>
          )}

          {resubmitted && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl p-4 mb-5">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2 justify-center">
                <Clock className="w-4 h-4" /> Document resubmitted — now pending review.
              </p>
            </div>
          )}

          {status === 'pending' && (
            <div className="flex items-center justify-center gap-2 text-amber-600 text-xs bg-amber-50 dark:bg-amber-900/20 rounded-xl py-3 px-4 mb-5">
              <Clock className="w-4 h-4 shrink-0 animate-pulse" />
              <span>You'll receive access once our admin reviews your document.</span>
            </div>
          )}

          <button
            onClick={onLogout}
            className="flex items-center gap-2 mx-auto text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition font-medium"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerificationStatus;
