import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Users, TrendingUp, DollarSign, Activity, MessageSquare, CheckSquare, Clock, CheckCircle, Trash2, Edit, Save, X, Search, Shield, Settings, Power, Download, Filter, Lock, Calendar, CreditCard, Moon, Sun, XCircle, Wallet, FileText, ChevronRight, ChevronDown, RefreshCw, UserPlus, LogIn, Upload } from 'lucide-react';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { supportService } from '../services/supportService';
import { supportRealtime } from '../services/supportRealtime';
import { Ticket, User } from '../types';
import { useOrganicDialog } from './OrganicDialog';
import { useToast } from './ui/Toast';
import './admin/adminConsole.css';

interface Props {
  darkMode: boolean;
  toggleTheme: () => void;
}

/* ── Shared building blocks for the console ──────────────────────── */
const cx = (...c: Array<string | false | undefined | null>) => c.filter(Boolean).join(' ');

const StatCard: React.FC<{ label: string; value: React.ReactNode; icon: React.ElementType; accent?: boolean }> = ({
  label, value, icon: Icon, accent,
}) => (
  <div className={cx('adm-stat', accent && 'adm-stat--accent')}>
    <div className="adm-stat__icon"><Icon className="w-4 h-4" /></div>
    <div className="min-w-0">
      <p className="adm-stat__value">{value}</p>
      <p className="adm-stat__label">{label}</p>
    </div>
  </div>
);

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
};
const DEFAULT_ACTION_META = { label: 'System event', icon: Activity, bg: 'bg-[var(--bg-alt)]', fg: 'text-[var(--fg-muted)]', dot: 'bg-[var(--fg-subtle)]' };

const LOG_FILTERS: Array<{ key: string; label: string; actions?: string[] }> = [
  { key: 'all', label: 'All actions' },
  { key: 'accounts', label: 'Accounts — register & login', actions: ['register', 'login'] },
  { key: 'submitted', label: 'Documents submitted', actions: ['submit_verification', 'resubmit_verification'] },
  { key: 'approved', label: 'Verifications approved', actions: ['approve_verification'] },
  { key: 'rejected', label: 'Verifications rejected', actions: ['reject_verification'] },
  { key: 'deleted', label: 'Accounts deleted', actions: ['delete_user'] },
];

// Supabase returns timestamptz values with no UTC marker (e.g. "2026-09-16T16:40:30.69"),
// so `new Date(...)` misreads them as local time instead of UTC. Force UTC before parsing;
// `toLocaleString`/`toLocaleDateString` then render in the viewer's own local time automatically.
const parseUtc = (iso: string): Date => new Date(/[Zz]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);

const timeAgo = (iso: string): string => {
  const s = Math.floor((Date.now() - parseUtc(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return parseUtc(iso).toLocaleDateString();
};

const dayLabel = (iso: string): string => {
  const d = parseUtc(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
};

const chartTip = {
  borderRadius: 10,
  border: '1px solid var(--border-strong)',
  background: 'var(--card)',
  color: 'var(--fg)',
  fontSize: 12,
  boxShadow: 'var(--shadow-md)',
} as const;

const AdminDashboard: React.FC<Props> = ({ darkMode, toggleTheme }) => {
  const dialog = useOrganicDialog();
  const toast = useToast();
  const [dbService] = useState(() => new UniversalDatabaseService());
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'verification' | 'billing' | 'helpdesk' | 'logs' | 'settings'>('overview');
  
  // Stats State
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalPostsGenerated: 0,
    revenue: 0,
    cancelledTransactions: 0,
    pendingTransactions: 0,
    retentionRate: 0,
    revenueData: [] as any[],
    churnData: [] as any[]
  });

  const [pendingTxns, setPendingTxns] = useState<any[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Tomorrow
  });

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
  const [verifStatusFilter, setVerifStatusFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [selectedVerifId, setSelectedVerifId] = useState<string | null>(null);
  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null);
  const [docPreviewLoading, setDocPreviewLoading] = useState(false);
  const [docPreviewError, setDocPreviewError] = useState<string | null>(null);
  const [docPreviewRetryTick, setDocPreviewRetryTick] = useState(0);

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
  }, [dbService, dateRange]);

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
      await dialog.alert({ title: 'Approved', message: 'Payment verified and balance updated.' });
      loadPendingTransactions();
      loadData();
    } catch (e) {
      await dialog.alert('Failed to approve transaction.');
    }
  };

  const loadData = async () => {
    try {
      const [adminStats, userList, ticketList, logs] = await Promise.all([
        dbService.getAdminStats(dateRange.start, dateRange.end),
        dbService.getAllUsers(),
        dbService.getAllTicketsAdmin(),
        dbService.getAuditLogs(100)
      ]);
      setStats(adminStats);
      setUsers(userList);
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
      const logs = await dbService.getAuditLogs(100);
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

  // Load the selected submission's document as an in-app preview instead of a new tab.
  useEffect(() => {
    if (!selectedVerifId) { setDocPreviewUrl(null); return; }
    let cancelled = false;
    setDocPreviewLoading(true);
    setDocPreviewError(null);
    (async () => {
      try {
        const token = localStorage.getItem('kawayan_jwt');
        const res = await fetch(`/api/admin/verifications/${selectedVerifId}/document`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) throw new Error('load failed');
        const blob = await res.blob();
        if (cancelled) return;
        setDocPreviewUrl(URL.createObjectURL(blob));
      } catch {
        if (!cancelled) setDocPreviewError('Could not load this document.');
      } finally {
        if (!cancelled) setDocPreviewLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedVerifId, docPreviewRetryTick]);

  // Release the previous blob URL whenever it's replaced or the tab unmounts.
  useEffect(() => {
    return () => { if (docPreviewUrl) URL.revokeObjectURL(docPreviewUrl); };
  }, [docPreviewUrl]);

  // After a decision, jump straight to the next pending item so the queue can be cleared without re-scanning the list.
  const refreshVerificationsAndAdvance = async () => {
    const list = await dbService.getAllVerifications();
    setVerifications(list);
    const nextPending = list.find((v: any) => v.status === 'pending');
    setSelectedVerifId(nextPending ? nextPending.id : (list[0]?.id ?? null));
  };

  const handleApprove = async (id: string, businessName?: string) => {
    const confirmed = await dialog.confirm({
      title: 'Approve verification',
      message: `Approve ${businessName ? `"${businessName}"` : 'this business'}? They will immediately gain full account access.`,
      confirmLabel: 'Approve',
    });
    if (!confirmed) return;
    try {
      await dbService.approveVerification(id);
      toast.success(`${businessName ? `"${businessName}"` : 'Business'} approved`);
      await refreshVerificationsAndAdvance();
    } catch (e) {
      await dialog.alert('Failed to approve. Please try again.');
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    if (!rejectReason.trim()) { await dialog.alert('Please provide a rejection reason.'); return; }
    try {
      await dbService.rejectVerification(rejectModal.id, rejectReason.trim());
      toast.info(`"${rejectModal.businessName}" rejected`);
      setRejectModal(null);
      setRejectReason('');
      await refreshVerificationsAndAdvance();
    } catch (e) {
      await dialog.alert('Failed to reject. Please try again.');
    }
  };

  // Verification queue keyboard nav: ↑/↓ to move selection, A/R to approve/reject the pending item in view.
  useEffect(() => {
    if (activeTab !== 'verification' || rejectModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const list = verifStatusFilter === 'all' ? verifications : verifications.filter((v) => v.status === verifStatusFilter);
      if (list.length === 0) return;
      const idx = list.findIndex((v) => v.id === selectedVerifId);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedVerifId(list[Math.min(idx + 1, list.length - 1)]?.id ?? list[0].id);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedVerifId(list[Math.max(idx - 1, 0)]?.id ?? list[0].id);
      } else if ((e.key === 'a' || e.key === 'A') && idx >= 0 && list[idx].status === 'pending') {
        handleApprove(list[idx].id, list[idx].businessName);
      } else if ((e.key === 'r' || e.key === 'R') && idx >= 0 && list[idx].status === 'pending') {
        setRejectModal({ id: list[idx].id, businessName: list[idx].businessName });
        setRejectReason('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, verifications, verifStatusFilter, selectedVerifId, rejectModal]);

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
      await dialog.alert('Failed to update user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const confirmed = await dialog.confirm('Are you sure? This will delete ALL user data permanently.');
    if (confirmed) {
      try {
        await dbService.deleteUser(userId);
        loadData();
      } catch (error) {
        await dialog.alert('Failed to delete user');
      }
    }
  };

  const handleAdjustBalance = async () => {
    if (!managingUser) return;
    try {
      await dbService.adminAdjustBalance(managingUser.id, balanceForm.amount, balanceForm.reason);
      await dialog.alert('Balance adjusted');
      setManagingUser(null);
      loadData();
    } catch (error) {
      await dialog.alert('Failed to adjust balance');
    }
  };

  const handleUpdateSubscription = async () => {
    if (!managingUser) return;
    try {
      await dbService.adminUpdateSubscription(managingUser.id, subForm.plan, subForm.expiresAt);
      await dialog.alert('Subscription updated');
      setManagingUser(null);
      loadData();
    } catch (error) {
      await dialog.alert('Failed to update subscription');
    }
  };

  const handleTicketStatus = (id: string, status: 'Open' | 'Pending' | 'Resolved') => {
    supportService.updateTicketStatus(id, status);
    dbService.getAllTicketsAdmin().then(setTickets);
  };

  const handleAdminProfileUpdate = async () => {
    if (adminProfile.password !== adminProfile.confirm) {
      await dialog.alert("Passwords do not match");
      return;
    }
    await dialog.alert("Admin profile updated (Simulation)");
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
    overview: { title: 'Overview', sub: 'Revenue, growth and platform activity at a glance.' },
    users: { title: 'Users', sub: 'Search, edit roles, adjust wallets and manage subscriptions.' },
    verification: { title: 'Verification queue', sub: 'Review business documents and approve or reject MSME accounts.' },
    billing: { title: 'Billing', sub: 'Verify pending wallet top-ups and manage billing cycles.' },
    helpdesk: { title: 'Help desk', sub: 'Track and resolve customer support tickets.' },
    logs: { title: 'Audit logs', sub: 'Every privileged action, timestamped.' },
    settings: { title: 'System settings', sub: 'Platform switches, appearance and admin credentials.' },
  };

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
    <div className="adm-console animate-fade-in pb-16">
      {/* ── Sidebar ── */}
      <aside className="adm-side">
        <div className="adm-side__brand">
          <div className="adm-side__brand-icon"><Shield className="w-4 h-4" /></div>
          <div>
            <p className="adm-side__brand-name">Admin Console</p>
            <p className="adm-side__brand-tag">Kawayan AI</p>
          </div>
        </div>
        <nav className="adm-side__nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={cx('adm-side__item', activeTab === item.id && 'is-active')}
            >
              <item.icon />
              <span>{item.label}</span>
              {item.count != null && <span className="adm-side__count">{item.count}</span>}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Main ── */}
      <div className="adm-main">
        <header className="adm-head">
          <div>
            <h1 className="adm-head__title">{head.title}</h1>
            <p className="adm-head__sub">{head.sub}</p>
          </div>
          <div className="adm-head__actions">
            {activeTab === 'overview' && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Range
                </span>
                <input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} className="input !w-auto !py-1.5 !text-xs" />
                <span className="text-[var(--fg-subtle)]">–</span>
                <input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} className="input !w-auto !py-1.5 !text-xs" />
              </div>
            )}
            {activeTab === 'users' && (
              <button type="button" onClick={exportUsersToCSV} className="btn btn-glass btn-sm">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            )}
            {activeTab === 'verification' && refreshBtn(loadVerifications)}
          </div>
        </header>

        {/* ─────────────  OVERVIEW  ───────────── */}
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5 mb-5">
              <StatCard label="Total revenue" value={`₱${stats.revenue.toLocaleString()}`} icon={DollarSign} accent />
              <StatCard label="Total users" value={stats.totalUsers} icon={Users} />
              <StatCard label="Active sessions" value={stats.activeUsers} icon={Activity} />
              <StatCard label="Posts created" value={stats.totalPostsGenerated} icon={TrendingUp} />
              <StatCard label="Cancelled txns" value={stats.cancelledTransactions} icon={XCircle} />
              <StatCard label="Pending txns" value={stats.pendingTransactions} icon={Wallet} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="adm-panel lg:col-span-2 p-5">
                <h3 className="adm-panel__title mb-3">User growth</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.revenueData}>
                      <defs>
                        <linearGradient id="admArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2B5748" stopOpacity={0.18} />
                          <stop offset="100%" stopColor="#2B5748" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }} width={34} />
                      <Tooltip contentStyle={chartTip} />
                      <Area type="monotone" dataKey="value" stroke="#2B5748" strokeWidth={2.5} fill="url(#admArea)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="adm-panel p-5">
                <h3 className="adm-panel__title mb-3">Retention rate</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.churnData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }} unit="%" width={34} />
                      <Tooltip contentStyle={chartTip} formatter={(v: number) => [`${v}%`, 'Retention']} />
                      <Bar dataKey="value" fill="#5E7F63" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="adm-panel lg:col-span-3">
                <header className="adm-panel__head">
                  <h3 className="adm-panel__title">Latest activity</h3>
                  <button onClick={() => setActiveTab('logs')} className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1">
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </header>
                <div className="divide-y divide-[var(--border)]">
                  {auditLogs.slice(0, 6).map((log) => {
                    const meta = ACTION_META[log.action] || DEFAULT_ACTION_META;
                    const Icon = meta.icon;
                    return (
                      <div key={log.id} className="flex items-center gap-3 px-5 py-3">
                        <div className={cx('w-8 h-8 rounded-lg grid place-items-center shrink-0', meta.bg)}>
                          <Icon className={cx('w-3.5 h-3.5', meta.fg)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[var(--fg)] truncate">{meta.label}</p>
                          <p className="text-xs text-[var(--fg-subtle)] truncate adm-table__mono">{log.user_id}</p>
                        </div>
                        <span className="text-xs text-[var(--fg-subtle)] whitespace-nowrap">{timeAgo(log.timestamp)}</span>
                      </div>
                    );
                  })}
                  {auditLogs.length === 0 && <div className="adm-empty">No activity recorded yet.</div>}
                </div>
              </div>
            </div>
          </>
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
        {activeTab === 'verification' && (() => {
          const filteredVerifs = verifStatusFilter === 'all' ? verifications : verifications.filter((v) => v.status === verifStatusFilter);
          const selectedVerif = verifications.find((v) => v.id === selectedVerifId) || null;
          const isPdf = /\.pdf$/i.test(selectedVerif?.documentName || '');
          return (
            <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 items-start">
              {/* Queue list */}
              <div className="adm-panel overflow-hidden">
                <div className="p-3 border-b border-[var(--border)] flex items-center gap-1.5 flex-wrap">
                  {(['all', 'pending', 'verified', 'rejected'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setVerifStatusFilter(s)}
                      className={cx(
                        'px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide border transition-colors',
                        verifStatusFilter === s
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                          : 'border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--border-strong)]'
                      )}
                    >
                      {s === 'all' ? `All · ${verifications.length}` : `${s} · ${verifications.filter((v) => v.status === s).length}`}
                    </button>
                  ))}
                </div>
                <p className="px-3 py-1.5 text-[10px] text-[var(--fg-subtle)] border-b border-[var(--border)]">
                  <kbd className="adm-table__mono">↑↓</kbd> move · <kbd className="adm-table__mono">A</kbd> approve · <kbd className="adm-table__mono">R</kbd> reject
                </p>
                <div className="max-h-[600px] overflow-y-auto divide-y divide-[var(--border)]">
                  {verifLoading ? (
                    <div className="adm-spinner m-6" />
                  ) : filteredVerifs.length === 0 ? (
                    <div className="adm-empty">No submissions.</div>
                  ) : filteredVerifs.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVerifId(v.id)}
                      className={cx('w-full text-left pl-16 pr-4 py-3 lg:px-4 transition-colors', selectedVerifId === v.id ? 'bg-[var(--bg-alt)]' : 'hover:bg-[var(--bg-alt)]')}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[var(--fg)] truncate">{v.businessName || 'Unnamed business'}</p>
                        <VStatusBadge status={v.status} />
                      </div>
                      <p className="text-xs text-[var(--fg-subtle)] truncate mt-0.5">{v.email}</p>
                      <p className="text-[11px] text-[var(--fg-subtle)] mt-1">{v.createdAt ? parseUtc(v.createdAt).toLocaleDateString() : '—'}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Detail + inline document preview */}
              <div className="adm-panel p-5 min-h-[520px]">
                {!selectedVerif ? (
                  <div className="adm-empty h-full flex items-center justify-center min-h-[460px]">Select a submission to review.</div>
                ) : (
                  <>
                    <header className="flex items-start justify-between gap-3 mb-5 pb-4 border-b border-[var(--border)]">
                      <div className="min-w-0">
                        <h3 className="font-display text-lg font-bold text-[var(--fg)] truncate">{selectedVerif.businessName || 'Unnamed business'}</h3>
                        <p className="text-sm text-[var(--fg-muted)] truncate">{selectedVerif.email}</p>
                      </div>
                      <VStatusBadge status={selectedVerif.status} />
                    </header>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-5">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--fg-subtle)] mb-1">Phone</p>
                        <p className="text-[var(--fg)]">{selectedVerif.businessPhone || '—'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--fg-subtle)] mb-1">Address</p>
                        <p className="text-[var(--fg)] truncate">{selectedVerif.businessAddress || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--fg-subtle)] mb-1">Submitted</p>
                        <p className="text-[var(--fg)]">{selectedVerif.createdAt ? parseUtc(selectedVerif.createdAt).toLocaleDateString() : '—'}</p>
                      </div>
                    </div>

                    {selectedVerif.status === 'rejected' && selectedVerif.rejectionReason && (
                      <div className="mb-5 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-3.5 py-2.5 text-xs text-[var(--danger)]">
                        <strong>Rejection reason:</strong> {selectedVerif.rejectionReason}
                      </div>
                    )}
                    {selectedVerif.status !== 'pending' && selectedVerif.reviewedAt && (
                      <p className="text-xs text-[var(--fg-subtle)] italic mb-5">Reviewed {parseUtc(selectedVerif.reviewedAt).toLocaleString()}</p>
                    )}

                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--fg-subtle)] flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> Submitted document
                      </p>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--fg-subtle)]">{isPdf ? 'PDF' : 'Image'}</span>
                    </div>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-alt)] overflow-hidden flex items-center justify-center" style={{ minHeight: 380 }}>
                      {docPreviewLoading ? (
                        <div className="adm-spinner" />
                      ) : docPreviewError ? (
                        <div className="text-center p-6">
                          <p className="text-xs text-[var(--fg-subtle)] mb-3">{docPreviewError}</p>
                          <button type="button" onClick={() => setDocPreviewRetryTick((n) => n + 1)} className="btn btn-outline btn-sm">
                            <RefreshCw className="w-3.5 h-3.5" /> Retry
                          </button>
                        </div>
                      ) : docPreviewUrl && isPdf ? (
                        <iframe src={docPreviewUrl} className="w-full" style={{ height: 480, border: 0 }} title="Submitted document" />
                      ) : docPreviewUrl ? (
                        <img src={docPreviewUrl} alt="Submitted document" className="max-w-full max-h-[480px] object-contain" />
                      ) : null}
                    </div>
                    <p className="text-[11px] text-[var(--fg-subtle)] mt-1.5 mb-5 truncate" title={selectedVerif.documentName}>{selectedVerif.documentName || ' '}</p>

                    {selectedVerif.status === 'pending' && (
                      <div className="flex items-center gap-5">
                        <button onClick={() => handleApprove(selectedVerif.id, selectedVerif.businessName)} className="btn btn-primary"><CheckCircle className="w-4 h-4" /> Approve</button>
                        <button onClick={() => { setRejectModal({ id: selectedVerif.id, businessName: selectedVerif.businessName }); setRejectReason(''); }} className="btn btn-danger"><XCircle className="w-4 h-4" /> Reject</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })()}

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
                    <input type="password" value={adminProfile.confirm} onChange={(e) => setAdminProfile({ ...adminProfile, confirm: e.target.value as any })} className="input" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={handleAdminProfileUpdate} className="btn btn-primary">
                    <Lock className="w-4 h-4" /> Update credentials
                  </button>
                </div>
              </div>
            </Panel>
          </div>
        )}
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
              />
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => setRejectModal(null)} className="btn btn-outline flex-1">Cancel</button>
              <button onClick={handleReject} className="btn btn-primary flex-1" style={{ background: 'var(--danger)' }}>Confirm rejection</button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
};

export default AdminDashboard;
