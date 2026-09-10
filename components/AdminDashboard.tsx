import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Users, TrendingUp, DollarSign, Activity, MessageSquare, CheckSquare, Clock, CheckCircle, Trash2, Edit, Save, X, Search, Shield, Settings, Power, Download, Filter, Lock, Calendar, CreditCard, Moon, Sun, XCircle, Wallet, FileText, ExternalLink, ChevronRight, RefreshCw } from 'lucide-react';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { supportService } from '../services/supportService';
import { supportRealtime } from '../services/supportRealtime';
import { Ticket, User } from '../types';
import { useOrganicDialog } from './OrganicDialog';
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

  // Modal State
  const [manageAction, setManageAction] = useState<'balance' | 'subscription'>('balance');
  const [balanceForm, setBalanceForm] = useState({ amount: 0, reason: '' });
  const [subForm, setSubForm] = useState({ plan: 'FREE', expiresAt: '' });

  // Verification State
  const [verifications, setVerifications] = useState<any[]>([]);
  const [verifLoading, setVerifLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ id: string; businessName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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

  const loadVerifications = async () => {
    setVerifLoading(true);
    try {
      const list = await dbService.getAllVerifications();
      setVerifications(list);
    } catch (e) {
      console.error('Error loading verifications:', e);
    } finally {
      setVerifLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    const confirmed = await dialog.confirm('Approve this business verification?');
    if (!confirmed) return;
    try {
      await dbService.approveVerification(id);
      loadVerifications();
    } catch (e) {
      await dialog.alert('Failed to approve. Please try again.');
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    if (!rejectReason.trim()) { await dialog.alert('Please provide a rejection reason.'); return; }
    try {
      await dbService.rejectVerification(rejectModal.id, rejectReason.trim());
      setRejectModal(null);
      setRejectReason('');
      loadVerifications();
    } catch (e) {
      await dialog.alert('Failed to reject. Please try again.');
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
            {activeTab === 'logs' && refreshBtn(loadData)}
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
                  {auditLogs.slice(0, 6).map((log, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--bg-alt)] grid place-items-center shrink-0">
                        <Activity className="w-3.5 h-3.5 text-[var(--fg-muted)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--fg)] truncate">{String(log.action).replace(/_/g, ' ')}</p>
                        <p className="text-xs text-[var(--fg-subtle)] truncate adm-table__mono">{log.user_id}</p>
                      </div>
                      <span className="text-xs text-[var(--fg-subtle)] whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
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
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
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

        {/* ─────────────  VERIFICATION  ───────────── */}
        {activeTab === 'verification' && (
          <Panel flush>
            <div className="px-4 py-3 flex gap-2 border-b border-[var(--border)] bg-[var(--bg-alt)] flex-wrap">
              {(['pending', 'verified', 'rejected'] as const).map((s) => (
                <span key={s} className={cx('badge', s === 'pending' ? 'badge-amber' : s === 'verified' ? 'badge-green' : 'badge-red')}>
                  {s}: {verifications.filter((v) => v.status === s).length}
                </span>
              ))}
            </div>
            {verifLoading ? (
              <div className="adm-spinner" />
            ) : verifications.length === 0 ? (
              <div className="adm-empty">No verification submissions yet.</div>
            ) : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>Business</th><th>Contact</th><th>Document</th><th>Status</th><th>Submitted</th><th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifications.map((v) => (
                      <tr key={v.id}>
                        <td>
                          <p className="adm-table__primary">{v.businessName}</p>
                          <p className="text-xs text-[var(--fg-subtle)] mt-0.5">{v.email}</p>
                          {v.businessAddress && <p className="text-xs text-[var(--fg-subtle)] mt-0.5 truncate max-w-[180px]">{v.businessAddress}</p>}
                        </td>
                        <td className="text-xs text-[var(--fg-muted)]">{v.businessPhone || '—'}</td>
                        <td>
                          <button
                            onClick={async () => {
                              const token = localStorage.getItem('kawayan_jwt');
                              try {
                                const res = await fetch(`/api/admin/verifications/${v.id}/document`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                                if (!res.ok) { await dialog.alert('Could not load document.'); return; }
                                const blob = await res.blob();
                                const url = URL.createObjectURL(blob);
                                window.open(url, '_blank');
                              } catch { await dialog.alert('Failed to open document.'); }
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] hover:underline"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {v.documentName || 'View file'}
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </button>
                        </td>
                        <td>
                          <VStatusBadge status={v.status} />
                          {v.status === 'rejected' && v.rejectionReason && (
                            <p className="text-[10px] text-[var(--danger)] mt-1 max-w-[150px] truncate" title={v.rejectionReason}>{v.rejectionReason}</p>
                          )}
                        </td>
                        <td className="text-xs text-[var(--fg-subtle)] whitespace-nowrap">{v.createdAt ? new Date(v.createdAt).toLocaleDateString() : '—'}</td>
                        <td>
                          {v.status === 'pending' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => handleApprove(v.id)} className="btn btn-primary btn-sm"><CheckCircle className="w-3.5 h-3.5" /> Approve</button>
                              <button onClick={() => { setRejectModal({ id: v.id, businessName: v.businessName }); setRejectReason(''); }} className="btn btn-danger btn-sm"><XCircle className="w-3.5 h-3.5" /> Reject</button>
                            </div>
                          ) : (
                            <span className="block text-right text-xs text-[var(--fg-subtle)] italic">
                              Reviewed {v.reviewedAt ? new Date(v.reviewedAt).toLocaleDateString() : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
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
                        <td className="text-xs text-[var(--fg-subtle)]">{new Date(txn.date).toLocaleString()}</td>
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

        {/* ─────────────  AUDIT LOGS  ───────────── */}
        {activeTab === 'logs' && (
          <Panel flush>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr><th>Timestamp</th><th>User ID</th><th>Action</th><th>Details</th></tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr><td colSpan={4}><div className="adm-empty">No logs recorded.</div></td></tr>
                  ) : auditLogs.map((log, idx) => (
                    <tr key={idx}>
                      <td className="text-xs text-[var(--fg-muted)] whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="adm-table__mono">{log.user_id}</td>
                      <td><span className="badge badge-sage">{String(log.action).replace(/_/g, ' ')}</span></td>
                      <td className="text-xs text-[var(--fg-muted)] max-w-xs truncate">{log.details || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
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
