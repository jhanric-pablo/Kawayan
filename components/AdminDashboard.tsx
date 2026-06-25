import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Users, AlertTriangle, TrendingUp, DollarSign, Activity, MessageSquare, CheckSquare, Clock, CheckCircle, Trash2, Edit, Save, X, Search, Shield, Settings, Power, Download, Upload, Filter, User as UserIcon, Lock, Calendar, CreditCard, Moon, Sun, XCircle, Wallet, FileText, ExternalLink } from 'lucide-react';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { supportService } from '../services/supportService';
import { Ticket, User } from '../types';
import { useOrganicDialog } from './OrganicDialog';

interface Props {
  darkMode: boolean;
  toggleTheme: () => void;
}

const AdminDashboard: React.FC<Props> = ({ darkMode, toggleTheme }) => {
  const dialog = useOrganicDialog();
  const [dbService] = useState(() => new UniversalDatabaseService());
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'verification' | 'helpdesk' | 'logs' | 'settings'>('overview');
  
  // Stats State
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalPostsGenerated: 0,
    revenue: 0,
    cancelledTransactions: 0,
    pendingTransactions: 0,
    revenueData: [] as any[],
    churnData: [] as any[]
  });
  
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
  }, [activeTab]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-[#2B5748] border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 relative">
      
      {/* MANAGE USER MODAL */}
      {managingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#2B5748]/40 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-[#9CB080]/20">
            <div className="p-4 bg-[#FFFFFF] dark:bg-[#273338] border-b border-[#273338]/10 dark:border-[#9CB080]/20 flex justify-between items-center">
              <div>
                <h3 className="font-display text-base text-slate-800 dark:text-white">Manage User</h3>
                <p className="text-xs text-slate-400">{managingUser.email}</p>
              </div>
              <button onClick={() => setManagingUser(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#2B5748]/50 rounded-full transition"><X className="w-4 h-4 text-slate-400"/></button>
            </div>
            
            <div className="px-3 pt-3 flex gap-1.5 border-b border-[#273338]/10 dark:border-[#9CB080]/20 bg-white dark:bg-[#2B5748]/40 pb-0">
               <button 
                 onClick={() => setManageAction('balance')}
                 className={`flex-1 py-2 text-xs font-bold rounded-t-lg border-b-2 transition ${manageAction === 'balance' ? 'border-[#2B5748]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                 style={manageAction === 'balance' ? { color: '#2B5748' } : {}}
               >
                 Wallet Balance
               </button>
               <button 
                 onClick={() => setManageAction('subscription')}
                 className={`flex-1 py-2 text-xs font-bold rounded-t-lg border-b-2 transition ${manageAction === 'subscription' ? 'border-[#2B5748]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                 style={manageAction === 'subscription' ? { color: '#2B5748' } : {}}
               >
                 Subscription
               </button>
            </div>

            <div className="p-5">
              {manageAction === 'balance' ? (
                <div className="space-y-3">
                   <div className="p-4 bg-[#273338]/5 dark:bg-[#273338] rounded-xl text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Balance</span>
                      <h2 className="font-display text-3xl text-slate-800 dark:text-white mt-1">₱{managingUser.balance.toLocaleString()}</h2>
                   </div>
                   <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Amount to Add (negative to subtract)</label>
                      <input 
                        type="number" 
                        value={balanceForm.amount} 
                        onChange={(e) => setBalanceForm({...balanceForm, amount: Number(e.target.value)})}
                        className="w-full px-3 py-2.5 bg-[#FFFFFF] dark:bg-[#273338] border border-[#273338]/10 dark:border-[#9CB080]/20 rounded-xl outline-none text-sm dark:text-white"
                      />
                   </div>
                   <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Reason / Reference</label>
                      <input 
                        type="text" 
                        value={balanceForm.reason} 
                        onChange={(e) => setBalanceForm({...balanceForm, reason: e.target.value})}
                        className="w-full px-3 py-2.5 bg-[#FFFFFF] dark:bg-[#273338] border border-[#273338]/10 dark:border-[#9CB080]/20 rounded-xl outline-none text-sm dark:text-white"
                        placeholder="e.g. Manual Top-up"
                      />
                   </div>
                   <button onClick={handleAdjustBalance} className="w-full py-3 rounded-full font-bold text-sm text-white transition hover:scale-105 active:scale-95 bg-[#2B5748]" style={{ boxShadow: '0 4px 16px -4px rgba(43, 87, 72,0.35)' }}>Confirm Adjustment</button>
                </div>
              ) : (
                <div className="space-y-4">
                   <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Plan</label>
                      <select 
                        value={subForm.plan} 
                        onChange={(e) => setSubForm({...subForm, plan: e.target.value})}
                        className="w-full px-3 py-2 bg-white dark:bg-[#273338] border border-slate-200 dark:border-[#9CB080]/20 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      >
                        <option value="FREE">Free</option>
                        <option value="PRO">Pro</option>
                        <option value="ENTERPRISE">Enterprise</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Expiry Date</label>
                      <input 
                        type="date" 
                        value={subForm.expiresAt} 
                        onChange={(e) => setSubForm({...subForm, expiresAt: e.target.value})}
                        className="w-full px-3 py-2 bg-white dark:bg-[#273338] border border-slate-200 dark:border-[#9CB080]/20 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      />
                   </div>
                   <button onClick={handleUpdateSubscription} className="w-full py-3 rounded-full font-bold text-sm text-white transition hover:scale-105 active:scale-95 bg-[#2B5748]" style={{ boxShadow: '0 4px 16px -4px rgba(43, 87, 72,0.35)' }}>Update Subscription</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header & Nav */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
           <div className="flex items-center gap-2 mb-1">
             <div className="p-1.5 rounded-lg bg-[#2B5748]/15">
               <Shield className="w-4 h-4 text-[#2B5748]"/>
             </div>
             <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Admin Portal</span>
           </div>
           <h1 className="font-display text-3xl text-slate-800 dark:text-white">Administrator Panel</h1>
           <p className="text-slate-400 dark:text-slate-500 mt-1 text-sm">Users, transactions, and system settings.</p>
        </div>
        <div className="flex gap-1 p-1 bg-[#273338]/5 dark:bg-[#2B5748]/40 rounded-2xl overflow-x-auto border border-[#273338]/10 dark:border-[#9CB080]/20">
           {[ 
             { id: 'overview', label: 'Overview', icon: Activity },
             { id: 'users', label: 'Users', icon: Users },
             { id: 'verification', label: 'Verification', icon: Shield },
             { id: 'helpdesk', label: 'Help Desk', icon: MessageSquare },
             { id: 'logs', label: 'Audit Logs', icon: Clock },
             { id: 'settings', label: 'Settings', icon: Settings },
           ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition whitespace-nowrap ${ 
                  activeTab === tab.id 
                  ? 'bg-white dark:bg-[#2B5748]/50 shadow-sm' 
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                style={activeTab === tab.id ? { color: '#2B5748' } : {}}
              >
               <tab.icon className="w-3.5 h-3.5" /> {tab.label}
             </button>
           ))}
        </div>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <>
          <div className="flex items-center gap-4 bg-white dark:bg-[#2B5748]/40 p-4 rounded-xl border border-slate-100 dark:border-[#9CB080]/20 shadow-sm">
             <span className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2"><Calendar className="w-4 h-4"/> Date Range:</span>
             <input 
               type="date" 
               value={dateRange.start} 
               onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
               className="bg-slate-50 dark:bg-[#273338] border border-slate-200 dark:border-[#9CB080]/20 rounded px-2 py-1 text-sm dark:text-white"
             />
             <span className="text-slate-400">-</span>
             <input 
               type="date" 
               value={dateRange.end} 
               onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
               className="bg-slate-50 dark:bg-[#273338] border border-slate-200 dark:border-[#9CB080]/20 rounded px-2 py-1 text-sm dark:text-white"
             />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {[ 
              { label: 'Total Revenue', value: `₱${stats.revenue.toLocaleString()}`, icon: DollarSign, accent: true },
              { label: 'Total Users', value: stats.totalUsers, icon: Users, accent: false },
              { label: 'Active Sessions', value: stats.activeUsers, icon: Activity, accent: false },
              { label: 'Posts Created', value: stats.totalPostsGenerated, icon: TrendingUp, accent: false },
              { label: 'Cancelled Txns', value: stats.cancelledTransactions, icon: XCircle, accent: false },
              { label: 'Pending Txns', value: stats.pendingTransactions, icon: Wallet, accent: false },
            ].map((stat, idx) => (
              <div key={idx} className={`p-5 rounded-2xl border transition-all hover:-translate-y-0.5 ${stat.accent ? 'border-[#273338]/10' : 'border-[#2B5748] dark:border-[#9CB080]/20'} bg-white dark:bg-[#2B5748]/40`} style={stat.accent ? { boxShadow: '0 4px 20px -4px rgba(43, 87, 72,0.15)' } : {}}>
                <div className="mb-3">
                   <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={stat.accent ? { background: '#2B5748' } : { background: "rgba(231, 225, 177, 0.4)" }}>
                     <stat.icon className={`w-4 h-4 ${stat.accent ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                   </div>
                </div>
                <h3 className="font-display text-xl text-slate-800 dark:text-white">{stat.value}</h3>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-[#2B5748]/40 p-6 rounded-2xl border border-[#2B5748] dark:border-[#9CB080]/20 h-80">
              <h3 className="font-display text-base text-slate-800 dark:text-white mb-4">Revenue Growth</h3>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2B5748" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#2B5748" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2B5748" className="dark:opacity-10"/>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                  <Tooltip contentStyle={{borderRadius: '12px', border: '1px solid #2B5748', backgroundColor: '#fff', color: '#273338', boxShadow: '0 4px 16px rgba(43, 87, 72,0.08)'}} />
                  <Area type="monotone" dataKey="value" stroke="#2B5748" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="lg:col-span-1 bg-white dark:bg-[#2B5748]/40 p-6 rounded-2xl border border-[#2B5748] dark:border-[#9CB080]/20 h-80 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-display text-base text-slate-800 dark:text-white">Latest Activity</h3>
                <button onClick={() => setActiveTab('logs')} className="text-xs font-bold hover:opacity-80 transition" style={{ color: '#2B5748' }}>View All</button>
              </div>
              <div className="flex-1 space-y-3 overflow-hidden">
                {auditLogs.slice(0, 5).map((log, idx) => (
                  <div key={idx} className="flex gap-2.5 border-b border-[#9CB080]/40 dark:border-[#9CB080]/20 pb-2.5 last:border-0">
                    <div className="p-1.5 bg-[#273338]/5 dark:bg-[#273338] rounded-lg h-fit flex-shrink-0">
                      <Activity className="w-3 h-3 text-slate-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{log.action.replace(/_/g, ' ')}</p>
                      <p className="text-[10px] text-slate-400 truncate">{log.user_id}</p>
                      <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5">{new Date(log.timestamp).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
                {auditLogs.length === 0 && (
                  <div className="h-full flex items-center justify-center text-slate-300 dark:text-slate-600 text-xs">No activity recorded yet.</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* USER MANAGEMENT TAB */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-[#2B5748]/40 rounded-2xl border border-slate-100 dark:border-[#9CB080]/20 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-100 dark:border-[#9CB080]/20 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 dark:bg-[#273338]/50">
            <div className="relative w-full sm:w-auto">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search users..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-[#9CB080]/20 bg-white dark:bg-[#2B5748]/40 text-sm focus:ring-2 focus:ring-emerald-500 outline-none w-full sm:w-64 dark:text-white"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
               <button 
                 onClick={exportUsersToCSV}
                 className="flex-1 sm:flex-none px-4 py-2 bg-white dark:bg-[#2B5748]/40 border border-slate-200 dark:border-[#9CB080]/20 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-[#2B5748]/50 flex items-center justify-center gap-2"
               >
                 <Download className="w-4 h-4"/> Export CSV
               </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-[#273338] text-slate-500 dark:text-slate-400 font-medium border-b border-slate-100 dark:border-[#9CB080]/20">
                <tr>
                  {[ 
                    { key: 'email', label: 'User' },
                    { key: 'role', label: 'Role' },
                    { key: 'businessName', label: 'Business' },
                    { key: 'balance', label: 'Wallet Balance' },
                    { key: 'createdAt', label: 'Joined' },
                  ].map(h => (
                    <th key={h.key} className="px-6 py-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition" onClick={() => handleSort(h.key)}>
                      <div className="flex items-center gap-1">
                        {h.label}
                        <Filter className={`w-3 h-3 ${sortConfig.key === h.key ? 'text-emerald-500' : 'opacity-30'}`} />
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                {getFilteredAndSortedUsers().map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-[#2B5748]/50/50 transition group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800 dark:text-white">{user.email}</div>
                      <div className="text-xs text-slate-400 font-mono">{user.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      {editingUser === user.id ? (
                        <select 
                          className="bg-white dark:bg-[#2B5748]/40 border border-slate-200 dark:border-[#9CB080]/20 rounded px-2 py-1 dark:text-white"
                          value={editForm.role || user.role}
                          onChange={(e) => setEditForm({...editForm, role: e.target.value as any})}>
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                          <option value="support">Support</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${ 
                          user.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                          user.role === 'support' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                          'bg-slate-100 text-slate-600 dark:bg-[#2B5748]/50 dark:text-slate-300'
                        }`}>
                          {user.role}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {editingUser === user.id ? (
                        <input 
                          type="text" 
                          value={editForm.businessName || user.businessName || ''}
                          onChange={(e) => setEditForm({...editForm, businessName: e.target.value})}
                          className="bg-white dark:bg-[#2B5748]/40 border border-slate-200 dark:border-[#9CB080]/20 rounded px-2 py-1 w-full dark:text-white"
                        />
                      ) : (
                        user.businessName || '—'
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                      ₱{(user.balance || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button 
                        onClick={() => { setManagingUser(user); setBalanceForm({ amount: 0, reason: '' }); setSubForm({ plan: 'FREE', expiresAt: '' }); }}
                        className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-500 rounded transition" 
                        title="Manage Wallet/Sub"
                      >
                        <CreditCard className="w-4 h-4"/>
                      </button>
                      
                      {editingUser === user.id ? (
                        <>
                          <button onClick={() => handleUserUpdate(user.id)} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200"><Save className="w-4 h-4"/></button>
                          <button onClick={() => { setEditingUser(null); setEditForm({}); }} className="p-1.5 bg-slate-100 text-slate-700 rounded hover:bg-slate-200"><X className="w-4 h-4"/></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingUser(user.id); setEditForm({}); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#2B5748]/50 text-slate-500 rounded transition"><Edit className="w-4 h-4"/></button>
                          <button onClick={() => handleDeleteUser(user.id)} className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-500 rounded transition"><Trash2 className="w-4 h-4"/></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VERIFICATION QUEUE TAB */}
      {activeTab === 'verification' && (
        <>
          {/* Reject modal */}
          {rejectModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-[#2B5748]/40 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-[#9CB080]/20">
                <div className="p-4 bg-[#FFFFFF] dark:bg-[#273338] border-b border-slate-200 dark:border-[#9CB080]/20 flex justify-between items-center">
                  <h3 className="font-display text-base text-slate-800 dark:text-white">Reject Verification</h3>
                  <button onClick={() => setRejectModal(null)}><X className="w-4 h-4 text-slate-400" /></button>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-sm text-slate-500">Business: <span className="font-bold text-slate-800 dark:text-white">{rejectModal.businessName}</span></p>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Rejection Reason <span className="text-rose-400">*</span></label>
                    <textarea
                      rows={3}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="e.g. Document appears unreadable, business name does not match..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#9CB080]/20 bg-[#FFFFFF] dark:bg-[#273338] text-sm dark:text-white outline-none focus:ring-2 focus:ring-rose-400 resize-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setRejectModal(null)} className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-slate-200 dark:border-[#9CB080]/20 text-slate-500 hover:bg-slate-50 dark:hover:bg-[#2B5748]/50 transition">Cancel</button>
                    <button onClick={handleReject} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-rose-500 hover:bg-rose-600 text-white transition">Confirm Rejection</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-[#2B5748]/40 rounded-2xl border border-slate-100 dark:border-[#9CB080]/20 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-[#9CB080]/20 flex justify-between items-center bg-slate-50 dark:bg-[#273338]/50">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-slate-400"/> Business Verification Queue
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Review submitted business registration documents and approve or reject MSME accounts.</p>
              </div>
              <button onClick={loadVerifications} className="px-3 py-1.5 bg-white dark:bg-[#2B5748]/40 border border-slate-200 dark:border-[#9CB080]/20 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-50 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5"/> Refresh
              </button>
            </div>

            {/* Status summary chips */}
            <div className="px-4 py-3 flex gap-3 border-b border-slate-100 dark:border-[#9CB080]/20 bg-[#FFFFFF] dark:bg-[#273338]/30 flex-wrap">
              {(['pending', 'verified', 'rejected'] as const).map(s => {
                const count = verifications.filter(v => v.status === s).length;
                const colors: Record<string, string> = {
                  pending: 'bg-amber-50 text-amber-700 border-amber-100',
                  verified: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                  rejected: 'bg-rose-50 text-rose-700 border-rose-100',
                };
                return (
                  <span key={s} className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wide ${colors[s]}`}>
                    {s}: {count}
                  </span>
                );
              })}
            </div>

            <div className="overflow-x-auto">
              {verifLoading ? (
                <div className="flex items-center justify-center py-16"><div className="w-8 h-8 rounded-full border-2 border-[#2B5748] border-t-transparent animate-spin"/></div>
              ) : verifications.length === 0 ? (
                <div className="text-center py-16 text-slate-400 italic">No verification submissions yet.</div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-[#273338] text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wide border-b border-slate-100 dark:border-[#9CB080]/20">
                    <tr>
                      <th className="px-5 py-3">Business</th>
                      <th className="px-5 py-3">Contact</th>
                      <th className="px-5 py-3">Document</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Submitted</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                    {verifications.map(v => (
                      <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-[#2B5748]/50/40 transition">
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-800 dark:text-white text-sm">{v.businessName}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{v.email}</p>
                          {v.businessAddress && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[180px]">{v.businessAddress}</p>}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400">{v.businessPhone || '—'}</td>
                        <td className="px-5 py-4">
                          <button
                            onClick={async () => {
                              const token = localStorage.getItem('kawayan_jwt');
                              try {
                                const res = await fetch(`/api/admin/verifications/${v.id}/document`, {
                                  headers: token ? { Authorization: `Bearer ${token}` } : {}
                                });
                                if (!res.ok) { await dialog.alert('Could not load document.'); return; }
                                const blob = await res.blob();
                                const url = URL.createObjectURL(blob);
                                window.open(url, '_blank');
                              } catch {
                                await dialog.alert('Failed to open document.');
                              }
                            }}
                            className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {v.documentName || 'View File'}
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                            v.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                            v.status === 'verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            'bg-rose-50 text-rose-700 border-rose-100'
                          }`}>
                            {v.status === 'pending' && <Clock className="w-3 h-3" />}
                            {v.status === 'verified' && <CheckCircle className="w-3 h-3" />}
                            {v.status === 'rejected' && <XCircle className="w-3 h-3" />}
                            {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                          </span>
                          {v.status === 'rejected' && v.rejectionReason && (
                            <p className="text-[10px] text-rose-400 mt-1 max-w-[140px] truncate" title={v.rejectionReason}>{v.rejectionReason}</p>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-400 whitespace-nowrap">
                          {v.createdAt ? new Date(v.createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {v.status === 'pending' && (
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => handleApprove(v.id)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Approve
                              </button>
                              <button
                                onClick={() => { setRejectModal({ id: v.id, businessName: v.businessName }); setRejectReason(''); }}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 transition"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Reject
                              </button>
                            </div>
                          )}
                          {v.status !== 'pending' && (
                            <span className="text-xs text-slate-400 italic">
                              Reviewed {v.reviewedAt ? new Date(v.reviewedAt).toLocaleDateString() : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* HELP DESK TAB */}
      {activeTab === 'helpdesk' && (
        <div className="bg-white dark:bg-[#2B5748]/40 rounded-2xl border border-slate-100 dark:border-[#9CB080]/20 shadow-sm overflow-hidden">
           <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-[#273338] text-slate-500 dark:text-slate-400 font-medium border-b border-slate-100 dark:border-[#9CB080]/20">
              <tr>
                <th className="px-6 py-4">Ticket</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4">Priority</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {tickets.length === 0 ? (
                 <tr><td colSpan={6} className="text-center p-8 text-slate-400">No tickets found.</td></tr>
              ) : tickets.map(ticket => (
                <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-[#2B5748]/50/50">
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">#{ticket.ticketNum}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-xs">{ticket.userEmail}</td>
                  <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{ticket.subject}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${ 
                      ticket.priority === 'Critical' ? 'bg-rose-100 text-rose-700' : 
                      ticket.priority === 'High' ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-700'
                    }`}>{ticket.priority}</span>
                  </td>
                  <td className="px-6 py-4">
                     <span className={`px-2 py-1 rounded-full text-xs font-bold border ${ 
                       ticket.status === 'Open' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-500'
                     }`}>{ticket.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {ticket.status !== 'Resolved' && (
                      <button onClick={() => handleTicketStatus(ticket.id, 'Resolved')} className="text-emerald-600 hover:text-emerald-700 font-bold text-xs flex items-center gap-1 ml-auto">
                        <CheckSquare className="w-3 h-3"/> Resolve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* AUDIT LOGS TAB */}
      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-[#2B5748]/40 rounded-2xl border border-slate-100 dark:border-[#9CB080]/20 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-[#9CB080]/20 flex justify-between items-center bg-slate-50 dark:bg-[#273338]/50">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400"/> System Audit Logs
            </h3>
            <div className="flex gap-2">
               <button 
                 onClick={() => loadData()}
                 className="px-3 py-1.5 bg-white dark:bg-[#2B5748]/40 border border-slate-200 dark:border-[#9CB080]/20 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-50 flex items-center gap-2"
               >
                 <Activity className="w-3.5 h-3.5"/> Refresh
               </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-[#273338] text-slate-500 dark:text-slate-400 font-medium border-b border-slate-100 dark:border-[#9CB080]/20">
                <tr>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">User ID</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                {auditLogs.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-10 text-slate-400 italic">No logs recorded.</td></tr>
                ) : auditLogs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-[#2B5748]/50/50 transition">
                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                      {log.user_id}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 dark:bg-[#2B5748]/50 text-slate-700 dark:text-slate-200 rounded text-[10px] font-bold uppercase">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {log.details || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SYSTEM SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="bg-white dark:bg-[#2B5748]/40 p-6 rounded-2xl border border-slate-100 dark:border-[#9CB080]/20 shadow-sm">
             <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Power className="w-5 h-5 text-slate-500"/> System Status</h3>
             <div className="space-y-4">
               <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-[#273338] rounded-xl border border-slate-200 dark:border-[#9CB080]/20">
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-white">Maintenance Mode</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Disable access for non-admins.</p>
                  </div>
                  <button 
                    onClick={() => setSystemSettings({...systemSettings, maintenanceMode: !systemSettings.maintenanceMode})}
                    className={`w-12 h-6 rounded-full transition-colors relative ${systemSettings.maintenanceMode ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${systemSettings.maintenanceMode ? 'left-7' : 'left-1'}`} />
                  </button>
               </div>
               <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-[#273338] rounded-xl border border-slate-200 dark:border-[#9CB080]/20">
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-white">Allow Registrations</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">New users can sign up.</p>
                  </div>
                  <button 
                    onClick={() => setSystemSettings({...systemSettings, allowRegistrations: !systemSettings.allowRegistrations})}
                    className={`w-12 h-6 rounded-full transition-colors relative ${systemSettings.allowRegistrations ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${systemSettings.allowRegistrations ? 'left-7' : 'left-1'}`} />
                  </button>
               </div>
             </div>
           </div>

           <div className="bg-white dark:bg-[#2B5748]/40 p-6 rounded-2xl border border-slate-100 dark:border-[#9CB080]/20 shadow-sm">
             <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Settings className="w-5 h-5 text-slate-500"/> Preferences</h3>
             <div className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-[#273338] rounded-xl border border-slate-200 dark:border-[#9CB080]/20">
                   <h4 className="font-bold text-slate-800 dark:text-white mb-2">Appearance</h4>
                   <div className="flex gap-2">
                     <button 
                       onClick={() => darkMode && toggleTheme()}
                       className={`flex-1 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition ${darkMode ? 'bg-white text-slate-800' : 'bg-slate-200 text-slate-500'}`}
                     >
                       <Moon className="w-4 h-4"/> Dark
                     </button>
                     <button 
                       onClick={() => !darkMode && toggleTheme()} 
                       className={`flex-1 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition ${!darkMode ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                     >
                       <Sun className="w-4 h-4"/> Light
                     </button>
                   </div>
                </div>
             </div>
           </div>

           <div className="bg-white dark:bg-[#2B5748]/40 p-6 rounded-2xl border border-slate-100 dark:border-[#9CB080]/20 shadow-sm md:col-span-2">
             <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Lock className="w-5 h-5 text-slate-500"/> Admin Profile</h3>
             <div className="space-y-4">
                <div>
                   <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Email</label>
                   <input type="text" value={adminProfile.email} disabled className="w-full bg-slate-100 dark:bg-[#273338] border-none rounded-lg p-2 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                     <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">New Password</label>
                     <input 
                       type="password" 
                       value={adminProfile.password}
                       onChange={(e) => setAdminProfile({...adminProfile, password: e.target.value as any})}
                       className="w-full bg-white dark:bg-[#273338] border border-slate-200 dark:border-[#9CB080]/20 rounded-lg p-2 text-sm outline-none focus:border-emerald-500 dark:text-white"
                     />
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Confirm Password</label>
                     <input 
                       type="password" 
                       value={adminProfile.confirm}
                       onChange={(e) => setAdminProfile({...adminProfile, confirm: e.target.value as any})}
                       className="w-full bg-white dark:bg-[#273338] border border-slate-200 dark:border-[#9CB080]/20 rounded-lg p-2 text-sm outline-none focus:border-emerald-500 dark:text-white"
                     />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button 
                    onClick={handleAdminProfileUpdate}
                    className="bg-slate-900 dark:bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-slate-800 dark:hover:bg-emerald-700"
                  >
                    Update Credentials
                  </button>
                </div>
             </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
