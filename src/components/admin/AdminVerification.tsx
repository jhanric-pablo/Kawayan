import React, { useEffect, useState } from 'react';
import { Check, ExternalLink, FileText, Maximize2, Minimize2, RefreshCw, Search, Undo2 } from 'lucide-react';
import clsx from 'clsx';
import { parseUtc, timeAgo } from '../../utils/adminJobs';
import KwSelect from '../ui/kw-select';

export type VerifFilter = 'all' | 'pending' | 'verified' | 'rejected';

interface Props {
  verifications: any[];
  loading: boolean;
  filter: VerifFilter;
  onFilter: (f: VerifFilter) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onApprove: (v: any) => void;
  onReject: (v: any) => void;
  /** Send back straight from the rail with the picked reason and note (the owner sees both). */
  onSendBack?: (v: any, reason: string) => Promise<void> | void;
  /** A dialog (reject reason, confirm) is open: keys belong to it. */
  paused: boolean;
}

const TAG: Record<string, string> = {
  pending: 'border-transparent bg-(--amber-soft) text-(--amber)',
  verified: 'border-transparent bg-(--green-soft) text-(--green-ink)',
  rejected: 'border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_7%,var(--card))] text-(--danger)',
};

const STATUS_LABEL: Record<string, string> = { pending: 'Pending', verified: 'Approved', rejected: 'Sent back' };
const FILTER_LABEL: Record<VerifFilter, string> = { pending: 'Pending', verified: 'Approved', rejected: 'Sent back', all: 'All' };

const StatusTag: React.FC<{ status: string }> = ({ status }) => (
  <span className={clsx('inline-flex h-[22px] shrink-0 items-center rounded-full border px-2 text-xs font-medium', TAG[status] ?? TAG.pending)}>{STATUS_LABEL[status] ?? status}</span>
);

/** A reviewer's checklist: an aid while looking at the document, not saved. */
const CHECKS = ['Business name matches', 'Owner name matches', 'Address matches sign-up', 'Not expired'];
const REASONS = ['Photo is blurry', 'Name doesn’t match', 'Address doesn’t match', 'Document expired', 'Wrong kind of document', 'Other'];

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="rounded border border-(--border-strong) px-1 font-mono text-xs font-semibold opacity-80">{children}</kbd>
);

const stamp = (iso?: string) => (iso ? parseUtc(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** Document review: the queue on the left, the selected submission and its document on the right. */
const AdminVerification: React.FC<Props> = ({ verifications, loading, filter, onFilter, selectedId, onSelect, onApprove, onReject, onSendBack, paused }) => {
  const [checks, setChecks] = useState<boolean[]>(CHECKS.map(() => false));
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [zoom, setZoom] = useState(false);
  // A fresh checklist and reason for each submission.
  useEffect(() => {
    setChecks(CHECKS.map(() => false));
    setReason('');
    setNote('');
    setZoom(false);
  }, [selectedId]);
  const sendBackText = [reason && reason !== 'Other' ? reason : '', note.trim()].filter(Boolean).join('. ');
  const sendBack = async () => {
    if (!selected || !sendBackText) return;
    if (!onSendBack) return onReject(selected);
    setSending(true);
    try {
      await onSendBack(selected, sendBackText);
    } finally {
      setSending(false);
    }
  };
  const [query, setQuery] = useState('');
  const [doc, setDoc] = useState<{ url: string | null; loading: boolean; error: string | null }>({ url: null, loading: false, error: null });
  const [retry, setRetry] = useState(0);

  const q = query.trim().toLowerCase();
  const list = verifications
    .filter((v) => filter === 'all' || v.status === filter)
    .filter((v) => !q || `${v.businessName} ${v.email} ${v.userId}`.toLowerCase().includes(q));
  const selected = verifications.find((v) => v.id === selectedId) ?? null;
  const isPdf = /\.pdf$/i.test(selected?.documentName || '');

  // The selected submission's document, loaded as an in-page preview.
  useEffect(() => {
    if (!selectedId) {
      setDoc({ url: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    let url: string | null = null;
    setDoc({ url: null, loading: true, error: null });
    (async () => {
      try {
        const token = localStorage.getItem('kawayan_jwt');
        const res = await fetch(`/api/admin/verifications/${selectedId}/document`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) throw new Error('load failed');
        const blob = await res.blob();
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setDoc({ url, loading: false, error: null });
      } catch {
        if (!cancelled) setDoc({ url: null, loading: false, error: 'Could not load this document.' });
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [selectedId, retry]);

  // ↑/↓ move through the queue; A approves and R rejects the pending submission in view.
  useEffect(() => {
    if (paused) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey || !list.length) return;
      const idx = list.findIndex((v) => v.id === selectedId);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const next = e.key === 'ArrowDown' ? Math.min(idx + 1, list.length - 1) : Math.max(idx - 1, 0);
        onSelect(list[idx < 0 ? 0 : next].id);
      } else if (selected?.status === 'pending' && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        onApprove(selected);
      } else if (selected?.status === 'pending' && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        onReject(selected);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const counts = (f: VerifFilter) => (f === 'all' ? verifications.length : verifications.filter((v) => v.status === f).length);

  return (
    <div className="grid min-h-[calc(100vh-12rem)] overflow-hidden rounded-2xl border border-(--border) bg-(--card) shadow-(--shadow-xs) lg:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)_320px]">
      {/* Queue */}
      <aside className="flex min-h-0 flex-col border-b border-(--border) lg:border-b-0 lg:border-r" aria-label="Submissions">
        <div className="space-y-2.5 border-b border-(--border) p-3">
          <div className="adm-segment adm-segment--full" role="group" aria-label="Filter by status">
            {(['pending', 'verified', 'rejected', 'all'] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => onFilter(f)}
              >
                {FILTER_LABEL[f]} {f !== 'all' && <span className="font-mono opacity-70">{counts(f)}</span>}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-(--border) bg-(--bg-alt) px-3 focus-within:border-(--green)">
            <Search className="h-3.5 w-3.5 shrink-0 text-(--fg-subtle)" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Business, email or account ID"
              aria-label="Filter submissions"
              className="h-9 min-w-0 flex-1 bg-transparent text-ui outline-hidden placeholder:text-(--fg-subtle)"
            />
          </label>
        </div>
        <ul className="max-h-[50vh] flex-1 divide-y divide-(--border) overflow-y-auto lg:max-h-none">
          {loading && !verifications.length ? (
            <li className="px-3 py-6 text-center text-xs text-(--fg-muted)">Loading submissions…</li>
          ) : list.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-(--fg-muted)">No submissions here.</li>
          ) : (
            list.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => onSelect(v.id)}
                  aria-current={v.id === selectedId || undefined}
                  className={clsx(
                    'block w-full px-4 py-3 text-left hover:bg-(--bg-alt)',
                    v.id === selectedId && 'bg-(--bg-alt) shadow-[inset_2px_0_0_var(--green)]',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{v.businessName || 'Unnamed business'}</span>
                    <StatusTag status={v.status} />
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 font-mono text-xs text-(--fg-muted)">
                    <span className="min-w-0 flex-1 truncate">{v.documentType || v.email}</span>
                    <span className="shrink-0">{v.createdAt ? timeAgo(v.createdAt) : '—'}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="flex items-center gap-2 border-t border-(--border) px-3 py-1.5 text-xs text-(--fg-subtle)">
          <Kbd>↑↓</Kbd> move <Kbd>A</Kbd> approve <Kbd>R</Kbd> send back
        </p>
      </aside>

      {/* Document viewer */}
      <section className="flex min-h-0 min-w-0 flex-col bg-(--muted)" aria-label="Document">
        {!selected ? (
          <p className="m-auto p-8 text-xs text-(--fg-muted)">Select a submission to review.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 px-5 pb-3 pt-4">
              <span className="flex min-w-0 flex-1 items-center gap-1.5 text-ui">
                <FileText className="h-4 w-4 shrink-0 text-(--fg-muted)" aria-hidden />
                <span className="truncate" title={selected.documentName}>{selected.documentName || 'Document'}</span>
                <span className="text-(--fg-muted)">· {isPdf ? 'PDF' : 'Image'}</span>
              </span>
              {!isPdf && doc.url && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setZoom((z) => !z)} aria-pressed={zoom}>
                  {zoom ? <Minimize2 className="h-3.5 w-3.5" aria-hidden /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden />} {zoom ? 'Fit' : 'Zoom'}
                </button>
              )}
              {doc.url && (
                <a className="btn btn-outline btn-sm" href={doc.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open
                </a>
              )}
            </div>
            <div className={clsx('mx-5 mb-5 grid min-h-[420px] flex-1 rounded-lg border border-(--border) bg-(--card)', zoom ? 'overflow-auto' : 'place-items-center overflow-hidden')}>
              {doc.loading ? (
                <p className="text-xs text-(--fg-muted)">Loading document…</p>
              ) : doc.error ? (
                <div className="text-center">
                  <p className="mb-2 text-xs text-(--fg-muted)">{doc.error}</p>
                  <button type="button" onClick={() => setRetry((n) => n + 1)} className="btn btn-outline btn-sm">
                    <RefreshCw className="h-3.5 w-3.5" /> Retry
                  </button>
                </div>
              ) : doc.url && isPdf ? (
                <iframe src={doc.url} title="Submitted document" className="h-full min-h-[420px] w-full rounded-lg border-0" />
              ) : doc.url ? (
                <img src={doc.url} alt="Submitted document" className={zoom ? 'max-w-none' : 'max-h-[70vh] max-w-full object-contain'} />
              ) : null}
            </div>
          </>
        )}
      </section>

      {/* Right rail: business, checks, send-back reason, decision */}
      {selected && (
        <aside className="flex min-w-0 flex-col border-t border-(--border) lg:col-span-2 lg:grid lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] lg:items-stretch lg:[&>*]:border-b-0 lg:[&>*]:content-start lg:[&>*+*]:border-l 2xl:col-span-1 2xl:flex 2xl:border-l 2xl:border-t-0 2xl:[&>*]:border-b 2xl:[&>*+*]:border-l-0" aria-label="Review">
          <div className="grid gap-1 border-b border-(--border) px-5 py-4">
            <div className="flex items-center gap-2">
              <h4 className="flex-1 text-xs font-medium text-(--fg-muted)">Business</h4>
              <StatusTag status={selected.status} />
            </div>
            <b className="text-[15px] font-semibold">{selected.businessName || 'Unnamed business'}</b>
            <span className="truncate font-mono text-xs text-(--fg-muted)">{selected.email}</span>
            <dl className="mt-2 grid grid-cols-[84px_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
              <dt className="text-(--fg-muted)">Phone</dt>
              <dd className="font-mono">{selected.businessPhone || '—'}</dd>
              <dt className="text-(--fg-muted)">Address</dt>
              <dd>{selected.businessAddress || '—'}</dd>
              <dt className="text-(--fg-muted)">Account ID</dt>
              <dd className="truncate font-mono">{selected.userId}</dd>
              <dt className="text-(--fg-muted)">Submitted</dt>
              <dd className="font-mono">{stamp(selected.createdAt)}</dd>
              <dt className="text-(--fg-muted)">Reviewed</dt>
              <dd className="font-mono">{selected.status === 'pending' ? '—' : stamp(selected.reviewedAt)}</dd>
            </dl>
          </div>

          {selected.status === 'rejected' && selected.rejectionReason && (
            <p className="border-b border-(--border) bg-[color-mix(in_srgb,var(--danger)_7%,var(--card))] px-5 py-2.5 text-xs text-(--danger)">
              <b className="font-semibold">Sent back:</b> {selected.rejectionReason}
            </p>
          )}

          {selected.status === 'pending' && (
            <>
              <fieldset className="grid gap-2 border-b border-(--border) px-5 py-4">
                <legend className="mb-2 text-xs font-medium text-(--fg-muted)">Checks <span className="font-normal">(for you, not saved)</span></legend>
                {CHECKS.map((c, i) => (
                  <label key={c} className="kw-check text-ui">
                    <input type="checkbox" checked={checks[i]} onChange={(e) => setChecks((list) => list.map((x, j) => (j === i ? e.target.checked : x)))} />
                    {c}
                  </label>
                ))}
              </fieldset>

              <div className="grid gap-2 border-b border-(--border) px-5 py-4">
                <label htmlFor="vf-reason" className="text-xs font-medium text-(--fg-muted)">If sending back</label>
                <KwSelect id="vf-reason" value={reason} onValueChange={setReason} placeholder="Pick a reason…" options={REASONS.map((r) => ({ value: r, label: r }))} />
                <textarea className="input min-h-16 resize-y" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the owner (optional)" aria-label="Note to the owner" maxLength={800} />
                <p className="text-xs text-(--fg-muted)">The owner sees the reason and note, so say what to fix.</p>
              </div>

              <div className="mt-auto grid gap-2 px-5 py-4">
                <button type="button" onClick={() => onApprove(selected)} className="btn btn-primary">
                  <Check className="h-4 w-4" aria-hidden /> Approve <Kbd>A</Kbd>
                </button>
                <button type="button" onClick={sendBack} disabled={!sendBackText || sending} className="btn btn-outline text-(--danger)" title={sendBackText ? undefined : 'Pick a reason or write a note first'}>
                  <Undo2 className="h-4 w-4" aria-hidden /> {sending ? 'Sending back…' : 'Send back'}
                </button>
                <p className="text-xs text-(--fg-muted)">Approving gives the owner full access right away.</p>
              </div>
            </>
          )}
        </aside>
      )}
    </div>
  );
};

export default AdminVerification;
