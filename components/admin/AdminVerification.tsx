import React, { useEffect, useState } from 'react';
import { Check, FileText, RefreshCw, Search, X } from 'lucide-react';
import clsx from 'clsx';
import { parseUtc, timeAgo } from '../../utils/adminJobs';

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
  /** A dialog (reject reason, confirm) is open: keys belong to it. */
  paused: boolean;
}

const TAG: Record<string, string> = {
  pending: 'border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
  verified: 'border-[var(--badge-border)] bg-[var(--badge-bg)] text-[var(--badge-text)]',
  rejected: 'border-red-300/70 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300',
};

const StatusTag: React.FC<{ status: string }> = ({ status }) => (
  <span className={clsx('inline-flex shrink-0 rounded-full border px-2 text-[11px] font-semibold capitalize leading-5', TAG[status] ?? TAG.pending)}>{status}</span>
);

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="rounded border border-[var(--border-strong)] px-1 font-mono text-[10px] font-semibold opacity-80">{children}</kbd>
);

const stamp = (iso?: string) => (iso ? parseUtc(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** Document review: the queue on the left, the selected submission and its document on the right. */
const AdminVerification: React.FC<Props> = ({ verifications, loading, filter, onFilter, selectedId, onSelect, onApprove, onReject, paused }) => {
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
    <div className="grid min-h-[calc(100vh-12rem)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-xs)] lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* Queue */}
      <aside className="flex min-h-0 flex-col border-b border-[var(--border)] lg:border-b-0 lg:border-r" aria-label="Submissions">
        <div className="space-y-2.5 border-b border-[var(--border)] p-3">
          <div className="adm-segment adm-segment--full" role="group" aria-label="Filter by status">
            {(['pending', 'verified', 'rejected', 'all'] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => onFilter(f)}
                className="capitalize"
              >
                {f} <span className="font-mono opacity-70">{counts(f)}</span>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-alt)] px-3 focus-within:border-[var(--primary)]">
            <Search className="h-3.5 w-3.5 shrink-0 text-[var(--fg-subtle)]" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Business, email or account ID"
              aria-label="Filter submissions"
              className="h-9 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--fg-subtle)]"
            />
          </label>
        </div>
        <ul className="max-h-[50vh] flex-1 divide-y divide-[var(--border)] overflow-y-auto lg:max-h-none">
          {loading && !verifications.length ? (
            <li className="px-3 py-6 text-center text-xs text-[var(--fg-muted)]">Loading submissions…</li>
          ) : list.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-[var(--fg-muted)]">No submissions here.</li>
          ) : (
            list.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => onSelect(v.id)}
                  aria-current={v.id === selectedId || undefined}
                  className={clsx(
                    'block w-full px-4 py-3 text-left hover:bg-[var(--bg-alt)]',
                    v.id === selectedId && 'bg-[var(--bg-alt)] shadow-[inset_2px_0_0_var(--primary)]',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{v.businessName || 'Unnamed business'}</span>
                    <StatusTag status={v.status} />
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-[var(--fg-muted)]">
                    <span className="min-w-0 flex-1 truncate">{v.email}</span>
                    <span className="shrink-0">{v.createdAt ? timeAgo(v.createdAt) : '—'}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="flex items-center gap-2 border-t border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--fg-subtle)]">
          <Kbd>↑↓</Kbd> move <Kbd>A</Kbd> approve <Kbd>R</Kbd> reject
        </p>
      </aside>

      {/* Inspector */}
      <section className="flex min-h-0 min-w-0 flex-col" aria-label="Submission details">
        {!selected ? (
          <p className="m-auto p-8 text-xs text-[var(--fg-muted)]">Select a submission to review.</p>
        ) : (
          <>
            <header className="flex items-start gap-3 border-b border-[var(--border)] px-5 py-4">
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-base font-bold">{selected.businessName || 'Unnamed business'}</h2>
                <p className="truncate font-mono text-[11px] text-[var(--fg-muted)]">{selected.email}</p>
              </div>
              <StatusTag status={selected.status} />
            </header>

            <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-b border-[var(--border)] px-5 py-3.5 text-xs sm:grid-cols-[96px_minmax(0,1fr)_96px_minmax(0,1fr)]">
              <dt className="text-[var(--fg-muted)]">Account ID</dt>
              <dd className="truncate font-mono text-[11px]">{selected.userId}</dd>
              <dt className="text-[var(--fg-muted)]">Phone</dt>
              <dd className="font-mono text-[11px]">{selected.businessPhone || '—'}</dd>
              <dt className="text-[var(--fg-muted)]">Address</dt>
              <dd className="sm:col-span-3">{selected.businessAddress || '—'}</dd>
              <dt className="text-[var(--fg-muted)]">Submitted</dt>
              <dd className="font-mono text-[11px]">{stamp(selected.createdAt)}</dd>
              <dt className="text-[var(--fg-muted)]">Reviewed</dt>
              <dd className="font-mono text-[11px]">{selected.status === 'pending' ? '—' : stamp(selected.reviewedAt)}</dd>
              <dt className="text-[var(--fg-muted)]">Document</dt>
              <dd className="flex min-w-0 items-center gap-1.5 sm:col-span-3">
                <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--fg-subtle)]" aria-hidden />
                <span className="truncate font-mono text-[11px]" title={selected.documentName}>{selected.documentName || '—'}</span>
                <span className="rounded border border-[var(--border-strong)] px-1 font-mono text-[10px] leading-4">{isPdf ? 'PDF' : 'IMAGE'}</span>
              </dd>
            </dl>

            {selected.status === 'rejected' && selected.rejectionReason && (
              <p className="border-b border-[var(--border)] bg-red-50 px-4 py-2 text-xs text-red-800 dark:bg-red-950/30 dark:text-red-200">
                <b className="font-semibold">Rejection reason:</b> {selected.rejectionReason}
              </p>
            )}

            <div className="grid min-h-[420px] flex-1 place-items-center bg-[var(--bg-alt)]">
              {doc.loading ? (
                <p className="text-xs text-[var(--fg-muted)]">Loading document…</p>
              ) : doc.error ? (
                <div className="text-center">
                  <p className="mb-2 text-xs text-[var(--fg-muted)]">{doc.error}</p>
                  <button type="button" onClick={() => setRetry((n) => n + 1)} className="btn btn-glass btn-sm">
                    <RefreshCw className="h-3.5 w-3.5" /> Retry
                  </button>
                </div>
              ) : doc.url && isPdf ? (
                <iframe src={doc.url} title="Submitted document" className="h-full min-h-[420px] w-full border-0" />
              ) : doc.url ? (
                <img src={doc.url} alt="Submitted document" className="max-h-[70vh] max-w-full object-contain" />
              ) : null}
            </div>

            {selected.status === 'pending' && (
              <footer className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-[var(--border)] bg-[var(--card)] px-5 py-3">
                <span className="mr-auto text-[11px] text-[var(--fg-muted)]">Approving gives the owner full access right away.</span>
                <button type="button" onClick={() => onReject(selected)} className="btn btn-danger btn-sm">
                  <X className="h-3.5 w-3.5" /> Reject <Kbd>R</Kbd>
                </button>
                <button type="button" onClick={() => onApprove(selected)} className="btn btn-primary btn-sm">
                  <Check className="h-3.5 w-3.5" /> Approve account <Kbd>A</Kbd>
                </button>
              </footer>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default AdminVerification;
