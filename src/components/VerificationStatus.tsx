import React, { useEffect, useRef, useState } from 'react';
import {
  Clock, CheckCircle, XCircle, Upload, FileText, X, RefreshCw, LogOut,
  Shield, ArrowRight, Check, Sparkles, Send,
} from 'lucide-react';
import { VerificationStatus as VStatus } from '../types';
import { getStoredToken, getStoredUserId, isAuthResponse } from '../utils/authSession';
import { supportRealtime } from '../services/supportRealtime';
import './onboarding.css';

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
    accent: '#D97706',
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
      <img src="/logo.png" alt="Kawayan" />
      <span>Kawayan<span style={{ color: 'var(--kw-green)' }}>.</span></span>
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

  return (
    <div className="ob-screen" style={{ ['--vs-accent' as any]: meta.accent }}>
      <div className="ob-orb ob-orb--1" />
      <div className="ob-orb ob-orb--2" />

      <div className="ob-inner vs-inner">
        {Brand}

        <div className="vs-card">
          <div className="vs-card__accent" />

          <div className="vs-card__body">
            <div className={`vs-icon${status === 'pending' ? ' vs-icon--pulse' : ''}`}>{meta.icon}</div>

            <div className="vs-badge"><b />{meta.badge}</div>

            <h1 className="vs-title">{meta.title}</h1>
            {businessName && <p className="vs-biz">{businessName}</p>}
            <p className="vs-body">{meta.body}</p>

            {(status === 'pending' || status === 'rejected') && (
              <div className="vs-timeline">
                {tl.map((s) => (
                  <div
                    key={s.label}
                    className={`vs-tl__step ${
                      s.state === 'done' ? 'is-done' : s.state === 'current' ? 'is-current' : s.state === 'fail' ? 'is-fail' : ''
                    }`}
                  >
                    <span className="vs-tl__dot">{s.icon}</span>
                    <span className="vs-tl__label">{s.label}</span>
                  </div>
                ))}
              </div>
            )}

            {status === 'pending' && (
              <div className="vs-live"><b />Live &mdash; this page updates the moment you&apos;re approved</div>
            )}

            {/* Rejection note */}
            {status === 'rejected' && rejectionReason && (
              <div className="vs-note">
                <XCircle />
                <span><strong>Admin note:</strong> {rejectionReason}</span>
              </div>
            )}

            {/* Submit / resubmit form */}
            {showForm && (
              <div className="vs-form">
                <div className="vs-form__divider" />
                <p className="vs-form__head">{isFirstSubmit ? 'Submit verification' : 'Upload a new document'}</p>

                {isFirstSubmit && (
                  <>
                    <div>
                      <label className="vs-label">Business Address</label>
                      <input
                        type="text"
                        className="input"
                        value={businessAddress}
                        onChange={(e) => setBusinessAddress(e.target.value)}
                        placeholder="e.g. 123 Rizal St, Quezon City"
                      />
                    </div>
                    <div>
                      <label className="vs-label">Contact Number</label>
                      <input
                        type="tel"
                        className="input"
                        value={businessPhone}
                        onChange={(e) => setBusinessPhone(e.target.value)}
                        placeholder="e.g. 09171234567"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="vs-label">Registration Document</label>
                  <p className="vs-hint">Mayor&apos;s Permit, DTI, or SEC Registration — JPG, PNG or PDF, max 5MB</p>
                </div>

                {document ? (
                  <div className="vs-file">
                    <FileText className="vs-file__ico" />
                    <div className="vs-file__meta">
                      <div className="vs-file__name">{document.name}</div>
                      <div className="vs-file__size">{fmtSize(document.size)}</div>
                    </div>
                    <button
                      type="button"
                      className="vs-file__x"
                      aria-label="Remove file"
                      onClick={() => { setDocument(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    >
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
                    <span className="vs-drop__s">Your document is only shared with our verification team</span>
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {uploadError && <p className="vs-err">{uploadError}</p>}

                {document && (
                  <button onClick={handleSubmitDocument} disabled={uploading} className="btn btn-primary w-full">
                    {uploading ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Submitting&hellip;</>
                    ) : isFirstSubmit ? (
                      <><Send className="w-4 h-4" /> Submit for Review</>
                    ) : (
                      <><ArrowRight className="w-4 h-4" /> Resubmit for Review</>
                    )}
                  </button>
                )}
              </div>
            )}

            {resubmitted && (
              <div className="vs-note">
                <Clock />
                <span>Document submitted &mdash; your account is now pending review.</span>
              </div>
            )}

            {status === 'pending' && !resubmitted && (
              <div className="vs-note">
                <Shield />
                <span>You&apos;ll get full access the instant an admin approves your document. No need to refresh.</span>
              </div>
            )}

            <button onClick={onLogout} className="vs-signout">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerificationStatus;
