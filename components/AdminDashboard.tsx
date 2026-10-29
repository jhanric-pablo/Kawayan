import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts';
import { Dialog } from '@base-ui/react/dialog';
import { Menu } from '@base-ui/react/menu';
import { Tabs } from '@base-ui/react/tabs';
import { Switch } from '@base-ui/react/switch';
import {
  Users, Activity, MessageSquare, CheckSquare, Clock, CheckCircle, Trash2, Edit, Save, X, Search, Shield, Settings,
  Download, Filter, Lock, CreditCard, Moon, Sun, XCircle, Wallet, ChevronDown, ChevronRight, RefreshCw, UserPlus,
  LogIn, Upload, Send, CalendarClock, AlertTriangle, TrendingUp, PhilippinePeso, Store, ArrowUpDown, Check,
} from 'lucide-react';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { supportService } from '../services/supportService';
import { supportRealtime } from '../services/supportRealtime';
import { Ticket, User } from '../types';
import { useOrganicDialog } from './OrganicDialog';
import { useToast } from './ui/Toast';
import AccountMenu from './AccountMenu';
import AdminVerification, { VerifFilter } from './admin/AdminVerification';
import { parseUtc, timeAgo } from '../utils/adminJobs';
import './admin/adminConsole.css';

interface Props {
  darkMode: boolean;
  toggleTheme: () => void;
  user: User;
  onSignOut: () => void;
  onSwitchAccount?: () => void;
}

type Tab = 'overview' | 'users' | 'verification' | 'billing' | 'helpdesk' | 'logs' | 'settings';

type AdminStats = {
  totalUsers: number;
  activeUsers: number;
  totalPostsGenerated: number;
  revenue: number;
  cancelledTransactions: number;
  pendingTransactions: number;
  retentionRate: number;
  revenueData: { name: string; value: number }[];
  churnData: { name: string; value: number; activeUsers?: number }[];
};

const EMPTY_STATS: AdminStats = {
  totalUsers: 0, activeUsers: 0, totalPostsGenerated: 0, revenue: 0,
  cancelledTransactions: 0, pendingTransactions: 0, retentionRate: 0, revenueData: [], churnData: [],
};

type HealthStatus = 'checking' | 'ok' | 'db-down' | 'api-down';
type Health = { status: HealthStatus; latencyMs?: number; checkedAt?: number };

/* ── Shared building blocks ───────────────────────────────────────── */
const cx = (...c: Array<string | false | undefined | null>) => c.filter(Boolean).join(' ');
const peso = (n: number) => `₱${Number(n || 0).toLocaleString('en-PH')}`;
const isoDay = (d: Date) => d.toISOString().split('T')[0];
const daysAgo = (n: number) => isoDay(new Date(Date.now() - n * 86_400_000));
const tomorrow = () => isoDay(new Date(Date.now() + 86_400_000));

const Panel: React.FC<{
  title?: string; desc?: string; actions?: React.ReactNode; children: React.ReactNode; flush?: boolean; className?: string;
}> = ({ title, desc, actions, children, flush, className }) => (
  <section className={cx('adm-panel', className)}>
    {(title || actions) && (
      <header className="adm-panel__head">
        <div className="min-w-0">
          {title && <h2 className="adm-panel__title">{title}</h2>}
          {desc && <p className="adm-panel__desc">{desc}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
    )}
    <div className={flush ? '' : 'p-5'}>{children}</div>
  </section>
);

const Kpi: React.FC<{
  label: string; value: React.ReactNode; hint: string; icon: React.ElementType; accent?: boolean; onClick?: () => void;
}> = ({ label, value, hint, icon: Icon, accent, onClick }) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={cx('adm-kpi', accent && 'adm-kpi--accent', onClick && 'adm-kpi--link')}>
      <span className="adm-kpi__icon"><Icon className="h-4 w-4" aria-hidden /></span>
      <span className="adm-kpi__label">{label}</span>
      <span className="adm-kpi__value">{value}</span>
      <span className="adm-kpi__hint">{hint}</span>
    </Tag>
  );
};

const AdminModal: React.FC<{ title: string; sub?: string; onClose: () => void; children: React.ReactNode }> = ({ title, sub, onClose, children }) => (
  <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
      <Dialog.Popup className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border-strong)] bg-[var(--card)] text-[var(--fg)] shadow-2xl outline-none transition-[opacity,transform] duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <Dialog.Title className="font-display text-base font-bold">{title}</Dialog.Title>
            {sub && <Dialog.Description className="mt-0.5 truncate text-xs text-[var(--fg-muted)]">{sub}</Dialog.Description>}
          </div>
          <Dialog.Close aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--bg-alt)] hover:text-[var(--fg)]">
            <X className="h-4 w-4" />
          </Dialog.Close>
        </header>
        <div className="p-5">{children}</div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
);

const FieldLabel: React.FC<{ htmlFor?: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">{children}</label>
);

const RoleBadge: React.FC<{ role: string }> = ({ role }) => (
  <span className={cx('badge', role === 'admin' ? 'badge-green' : role === 'support' ? 'badge-blue' : 'badge-sage')}>{role}</span>
);

const PlanBadge: React.FC<{ plan?: string }> = ({ plan = 'FREE' }) =>
  plan === 'FREE' ? (
    <span className="inline-flex rounded-full border border-[var(--border-strong)] px-2.5 text-[11px] font-bold uppercase leading-5 tracking-wide text-[var(--fg-muted)]">Free</span>
  ) : (
    <span className="badge badge-green">{plan === 'PRO' ? 'Pro' : 'Enterprise'}</span>
  );

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="adm-empty">{children}</div>;

const chartTip = {
  borderRadius: 12,
  border: '1px solid var(--border-strong)',
  background: 'var(--card)',
  color: 'var(--fg)',
  fontSize: 12,
  boxShadow: 'var(--shadow-md)',
} as const;
const axisTick = { fill: 'var(--fg-subtle)', fontSize: 11 };

/* ── Audit timeline: per-action icon, color and label ────────────── */
const ACTION_META: Record<string, { label: string; icon: React.ElementType; bg: string; fg: string; dot: string }> = {
  register: { label: 'Account registered', icon: UserPlus, bg: 'bg-blue-500/10', fg: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  login: { label: 'Signed in', icon: LogIn, bg: 'bg-[var(--bg-alt)]', fg: 'text-[var(--fg-muted)]', dot: 'bg-[var(--fg-subtle)]' },
  submit_verification: { label: 'Document submitted', icon: Upload, bg: 'bg-amber-500/10', fg: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  resubmit_verification: { label: 'Document resubmitted', icon: Upload, bg: 'bg-amber-500/10', fg: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  approve_verification: { label: 'Verification approved', icon: CheckCircle, bg: 'bg-emerald-500/10', fg: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  reject_verification: { label: 'Verification rejected', icon: XCircle, bg: 'bg-red-500/10', fg: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  delete_user: { label: 'Account deleted', icon: Trash2, bg: 'bg-rose-600/10', fg: 'text-rose-700 dark:text-rose-400', dot: 'bg-rose-600' },
  upgrade_plan: { label: 'Plan upgraded', icon: TrendingUp, bg: 'bg-emerald-500/10', fg: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  wallet_topup: { label: 'Wallet topped up', icon: Wallet, bg: 'bg-emerald-500/10', fg: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  publish_post: { label: 'Post published', icon: Send, bg: 'bg-emerald-500/10', fg: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  schedule_post: { label: 'Post scheduled', icon: CalendarClock, bg: 'bg-amber-500/10', fg: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  post_published: { label: 'Scheduled post went live', icon: CheckCircle, bg: 'bg-emerald-500/10', fg: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  post_failed: { label: 'Scheduled post failed', icon: AlertTriangle, bg: 'bg-red-500/10', fg: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
};
const DEFAULT_ACTION_META = { label: 'System event', icon: Activity, bg: 'bg-[var(--bg-alt)]', fg: 'text-[var(--fg-muted)]', dot: 'bg-[var(--fg-subtle)]' };

const AUDIT_WINDOW = 300;

const LOG_FILTERS: Array<{ key: string; label: string; actions?: string[] }> = [
  { key: 'all', label: 'All actions' },
  { key: 'accounts', label: 'Accounts — register & login', actions: ['register', 'login'] },
  { key: 'submitted', label: 'Documents submitted', actions: ['submit_verification', 'resubmit_verification'] },
  { key: 'approved', label: 'Verifications approved', actions: ['approve_verification'] },
  { key: 'rejected', label: 'Verifications rejected', actions: ['reject_verification'] },
  { key: 'payments', label: 'Payments & plans', actions: ['wallet_topup', 'upgrade_plan'] },
  { key: 'deleted', label: 'Accounts deleted', actions: ['delete_user'] },
  { key: 'publishing', label: 'Publishing — posts & outcomes', actions: ['publish_post', 'schedule_post', 'post_published', 'post_failed'] },
];

const RANGE_PRESETS = [
  { key: '7d', label: '7D', days: 7 },
  { key: '30d', label: '30D', days: 30 },
  { key: '90d', label: '90D', days: 90 },
  { key: '1y', label: '1Y', days: 365 },
] as const;

const dayLabel = (iso: string): string => {
  const d = parseUtc(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
};

type SearchHit = { kind: 'account' | 'verification'; id: string; label: string; sub: string };

/** ⌘K search across accounts and verification submissions. */
const AdminSearch: React.FC<{ hitsFor: (q: string) => SearchHit[]; onPick: (hit: SearchHit) => void }> = ({ hitsFor, onPick }) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const hits = q.trim().length >= 2 ? hitsFor(q.trim().toLowerCase()) : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pick = (hit: SearchHit) => {
    onPick(hit);
    setQ('');
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative w-full max-w-md" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <label className="flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-alt)] px-3 transition-colors focus-within:border-[var(--primary)] focus-within:bg-[var(--card)]">
        <Search className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, hits.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
            if (e.key === 'Enter' && hits[active]) pick(hits[active]);
            if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
          }}
          placeholder="Search accounts and verifications…"
          aria-label="Search the admin console"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--fg-subtle)]"
        />
        <kbd className="hidden rounded-md border border-[var(--border-strong)] px-1.5 font-mono text-[10px] text-[var(--fg-subtle)] sm:inline">⌘K</kbd>
      </label>
      {open && q.trim().length >= 2 && (
        <ul onMouseDown={(e) => e.preventDefault()} className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-[var(--border-strong)] bg-[var(--card)] p-1 shadow-lg" role="listbox">
          {hits.length === 0 ? (
            <li className="px-3 py-2 text-xs text-[var(--fg-muted)]">No matches for “{q.trim()}”.</li>
          ) : (
            hits.map((hit, i) => (
              <li key={`${hit.kind}-${hit.id}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onClick={() => pick(hit)}
                  onMouseEnter={() => setActive(i)}
                  className={cx('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-xs', i === active && 'bg-[var(--bg-alt)]')}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--bg-alt)] text-[var(--fg-muted)]">
                    {hit.kind === 'account' ? <Users className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-[var(--fg)]">{hit.label}</span>
                    <span className="block truncate text-[11px] text-[var(--fg-muted)]">{hit.sub}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

const SettingSwitch: React.FC<{ label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, desc, checked, onChange }) => (
  <label className="adm-setting-row cursor-pointer">
    <span>
      <span className="block text-sm font-bold text-[var(--fg)]">{label}</span>
      <span className="block text-xs text-[var(--fg-muted)]">{desc}</span>
    </span>
    <Switch.Root
      checked={checked}
      onCheckedChange={onChange}
      className="relative inline-flex h-6 w-[42px] shrink-0 items-center rounded-full bg-[var(--border-strong)] p-[3px] transition-colors data-[checked]:bg-[var(--primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
    >
      <Switch.Thumb className="h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-150 data-[checked]:translate-x-[18px]" />
    </Switch.Root>
  </label>
);

const AdminDashboard: React.FC<Props> = ({ darkMode, toggleTheme, user, onSignOut, onSwitchAccount }) => {
  const dialog = useOrganicDialog();
  const toast = useToast();
  const [dbService] = useState(() => new UniversalDatabaseService());
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Overview
  const [stats, setStats] = useState<AdminStats>(EMPTY_STATS);
  const [statsLoading, setStatsLoading] = useState(true);
  const [rangePreset, setRangePreset] = useState<string>('30d');
  const [dateRange, setDateRange] = useState({ start: daysAgo(30), end: tomorrow() });

  // Data
  const [pendingTxns, setPendingTxns] = useState<any[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketFilter, setTicketFilter] = useState<'all' | 'Open' | 'Pending' | 'Resolved'>('all');
  const [users, setUsers] = useState<any[]>([]); // includes wallet balance and plan
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // User management
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [managingUser, setManagingUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });
  const [manageAction, setManageAction] = useState<'balance' | 'subscription'>('balance');
  const [balanceForm, setBalanceForm] = useState({ amount: 0, reason: '' });
  const [subForm, setSubForm] = useState({ plan: 'FREE', expiresAt: '' });

  // Audit logs
  const [logFilter, setLogFilter] = useState('all');
  const [logSearch, setLogSearch] = useState('');
  const [logSortDir, setLogSortDir] = useState<'asc' | 'desc'>('desc');

  // Verification
  const [verifications, setVerifications] = useState<any[]>([]);
  const [verifLoading, setVerifLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ id: string; businessName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [verifStatusFilter, setVerifStatusFilter] = useState<VerifFilter>('pending');
  const [selectedVerifId, setSelectedVerifId] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false); // an approve confirm is open or in flight

  // Settings
  const [health, setHealth] = useState<Health>({ status: 'checking' });
  const [systemSettings, setSystemSettings] = useState({ maintenanceMode: false, allowRegistrations: true });
  const [adminProfile, setAdminProfile] = useState({ email: 'admin@kawayan.ph', password: '', confirm: '' });

  // A failed source shouldn't blank the whole console.
  const safe = <T,>(p: Promise<T>, fallback: T) => p.catch((e) => { console.error('Admin data error:', e); return fallback; });

  const loadStats = async () => {
    setStatsLoading(true);
    setStats(await safe(dbService.getAdminStats(dateRange.start, dateRange.end), EMPTY_STATS));
    setStatsLoading(false);
  };

  const loadData = async () => {
    const [userList, ticketList, logs, verifList, txns] = await Promise.all([
      safe(dbService.getAllUsers(), []),
      safe(dbService.getAllTicketsAdmin(), []),
      safe(dbService.getAuditLogs(AUDIT_WINDOW), []),
      safe(dbService.getAllVerifications(), []),
      safe(dbService.getPendingTransactionsAdmin(), []),
    ]);
    setUsers(userList);
    setTickets(ticketList);
    setAuditLogs(logs);
    setVerifications(verifList);
    setPendingTxns(txns);
    setLoading(false);
  };

  const refreshAll = () => Promise.all([loadStats(), loadData()]);

  useEffect(() => { loadData(); }, [dbService]);
  useEffect(() => { loadStats(); }, [dbService, dateRange]);

  // API and database health for the status pill and Settings.
  const checkHealth = useCallback(async () => {
    const started = performance.now();
    let status: HealthStatus;
    try {
      const d = await (await fetch('/api/health')).json();
      status = d.status === 'healthy' ? 'ok' : 'db-down';
    } catch {
      status = 'api-down';
    }
    setHealth({ status, latencyMs: Math.round(performance.now() - started), checkedAt: Date.now() });
  }, []);

  useEffect(() => {
    checkHealth();
    const id = setInterval(checkHealth, 60_000);
    return () => clearInterval(id);
  }, [checkHealth]);

  useEffect(() => {
    if (activeTab === 'verification') loadVerifications();
    if (activeTab === 'billing') loadPendingTransactions();
  }, [activeTab]);

  // Audit logs refresh quietly in the background.
  useEffect(() => {
    const interval = setInterval(loadAuditLogs, 8000);
    return () => clearInterval(interval);
  }, [dbService]);

  useEffect(() => {
    supportRealtime.connect();
    return supportRealtime.onVerificationUpdated(() => {
      if (activeTab === 'verification') loadVerifications();
    });
  }, [activeTab]);

  const loadPendingTransactions = async () => {
    setBillingLoading(true);
    setPendingTxns(await safe(dbService.getPendingTransactionsAdmin(), []));
    setBillingLoading(false);
  };

  const handleApproveTransaction = async (transactionId: string) => {
    const confirmed = await dialog.confirm('Approve this payment and credit the user wallet?');
    if (!confirmed) return;
    try {
      await dbService.approveTransactionAdmin(transactionId);
      toast.success('Payment verified and balance updated');
      loadPendingTransactions();
      refreshAll();
    } catch (e) {
      toast.error('Could not approve the payment.');
    }
  };

  const loadAuditLogs = async () => {
    try {
      setAuditLogs(await dbService.getAuditLogs(AUDIT_WINDOW));
    } catch (e) {
      console.error('Error loading audit logs:', e);
    }
  };

  const loadVerifications = async () => {
    setVerifLoading(true);
    const list = await safe(dbService.getAllVerifications(), []);
    setVerifications(list);
    setSelectedVerifId((current) => current ?? (list[0]?.id ?? null));
    setVerifLoading(false);
  };

  // After a decision, jump straight to the next pending item so the queue can be cleared without re-scanning the list.
  const refreshVerificationsAndAdvance = async () => {
    const list = await dbService.getAllVerifications();
    setVerifications(list);
    const nextPending = list.find((v: any) => v.status === 'pending');
    setSelectedVerifId(nextPending ? nextPending.id : (list[0]?.id ?? null));
  };

  const handleApprove = async (id: string, businessName?: string) => {
    if (deciding) return;
    setDeciding(true);
    try {
      const confirmed = await dialog.confirm({
        title: 'Approve verification',
        message: `Approve ${businessName ? `"${businessName}"` : 'this business'}? They will immediately gain full account access.`,
        confirmLabel: 'Approve',
      });
      if (!confirmed) return;
      await dbService.approveVerification(id);
      toast.success(`${businessName ? `"${businessName}"` : 'Business'} approved`);
      await refreshVerificationsAndAdvance();
    } catch (e) {
      toast.error('Could not approve. Please try again.');
    } finally {
      setDeciding(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) return; // the button stays disabled until a reason is typed
    try {
      await dbService.rejectVerification(rejectModal.id, rejectReason.trim());
      toast.info(`"${rejectModal.businessName}" rejected`);
      setRejectModal(null);
      setRejectReason('');
      await refreshVerificationsAndAdvance();
    } catch (e) {
      toast.error('Could not reject. Please try again.');
    }
  };

  // --- Sorting & filtering ---
  const handleSort = (key: string) => {
    setSortConfig((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const getFilteredAndSortedUsers = () => {
    const q = searchTerm.toLowerCase();
    const filtered = users.filter((u) =>
      (u.email && u.email.toLowerCase().includes(q)) || (u.businessName && u.businessName.toLowerCase().includes(q)));

    return filtered.sort((a, b) => {
      let aVal = a[sortConfig.key] ?? '';
      let bVal = b[sortConfig.key] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const getGroupedLogs = () => {
    const q = logSearch.trim().toLowerCase();
    const group = LOG_FILTERS.find((f) => f.key === logFilter);
    const logs = auditLogs
      .filter((log) => !group?.actions || group.actions.includes(log.action))
      .filter((log) => !q || `${log.action} ${log.user_id} ${log.details || ''}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const diff = parseUtc(a.timestamp).getTime() - parseUtc(b.timestamp).getTime();
        return logSortDir === 'asc' ? diff : -diff;
      });
    const groups: Array<{ day: string; entries: any[] }> = [];
    for (const log of logs) {
      const label = dayLabel(log.timestamp);
      const last = groups[groups.length - 1];
      if (last && last.day === label) last.entries.push(log);
      else groups.push({ day: label, entries: [log] });
    }
    return groups;
  };

  // --- Export ---
  const exportUsersToCSV = () => {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['ID', 'Email', 'Role', 'Business Name', 'Plan', 'Balance', 'Created At'],
      ...users.map((u) => [u.id, u.email, u.role, u.businessName, u.subscription, u.balance || 0, u.createdAt]),
    ].map((r) => r.map(cell).join(','));
    const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `kawayan_users_${isoDay(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // --- Actions ---
  const handleUserUpdate = async (userId: string) => {
    try {
      await dbService.updateUser(userId, editForm);
      setEditingUser(null);
      setEditForm({});
      loadData();
    } catch (error) {
      toast.error('Could not update the user.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const confirmed = await dialog.confirm('Are you sure? This will delete ALL user data permanently.');
    if (!confirmed) return;
    try {
      await dbService.deleteUser(userId);
      refreshAll();
    } catch (error) {
      toast.error('Could not delete the user.');
    }
  };

  const handleAdjustBalance = async () => {
    if (!managingUser) return;
    try {
      await dbService.adminAdjustBalance(managingUser.id, balanceForm.amount, balanceForm.reason);
      toast.success('Balance adjusted');
      setManagingUser(null);
      loadData();
    } catch (error) {
      toast.error('Could not adjust the balance.');
    }
  };

  const handleUpdateSubscription = async () => {
    if (!managingUser) return;
    try {
      await dbService.adminUpdateSubscription(managingUser.id, subForm.plan, subForm.expiresAt);
      toast.success('Subscription updated');
      setManagingUser(null);
      loadData();
    } catch (error) {
      toast.error('Could not update the subscription.');
    }
  };

  const handleTicketStatus = async (id: string, status: 'Open' | 'Pending' | 'Resolved') => {
    await supportService.updateTicketStatus(id, status);
    setTickets(await safe(dbService.getAllTicketsAdmin(), tickets));
  };

  const handleAdminProfileUpdate = async () => {
    if (adminProfile.password !== adminProfile.confirm) return; // shown under the field
    toast.info('Admin profile updated (simulation only)');
  };

  const setDark = (wantDark: boolean) => {
    if (wantDark !== darkMode) toggleTheme();
  };

  const pickRange = (key: string) => {
    setRangePreset(key);
    const preset = RANGE_PRESETS.find((p) => p.key === key);
    if (preset) setDateRange({ start: daysAgo(preset.days), end: tomorrow() });
  };

  const reviewVerification = (id?: string) => {
    setActiveTab('verification');
    setVerifStatusFilter(id ? 'all' : 'pending');
    setSelectedVerifId(id ?? verifications.find((v) => v.status === 'pending')?.id ?? null);
  };

  const searchHits = (q: string): SearchHit[] => [
    ...users
      .filter((u) => `${u.email} ${u.businessName || ''} ${u.id}`.toLowerCase().includes(q))
      .slice(0, 6)
      .map((u): SearchHit => ({ kind: 'account', id: u.id, label: u.businessName || u.email, sub: `${u.email} · ${u.role}` })),
    ...verifications
      .filter((v) => `${v.businessName || ''} ${v.email} ${v.id}`.toLowerCase().includes(q))
      .slice(0, 4)
      .map((v): SearchHit => ({ kind: 'verification', id: v.id, label: v.businessName || 'Unnamed business', sub: `${v.email} · ${v.status}` })),
  ];

  const pickSearchHit = (hit: SearchHit) => {
    if (hit.kind === 'account') {
      setActiveTab('users');
      setSearchTerm(users.find((u) => u.id === hit.id)?.email ?? '');
    } else {
      reviewVerification(hit.id);
    }
  };

  const pendingVerifs = verifications.filter((v) => v.status === 'pending').length;
  const openTickets = tickets.filter((t) => t.status !== 'Resolved').length;

  const NAV: Array<{ id: Tab; label: string; icon: React.ElementType; count?: number; group: 'Workspace' | 'System' }> = [
    { id: 'overview', label: 'Overview', icon: Activity, group: 'Workspace' },
    { id: 'users', label: 'Users', icon: Users, count: users.length || undefined, group: 'Workspace' },
    { id: 'verification', label: 'Verification', icon: Shield, count: pendingVerifs || undefined, group: 'Workspace' },
    { id: 'billing', label: 'Billing', icon: CreditCard, count: pendingTxns.length || undefined, group: 'Workspace' },
    { id: 'helpdesk', label: 'Help Desk', icon: MessageSquare, count: openTickets || undefined, group: 'Workspace' },
    { id: 'logs', label: 'Audit Logs', icon: Clock, group: 'System' },
    { id: 'settings', label: 'Settings', icon: Settings, group: 'System' },
  ];

  const HEADINGS: Record<Tab, { title: string; sub: string }> = {
    overview: { title: 'Overview', sub: 'Revenue, growth and platform activity at a glance.' },
    users: { title: 'Users', sub: 'Search, edit roles, adjust wallets and manage subscriptions.' },
    verification: { title: 'Verification queue', sub: 'Review business documents and approve or reject MSME accounts.' },
    billing: { title: 'Billing', sub: 'Verify pending wallet top-ups and manage billing cycles.' },
    helpdesk: { title: 'Help desk', sub: 'Track and resolve customer support tickets.' },
    logs: { title: 'Audit logs', sub: 'Every privileged action, timestamped.' },
    settings: { title: 'System settings', sub: 'Platform switches, appearance and admin credentials.' },
  };

  const STATUS_PILL: Record<HealthStatus, { label: string; dot: string }> = {
    checking: { label: 'Checking status…', dot: 'bg-[var(--fg-subtle)]' },
    ok: { label: 'System operational', dot: 'bg-[var(--success)]' },
    'db-down': { label: 'Database unreachable', dot: 'bg-[var(--danger)]' },
    'api-down': { label: 'API unreachable', dot: 'bg-[var(--danger)]' },
  };
  const pill = STATUS_PILL[health.status];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="adm-spinner" />
      </div>
    );
  }

  const head = HEADINGS[activeTab];
  const refreshBtn = (fn: () => void) => (
    <button type="button" onClick={fn} className="btn btn-glass btn-sm">
      <RefreshCw className="h-3.5 w-3.5" /> Refresh
    </button>
  );
  const signUps = stats.revenueData.reduce((sum, d) => sum + d.value, 0);
  const visibleTickets = ticketFilter === 'all' ? tickets : tickets.filter((t) => t.status === ticketFilter);
  const pendingTotal = pendingTxns.reduce((sum, t) => sum + Number(t.amount || 0), 0);

  return (
    <div className="adm flex min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      {/* ── Sidebar ── */}
      <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)] md:flex">
        <div className="flex h-16 shrink-0 items-center gap-2.5 px-4">
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg object-contain" />
          <div className="leading-tight">
            <p className="font-display text-[15px] font-bold">Kawayan</p>
            <p className="text-[11px] font-medium text-[var(--fg-muted)]">Admin console</p>
          </div>
        </div>
        <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 pb-4">
          {(['Workspace', 'System'] as const).map((group) => (
            <div key={group} className="mt-3">
              <p className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--fg-subtle)]">{group}</p>
              <div className="space-y-0.5">
                {NAV.filter((item) => item.group === group).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    aria-current={activeTab === item.id ? 'page' : undefined}
                    className="adm-nav"
                  >
                    <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.count != null && <span className="adm-nav__count">{item.count}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="m-3 rounded-xl border border-[var(--border)] bg-[var(--bg-alt)] p-3 text-xs" role="status">
          <p className="flex items-center gap-2 font-semibold">
            <span className="relative flex h-2 w-2" aria-hidden>
              {health.status === 'ok' && <span className={cx('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden', pill.dot)} />}
              <span className={cx('relative inline-flex h-2 w-2 rounded-full', pill.dot)} />
            </span>
            {pill.label}
          </p>
          {health.latencyMs != null && <p className="mt-1 text-[var(--fg-muted)]">API and database · {health.latencyMs} ms</p>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── Top bar ── */}
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 border-b border-[var(--border)] bg-[var(--card)]/90 px-4 backdrop-blur md:px-6">
          <nav aria-label="Breadcrumb" className="hidden shrink-0 items-center gap-1.5 text-[13px] text-[var(--fg-muted)] lg:flex">
            <span>Admin</span>
            <ChevronRight className="h-3.5 w-3.5 text-[var(--fg-subtle)]" aria-hidden />
            <span className="font-semibold text-[var(--fg)]">{head.title}</span>
          </nav>
          <div className="flex min-w-0 flex-1 justify-center">
            <AdminSearch hitsFor={searchHits} onPick={pickSearchHit} />
          </div>
          <AccountMenu user={user} onSignOut={onSignOut} onSwitchAccount={onSwitchAccount} onSettings={() => setActiveTab('settings')} />
        </header>

        {/* Phones: tabs instead of the sidebar */}
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--card)] px-3 py-2 md:hidden">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={activeTab === item.id ? 'page' : undefined}
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--fg-muted)] aria-[current=page]:bg-[var(--bg-alt)] aria-[current=page]:font-semibold aria-[current=page]:text-[var(--fg)]"
            >
              {item.label}{item.count != null ? ` · ${item.count}` : ''}
            </button>
          ))}
        </nav>

        {/* App's <main> already wraps the console, so this is a plain region. */}
        <div className="mx-auto w-full max-w-[1440px] min-w-0 flex-1 p-4 md:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-[22px] font-bold tracking-tight">{head.title}</h1>
              <p className="mt-0.5 text-[13px] text-[var(--fg-muted)]">{head.sub}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeTab === 'overview' && (
                <>
                  <div className="adm-segment" role="group" aria-label="Date range">
                    {RANGE_PRESETS.map((p) => (
                      <button key={p.key} type="button" aria-pressed={rangePreset === p.key} onClick={() => pickRange(p.key)}>{p.label}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-2 py-1">
                    <input
                      type="date"
                      aria-label="Start date"
                      value={dateRange.start}
                      onChange={(e) => { setRangePreset('custom'); setDateRange({ ...dateRange, start: e.target.value }); }}
                      className="bg-transparent text-xs text-[var(--fg)] outline-none"
                    />
                    <span className="text-[var(--fg-subtle)]">–</span>
                    <input
                      type="date"
                      aria-label="End date"
                      value={dateRange.end}
                      onChange={(e) => { setRangePreset('custom'); setDateRange({ ...dateRange, end: e.target.value }); }}
                      className="bg-transparent text-xs text-[var(--fg)] outline-none"
                    />
                  </div>
                  {refreshBtn(refreshAll)}
                </>
              )}
              {activeTab === 'users' && (
                <button type="button" onClick={exportUsersToCSV} className="btn btn-glass btn-sm">
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </button>
              )}
              {activeTab === 'verification' && refreshBtn(loadVerifications)}
              {activeTab === 'billing' && refreshBtn(loadPendingTransactions)}
            </div>
          </div>

          {/* ─────────────  OVERVIEW  ───────────── */}
          {activeTab === 'overview' && (
            <div className={cx('space-y-4 transition-opacity', statsLoading && 'opacity-60')} aria-busy={statsLoading}>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <Kpi accent icon={PhilippinePeso} label="Total revenue" value={peso(stats.revenue)} hint="Completed PayMongo payments" />
                <Kpi icon={Users} label="Total users" value={stats.totalUsers.toLocaleString()} hint="Signed up in this range" onClick={() => setActiveTab('users')} />
                <Kpi icon={Store} label="MSME accounts" value={stats.activeUsers.toLocaleString()} hint="Business owners who joined" />
                <Kpi icon={TrendingUp} label="Posts created" value={stats.totalPostsGenerated.toLocaleString()} hint="Across all businesses" />
                <Kpi icon={Wallet} label="Pending" value={stats.pendingTransactions.toLocaleString()} hint="Payments not yet paid" onClick={() => setActiveTab('billing')} />
                <Kpi icon={XCircle} label="Cancelled" value={stats.cancelledTransactions.toLocaleString()} hint="Payments cancelled" />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Panel
                  className="lg:col-span-2"
                  title="User growth"
                  desc="New sign-ups per month"
                  actions={<span className="adm-figure">{signUps.toLocaleString()}<small>sign-ups</small></span>}
                >
                  <div className="h-64">
                    {stats.revenueData.length === 0 ? (
                      <Empty>No sign-ups in this range.</Empty>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.revenueData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                          <defs>
                            <linearGradient id="admGrowth" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisTick} />
                          <YAxis axisLine={false} tickLine={false} tick={axisTick} width={36} allowDecimals={false} />
                          <ChartTooltip contentStyle={chartTip} formatter={(v) => [v, 'Sign-ups']} cursor={{ stroke: 'var(--border-strong)' }} />
                          <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2.5} fill="url(#admGrowth)" activeDot={{ r: 5 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </Panel>

                <Panel
                  title="Retention rate"
                  desc="Share of users who posted each month"
                  actions={<span className="adm-figure">{stats.retentionRate}%<small>last 30 days</small></span>}
                >
                  <div className="h-64">
                    {stats.churnData.length === 0 ? (
                      <Empty>No posting activity in this range.</Empty>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.churnData} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisTick} />
                          <YAxis axisLine={false} tickLine={false} tick={axisTick} unit="%" width={40} />
                          <ChartTooltip contentStyle={chartTip} formatter={(v) => [`${v}%`, 'Retention']} cursor={{ fill: 'var(--bg-alt)' }} />
                          <Bar dataKey="value" fill="var(--kw-sage)" radius={[8, 8, 0, 0]} maxBarSize={44} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </Panel>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Panel
                  flush
                  className="lg:col-span-2"
                  title="Latest activity"
                  actions={
                    <button type="button" onClick={() => setActiveTab('logs')} className="flex items-center gap-1 text-xs font-bold text-[var(--primary)] hover:underline">
                      View all <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  }
                >
                  <ul className="divide-y divide-[var(--border)]">
                    {auditLogs.slice(0, 6).map((log) => {
                      const meta = ACTION_META[log.action] || DEFAULT_ACTION_META;
                      const Icon = meta.icon;
                      return (
                        <li key={log.id} className="flex items-center gap-3 px-5 py-3">
                          <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-xl', meta.bg)}>
                            <Icon className={cx('h-4 w-4', meta.fg)} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{meta.label}</span>
                            <span className="block truncate text-xs text-[var(--fg-muted)]">{log.details || log.user_id}</span>
                          </span>
                          <span className="whitespace-nowrap text-xs text-[var(--fg-subtle)]" title={parseUtc(log.timestamp).toLocaleString()}>{timeAgo(log.timestamp)}</span>
                        </li>
                      );
                    })}
                    {auditLogs.length === 0 && <li><Empty>No activity recorded yet.</Empty></li>}
                  </ul>
                </Panel>

                <Panel flush title="Needs attention" desc="Work waiting on an admin">
                  <ul className="divide-y divide-[var(--border)]">
                    {[
                      { icon: Shield, label: 'Verifications to review', count: pendingVerifs, go: () => reviewVerification() },
                      { icon: Wallet, label: 'Payments to verify', count: pendingTxns.length, go: () => setActiveTab('billing') },
                      { icon: MessageSquare, label: 'Open support tickets', count: openTickets, go: () => setActiveTab('helpdesk') },
                    ].map((row) => (
                      <li key={row.label}>
                        <button type="button" onClick={row.go} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[var(--bg-alt)]">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--bg-alt)] text-[var(--fg-muted)]">
                            <row.icon className="h-4 w-4" />
                          </span>
                          <span className="flex-1 text-sm font-medium">{row.label}</span>
                          <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums', row.count ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-[var(--bg-alt)] text-[var(--fg-subtle)]')}>
                            {row.count}
                          </span>
                          <ChevronRight className="h-4 w-4 text-[var(--fg-subtle)]" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            </div>
          )}

          {/* ─────────────  USERS  ───────────── */}
          {activeTab === 'users' && (
            <Panel flush>
              <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-4 py-3">
                <label className="flex h-9 w-full max-w-xs items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-alt)] px-3 focus-within:border-[var(--primary)]">
                  <Search className="h-4 w-4 text-[var(--fg-subtle)]" aria-hidden />
                  <input
                    type="text"
                    placeholder="Search by email or business…"
                    aria-label="Search users"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--fg-subtle)]"
                  />
                </label>
                <span className="ml-auto text-xs text-[var(--fg-muted)]">{getFilteredAndSortedUsers().length} of {users.length} accounts</span>
              </div>
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      {[
                        { key: 'email', label: 'User' },
                        { key: 'role', label: 'Role' },
                        { key: 'businessName', label: 'Business' },
                        { key: 'subscription', label: 'Plan' },
                        { key: 'balance', label: 'Wallet' },
                        { key: 'createdAt', label: 'Joined' },
                      ].map((h) => (
                        <th key={h.key} aria-sort={sortConfig.key === h.key ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : undefined}>
                          <button type="button" onClick={() => handleSort(h.key)} className="inline-flex items-center gap-1 hover:text-[var(--fg)]">
                            {h.label}
                            <ArrowUpDown className={cx('h-3 w-3', sortConfig.key === h.key ? 'text-[var(--primary)]' : 'opacity-30')} aria-hidden />
                          </button>
                        </th>
                      ))}
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredAndSortedUsers().map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--kw-green-pale)] text-xs font-bold uppercase text-[var(--primary)]">
                              {(u.businessName || u.email || '?').charAt(0)}
                            </span>
                            <span className="min-w-0">
                              <span className="adm-table__primary block truncate">{u.email}</span>
                              <span className="adm-table__mono block truncate">{u.id}</span>
                            </span>
                          </div>
                        </td>
                        <td>
                          {editingUser === u.id ? (
                            <select
                              aria-label="Role"
                              className="input !w-auto !py-1 !text-xs"
                              value={editForm.role || u.role}
                              onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                              <option value="support">Support</option>
                            </select>
                          ) : (
                            <RoleBadge role={u.role} />
                          )}
                        </td>
                        <td className="text-[var(--fg-muted)]">
                          {editingUser === u.id ? (
                            <input
                              type="text"
                              aria-label="Business name"
                              value={editForm.businessName ?? u.businessName ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, businessName: e.target.value })}
                              className="input !py-1 !text-xs"
                            />
                          ) : (
                            u.businessName || '—'
                          )}
                        </td>
                        <td>{u.role === 'user' ? <PlanBadge plan={u.subscription} /> : <span className="text-[var(--fg-subtle)]">—</span>}</td>
                        <td className="adm-table__money">{peso(u.balance)}</td>
                        <td className="whitespace-nowrap text-xs text-[var(--fg-subtle)]">{u.createdAt ? parseUtc(u.createdAt).toLocaleDateString() : '—'}</td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              className="adm-icon-btn adm-icon-btn--primary"
                              aria-label={`Wallet and plan for ${u.email}`}
                              title="Wallet and plan"
                              onClick={() => {
                                setManagingUser(u);
                                setManageAction('balance');
                                setBalanceForm({ amount: 0, reason: '' });
                                setSubForm({ plan: u.subscription || 'FREE', expiresAt: '' });
                              }}
                            >
                              <CreditCard className="h-4 w-4" />
                            </button>
                            {editingUser === u.id ? (
                              <>
                                <button type="button" aria-label="Save" title="Save" className="adm-icon-btn adm-icon-btn--primary" onClick={() => handleUserUpdate(u.id)}><Save className="h-4 w-4" /></button>
                                <button type="button" aria-label="Cancel" title="Cancel" className="adm-icon-btn" onClick={() => { setEditingUser(null); setEditForm({}); }}><X className="h-4 w-4" /></button>
                              </>
                            ) : (
                              <>
                                <button type="button" aria-label={`Edit ${u.email}`} title="Edit role and business" className="adm-icon-btn" onClick={() => { setEditingUser(u.id); setEditForm({}); }}><Edit className="h-4 w-4" /></button>
                                <button type="button" aria-label={`Delete ${u.email}`} title="Delete account" className="adm-icon-btn adm-icon-btn--danger" onClick={() => handleDeleteUser(u.id)}><Trash2 className="h-4 w-4" /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {getFilteredAndSortedUsers().length === 0 && (
                      <tr><td colSpan={7}><Empty>No users match your search.</Empty></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {/* ─────────────  VERIFICATION — review queue  ───────────── */}
          {activeTab === 'verification' && (
            <AdminVerification
              verifications={verifications}
              loading={verifLoading}
              filter={verifStatusFilter}
              onFilter={setVerifStatusFilter}
              selectedId={selectedVerifId}
              onSelect={setSelectedVerifId}
              onApprove={(v) => handleApprove(v.id, v.businessName)}
              onReject={(v) => {
                setRejectModal({ id: v.id, businessName: v.businessName });
                setRejectReason('');
              }}
              paused={!!rejectModal || deciding}
            />
          )}

          {/* ─────────────  BILLING  ───────────── */}
          {activeTab === 'billing' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:max-w-xl">
                <Kpi icon={Wallet} label="Pending payments" value={pendingTxns.length} hint="Waiting to be verified" />
                <Kpi icon={PhilippinePeso} label="Pending amount" value={peso(pendingTotal)} hint="Across all pending payments" />
              </div>
              <Panel flush title="Pending payments" desc="Top-ups and plan payments that haven't been confirmed yet.">
                {billingLoading ? (
                  <div className="adm-spinner" />
                ) : pendingTxns.length === 0 ? (
                  <Empty>No pending transactions — all payments verified.</Empty>
                ) : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr><th>User</th><th>Description</th><th>Amount</th><th>Date</th><th>Status</th><th className="text-right">Action</th></tr>
                      </thead>
                      <tbody>
                        {pendingTxns.map((txn) => (
                          <tr key={txn.id}>
                            <td>
                              <p className="adm-table__primary">{txn.userEmail || txn.userId}</p>
                              <p className="adm-table__mono">{txn.id}</p>
                            </td>
                            <td className="text-[var(--fg-muted)]">{txn.description}</td>
                            <td className="adm-table__money">{peso(txn.amount)}</td>
                            <td className="text-xs text-[var(--fg-subtle)]">{parseUtc(txn.date).toLocaleString()}</td>
                            <td><span className="badge badge-amber">{txn.status}</span></td>
                            <td className="text-right">
                              <button type="button" onClick={() => handleApproveTransaction(txn.id)} className="btn btn-primary btn-sm">
                                <Check className="h-3.5 w-3.5" /> Verify payment
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--fg-muted)]">
                  Manage each user's plan and billing cycle from the{' '}
                  <button type="button" onClick={() => setActiveTab('users')} className="font-bold text-[var(--primary)] hover:underline">Users</button> tab.
                </div>
              </Panel>
            </div>
          )}

          {/* ─────────────  HELP DESK  ───────────── */}
          {activeTab === 'helpdesk' && (
            <Panel flush>
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-3">
                <div className="adm-segment" role="group" aria-label="Filter by status">
                  {(['all', 'Open', 'Pending', 'Resolved'] as const).map((s) => (
                    <button key={s} type="button" aria-pressed={ticketFilter === s} onClick={() => setTicketFilter(s)}>
                      {s === 'all' ? 'All' : s} <span className="tabular-nums opacity-60">{s === 'all' ? tickets.length : tickets.filter((t) => t.status === s).length}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr><th>Ticket</th><th>User</th><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th className="text-right">Action</th></tr>
                  </thead>
                  <tbody>
                    {visibleTickets.length === 0 ? (
                      <tr><td colSpan={7}><Empty>No tickets here.</Empty></td></tr>
                    ) : visibleTickets.map((ticket) => (
                      <tr key={ticket.id}>
                        <td className="adm-table__mono">#{ticket.ticketNum}</td>
                        <td className="text-xs text-[var(--fg-muted)]">{ticket.userEmail}</td>
                        <td className="adm-table__primary">{ticket.subject}</td>
                        <td>
                          <span className={cx('badge', ticket.category === 'Billing' ? 'badge-green' : ticket.category === 'Technical' ? 'badge-amber' : 'badge-sage')}>
                            {ticket.category || 'General'}
                          </span>
                        </td>
                        <td>
                          <span className={cx('badge', ticket.priority === 'Critical' ? 'badge-red' : ticket.priority === 'High' ? 'badge-amber' : 'badge-blue')}>{ticket.priority}</span>
                        </td>
                        <td><span className={cx('badge', ticket.status === 'Open' ? 'badge-green' : 'badge-sage')}>{ticket.status}</span></td>
                        <td className="text-right">
                          {ticket.status !== 'Resolved' && (
                            <button type="button" onClick={() => handleTicketStatus(ticket.id, 'Resolved')} className="btn btn-outline btn-sm">
                              <CheckSquare className="h-3.5 w-3.5" /> Resolve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {/* ─────────────  AUDIT LOGS — activity timeline  ───────────── */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="adm-panel flex flex-wrap items-center gap-2.5 p-3">
                <label className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-alt)] px-3 focus-within:border-[var(--primary)]">
                  <Search className="h-4 w-4 text-[var(--fg-subtle)]" aria-hidden />
                  <input
                    type="text"
                    placeholder="Search account, email, action…"
                    aria-label="Search audit logs"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--fg-subtle)]"
                  />
                </label>
                <Menu.Root>
                  <Menu.Trigger className="flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-semibold text-[var(--fg)] hover:border-[var(--border-strong)]">
                    <Filter className="h-3.5 w-3.5 text-[var(--fg-subtle)]" aria-hidden />
                    {LOG_FILTERS.find((f) => f.key === logFilter)?.label}
                    <ChevronDown className="h-3.5 w-3.5 text-[var(--fg-subtle)]" aria-hidden />
                  </Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Positioner side="bottom" align="start" sideOffset={6} className="z-[95]">
                      <Menu.Popup className="min-w-[240px] origin-[var(--transform-origin)] rounded-xl border border-[var(--border-strong)] bg-[var(--card)] p-1 shadow-lg outline-none transition-[transform,opacity] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
                        {LOG_FILTERS.map((f) => (
                          <Menu.Item
                            key={f.key}
                            onClick={() => setLogFilter(f.key)}
                            className="flex cursor-default items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--fg-muted)] outline-none data-[highlighted]:bg-[var(--bg-alt)] data-[highlighted]:text-[var(--fg)]"
                          >
                            <Check className={cx('h-3.5 w-3.5 text-[var(--primary)]', logFilter !== f.key && 'invisible')} aria-hidden />
                            {f.label}
                          </Menu.Item>
                        ))}
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
                <button type="button" onClick={() => setLogSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))} className="btn btn-glass btn-sm ml-auto">
                  <ArrowUpDown className="h-3.5 w-3.5" /> {logSortDir === 'desc' ? 'Newest' : 'Oldest'} first
                </button>
              </div>

              <div className="adm-panel p-5">
                {getGroupedLogs().length === 0 ? (
                  <Empty>No logs match.</Empty>
                ) : (
                  getGroupedLogs().map(({ day, entries }) => (
                    <div key={day} className="mb-7 last:mb-0">
                      <p className="mb-3.5 text-[11px] font-bold uppercase tracking-wider text-[var(--fg-subtle)]">{day}</p>
                      <ol className="ml-1.5 space-y-5 border-l-2 border-[var(--border)] pl-5">
                        {entries.map((log) => {
                          const meta = ACTION_META[log.action] || DEFAULT_ACTION_META;
                          const Icon = meta.icon;
                          return (
                            <li key={log.id} className="relative">
                              <span className={cx('absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-[var(--card)]', meta.dot)} />
                              <div className="flex items-start gap-3">
                                <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-xl', meta.bg)}>
                                  <Icon className={cx('h-4 w-4', meta.fg)} />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold">{meta.label}</p>
                                    <span className="whitespace-nowrap text-xs text-[var(--fg-subtle)]" title={parseUtc(log.timestamp).toLocaleString()}>{timeAgo(log.timestamp)}</span>
                                  </div>
                                  {log.details && <p className="mt-1 break-words text-xs leading-relaxed text-[var(--fg-muted)]">{log.details}</p>}
                                  <p className="adm-table__mono mt-1.5 !text-[10px]">account id: {log.user_id}</p>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ─────────────  SETTINGS  ───────────── */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
              <Panel
                title="System status"
                desc={health.checkedAt ? `Checked ${new Date(health.checkedAt).toLocaleTimeString()}` : 'Checking…'}
                actions={refreshBtn(checkHealth)}
              >
                <div className="space-y-3">
                  <div className="adm-setting-row">
                    <span className="flex items-center gap-2.5">
                      <span className={cx('h-2.5 w-2.5 rounded-full', pill.dot)} aria-hidden />
                      <span>
                        <span className="block text-sm font-bold">API and database</span>
                        <span className="block text-xs text-[var(--fg-muted)]">{pill.label}{health.latencyMs != null ? ` · ${health.latencyMs} ms` : ''}</span>
                      </span>
                    </span>
                  </div>
                  <SettingSwitch
                    label="Maintenance mode"
                    desc="Disable access for non-admins."
                    checked={systemSettings.maintenanceMode}
                    onChange={(v) => setSystemSettings({ ...systemSettings, maintenanceMode: v })}
                  />
                  <SettingSwitch
                    label="Allow registrations"
                    desc="New users can sign up."
                    checked={systemSettings.allowRegistrations}
                    onChange={(v) => setSystemSettings({ ...systemSettings, allowRegistrations: v })}
                  />
                </div>
              </Panel>

              <Panel title="Appearance" desc="Applies to the admin console on this device.">
                <div className="adm-segment adm-segment--full" role="group" aria-label="Theme">
                  <button type="button" aria-pressed={!darkMode} onClick={() => setDark(false)}><Sun className="h-4 w-4" /> Light</button>
                  <button type="button" aria-pressed={darkMode} onClick={() => setDark(true)}><Moon className="h-4 w-4" /> Dark</button>
                </div>
              </Panel>

              <Panel className="md:col-span-2" title="Admin profile" desc="Change the administrator sign-in credentials.">
                <div className="space-y-4">
                  <div>
                    <FieldLabel htmlFor="admin-email">Email</FieldLabel>
                    <input id="admin-email" type="text" value={adminProfile.email} disabled className="input cursor-not-allowed opacity-60" />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel htmlFor="admin-pw">New password</FieldLabel>
                      <input id="admin-pw" type="password" value={adminProfile.password} onChange={(e) => setAdminProfile({ ...adminProfile, password: e.target.value })} className="input" />
                    </div>
                    <div>
                      <FieldLabel htmlFor="admin-pw-confirm">Confirm password</FieldLabel>
                      <input
                        id="admin-pw-confirm"
                        type="password"
                        value={adminProfile.confirm}
                        onChange={(e) => setAdminProfile({ ...adminProfile, confirm: e.target.value })}
                        className="input"
                        aria-invalid={!!adminProfile.confirm && adminProfile.password !== adminProfile.confirm}
                        aria-describedby="admin-pw-match"
                      />
                      {adminProfile.confirm && adminProfile.password !== adminProfile.confirm && (
                        <p id="admin-pw-match" className="mt-1.5 text-xs" style={{ color: 'var(--danger)' }}>Passwords don’t match.</p>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={handleAdminProfileUpdate} className="btn btn-primary" disabled={adminProfile.password !== adminProfile.confirm}>
                      <Lock className="h-4 w-4" /> Update credentials
                    </button>
                  </div>
                </div>
              </Panel>
            </div>
          )}
        </div>
      </div>

      {/* ── Manage-user dialog ── */}
      {managingUser && (
        <AdminModal title="Manage user" sub={managingUser.email} onClose={() => setManagingUser(null)}>
          <Tabs.Root value={manageAction} onValueChange={(v) => setManageAction(v as 'balance' | 'subscription')}>
            <Tabs.List className="adm-segment adm-segment--full mb-4">
              <Tabs.Tab value="balance">Wallet balance</Tabs.Tab>
              <Tabs.Tab value="subscription">Subscription</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="balance" className="space-y-3 outline-none">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-alt)] p-4 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-subtle)]">Current balance</span>
                <p className="mt-1 font-display text-2xl font-bold">{peso(managingUser.balance)}</p>
              </div>
              <div>
                <FieldLabel htmlFor="adj-amount">Amount to add (negative to subtract)</FieldLabel>
                <input id="adj-amount" type="number" value={balanceForm.amount} onChange={(e) => setBalanceForm({ ...balanceForm, amount: Number(e.target.value) })} className="input" />
              </div>
              <div>
                <FieldLabel htmlFor="adj-reason">Reason / reference</FieldLabel>
                <input id="adj-reason" type="text" value={balanceForm.reason} onChange={(e) => setBalanceForm({ ...balanceForm, reason: e.target.value })} placeholder="e.g. Manual top-up" className="input" />
              </div>
              <button type="button" onClick={handleAdjustBalance} className="btn btn-primary w-full">Confirm adjustment</button>
            </Tabs.Panel>
            <Tabs.Panel value="subscription" className="space-y-4 outline-none">
              <div>
                <FieldLabel htmlFor="sub-plan">Plan</FieldLabel>
                <select id="sub-plan" value={subForm.plan} onChange={(e) => setSubForm({ ...subForm, plan: e.target.value })} className="input">
                  <option value="FREE">Free</option>
                  <option value="PRO">Pro</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="sub-expiry">Expiry date</FieldLabel>
                <input id="sub-expiry" type="date" value={subForm.expiresAt} onChange={(e) => setSubForm({ ...subForm, expiresAt: e.target.value })} className="input" />
              </div>
              <button type="button" onClick={handleUpdateSubscription} className="btn btn-primary w-full">Update subscription</button>
            </Tabs.Panel>
          </Tabs.Root>
        </AdminModal>
      )}

      {/* ── Reject-verification dialog ── */}
      {rejectModal && (
        <AdminModal title="Reject verification" sub={rejectModal.businessName} onClose={() => setRejectModal(null)}>
          <div className="space-y-4">
            <div>
              <FieldLabel htmlFor="reject-reason">
                Rejection reason <span className="text-[var(--danger)]">*</span>
              </FieldLabel>
              <textarea
                id="reject-reason"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Document appears unreadable, business name does not match…"
                className="input resize-none"
                aria-describedby="reject-hint"
              />
              <p id="reject-hint" className="mt-1.5 text-xs" style={{ color: 'var(--fg-subtle)' }}>The owner sees this reason, so say what they need to fix.</p>
            </div>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setRejectModal(null)} className="btn btn-outline flex-1">Cancel</button>
              <button type="button" onClick={handleReject} disabled={!rejectReason.trim()} className="btn btn-primary flex-1 disabled:opacity-50" style={{ background: 'var(--danger)' }}>
                Confirm rejection
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
};

export default AdminDashboard;
