import React, { useRef, useState, useEffect } from 'react';
import { X, ArrowRight } from 'lucide-react';
import {
  TERMS_SECTIONS, TOS_VERSION, TOS_EFFECTIVE_DATE,
  PRIVACY_SECTIONS, PRIVACY_EFFECTIVE_DATE,
} from '../constants/termsOfService';

type LegalDoc = 'terms' | 'privacy';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Which document to show. Defaults to the Terms of Service. */
  doc?: LegalDoc;
  /** When true, user must scroll to bottom before "I Agree" is enabled (registration flow) */
  requireScrollToAccept?: boolean;
  onAccept?: () => void;
  /** Lets the footer link jump to the other document without opening a new tab. */
  onSwitchDoc?: (doc: LegalDoc) => void;
}

const TermsOfServiceModal: React.FC<Props> = ({
  open,
  onClose,
  doc = 'terms',
  requireScrollToAccept = false,
  onAccept,
  onSwitchDoc,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(!requireScrollToAccept);

  const isPrivacy = doc === 'privacy';
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;
  const title = isPrivacy ? 'Privacy Policy' : 'Terms of Service';
  const meta = isPrivacy
    ? `Kawayan AI · Effective ${PRIVACY_EFFECTIVE_DATE}`
    : `Kawayan AI · Version ${TOS_VERSION} · Effective ${TOS_EFFECTIVE_DATE}`;
  const gateAccept = requireScrollToAccept && !isPrivacy;

  useEffect(() => {
    if (open) {
      setHasScrolledToEnd(!gateAccept);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }
  }, [open, doc, gateAccept]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || !gateAccept) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) setHasScrolledToEnd(true);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6"
      style={{ background: 'rgba(16,26,22,0.55)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--r-xl)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <div style={{ height: 3, background: 'var(--kw-green)' }} className="shrink-0" />

        {/* Header */}
        <header className="flex items-start justify-between gap-3 px-6 py-5 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 id="legal-title" className="font-display" style={{ fontSize: '1.3rem', fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.015em' }}>
              {title}
            </h2>
            <p className="mt-1" style={{ fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--fg-subtle)' }}>
              {meta}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: 'var(--fg-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-alt)'; e.currentTarget.style.color = 'var(--fg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--fg-muted)'; }}
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Body */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-5"
          style={{ color: 'var(--fg-muted)', fontSize: '0.88rem', lineHeight: 1.65 }}
        >
          <p
            className="mb-5 pl-3"
            style={{ borderLeft: '2px solid var(--kw-sage)', fontStyle: 'italic', fontSize: '0.82rem', color: 'var(--fg-subtle)' }}
          >
            {isPrivacy
              ? 'How Kawayan AI collects, uses and protects your business data on the platform.'
              : 'These terms align with the Kawayan AI Capstone research: an intelligent content generation and scheduling platform for Philippine MSME digital visibility.'}
          </p>

          <div className="space-y-4">
            {sections.map((section) => (
              <section key={section.title}>
                <h3 className="mb-1" style={{ fontWeight: 700, color: 'var(--fg)', fontSize: '0.86rem' }}>{section.title}</h3>
                <p>{section.body}</p>
              </section>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="px-6 py-4 shrink-0 space-y-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-alt)' }}>
          {gateAccept && !hasScrolledToEnd && (
            <p className="text-center" style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--warning)' }}>
              Scroll to the bottom to enable acceptance
            </p>
          )}

          <div className="flex gap-2.5">
            <button type="button" onClick={onClose} className="btn btn-outline flex-1">
              {onAccept ? 'Cancel' : 'Close'}
            </button>
            {onAccept && (
              <button
                type="button"
                disabled={gateAccept && !hasScrolledToEnd}
                onClick={() => { onAccept(); onClose(); }}
                className="btn btn-primary flex-1"
              >
                I agree <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {onSwitchDoc && (
            <p className="text-center" style={{ fontSize: '0.75rem', color: 'var(--fg-subtle)' }}>
              {isPrivacy ? 'Also read the ' : 'Also read the '}
              <button
                type="button"
                onClick={() => onSwitchDoc(isPrivacy ? 'terms' : 'privacy')}
                style={{ color: 'var(--fg)', fontWeight: 650, textDecoration: 'underline', textUnderlineOffset: 2, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}
              >
                {isPrivacy ? 'Terms of Service' : 'Privacy Policy'}
              </button>
            </p>
          )}
        </footer>
      </div>
    </div>
  );
};

export default TermsOfServiceModal;
