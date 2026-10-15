import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Users, Activity, MessageSquare, CheckSquare, Clock, CheckCircle, Trash2, Edit, Save, X, Search, Shield, Settings, Power, Download, Filter, Lock, CreditCard, Moon, Sun, XCircle, Wallet, ChevronDown, RefreshCw, UserPlus, LogIn, Upload, Send, CalendarClock, AlertTriangle } from 'lucide-react';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { supportService } from '../services/supportService';
import { supportRealtime } from '../services/supportRealtime';
import { Ticket, User } from '../types';
import { useOrganicDialog } from './OrganicDialog';
import { useToast } from './ui/Toast';
import AccountMenu from './AccountMenu';
import AdminOverview, { HealthInfo } from './admin/AdminOverview';
import AdminVerification, { VerifFilter } from './admin/AdminVerification';
import { buildJobs, parseUtc, timeAgo } from '../utils/adminJobs';
import './admin/adminConsole.css';

interface Props {
  darkMode: boolean;
  toggleTheme: () => void;
  user: User;
  onSignOut: () => void;
  onSwitchAccount?: () => void;
}

/* ── Shared building blocks for the console ──────────────────────── */
const cx = (...c: Array<string | false | undefined | null>) => c.filter(Boolean).join(' ');

const Panel: React.FC<{
  title?: string; desc?: string; actions?: React.ReactNode; children: React.ReactNode; flush?: boolean;
}> = ({ title, desc, actions, children, flush }) => (
  <section className="adm-panel">
    {(title || actions) && (
      <header className="adm-panel__head">
        <div className="min-w-0">
          {title && <h3 className="adm-panel__title">{title}</h3>}
          {desc && <p className="adm-panel__desc">{desc}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </header>
    )}
    <div className={flush ? '' : 'p-5'}>{children}</div>
  </section>
);

const AdminModal: React.FC<{
  title: string; sub?: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}> = ({ title, sub, onClose, children, wide }) => (
  <div className="kw-overlay" onClick={onClose}>
    <div className={cx('kw-sheet w-full', wide ? 'max-w-lg' : 'max-w-md')} onClick={(e) => e.stopPropagation()}>
      <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-[var(--fg)]">{title}</h3>
          {sub && <p className="text-xs text-[var(--fg-muted)] truncate mt-0.5">{sub}</p>}
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-alt)] transition-colors">
          <X className="w-4 h-4" />
        </button>
      </header>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

const RoleBadge: React.FC<{ role: string }> = ({ role }) => (
  <span className={cx('badge', role === 'admin' ? 'badge-green' : role === 'support' ? 'badge-blue' : 'badge-sage')}>
    {role}
  </span>
);

const VStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = { pending: 'badge-amber', verified: 'badge-green', rejected: 'badge-red' };
  const Icon = status === 'pending' ? Clock : status === 'verified' ? CheckCircle : XCircle;
  return (
    <span className={cx('badge', map[status] || 'badge-sage')}>
      <Icon className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

/* ── Audit timeline: per-action icon, color and label ────────────── */
const ACTION_META: Record<string, { label: string; icon: React.ElementType; bg: string; fg: string; dot: string }> = {
  register: { label: 'Account registered', icon: UserPlus, bg: 'bg-blue-500/10', fg: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  login: { label: 'Signed in', icon: LogIn, bg: 'bg-[var(--bg-alt)]', fg: 'text-[var(--fg-muted)]', dot: 'bg-[var(--fg-subtle)]' },
  submit_verification: { label: 'Document submitted', icon: Upload, bg: 'bg-amber-500/10', fg: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  resubmit_verification: { label: 'Document resubmitted', icon: Upload, bg: 'bg-amber-500/10', fg: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  approve_verification: { label: 'Verification approved', icon: CheckCircle, bg: 'bg-emerald-500/10', fg: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  reject_verification: { label: 'Verification rejected', icon: XCircle, bg: 'bg-red-500/10', fg: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  delete_user: { label: 'Account deleted', icon: Trash2, bg: 'bg-rose-600/10', fg: 'text-rose-700 dark:text-rose-400', dot: 'bg-rose-600' },
  publish_post: { label: 'Post published', icon: Send, bg: 'bg-emerald-500/10', fg: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  schedule_post: { label: 'Post scheduled', icon: CalendarClock, bg: 'bg-amber-500/10', fg: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  post_published: { label: 'Scheduled post went live', icon: CheckCircle, bg: 'bg-emerald-500/10', fg: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  post_failed: { label: 'Scheduled post failed', icon: AlertTriangle, bg: 'bg-red-500/10', fg: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
};
const DEFAULT_ACTION_META = { label: 'System event', icon: Activity, bg: 'bg-[var(--bg-alt)]', fg: 'text-[var(--fg-muted)]', dot: 'bg-[var(--fg-subtle)]' };

/** Audit entries loaded for the dispatch table and logs (newest first). */
const AUDIT_WINDOW = 300;

type SearchHit = { kind: 'account' | 'job' | 'verification'; id: string; label: string; sub: string };

/** ⌘K search across accounts, dispatch jobs and verification submissions. */
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
      <label className="flex h-8 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2.5 focus-within:border-[var(--primary)]">
        <Search className="h-3.5 w-3.5 shrink-0 text-[var(--fg-subtle)]" aria-hidden />
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
          placeholder="Search accounts, job IDs, verifications…"
          aria-label="Search the admin workspace"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--fg-subtle)]"
        />
        <kbd className="hidden rounded border border-[var(--border)] px-1 font-mono text-[10px] text-[var(--fg-subtle)] sm:inline">⌘K</kbd>
      </label>
      {open && q.trim().length >= 2 && (
        <ul onMouseDown={(e) => e.preventDefault()} className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-md border border-[var(--border-strong)] bg-[var(--card)] py-1 shadow-lg" role="listbox">
          {hits.length === 0 ? (
            <li className="px-3 py-2 text-xs text-[var(--fg-muted)]">No matches for “{q.trim()}”.</li>
          ) : (
            hits.map((hit, i) => (
              <li key={`${hit.kind}-${hit.id}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onClick={() => pick(hit)}
                  onMouseEnter={() => setActive(i)}
                  className={cx('flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs', i === active && 'bg-[var(--bg-alt)]')}
                >
                  <span className="w-[74px] shrink-0 font-mono text-[10px] uppercase tracking-wide text-[var(--fg-subtle)]">{hit.kind}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-[var(--fg)]">{hit.label}</span>
                    <span className="block truncate font-mono text-[11px] text-[var(--fg-muted)]">{hit.sub}</span>
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

const LOG_FILTERS: Array<{ key: string; label: string; actions?: string[] }> = [
  { key: 'all', label: 'All actions' },
  { key: 'accounts', label: 'Accounts — register & login', actions: ['register', 'login'] },
  { key: 'submitted', label: 'Documents submitted', actions: ['submit_verification', 'resubmit_verification'] },
  { key: 'approved', label: 'Verifications approved', actions: ['approve_verification'] },
  { key: 'rejected', label: 'Verifications rejected', actions: ['reject_verification'] },
  { key: 'deleted', label: 'Accounts deleted', actions: ['delete_user'] },
  { key: 'publishing', label: 'Publishing — posts & outcomes', actions: ['publish_post', 'schedule_post', 'post_published', 'post_failed'] },
];

const dayLabel = (iso: string): string => {
  const d = parseUtc(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
};

const AdminDashboard: React.FC<Props> = ({ darkMode, toggleTheme, user, onSignOut, onSwitchAccount }) => {
  const dialog = useOrganicDialog();
  const toast = useToast();
  const [dbService] = useState(() => new UniversalDatabaseService());
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'verification' | 'billing' | 'helpdesk' | 'logs' | 'settings'>('overview');
  
  const [pendingTxns, setPendingTxns] = useState<any[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  
  // Data State
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<any[]>([]); // Using 'any' to include balance
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // User Management State
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [managingUser, setManagingUser] = useState<any | null>(null); // For Modal
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });
  const [logFilter, setLogFilter] = useState('all');
  const [logFilterOpen, setLogFilterOpen] = useState(false);
  const logFilterRef = useRef<HTMLDivElement>(null);
  const [logSearch, setLogSearch] = useState('');
  const [logSortDir, setLogSortDir] = useState<'asc' | 'desc'>('desc');

  // Modal State
  const [manageAction, setManageAction] = useState<'balance' | 'subscription'>('balance');
  const [balanceForm, setBalanceForm] = useState({ amount: 0, reason: '' });
  const [subForm, setSubForm] = useState({ plan: 'FREE', expiresAt: '' });

  // Verification State
  const [verifications, setVerifications] = useState<any[]>([]);
  const [verifLoading, setVerifLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ id: string; businessName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [verifStatusFilter, setVerifStatusFilter] = useState<VerifFilter>('pending');
  const [selectedVerifId, setSelectedVerifId] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false); // an approve confirm is open or in flight

  // Workbench chrome
  const [health, setHealth] = useState<HealthInfo>({ status: 'checking', passed: 0, total: 0 });
  const [diagRunning, setDiagRunning] = useState(false);
  const [openJobId, setOpenJobId] = useState<string | null>(null);

  // Settings State
  const [systemSettings, setSystemSettings] = useState({
    maintenanceMode: false,
    allowRegistrations: true
  });

  const [adminProfile, setAdminProfile] = useState<{email: string, password: '', confirm: ''}>({
    email: 'admin@kawayan.ph',
    password: '',
    confirm: ''
  });

  useEffect(() => {
    loadData();
  }, [dbService]);

  // Live status: the API answers and its database check passes. Timed, and tallied for this session.
  const checkHealth = useCallback(async () => {
    const started = performance.now();
    let status: HealthInfo['status'];
    try {
      const d = await (await fetch('/api/health')).json();
      status = d.status === 'healthy' ? 'ok' : 'db-down';
    } catch {
      status = 'api-down';
    }
    const latencyMs = Math.round(performance.now() - started);
    setHealth((h) => ({ status, latencyMs, checkedAt: Date.now(), passed: h.passed + (status === 'ok' ? 1 : 0), total: h.total + 1 }));
  }, []);

  useEffect(() => {
    checkHealth();
    const id = setInterval(checkHealth, 60_000);
    return () => clearInterval(id);
  }, [checkHealth]);

  const runDiagnostics = async () => {
    setDiagRunning(true);
    await Promise.all([checkHealth(), loadData()]);
    setDiagRunning(false);
  };

  useEffect(() => {
    if (activeTab === 'verification') loadVerifications();
    if (activeTab === 'billing') loadPendingTransactions();
  }, [activeTab]);

  // Audit logs auto-refresh — no manual refresh button, just poll quietly.
  useEffect(() => {
    const interval = setInterval(loadAuditLogs, 8000);
    return () => clearInterval(interval);
  }, [dbService]);

  useEffect(() => {
    if (!logFilterOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (logFilterRef.current && !logFilterRef.current.contains(e.target as Node)) setLogFilterOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [logFilterOpen]);

  useEffect(() => {
    supportRealtime.connect();
    return supportRealtime.onVerificationUpdated(() => {
      if (activeTab === 'verification') loadVerifications();
    });
  }, [activeTab]);

  const loadPendingTransactions = async () => {
    setBillingLoading(true);
    try {
      const list = await dbService.getPendingTransactionsAdmin();
      setPendingTxns(list);
    } catch (e) {
      console.error('Error loading pending transactions:', e);
    } finally {
      setBillingLoading(false);
    }
  };

  const handleApproveTransaction = async (transactionId: string) => {
    const confirmed = await dialog.confirm('Approve this payment and credit the user wallet?');
    if (!confirmed) return;
    try {
      await dbService.approveTransactionAdmin(transactionId);
      toast.success('Payment verified and balance updated');
      loadPendingTransactions();
      loadData();
    } catch (e) {
      toast.error('Could not approve the payment.');
    }
  };

  const loadData = async () => {
    try {
      const [userList, ticketList, logs, verifList] = await Promise.all([
        dbService.getAllUsers(),
        dbService.getAllTicketsAdmin(),
        dbService.getAuditLogs(AUDIT_WINDOW),
        dbService.getAllVerifications(),
      ]);
      setUsers(userList);
      setVerifications(verifList);
      setTickets(ticketList);
      setAuditLogs(logs);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const logs = await dbService.getAuditLogs(AUDIT_WINDOW);
      setAuditLogs(logs);
    } catch (e) {
      console.error('Error loading audit logs:', e);
    }
  };

  const loadVerifications = async () => {
    setVerifLoading(true);
    try {
      const list = await dbService.getAllVerifications();
      setVerifications(list);
      setSelectedVerifId((current) => current ?? (list[0]?.id ?? null));
    } catch (e) {
      console.error('Error loading verifications:', e);
    } finally {
      setVerifLoading(false);
    }
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
    if (!rejectModal) return;
    if (!rejectReason.trim()) return; // the button stays disabled until a reason is typed
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

  // --- Sorting & Filtering ---
  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getFilteredAndSortedUsers = () => {
    let filtered = users.filter(u => 
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) || 
      (u.businessName && u.businessName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return filtered.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      // Handle nulls
      if (aVal === null) aVal = '';
      if (bVal === null) bVal = '';

      // Handle numbers
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // Handle strings
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const getFilteredLogs = () => {
    const q = logSearch.trim().toLowerCase();
    const group = LOG_FILTERS.find(f => f.key === logFilter);
    return auditLogs
      .filter((log) => !group?.actions || group.actions.includes(log.action))
      .filter((log) => !q || `${log.action} ${log.user_id} ${log.details || ''}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const diff = parseUtc(a.timestamp).getTime() - parseUtc(b.timestamp).getTime();
        return logSortDir === 'asc' ? diff : -diff;
      });
  };

  const getGroupedLogs = () => {
    const groups: Array<{ day: string; entries: any[] }> = [];
    for (const log of getFilteredLogs()) {
      const label = dayLabel(log.timestamp);
      const last = groups[groups.length - 1];
      if (last && last.day === label) last.entries.push(log);
      else groups.push({ day: label, entries: [log] });
    }
    return groups;
  };

  // --- Export Data ---
  const exportUsersToCSV = () => {
    const headers = ['ID,Email,Role,Business Name,Balance,Created At'];
    const rows = users.map(u => 
      `${u.id},${u.email},${u.role},"${u.businessName || ''}",${u.balance || 0},${u.createdAt}`
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `kawayan_users_${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    if (confirmed) {
      try {
        await dbService.deleteUser(userId);
        loadData();
      } catch (error) {
        toast.error('Could not delete the user.');
      }
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

  const handleTicketStatus = (id: string, status: 'Open' | 'Pending' | 'Resolved') => {
    supportService.updateTicketStatus(id, status);
    dbService.getAllTicketsAdmin().then(setTickets);
  };

  const handleAdminProfileUpdate = async () => {
    if (adminProfile.password !== adminProfile.confirm) return; // shown under the field
    toast.info('Admin profile updated (simulation only)');
  };

  const setDark = (wantDark: boolean) => {
    if (wantDark !== darkMode) toggleTheme();
  };

  const NAV: Array<{ id: typeof activeTab; label: string; icon: React.ElementType; count?: number }> = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'users', label: 'Users', icon: Users, count: users.length || undefined },
    { id: 'verification', label: 'Verification', icon: Shield, count: verifications.filter((v) => v.status === 'pending').length || undefined },
    { id: 'billing', label: 'Billing', icon: CreditCard, count: pendingTxns.length || undefined },
    { id: 'helpdesk', label: 'Help Desk', icon: MessageSquare, count: tickets.filter((t) => t.status !== 'Resolved').length || undefined },
    { id: 'logs', label: 'Audit Logs', icon: Clock },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const HEADINGS: Record<typeof activeTab, { title: string; sub: string }> = {
    overview: { title: 'Operations', sub: 'Dispatch jobs, verification backlog and system status.' },
    users: { title: 'Users', sub: 'Search, edit roles, adjust wallets and manage subscriptions.' },
    verification: { title: 'Verification queue', sub: 'Review business documents and approve or reject MSME accounts.' },
    billing: { title: 'Billing', sub: 'Verify pending wallet top-ups and manage billing cycles.' },
    helpdesk: { title: 'Help desk', sub: 'Track and resolve customer support tickets.' },
    logs: { title: 'Audit logs', sub: 'Every privileged action, timestamped.' },
    settings: { title: 'System settings', sub: 'Platform switches, appearance and admin credentials.' },
  };

  const jobs = useMemo(() => buildJobs(auditLogs), [auditLogs]);

  const searchHits = (q: string): SearchHit[] => [
    ...users
      .filter((u) => `${u.email} ${u.businessName || ''} ${u.id}`.toLowerCase().includes(q))
      .slice(0, 5)
      .map((u): SearchHit => ({ kind: 'account', id: u.id, label: u.businessName || u.email, sub: `${u.email} · ${u.role} · ${u.id}` })),
    ...jobs
      .filter((j) => `${j.id} ${j.postId || ''}`.toLowerCase().includes(q))
      .slice(0, 5)
      .map((j): SearchHit => ({ kind: 'job', id: j.id, label: `Job ${j.id}`, sub: `${j.tenant.name} · ${j.status} · ${j.topic}` })),
    ...verifications
      .filter((v) => `${v.businessName || ''} ${v.email} ${v.id}`.toLowerCase().includes(q))
      .slice(0, 3)
      .map((v): SearchHit => ({ kind: 'verification', id: v.id, label: v.businessName || 'Unnamed business', sub: `${v.email} · ${v.status}` })),
  ];

  const pickSearchHit = (hit: SearchHit) => {
    if (hit.kind === 'account') {
      setActiveTab('users');
      setSearchTerm(users.find((u) => u.id === hit.id)?.email ?? '');
    } else if (hit.kind === 'job') {
      setActiveTab('overview');
      setOpenJobId(hit.id);
    } else {
      setActiveTab('verification');
      setVerifStatusFilter('all');
      setSelectedVerifId(hit.id);
    }
  };

  const reviewVerification = (id?: string) => {
    setActiveTab('verification');
    setVerifStatusFilter(id ? 'all' : 'pending');
    if (id) setSelectedVerifId(id);
    else setSelectedVerifId(verifications.find((v) => v.status === 'pending')?.id ?? null);
  };

  const STATUS_PILL = {
    checking: { label: 'Checking status…', dot: 'bg-[var(--fg-subtle)]' },
    ok: { label: 'System operational', dot: 'bg-[var(--success)]' },
    'db-down': { label: 'Database unreachable', dot: 'bg-[var(--danger)]' },
    'api-down': { label: 'API unreachable', dot: 'bg-[var(--danger)]' },
  }[health.status];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="adm-spinner" />
      </div>
    );
  }

  const head = HEADINGS[activeTab];
  const refreshBtn = (fn: () => void) => (
    <button type="button" onClick={fn} className="btn btn-glass btn-sm">
      <RefreshCw className="w-3.5 h-3.5" /> Refresh
    </button>
  );

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      {/* ── Sidebar ── */}
      <aside className="sticky top-0 hidden h-screen w-[200px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)] md:flex">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--border)] px-3">
          <img src="/logo.png" alt="" className="h-6 w-6 rounded-md object-contain" />
          <span className="text-[13px] font-semibold">Kawayan</span>
          <span className="rounded border border-[var(--border-strong)] px-1 font-mono text-[10px] text-[var(--fg-muted)]">ADMIN</span>
        </div>
        <nav aria-label="Admin" className="flex-1 space-y-px overflow-y-auto p-2">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={activeTab === item.id ? 'page' : undefined}
              className={cx(
                'flex h-8 w-full items-center gap-2 rounded px-2 text-[13px] transition-colors',
                activeTab === item.id
                  ? 'bg-[var(--bg-alt)] font-semibold text-[var(--fg)] shadow-[inset_2px_0_0_var(--primary)]'
                  : 'text-[var(--fg-muted)] hover:bg-[var(--bg-alt)] hover:text-[var(--fg)]',
              )}
            >
              <item.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="flex-1 text-left">{item.label}</span>
              {item.count != null && <span className="font-mono text-[11px] tabular-nums text-[var(--fg-subtle)]">{item.count}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── Top bar ── */}
        <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4">
          <nav aria-label="Breadcrumb" className="hidden shrink-0 items-center gap-1.5 text-xs text-[var(--fg-muted)] lg:flex">
            <span>Kawayan</span>
            <span className="text-[var(--fg-subtle)]">/</span>
            <span>Admin Workspace</span>
            <span className="text-[var(--fg-subtle)]">/</span>
            <span className="font-semibold text-[var(--fg)]">{head.title}</span>
          </nav>
          <div className="flex min-w-0 flex-1 justify-center">
            <AdminSearch hitsFor={searchHits} onPick={pickSearchHit} />
          </div>
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium sm:inline-flex" role="status">
            <span className="relative flex h-2 w-2" aria-hidden>
              {health.status === 'ok' && <span className={cx('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden', STATUS_PILL.dot)} />}
              <span className={cx('relative inline-flex h-2 w-2 rounded-full', STATUS_PILL.dot)} />
            </span>
            {STATUS_PILL.label}
          </span>
          <AccountMenu user={user} onSignOut={onSignOut} onSwitchAccount={onSwitchAccount} onSettings={() => setActiveTab('settings')} />
        </header>

        {/* Phones: tabs instead of the sidebar */}
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--card)] px-2 py-1.5 md:hidden">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={activeTab === item.id ? 'page' : undefined}
              className="shrink-0 rounded px-2 py-1 text-xs text-[var(--fg-muted)] aria-[current=page]:bg-[var(--bg-alt)] aria-[current=page]:font-semibold aria-[current=page]:text-[var(--fg)]"
            >
              {item.label}{item.count != null ? ` ${item.count}` : ''}
            </button>
          ))}
        </nav>

        {/* App's <main> already wraps the console, so this is a plain region. */}
        <div className="min-w-0 flex-1 p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-[15px] font-semibold">{head.title}</h1>
              <p className="text-xs text-[var(--fg-muted)]">{head.sub}</p>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === 'overview' && refreshBtn(loadData)}
              {activeTab === 'users' && (
                <button type="button" onClick={exportUsersToCSV} className="btn btn-glass btn-sm">
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              )}
              {activeTab === 'verification' && refreshBtn(loadVerifications)}
            </div>
          </div>

        {/* ─────────────  OVERVIEW — operations workbench  ───────────── */}
        {activeTab === 'overview' && (
          <AdminOverview
            users={users}
            verifications={verifications}
            auditLogs={auditLogs}
            openJobId={openJobId}
            onOpenJob={setOpenJobId}
            health={health}
            diagRunning={diagRunning}
            onRunDiagnostics={runDiagnostics}
            onReviewVerification={reviewVerification}
            onOpenTenant={(email) => {
              setActiveTab('users');
              setSearchTerm(email);
            }}
          />
        )}

        {/* ─────────────  USERS  ───────────── */}
        {activeTab === 'users' && (
          <Panel flush>
            <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-alt)]">
              <div className="relative max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]" />
                <input
                  type="text"
                  placeholder="Search users…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input !pl-9"
                />
              </div>
            </div>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    {[
                      { key: 'email', label: 'User' },
                      { key: 'role', label: 'Role' },
                      { key: 'businessName', label: 'Business' },
                      { key: 'balance', label: 'Wallet' },
                      { key: 'createdAt', label: 'Joined' },
                    ].map((h) => (
                      <th key={h.key} className="is-sortable" onClick={() => handleSort(h.key)}>
                        <span className="inline-flex items-center gap-1">
                          {h.label}
                          <Filter className={cx('w-3 h-3', sortConfig.key === h.key ? 'text-[var(--primary)]' : 'opacity-30')} />
                        </span>
                      </th>
                    ))}
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredAndSortedUsers().map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="adm-table__primary">{user.email}</div>
                        <div className="adm-table__mono">{user.id}</div>
                      </td>
                      <td>
                        {editingUser === user.id ? (
                          <select
                            className="input !py-1 !text-xs !w-auto"
                            value={editForm.role || user.role}
                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                            <option value="support">Support</option>
                          </select>
                        ) : (
                          <RoleBadge role={user.role} />
                        )}
                      </td>
                      <td className="text-[var(--fg-muted)]">
                        {editingUser === user.id ? (
                          <input
                            type="text"
                            value={editForm.businessName ?? user.businessName ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, businessName: e.target.value })}
                            className="input !py-1 !text-xs"
                          />
                        ) : (
                          user.businessName || '—'
                        )}
                      </td>
                      <td className="adm-table__money">₱{(user.balance || 0).toLocaleString()}</td>
                      <td className="text-xs text-[var(--fg-subtle)] whitespace-nowrap">
                        {user.createdAt ? parseUtc(user.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="adm-icon-btn adm-icon-btn--primary"
                            title="Wallet / subscription"
                            onClick={() => { setManagingUser(user); setBalanceForm({ amount: 0, reason: '' }); setSubForm({ plan: 'FREE', expiresAt: '' }); }}
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                          {editingUser === user.id ? (
                            <>
                              <button className="adm-icon-btn adm-icon-btn--primary" onClick={() => handleUserUpdate(user.id)}><Save className="w-4 h-4" /></button>
                              <button className="adm-icon-btn" onClick={() => { setEditingUser(null); setEditForm({}); }}><X className="w-4 h-4" /></button>
                            </>
                          ) : (
                            <>
                              <button className="adm-icon-btn" onClick={() => { setEditingUser(user.id); setEditForm({}); }}><Edit className="w-4 h-4" /></button>
                              <button className="adm-icon-btn adm-icon-btn--danger" onClick={() => handleDeleteUser(user.id)}><Trash2 className="w-4 h-4" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {getFilteredAndSortedUsers().length === 0 && (
                    <tr><td colSpan={6}><div className="adm-empty">No users match your search.</div></td></tr>
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
          <Panel flush>
            {billingLoading ? (
              <div className="adm-spinner" />
            ) : pendingTxns.length === 0 ? (
              <div className="adm-empty">No pending transactions — all payments verified.</div>
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
                        <td className="adm-table__money">₱{Number(txn.amount).toLocaleString()}</td>
                        <td className="text-xs text-[var(--fg-subtle)]">{parseUtc(txn.date).toLocaleString()}</td>
                        <td><span className="badge badge-amber">{txn.status}</span></td>
                        <td className="text-right">
                          <button onClick={() => handleApproveTransaction(txn.id)} className="btn btn-primary btn-sm">Verify payment</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-5 py-3 border-t border-[var(--border)] text-xs text-[var(--fg-muted)]">
              Manage billing cycles per user under the{' '}
              <button type="button" onClick={() => setActiveTab('users')} className="font-bold text-[var(--primary)] hover:underline">Users</button> tab.
            </div>
          </Panel>
        )}

        {/* ─────────────  HELP DESK  ───────────── */}
        {activeTab === 'helpdesk' && (
          <Panel flush>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr><th>Ticket</th><th>User</th><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th className="text-right">Action</th></tr>
                </thead>
                <tbody>
                  {tickets.length === 0 ? (
                    <tr><td colSpan={7}><div className="adm-empty">No tickets found.</div></td></tr>
                  ) : tickets.map((ticket) => (
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
                        <span className={cx('badge', ticket.priority === 'Critical' ? 'badge-red' : ticket.priority === 'High' ? 'badge-amber' : 'badge-blue')}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td>
                        <span className={cx('badge', ticket.status === 'Open' ? 'badge-green' : 'badge-sage')}>{ticket.status}</span>
                      </td>
                      <td className="text-right">
                        {ticket.status !== 'Resolved' && (
                          <button onClick={() => handleTicketStatus(ticket.id, 'Resolved')} className="btn btn-outline btn-sm">
                            <CheckSquare className="w-3.5 h-3.5" /> Resolve
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
            {/* Toolbar */}
            <div className="adm-panel p-3.5" style={{ overflow: 'visible' }}>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]" />
                  <input
                    type="text"
                    placeholder="Search account, email, action…"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    className="input !pl-8 !py-1.5 !text-xs"
                  />
                </div>
                <div className="relative" ref={logFilterRef}>
                  <button
                    type="button"
                    onClick={() => setLogFilterOpen((o) => !o)}
                    className="input !py-1.5 !text-xs !w-auto !pl-8 pr-7 relative flex items-center whitespace-nowrap cursor-pointer"
                  >
                    <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]" />
                    {LOG_FILTERS.find((f) => f.key === logFilter)?.label}
                    <ChevronDown className={cx('w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)] transition-transform', logFilterOpen && 'rotate-180')} />
                  </button>
                  {logFilterOpen && (
                    <div className="absolute z-20 top-full mt-1.5 left-0 min-w-[230px] rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg py-1.5">
                      {LOG_FILTERS.map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => { setLogFilter(f.key); setLogFilterOpen(false); }}
                          className={cx(
                            'w-full text-left px-3.5 py-2 text-xs font-medium transition-colors',
                            logFilter === f.key
                              ? 'bg-[var(--primary)] text-white'
                              : 'text-[var(--fg-muted)] hover:bg-[var(--bg-alt)] hover:text-[var(--fg)]'
                          )}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setLogSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                  className="btn btn-glass btn-sm ml-auto"
                >
                  <Filter className="w-3.5 h-3.5" /> {logSortDir === 'desc' ? 'Newest' : 'Oldest'} first
                </button>
              </div>
            </div>

            {/* Timeline */}
            <div className="adm-panel p-5">
              {getGroupedLogs().length === 0 ? (
                <div className="adm-empty">No logs match.</div>
              ) : (
                getGroupedLogs().map(({ day, entries }) => (
                  <div key={day} className="mb-7 last:mb-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-subtle)] mb-3.5">{day}</p>
                    <div className="space-y-5 border-l-2 border-[var(--border)] pl-5 ml-1.5">
                      {entries.map((log) => {
                        const meta = ACTION_META[log.action] || DEFAULT_ACTION_META;
                        const Icon = meta.icon;
                        return (
                          <div key={log.id} className="relative">
                            <span className={cx('absolute -left-[26px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-[var(--card)]', meta.dot)} />
                            <div className="flex items-start gap-3">
                              <div className={cx('w-8 h-8 rounded-lg grid place-items-center shrink-0', meta.bg)}>
                                <Icon className={cx('w-4 h-4', meta.fg)} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-semibold text-[var(--fg)]">{meta.label}</p>
                                  <span className="text-xs text-[var(--fg-subtle)] whitespace-nowrap" title={parseUtc(log.timestamp).toLocaleString()}>
                                    {timeAgo(log.timestamp)}
                                  </span>
                                </div>
                                {log.details && (
                                  <p className="text-xs text-[var(--fg-muted)] mt-1 break-words leading-relaxed">{log.details}</p>
                                )}
                                <p className="adm-table__mono text-[10px] mt-1.5">account id: {log.user_id}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ─────────────  SETTINGS  ───────────── */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Panel title="System status">
              <div className="space-y-3">
                <div className="adm-setting-row">
                  <div>
                    <h4 className="text-sm font-bold text-[var(--fg)]">Maintenance mode</h4>
                    <p className="text-xs text-[var(--fg-muted)]">Disable access for non-admins.</p>
                  </div>
                  <button
                    className={cx('adm-switch', systemSettings.maintenanceMode && 'is-on')}
                    aria-pressed={systemSettings.maintenanceMode}
                    onClick={() => setSystemSettings({ ...systemSettings, maintenanceMode: !systemSettings.maintenanceMode })}
                  />
                </div>
                <div className="adm-setting-row">
                  <div>
                    <h4 className="text-sm font-bold text-[var(--fg)]">Allow registrations</h4>
                    <p className="text-xs text-[var(--fg-muted)]">New users can sign up.</p>
                  </div>
                  <button
                    className={cx('adm-switch', systemSettings.allowRegistrations && 'is-on')}
                    aria-pressed={systemSettings.allowRegistrations}
                    onClick={() => setSystemSettings({ ...systemSettings, allowRegistrations: !systemSettings.allowRegistrations })}
                  />
                </div>
              </div>
            </Panel>

            <Panel title="Appearance">
              <div className="flex gap-2 p-1 rounded-lg bg-[var(--bg-alt)] border border-[var(--border-strong)]">
                <button
                  onClick={() => setDark(false)}
                  className={cx('flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-colors',
                    !darkMode ? 'bg-[var(--card)] shadow-sm text-[var(--primary)]' : 'text-[var(--fg-muted)]')}
                >
                  <Sun className="w-4 h-4" /> Light
                </button>
                <button
                  onClick={() => setDark(true)}
                  className={cx('flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-colors',
                    darkMode ? 'bg-[var(--card)] shadow-sm text-[var(--primary)]' : 'text-[var(--fg-muted)]')}
                >
                  <Moon className="w-4 h-4" /> Dark
                </button>
              </div>
            </Panel>

            <Panel title="Admin profile" desc="Change the administrator sign-in credentials.">
              <div className="space-y-4 md:col-span-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1.5">Email</label>
                  <input type="text" value={adminProfile.email} disabled className="input opacity-60 cursor-not-allowed" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1.5">New password</label>
                    <input type="password" value={adminProfile.password} onChange={(e) => setAdminProfile({ ...adminProfile, password: e.target.value as any })} className="input" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1.5">Confirm password</label>
                    <input
                      type="password"
                      value={adminProfile.confirm}
                      onChange={(e) => setAdminProfile({ ...adminProfile, confirm: e.target.value as any })}
                      className="input"
                      aria-invalid={!!adminProfile.confirm && adminProfile.password !== adminProfile.confirm}
                      aria-describedby="admin-pw-match"
                    />
                    {adminProfile.confirm && adminProfile.password !== adminProfile.confirm && (
                      <p id="admin-pw-match" className="text-xs mt-1.5" style={{ color: 'var(--danger)' }}>Passwords don’t match.</p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={handleAdminProfileUpdate} className="btn btn-primary" disabled={adminProfile.password !== adminProfile.confirm}>
                    <Lock className="w-4 h-4" /> Update credentials
                  </button>
                </div>
              </div>
            </Panel>
          </div>
        )}
        </div>
      </div>

      {/* ── Manage-user modal ── */}
      {managingUser && (
        <AdminModal title="Manage user" sub={managingUser.email} onClose={() => setManagingUser(null)}>
          <div className="flex gap-1.5 p-1 rounded-lg bg-[var(--bg-alt)] border border-[var(--border-strong)] mb-4">
            {(['balance', 'subscription'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setManageAction(k)}
                className={cx('flex-1 py-1.5 rounded-md text-xs font-bold capitalize transition-colors',
                  manageAction === k ? 'bg-[var(--card)] shadow-sm text-[var(--primary)]' : 'text-[var(--fg-muted)]')}
              >
                {k === 'balance' ? 'Wallet balance' : 'Subscription'}
              </button>
            ))}
          </div>

          {manageAction === 'balance' ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-[var(--bg-alt)] border border-[var(--border)] p-4 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-subtle)]">Current balance</span>
                <h2 className="font-display text-2xl text-[var(--fg)] mt-1">₱{Number(managingUser.balance || 0).toLocaleString()}</h2>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1.5">Amount to add (negative to subtract)</label>
                <input type="number" value={balanceForm.amount} onChange={(e) => setBalanceForm({ ...balanceForm, amount: Number(e.target.value) })} className="input" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1.5">Reason / reference</label>
                <input type="text" value={balanceForm.reason} onChange={(e) => setBalanceForm({ ...balanceForm, reason: e.target.value })} placeholder="e.g. Manual top-up" className="input" />
              </div>
              <button onClick={handleAdjustBalance} className="btn btn-primary w-full">Confirm adjustment</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1.5">Plan</label>
                <select value={subForm.plan} onChange={(e) => setSubForm({ ...subForm, plan: e.target.value })} className="input">
                  <option value="FREE">Free</option>
                  <option value="PRO">Pro</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1.5">Expiry date</label>
                <input type="date" value={subForm.expiresAt} onChange={(e) => setSubForm({ ...subForm, expiresAt: e.target.value })} className="input" />
              </div>
              <button onClick={handleUpdateSubscription} className="btn btn-primary w-full">Update subscription</button>
            </div>
          )}
        </AdminModal>
      )}

      {/* ── Reject-verification modal ── */}
      {rejectModal && (
        <AdminModal title="Reject verification" sub={rejectModal.businessName} onClose={() => setRejectModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1.5">
                Rejection reason <span className="text-[var(--danger)]">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Document appears unreadable, business name does not match…"
                className="input resize-none"
                aria-describedby="reject-hint"
              />
              <p id="reject-hint" className="text-xs mt-1.5" style={{ color: 'var(--fg-subtle)' }}>The owner sees this reason, so say what they need to fix.</p>
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => setRejectModal(null)} className="btn btn-outline flex-1">Cancel</button>
              <button onClick={handleReject} disabled={!rejectReason.trim()} className="btn btn-primary flex-1 disabled:opacity-50" style={{ background: 'var(--danger)' }}>Confirm rejection</button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
};

export default AdminDashboard;
