import React, { useRef, useState, useEffect } from 'react';
import { X, FileText, CheckCircle } from 'lucide-react';
import { TERMS_SECTIONS, TOS_VERSION, TOS_EFFECTIVE_DATE } from '../constants/termsOfService';

interface Props {
  open: boolean;
  onClose: () => void;
  /** When true, user must scroll to bottom before "I Agree" is enabled (registration flow) */
  requireScrollToAccept?: boolean;
  onAccept?: () => void;
}

const TermsOfServiceModal: React.FC<Props> = ({
  open,
  onClose,
  requireScrollToAccept = false,
  onAccept,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(!requireScrollToAccept);

  useEffect(() => {
    if (open) {
      setHasScrolledToEnd(!requireScrollToAccept);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }
  }, [open, requireScrollToAccept]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || !requireScrollToAccept) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (atBottom) setHasScrolledToEnd(true);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-[#273338] w-full max-w-lg max-h-[90vh] rounded-[2rem] border border-[#2B5748]/20 shadow-2xl flex flex-col overflow-hidden"
        role="dialog"
        aria-labelledby="tos-title"
        aria-modal="true"
      >
        <div className="h-1.5 w-full bg-[#2B5748] shrink-0" />
        <div className="p-5 border-b border-slate-100 dark:border-[#9CB080]/20 flex justify-between items-start gap-3 shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-[#2B5748]/10">
              <FileText className="w-5 h-5 text-[#2B5748]" />
            </div>
            <div>
              <h2 id="tos-title" className="font-display text-lg text-slate-800 dark:text-white">
                Terms of Service
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Kawayan AI · Version {TOS_VERSION} · Effective {TOS_EFFECTIVE_DATE}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-[#2B5748]/30 transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed"
        >
          <p className="text-xs text-slate-500 dark:text-slate-400 italic border-l-2 border-[#9CB080] pl-3">
            These terms align with the Kawayan AI Capstone research: an intelligent content generation
            and scheduling platform for Philippine MSME digital visibility.
          </p>
          {TERMS_SECTIONS.map((section) => (
            <section key={section.title}>
              <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1.5">{section.title}</h3>
              <p className="text-xs sm:text-sm">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-[#9CB080]/20 bg-slate-50/80 dark:bg-[#1a2420]/50 shrink-0 space-y-3">
          {requireScrollToAccept && !hasScrolledToEnd && (
            <p className="text-[11px] text-center text-amber-600 dark:text-amber-400 font-medium">
              Scroll to the bottom to enable acceptance
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-full text-sm font-bold text-slate-500 border border-slate-200 dark:border-[#9CB080]/20 hover:bg-white dark:hover:bg-[#273338] transition"
            >
              {onAccept ? 'Cancel' : 'Close'}
            </button>
            {onAccept && (
              <button
                type="button"
                disabled={!hasScrolledToEnd}
                onClick={() => {
                  onAccept();
                  onClose();
                }}
                className="flex-1 py-2.5 rounded-full text-sm font-bold text-white bg-[#2B5748] hover:scale-[1.02] active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" /> I Agree
              </button>
            )}
          </div>
          <p className="text-[10px] text-center text-slate-400">
            Also see{' '}
            <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="text-[#2B5748] underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServiceModal;
