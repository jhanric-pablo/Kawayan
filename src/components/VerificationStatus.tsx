import React, { useEffect, useRef, useState } from 'react';
import {
  Clock, CheckCircle, XCircle, Upload, FileText, X, RefreshCw, LogOut,
  Shield, ArrowRight, Check, Sparkles, Send, LifeBuoy, Lock,
} from 'lucide-react';
import { VerificationStatus as VStatus } from '../types';
import { getStoredToken, getStoredUserId, isAuthResponse } from '../utils/authSession';
import { supportRealtime } from '../services/supportRealtime';
import './onboarding.css';
import KawayanLogo from './KawayanLogo';
import { HELP_EVENT } from '../utils/usePhone';

interface Props {
  userId?: string;
  status: VStatus;
  rejectionReason?: string;
  businessName?: string;
  onLogout: () => void;
  onResubmit?: () => void;
  onSessionExpired?: () => void;
  /** Fired after the on-screen approval animation so the parent can route on. */
  onVerified?: () => void;
  /** "Review your Brand DNA" while waiting (allowed before approval). */
  onOpenBrandDna?: () => void;
}

type MetaKey = 'pending' | 'verified' | 'rejected' | 'none';

const META: Record<MetaKey, {
  accent: string;
  icon: React.ReactNode;
  badge: string;
  title: string;
  body: string;
}> = {
  pending: {
    accent: 'var(--amber)',
    icon: <Clock />,
    badge: 'Under Review',
    title: 'Verification in progress',
    body: "Our team is reviewing your business documents. This usually takes 1–2 business days — you don't need to keep this page open, we'll let you in automatically.",
  },
  verified: {
    accent: 'var(--success)',
    icon: <CheckCircle />,
    badge: 'Verified',
    title: 'Business verified',
    body: 'Your business has been verified. You now have full access to the Kawayan AI workspace.',
  },
  rejected: {
    accent: 'var(--danger)',
    icon: <XCircle />,
    badge: 'Action needed',
    title: "We couldn't verify this yet",
    body: "The document submitted wasn't accepted. Upload a valid business registration — Mayor's Permit, DTI, or SEC Registration — to try again.",
  },
  none: {
    accent: 'var(--primary)',
    icon: <Shield />,
    badge: 'Verification required',
    title: 'Verify your business',
    body: 'Submit your business registration document to unlock the full Kawayan AI workspace.',
  },
};

const VerificationStatus: React.FC<Props> = ({
  userId: userIdProp,
  status,
  rejectionReason,
  businessName,
  onLogout,
  onResubmit,
  onSessionExpired,
  onVerified,
  onOpenBrandDna,
}) => {
  const [document, setDocument] = useState<File | null>(null);
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [resubmitted, setResubmitted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [approved, setApproved] = useState(status === 'verified');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFirstSubmit = status === 'none';
  // The file on record (from the status check), for the "uploaded file" row.
  const [onFile, setOnFile] = useState<{ name?: string; at?: string } | null>(null);

  // ── real-time approval: react to the parent prop flipping to "verified" ──
  useEffect(() => {
    if (status === 'verified') setApproved(true);
  }, [status]);

  // ── real-time approval: component-level socket + polling fallback ──
  const shouldWatch = !approved && (status === 'pending' || status === 'rejected');
  useEffect(() => {
    if (!shouldWatch) return;
    let cancelled = false;

    const check = async () => {
      const uid = userIdProp || getStoredUserId();
      const token = getStoredToken();
      if (!uid || !token) return;
      try {
        const res = await fetch(`/api/verification/status/${uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (isAuthResponse(res.status)) { onSessionExpired?.(); return; }
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!cancelled && data?.documentName) setOnFile({ name: data.documentName, at: data.createdAt });
        if (!cancelled && data?.status === 'verified') setApproved(true);
      } catch {
        /* network hiccup — the next tick will retry */
      }
    };

    supportRealtime.connect();
    const unsub = supportRealtime.onVerificationUpdated(check);
    const iv = window.setInterval(check, 15000);
    check();

    return () => { cancelled = true; unsub(); window.clearInterval(iv); };
  }, [shouldWatch, userIdProp, onSessionExpired]);

  // ── hand back to the parent once the celebration has played ──
  const onVerifiedRef = useRef(onVerified);
  useEffect(() => { onVerifiedRef.current = onVerified; });
  useEffect(() => {
    if (!approved) return;
    const t = window.setTimeout(() => {
      if (onVerifiedRef.current) onVerifiedRef.current();
      else window.location.reload();
    }, 2600);
    return () => window.clearTimeout(t);
  }, [approved]);

  const validateAndSetFile = (file: File | undefined | null) => {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowed.includes(file.type)) { setUploadError('Only JPG, PNG, or PDF files are accepted.'); return; }
    if (file.size > 5 * 1024 * 1024) { setUploadError('File must be smaller than 5MB.'); return; }
    setUploadError('');
    setDocument(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndSetFile(e.target.files?.[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    validateAndSetFile(e.dataTransfer.files?.[0]);
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
      const userId = userIdProp || getStoredUserId();
      const token = getStoredToken();

      if (!userId || !token) {
        setUploadError('Your session has expired. Please sign out and sign in again.');
        onSessionExpired?.();
        return;
      }

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

      if (isAuthResponse(res.status)) {
        setUploadError('Your session has expired. Please sign out and sign in again.');
        onSessionExpired?.();
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
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

  const fmtSize = (bytes: number) =>
    bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

  const Brand = (
    <div className="ob-brand">
      <KawayanLogo size={17} />
    </div>
  );

  // ═══════════════════ Approval celebration ═══════════════════
  if (approved) {
    return (
      <div className="ob-screen" style={{ ['--vs-accent' as any]: 'var(--success)' }}>
        <div className="ob-orb ob-orb--1" />
        <div className="ob-orb ob-orb--2" />
        <div className="ob-inner vs-inner">
          {Brand}
          <div className="vs-card">
            <div className="vs-card__accent" style={{ background: 'var(--success)' }} />
            <div className="vs-celebrate">
              <div className="vs-burst">
                <span className="vs-burst__ring" />
                <span className="vs-burst__check"><CheckCircle /></span>
                <i /><i /><i /><i /><i /><i />
              </div>
              <h2>You&apos;re verified!</h2>
              <p>
                {businessName ? <><strong>{businessName}</strong> is approved. </> : 'Your business is approved. '}
                Taking you to your workspace&hellip;
              </p>
              <div className="vs-proceed"><b /></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const meta = META[(status as MetaKey)] ?? META.none;
  const showForm = (status === 'rejected' || status === 'none') && !resubmitted;

  // review timeline states
  const tl: { label: string; state: 'done' | 'current' | 'todo' | 'fail'; icon: React.ReactNode }[] =
    status === 'rejected'
      ? [
          { label: 'Submitted', state: 'done', icon: <Check /> },
          { label: 'Reviewed', state: 'done', icon: <Check /> },
          { label: 'Not approved', state: 'fail', icon: <X /> },
        ]
      : [
          { label: 'Submitted', state: 'done', icon: <Check /> },
          { label: 'Under review', state: 'current', icon: <Clock /> },
          { label: 'Approved', state: 'todo', icon: <Sparkles /> },
        ];

  const replacing = status === 'pending' && !!document; // a new file picked to replace the one under review
  const TITLE: Record<MetaKey, string> = {
    pending: 'We’re checking your business permit.',
    rejected: 'We couldn’t verify this yet.',
    none: 'Verify your business.',
    verified: 'Business verified',
  };
  const LINE: Record<MetaKey, string> = {
    pending: 'Usually 1–2 business days. This page updates by itself.',
    rejected: 'Upload a clear Mayor’s Permit, DTI or SEC registration to try again. This page updates by itself.',
    none: 'Upload your Mayor’s Permit, DTI or SEC registration to unlock your workspace.',
    verified: '',
  };
  const key = ((status as MetaKey) in META ? status : 'none') as MetaKey;
  const badgeClass = key === 'pending' ? 'badge-amber' : key === 'rejected' ? 'badge-red' : 'badge-sage';
  const uploadedOn = onFile?.at ? new Date(onFile.at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : null;

  const fileInput = (
    <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={handleFileChange} />
  );

  return (
    <div className="ob-screen vs-screen">
      <div className="ob-inner vs-split">
        {/* ── Status ── */}
        <section className="vs-status card" aria-labelledby="vs-title">
          <span className={`badge ${badgeClass} self-start`}><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />{key === 'pending' ? 'Under review' : meta.badge}</span>
          <div>
            <h1 id="vs-title" className="vs-status__title">{TITLE[key]}</h1>
            {businessName && <p className="vs-status__biz">{businessName}</p>}
            <p className="vs-status__line">{resubmitted ? 'Document submitted. Your account is now pending review. This page updates by itself.' : LINE[key]}</p>
          </div>

          {(status === 'pending' || status === 'rejected') && (
            <ol className="vs-steps" aria-label="Verification progress">
              {tl.map((st) => (
                <li key={st.label} className={`vs-steps__s is-${st.state}`} aria-current={st.state === 'current' ? 'step' : undefined}>
                  <span className="vs-steps__dot">{st.state === 'done' ? <Check /> : st.state === 'fail' ? <X /> : null}</span>
                  <span>{st.label}</span>
                </li>
              ))}
            </ol>
          )}

          {status === 'rejected' && rejectionReason && (
            <p className="kw-alert">
              <XCircle className="h-4 w-4 shrink-0" aria-hidden /> <span><b className="font-semibold">Reviewer’s note:</b> {rejectionReason}</span>
            </p>
          )}

          {/* The file under review, with Replace file */}
          {status === 'pending' && (
            <div className="vs-file">
              <FileText className="vs-file__ico" aria-hidden />
              <div className="vs-file__meta">
                <div className="vs-file__name">{replacing ? document!.name : onFile?.name || 'Your business permit'}</div>
                <div className="vs-file__size">{replacing ? `${fmtSize(document!.size)} · not sent yet` : uploadedOn ? `Uploaded ${uploadedOn}` : 'Under review'}</div>
              </div>
              {replacing ? (
                <>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setDocument(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>Cancel</button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleSubmitDocument} disabled={uploading}>
                    {uploading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {uploading ? 'Sending…' : 'Send instead'}
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" aria-hidden /> Replace file
                </button>
              )}
              {fileInput}
            </div>
          )}

          {/* First submission or after a send-back */}
          {showForm && (
            <div className="vs-form">
              {isFirstSubmit && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="vs-label" htmlFor="vs-addr">Business address</label>
                    <input id="vs-addr" type="text" className="input" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} placeholder="e.g. 123 Rizal St, Quezon City" />
                  </div>
                  <div>
                    <label className="vs-label" htmlFor="vs-phone">Contact number</label>
                    <input id="vs-phone" type="tel" className="input" value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} placeholder="e.g. 09171234567" />
                  </div>
                </div>
              )}
              {document ? (
                <div className="vs-file">
                  <FileText className="vs-file__ico" />
                  <div className="vs-file__meta">
                    <div className="vs-file__name">{document.name}</div>
                    <div className="vs-file__size">{fmtSize(document.size)}</div>
                  </div>
                  <button type="button" className="vs-file__x" aria-label="Remove file" onClick={() => { setDocument(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`vs-drop${dragging ? ' is-drag' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                >
                  <span className="vs-drop__ico"><Upload /></span>
                  <span className="vs-drop__t">Click to upload{dragging ? '' : ' or drag & drop'}</span>
                  <span className="vs-drop__s">Mayor’s Permit, DTI or SEC · JPG, PNG or PDF · max 5 MB</span>
                </button>
              )}
              {fileInput}
              {document && (
                <button onClick={handleSubmitDocument} disabled={uploading} className="btn btn-primary w-full">
                  {uploading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Submitting&hellip;</> : isFirstSubmit ? <><Send className="w-4 h-4" /> Submit for review</> : <><ArrowRight className="w-4 h-4" /> Resubmit for review</>}
                </button>
              )}
            </div>
          )}

          {uploadError && <p className="vs-err" role="alert">{uploadError}</p>}

          <button onClick={onLogout} className="vs-signout self-start">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </section>

        {/* ── While you wait ── */}
        <aside className="vs-wait" aria-labelledby="vs-wait-h">
          <h2 id="vs-wait-h" className="vs-wait__h">While you wait</h2>
          {onOpenBrandDna && (
            <button type="button" className="vs-wait__c is-primary" onClick={onOpenBrandDna}>
              <Sparkles aria-hidden />
              <span><b>Review your Brand DNA</b><span>Tell Kawayan how your shop sounds. Every caption follows it once you’re approved.</span></span>
              <ArrowRight className="vs-wait__go" aria-hidden />
            </button>
          )}
          <button type="button" className="vs-wait__c" onClick={() => window.dispatchEvent(new Event(HELP_EVENT))}>
            <LifeBuoy aria-hidden />
            <span><b>Help desk</b><span>Questions about your permit? A person replies there and by email.</span></span>
            <ArrowRight className="vs-wait__go" aria-hidden />
          </button>
          <div className="vs-wait__c is-locked" aria-disabled="true">
            <Lock aria-hidden />
            <span><b>Opens after approval</b><span>Calendar, month planner, Post studio and insights. Then connect your Facebook Page and Instagram.</span></span>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default VerificationStatus;
