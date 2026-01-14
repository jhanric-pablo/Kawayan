import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Users, AlertTriangle, TrendingUp, DollarSign, Activity, MessageSquare, CheckSquare, Clock } from 'lucide-react';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { supportService } from '../services/supportService';
import { Ticket } from '../types';

const mockChurnData = [
  { name: 'Jan', value: 2 },
  { name: 'Feb', value: 3 },
  { name: 'Mar', value: 1 },
  { name: 'Apr', value: 4 },
  { name: 'May', value: 2 },
  { name: 'Jun', value: 1 },
];

const mockRevenueData = [
  { name: 'Jan', value: 25000 },
  { name: 'Feb', value: 32000 },
  { name: 'Mar', value: 45000 },
  { name: 'Apr', value: 42000 },
  { name: 'May', value: 55000 },
  { name: 'Jun', value: 68000 },
];

const AdminDashboard: React.FC = () => {
  const [dbService] = useState(() => new UniversalDatabaseService());
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalPostsGenerated: 0,
    revenue: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'helpdesk'>('overview');
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const adminStats = await dbService.getAdminStats();
        setStats(adminStats);
      } catch (error) {
        console.error('Error loading admin stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
    loadTickets();
  }, [dbService]);

  const loadTickets = () => {
    setTickets(supportService.getAllTickets());
  };

  const handleStatusChange = (id: string, status: 'Open' | 'Pending' | 'Resolved') => {
    supportService.updateTicketStatus(id, status);
    loadTickets();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <div className="flex justify-between items-end">
        <div>
           <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Admin Portal</h1>
           <p className="text-slate-500 dark:text-slate-400 mt-1">Platform management and support.</p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => setActiveTab('overview')}
             className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === 'overview' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
           >
             Overview
           </button>
           <button 
             onClick={() => setActiveTab('helpdesk')}
             className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === 'helpdesk' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
           >
             Help Desk
           </button>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Total Revenue', value: `₱${stats.revenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: `₱${(stats.revenue / stats.totalUsers || 0).toLocaleString()} per user` },
              { label: 'Active Users', value: stats.activeUsers.toString(), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', trend: `${stats.totalUsers - stats.activeUsers} admins` },
              { label: 'Total Users', value: stats.totalUsers.toString(), icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50', trend: `${((stats.activeUsers / stats.totalUsers) * 100 || 0).toFixed(1)}% active` },
              { label: 'Posts Generated', value: stats.totalPostsGenerated.toString(), icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50', trend: `${(stats.totalPostsGenerated / stats.totalUsers || 0).toFixed(1)} per user` },
            ].map((stat, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                <div className="flex justify-between items-start mb-4">
                   <div className={`p-3 rounded-xl ${stat.bg}`}>
                     <stat.icon className={`w-6 h-6 ${stat.color}`} />
                   </div>
                   <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">KPI</span>
                </div>
                <div>
                  <h3 className="text-3xl font-black text-slate-800">{stat.value}</h3>
                  <p className="text-sm font-medium text-slate-500 mt-1">{stat.label}</p>
                  <p className="text-xs text-emerald-600 mt-2 font-medium">{stat.trend}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <div className="w-2 h-6 bg-emerald-500 rounded-full"></div> Revenue Growth (PHP)
              </h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mockRevenueData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <Tooltip 
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    />
                    <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <div className="w-2 h-6 bg-rose-500 rounded-full"></div> Monthly Churn
              </h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mockChurnData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <Tooltip 
                       cursor={{fill: '#f8fafc'}}
                       contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    />
                    <Bar dataKey="value" fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Help Desk View */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-emerald-600"/> Support Tickets</h3>
            <span className="text-sm text-slate-500">{tickets.length} total tickets</span>
          </div>
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Ticket ID</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4">Priority</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No tickets found. Good job! 🎉
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">#{ticket.ticketNum}</td>
                    <td className="px-6 py-4 font-bold text-slate-800">{ticket.userEmail}</td>
                    <td className="px-6 py-4 text-slate-600">{ticket.subject}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        ticket.priority === 'Critical' ? 'bg-rose-100 text-rose-700' :
                        ticket.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-50 text-blue-700'
                      }`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                        ticket.status === 'Open' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                        ticket.status === 'Pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                        'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {ticket.status === 'Open' && <Activity className="w-3 h-3"/>}
                        {ticket.status === 'Resolved' && <CheckCircle className="w-3 h-3"/>}
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">{new Date(ticket.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      {ticket.status !== 'Resolved' && (
                        <button 
                          onClick={() => handleStatusChange(ticket.id, 'Resolved')}
                          className="text-emerald-600 hover:text-emerald-700 font-medium text-xs flex items-center gap-1 ml-auto"
                        >
                          <CheckSquare className="w-3 h-3"/> Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
