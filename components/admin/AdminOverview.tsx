import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { ArrowRight, ArrowUpRight, Loader2, ScrollText, Stethoscope, X } from 'lucide-react';
import clsx from 'clsx';
import { AuditLog, DispatchJob, JobStatus, buildJobs, parseUtc, timeAgo } from '../../utils/adminJobs';

export interface HealthInfo {
  status: 'checking' | 'ok' | 'db-down' | 'api-down';
  /** Round trip of the last /api/health call (API + database check). */
  latencyMs?: number;
  checkedAt?: number;
  /** Checks run and passed since this console opened. */
  passed: number;
  total: number;
}

interface Props {
  users: any[];
  verifications: any[];
  auditLogs: AuditLog[];
  /** A job opened from the global search. */
  openJobId: string | null;
  onOpenJob: (id: string | null) => void;
  onReviewVerification: (id?: string) => void;
  onOpenTenant: (email: string) => void;
  health: HealthInfo;
  diagRunning: boolean;
  onRunDiagnostics: () => void;
}

const STATUS: Record<JobStatus, { label: string; cls: string }> = {
  success: { label: 'Success', cls: 'border-[var(--badge-border)] bg-[var(--badge-bg)] text-[var(--badge-text)]' },
  scheduled: { label: 'Scheduled', cls: 'border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300' },
  awaiting: { label: 'Awaiting sync', cls: 'border-[var(--border-strong)] bg-[var(--bg-alt)] text-[var(--fg-muted)]' },
  failed: { label: 'Failed', cls: 'border-red-300/70 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300' },
};

const PLATFORM: Record<string, { short: string; cls: string }> = {
  facebook: { short: 'FB', cls: 'text-[#1877F2] border-[#1877F2]/30 bg-[#1877F2]/5' },
  instagram: { short: 'IG', cls: 'text-[#E1306C] border-[#E1306C]/30 bg-[#E1306C]/5' },
  tiktok: { short: 'TT', cls: 'text-[var(--fg)] border-[var(--border-strong)] bg-[var(--bg-alt)]' },
};

const FILTERS: { key: 'all' | JobStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'awaiting', label: 'Awaiting sync' },
  { key: 'failed', label: 'Failed' },
  { key: 'success', label: 'Success' },
];

const PAGE = 10;
const CARD = 'rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-[0_1px_2px_rgba(0,0,0,0.03)]';
const CARD_HEAD = 'flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5';
const CARD_TITLE = 'text-[13px] font-semibold text-[var(--fg)]';
const TH = 'border-b border-[var(--border)] px-4 py-2.5 font-semibold';
const TD = 'px-4 py-3 align-middle';
const PILL = 'inline-flex items-center gap-1 rounded-full border px-2 text-[11px] font-semibold leading-5';

export const StatusTag: React.FC<{ status: JobStatus }> = ({ status }) => (
  <span className={clsx('inline-flex whitespace-nowrap rounded border px-1.5 text-[11px] font-semibold leading-[18px]', STATUS[status].cls)}>{STATUS[status].label}</span>
);

const PlatformTag: React.FC<{ platform: string }> = ({ platform }) => {
  const p = PLATFORM[platform] ?? { short: platform.slice(0, 2).toUpperCase(), cls: 'border-[var(--border-strong)] text-[var(--fg-muted)]' };
  return <span className={clsx('inline-flex rounded border px-1 font-mono text-[10.5px] font-semibold leading-[18px]', p.cls)} title={platform}>{p.short}</span>;
};

type Tone = 'ok' | 'warn' | 'down' | 'idle';
const DOT: Record<Tone, string> = { ok: 'bg-[var(--success)]', warn: 'bg-amber-500', down: 'bg-[var(--danger)]', idle: 'bg-[var(--fg-subtle)]' };
const TONE_PILL: Record<Tone, string> = {
  ok: 'border-[var(--badge-border)] bg-[var(--badge-bg)] text-[var(--badge-text)]',
  warn: 'border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
  down: 'border-red-300/70 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300',
  idle: 'border-[var(--border-strong)] bg-[var(--bg-alt)] text-[var(--fg-muted)]',
};

const StatePill: React.FC<{ tone: Tone; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={clsx(PILL, TONE_PILL[tone])}>
    <span className={clsx('h-1.5 w-1.5 rounded-full', DOT[tone])} aria-hidden />
    {children}
  </span>
);

const docType = (name?: string) => (name?.split('.').pop() || 'file').toUpperCase();
/** "2026-10-16T09:00:00" → "2026-10-16 09:00" (shown in the tenant's own time zone, as scheduled). */
const wallClock = (s: string) => s.slice(0, 16).replace('T', ' ');
const localStamp = (iso: string) => {
  const d = parseUtc(iso);
  return `${d.toLocaleDateString('en-CA')} ${d.toTimeString().slice(0, 5)}`;
};

const Metric: React.FC<{ label: string; tone?: Tone; children: React.ReactNode }> = ({ label, tone, children }) => (
  <div className={clsx(CARD, 'min-w-0 p-3.5')}>
    <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-subtle)]">
      {tone && <span className={clsx('h-1.5 w-1.5 rounded-full', DOT[tone])} aria-hidden />}
      {label}
    </p>
    {children}
  </div>
);

/** One label/value line in a rail card. */
const Row: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <div className="flex items-baseline justify-between gap-3 px-4 py-2 text-xs">
    <span className="text-[var(--fg-muted)]" title={hint}>{label}</span>
    <span className="min-w-0 truncate text-right font-mono text-[11px] text-[var(--fg)]">{children}</span>
  </div>
);

/** Operations overview: metric strip, the dispatch table, and a rail of system checks. */
const AdminOverview: React.FC<Props> = ({
  users, verifications, auditLogs, openJobId, onOpenJob, onReviewVerification, onOpenTenant, health, diagRunning, onRunDiagnostics,
}) => {
  const [filter, setFilter] = useState<'all' | JobStatus>('all');
  const [page, setPage] = useState(0);
  const jobs = useMemo(() => buildJobs(auditLogs), [auditLogs]);
  useEffect(() => setPage(0), [filter]);

  const tenants = users.filter((u) => u.role === 'user').length;
  const verified = verifications.filter((v) => v.status === 'verified').length;
  const pending = verifications
    .filter((v) => v.status === 'pending')
    .sort((a, b) => parseUtc(a.createdAt).getTime() - parseUtc(b.createdAt).getTime());
  const count = (s: JobStatus) => jobs.filter((j) => j.status === s).length;

  // Health goes by when outcomes happened, not when the jobs were queued.
  const dayAgo = Date.now() - 24 * 3600_000;
  const failed24 = auditLogs.filter((l) => l.action === 'post_failed' && parseUtc(l.timestamp).getTime() > dayAgo).length;
  const byTime = (a: AuditLog, b: AuditLog) => parseUtc(b.timestamp).getTime() - parseUtc(a.timestamp).getTime();
  const lastOk = auditLogs.filter((l) => l.action === 'publish_post' || l.action === 'post_published').sort(byTime)[0];
  const lastSync = auditLogs.filter((l) => l.action === 'post_published' || l.action === 'post_failed').sort(byTime)[0];

  const filtered = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = filtered.slice(current * PAGE, current * PAGE + PAGE);
  const openJob = jobs.find((j) => j.id === openJobId) ?? null;

  // Per platform: what the recent dispatches did (the latest resolved one decides the state).
  const channel = (platform: string): { tone: Tone; label: string; detail: string } => {
    const resolved = jobs.filter((j) => j.platforms.some((p) => p.platform === platform) && (j.status === 'success' || j.status === 'failed'));
    const ok = resolved.filter((j) => j.status === 'success').length;
    const bad = resolved.length - ok;
    if (!resolved.length) return { tone: 'idle', label: 'No recent posts', detail: 'Nothing sent in the loaded window' };
    return {
      tone: resolved[0].status === 'failed' ? 'down' : bad ? 'warn' : 'ok',
      label: resolved[0].status === 'failed' ? 'Last post failed' : bad ? 'Some failures' : 'Operational',
      detail: `${ok} sent · ${bad} failed · latest ${timeAgo(resolved[0].loggedAt)}`,
    };
  };
  const CHANNELS = [
    { name: 'Facebook Pages', via: 'Meta Graph API via Zernio', ...channel('facebook') },
    { name: 'Instagram', via: 'Meta Graph API via Zernio', ...channel('instagram') },
    { name: 'TikTok', via: 'Not integrated', tone: 'idle' as Tone, label: 'Not integrated', detail: '' },
    { name: 'LinkedIn', via: 'Not integrated', tone: 'idle' as Tone, label: 'Not integrated', detail: '' },
  ];

  const healthTone: Tone = health.status === 'ok' ? 'ok' : health.status === 'checking' ? 'idle' : 'down';
  const healthLabel = { checking: 'Checking…', ok: 'API and database OK', 'db-down': 'Database unreachable', 'api-down': 'API unreachable' }[health.status];

  return (
    <div className="space-y-6">
      {/* Metric strip */}
      <section aria-label="System health" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Tenants">
          <p className="mt-1 text-lg font-semibold tabular-nums">{tenants}</p>
          <p className="font-mono text-[11px] text-[var(--fg-muted)]">{verified} verified · {pending.length} pending</p>
        </Metric>
        <Metric label="Dispatch queue" tone={count('awaiting') ? 'warn' : 'ok'}>
          <p className="mt-1 text-lg font-semibold tabular-nums">{count('scheduled')} <span className="text-xs font-medium text-[var(--fg-muted)]">scheduled</span></p>
          <p className="font-mono text-[11px] text-[var(--fg-muted)]">{count('awaiting')} awaiting sync</p>
        </Metric>
        <Metric label="Publishing API" tone={failed24 ? 'down' : lastOk ? 'ok' : 'idle'}>
          <p className="mt-1 text-lg font-semibold">{failed24 ? <span className="tabular-nums">{failed24} failed</span> : lastOk ? 'Operational' : 'Idle'}</p>
          <p className="truncate font-mono text-[11px] text-[var(--fg-muted)]">{failed24 ? 'in the last 24h' : lastOk ? `last ok ${timeAgo(lastOk.timestamp)}` : 'no dispatches yet'}</p>
        </Metric>
        <Metric label="Pending verifications" tone={pending.length ? 'warn' : 'ok'}>
          <button type="button" onClick={() => onReviewVerification()} className="group mt-1 flex items-baseline gap-1.5 text-lg font-semibold tabular-nums hover:text-[var(--primary)]">
            {pending.length}
            <span className="text-xs font-medium text-[var(--fg-muted)] group-hover:text-[var(--primary)]">to review</span>
            <ArrowUpRight className="h-3.5 w-3.5 self-center text-[var(--fg-subtle)] group-hover:text-[var(--primary)]" aria-hidden />
          </button>
          <p className="font-mono text-[11px] text-[var(--fg-muted)]">{verifications.length} submissions total</p>
        </Metric>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        {/* Job queue & dispatch */}
        <section className={clsx(CARD, 'overflow-hidden xl:col-span-2')} aria-label="Job queue and dispatch">
          <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--border)] px-4 py-2.5">
            <h2 className={CARD_TITLE}>Job queue &amp; dispatch</h2>
            <span className="text-[11px] text-[var(--fg-subtle)]">From the audit trail · refreshes every 8s</span>
            <div className="ml-auto flex flex-wrap gap-1" role="group" aria-label="Filter jobs">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className="rounded-md border border-[var(--border)] px-2 py-0.5 text-[11px] font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] aria-pressed:border-[var(--fg)] aria-pressed:bg-[var(--fg)] aria-pressed:text-[var(--bg)]"
                >
                  {f.label} <span className="font-mono tabular-nums opacity-70">{f.key === 'all' ? jobs.length : count(f.key)}</span>
                </button>
              ))}
            </div>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-[color-mix(in_srgb,var(--bg-alt)_80%,transparent)] text-[11px] uppercase tracking-wider text-[var(--fg-muted)]">
                <tr>
                  <th className={TH}>Job ID</th>
                  <th className={TH}>Target</th>
                  <th className={TH}>Tenant / account</th>
                  <th className={TH}>Scheduled for</th>
                  <th className={TH}>Status</th>
                  <th className={clsx(TH, 'text-right')}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--fg)]">
                {shown.map((job) => (
                  <tr key={job.id} className="hover:bg-[var(--bg-alt)]">
                    <td className={clsx(TD, 'font-mono text-[11px] text-[var(--fg-muted)]')}>{job.id}</td>
                    <td className={TD}>
                      <span className="flex gap-1">{job.platforms.map((p) => <PlatformTag key={p.platform + p.handle} platform={p.platform} />)}</span>
                    </td>
                    <td className={clsx(TD, 'max-w-[200px]')}>
                      <p className="truncate font-medium" title={job.topic}>{job.tenant.name}</p>
                      <p className="truncate font-mono text-[11px] text-[var(--fg-muted)]">{job.tenant.email || job.userId}</p>
                    </td>
                    <td className={clsx(TD, 'whitespace-nowrap font-mono text-[11px]')}>
                      {job.scheduledFor ? (
                        <>
                          <p>{wallClock(job.scheduledFor)}</p>
                          <p className="text-[var(--fg-subtle)]">{job.timezone}</p>
                        </>
                      ) : (
                        <>
                          <p>{localStamp(job.loggedAt)}</p>
                          <p className="text-[var(--fg-subtle)]">posted immediately</p>
                        </>
                      )}
                    </td>
                    <td className={TD}><StatusTag status={job.status} /></td>
                    <td className={clsx(TD, 'text-right')}>
                      <button
                        type="button"
                        onClick={() => onOpenJob(job.id)}
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-[var(--border)] px-2 py-0.5 text-[11px] font-medium hover:border-[var(--border-strong)] hover:bg-[var(--card)]"
                      >
                        <ScrollText className="h-3 w-3" aria-hidden /> View logs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length === 0 && (
              <p className="px-4 py-10 text-center text-xs text-[var(--fg-muted)]">
                {jobs.length ? 'No jobs with this status.' : 'No dispatches yet. Jobs appear here when tenants publish or schedule posts.'}
              </p>
            )}
          </div>
          <footer className="flex items-center gap-2 border-t border-[var(--border)] px-4 py-2 text-[11px] text-[var(--fg-muted)]">
            <span className="mr-auto">
              {filtered.length
                ? `Showing ${current * PAGE + 1}–${current * PAGE + shown.length} of ${filtered.length} job${filtered.length === 1 ? '' : 's'}`
                : 'No jobs'}
            </span>
            <button
              type="button"
              onClick={() => setPage(current - 1)}
              disabled={current === 0}
              className="rounded-md border border-[var(--border)] px-2 py-0.5 font-medium text-[var(--fg)] hover:bg-[var(--bg-alt)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="font-mono tabular-nums">{current + 1}/{pages}</span>
            <button
              type="button"
              onClick={() => setPage(current + 1)}
              disabled={current >= pages - 1}
              className="rounded-md border border-[var(--border)] px-2 py-0.5 font-medium text-[var(--fg)] hover:bg-[var(--bg-alt)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </footer>
        </section>

        {/* Observability rail */}
        <aside className="space-y-6" aria-label="System status">
          {/* Channel API status */}
          <section className={CARD}>
            <header className={CARD_HEAD}>
              <h2 className={CARD_TITLE}>Channel API status</h2>
              <span className="ml-auto text-[11px] text-[var(--fg-subtle)]">from dispatch results</span>
            </header>
            <ul className="divide-y divide-[var(--border)]">
              {CHANNELS.map((c) => (
                <li key={c.name} className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold">{c.name}</span>
                    <StatePill tone={c.tone}>{c.label}</StatePill>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--fg-muted)]" title={c.detail || undefined}>{c.detail || c.via}</p>
                </li>
              ))}
            </ul>
            <footer className="space-y-2 border-t border-[var(--border)] px-4 py-3">
              <button type="button" onClick={onRunDiagnostics} disabled={diagRunning} className="btn btn-glass btn-sm w-full">
                {diagRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Stethoscope className="h-3.5 w-3.5" />}
                {diagRunning ? 'Running diagnostics…' : 'Run connectivity diagnostics'}
              </button>
              <p className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--fg-muted)]" aria-live="polite">
                <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', DOT[healthTone])} aria-hidden />
                {healthLabel}
                {health.latencyMs != null && ` · ${health.latencyMs} ms`}
                {health.checkedAt && ` · ${new Date(health.checkedAt).toLocaleTimeString()}`}
              </p>
            </footer>
          </section>

          {/* Verification backlog */}
          <section className={CARD}>
            <header className={CARD_HEAD}>
              <h2 className={CARD_TITLE}>MSME verification backlog</h2>
              <StatePill tone={pending.length ? 'warn' : 'ok'}>{pending.length} pending</StatePill>
            </header>
            {pending.length ? (
              <>
                <p className="px-4 pt-2.5 text-xs text-[var(--fg-muted)]">
                  Oldest has waited <b className="font-semibold text-[var(--fg)]">{timeAgo(pending[0].createdAt).replace(' ago', '')}</b>.
                </p>
                <ul className="divide-y divide-[var(--border)] px-4 pb-1 pt-1.5">
                  {pending.slice(0, 3).map((v) => (
                    <li key={v.id} className="flex items-center gap-2 py-2 text-xs">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{v.businessName || 'Unnamed business'}</span>
                        <span className="block truncate font-mono text-[11px] text-[var(--fg-muted)]">{v.email}</span>
                      </span>
                      <span className="rounded border border-[var(--border-strong)] px-1 font-mono text-[10px] leading-4" title={v.documentName}>{docType(v.documentName)}</span>
                      <button
                        type="button"
                        onClick={() => onReviewVerification(v.id)}
                        aria-label={`Review ${v.businessName || 'submission'}`}
                        className="grid h-6 w-6 place-items-center rounded-md border border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="px-4 py-3 text-xs text-[var(--fg-muted)]">No reviews pending. New submissions show up here as they arrive.</p>
            )}
            <footer className="border-t border-[var(--border)] px-4 py-2.5">
              <button type="button" onClick={() => onReviewVerification()} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline">
                Open verification queue <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </footer>
          </section>

          {/* Worker engine */}
          <section className={CARD}>
            <header className={CARD_HEAD}>
              <h2 className={CARD_TITLE}>Background engine</h2>
            </header>
            <div className="divide-y divide-[var(--border)] py-1">
              <Row label="Post scheduler" hint="Kawayan has no local cron: Zernio holds the queue and sends at the scheduled time.">Zernio (hosted)</Row>
              <Row label="Outcome sync" hint="Results are pulled from Zernio when a tenant opens their timeline.">
                {lastSync ? `last ${timeAgo(lastSync.timestamp)}` : 'none recorded yet'}
              </Row>
              <Row label="API + DB round trip">{health.latencyMs != null ? `${health.latencyMs} ms` : '—'}</Row>
              <Row label="Health checks this session">{health.total ? `${health.passed}/${health.total} passed` : '—'}</Row>
            </div>
          </section>
        </aside>
      </div>

      <JobLogsDrawer job={openJob} logs={auditLogs} onClose={() => onOpenJob(null)} onOpenTenant={onOpenTenant} />
    </div>
  );
};

const Trail: React.FC<{ title: string; items: AuditLog[] }> = ({ title, items }) => (
  <section>
    <h3 className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-subtle)]">{title}</h3>
    <ol className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
      {items.map((l) => (
        <li key={l.id} className="grid grid-cols-[110px_1fr] gap-2 px-2 py-1.5 text-[11px]">
          <span className="font-mono text-[var(--fg-muted)]">{localStamp(l.timestamp)}</span>
          <span className="min-w-0">
            <b className="font-mono font-semibold">{l.action}</b>
            <span className="block break-words text-[var(--fg-muted)]">{l.details}</span>
          </span>
        </li>
      ))}
    </ol>
  </section>
);

/** Everything the audit trail knows about one dispatch, plus the tenant's recent activity. */
const JobLogsDrawer: React.FC<{ job: DispatchJob | null; logs: AuditLog[]; onClose: () => void; onOpenTenant: (email: string) => void }> = ({
  job,
  logs,
  onClose,
  onOpenTenant,
}) => {
  const postTrail = job?.postId ? logs.filter((l) => l.details?.endsWith(`(post:${job.postId})`)) : [];
  const tenantTrail = job ? logs.filter((l) => l.user_id === job.userId).slice(0, 15) : [];
  const row = (k: string, v: React.ReactNode, mono = false) => (
    <>
      <dt className="text-[var(--fg-muted)]">{k}</dt>
      <dd className={clsx('min-w-0 break-words', mono && 'font-mono text-[11px]')}>{v}</dd>
    </>
  );

  return (
    <Dialog.Root open={!!job} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[100] bg-black/30 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-[101] flex w-full max-w-[520px] flex-col border-l border-[var(--border-strong)] bg-[var(--card)] text-[var(--fg)] outline-none transition-transform duration-200 data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full motion-reduce:transition-none">
          {job && (
            <>
              <header className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5">
                <Dialog.Title className="text-sm font-semibold">
                  Job <span className="font-mono">{job.id}</span>
                </Dialog.Title>
                <StatusTag status={job.status} />
                <Dialog.Close aria-label="Close" className="ml-auto grid h-7 w-7 place-items-center rounded text-[var(--fg-muted)] hover:bg-[var(--bg-alt)] hover:text-[var(--fg)]">
                  <X className="h-4 w-4" />
                </Dialog.Close>
              </header>
              <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
                <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5">
                  {row('Tenant', job.tenant.name)}
                  {row('Owner', job.tenant.email || '—', true)}
                  {row('Account ID', job.userId, true)}
                  {row('Post ID', job.postId ?? '— (logged before post IDs were recorded)', true)}
                  {row('Post', `“${job.topic}”`)}
                  {row('Targets', job.platforms.map((p) => `${p.platform} ${p.handle}`).join(', '), true)}
                  {row('Scheduled for', job.scheduledFor ? `${wallClock(job.scheduledFor)} ${job.timezone}` : 'Immediately', true)}
                  {row('Logged', localStamp(job.loggedAt), true)}
                </dl>
                {job.status === 'failed' && (
                  <p className="rounded-md border border-red-300/70 bg-red-50 px-2.5 py-2 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                    The post went back to Draft on the tenant’s timeline. Admins can’t publish for a tenant; the owner retries or reschedules it from the post’s details.
                  </p>
                )}
                {job.status === 'awaiting' && (
                  <p className="rounded-md border border-[var(--border)] bg-[var(--bg-alt)] px-2.5 py-2 text-[var(--fg-muted)]">
                    Its time has passed. Zernio sends it; the result is recorded the next time the owner opens Kawayan.
                  </p>
                )}
                {postTrail.length > 0 && <Trail title="This post" items={postTrail} />}
                <Trail title="Tenant activity (latest 15)" items={tenantTrail} />
              </div>
              {job.tenant.email && (
                <footer className="border-t border-[var(--border)] px-4 py-2.5">
                  <button type="button" onClick={() => { onClose(); onOpenTenant(job.tenant.email); }} className="btn btn-glass btn-sm">
                    Open tenant in Users <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </footer>
              )}
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default AdminOverview;
