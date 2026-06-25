import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { MessageSquare, Clock, User as UserIcon, PhoneCall, Search, Loader2, Send, ArrowLeft, MoreVertical, CheckCircle, History, ArrowUpDown, ChevronDown, AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { supportService } from '../services/supportService';
import { Ticket, User } from '../types';
import CallOverlay from './CallOverlay';

type SortKey = 'date' | 'user' | 'priority' | 'duration';
type SortDirection = 'asc' | 'desc';

const SupportDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'tickets' | 'calls'>('overview');
  const [user] = useState<User | null>(() => {
    const saved = localStorage.getItem('kawayan_session');
    return saved ? JSON.parse(saved) : null;
  });
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeCalls, setActiveCalls] = useState<any[]>([]);
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [filter, setFilter] = useState<'All' | 'Open' | 'Resolved' | 'History'>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [isSending, setIsTyping] = useState(false);
  const [activeCallRoom, setActiveCallRoom] = useState<{room: string, reason?: string, userId?: string} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sorting State
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    loadTickets();
    loadCalls();
    if (filter === 'History' || activeTab === 'calls') loadCallHistory();

    const callInterval = setInterval(loadCalls, 5000);
    return () => clearInterval(callInterval);
  }, [filter, activeTab]);

  useEffect(() => {
    if (selectedTicket) {
      loadUserProfile(selectedTicket.userId, selectedTicket.userEmail);
    } else {
      setUserProfile(null);
    }
  }, [selectedTicket]);

  const loadUserProfile = async (userId: string, userEmail: string) => {
    try {
      const jwt = localStorage.getItem('kawayan_jwt');
      const [profileRes, walletRes] = await Promise.all([
        fetch(`/api/profiles/${userId}`, { headers: { 'Authorization': `Bearer ${jwt}` } }),
        fetch(`/api/wallet/${userId}`, { headers: { 'Authorization': `Bearer ${jwt}` } })
      ]);
      
      const profile = profileRes.ok ? await profileRes.json() : null;
      const wallet = walletRes.ok ? await walletRes.json() : null;
      
      setUserProfile({ 
        ...profile, 
        wallet, 
        email: userEmail,
        // Ensure we have a name to show
        businessName: profile?.businessName || userEmail.split('@')[0]
      });
    } catch (e) {
      console.error("Failed to load user info", e);
      setUserProfile({ email: userEmail, wallet: { balance: 0 } });
    }
  };

  const loadTickets = async () => {
    setIsLoading(true);
    const all = await supportService.getAllTickets();
    setTickets(all);
    setIsLoading(false);
  };

  const loadCalls = async () => {
    try {
      const response = await fetch('/api/support/calls', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('kawayan_jwt')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setActiveCalls(data);
      }
    } catch (e) { console.error("Failed to load calls", e); }
  };

  const loadCallHistory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/support/call-history', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('kawayan_jwt')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCallHistory(data);
      }
    } catch (e) { console.error("Failed to load call history", e); }
    setIsLoading(false);
  };

  const handleJoinCall = (roomName: string, reason?: string, userId?: string) => {
    setActiveCallRoom({ room: roomName, reason, userId });
  };

  const handleStatusUpdate = async (id: string, status: 'Open' | 'Pending' | 'Resolved') => {
    await supportService.updateTicketStatus(id, status);
    if (selectedTicket?.id === id) {
      setSelectedTicket({ ...selectedTicket, status });
    }
    loadTickets();
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !reply.trim()) return;

    setIsTyping(true);
    try {
      const newMessage = {
        sender: 'agent' as const,
        text: reply,
        timestamp: new Date().toISOString()
      };

      const updatedMessages = [...(selectedTicket.messages || []), newMessage];
      
      const response = await fetch(`/api/support/tickets/${selectedTicket.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kawayan_jwt')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          status: selectedTicket.status === 'Open' ? 'Pending' : selectedTicket.status,
          messages: updatedMessages 
        })
      });

      if (response.ok) {
        setSelectedTicket({ 
          ...selectedTicket, 
          messages: updatedMessages,
          status: selectedTicket.status === 'Open' ? 'Pending' : selectedTicket.status 
        });
        setReply('');
        loadTickets();
      }
    } catch (e) {
      console.error("Failed to send reply", e);
    } finally {
      setIsTyping(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const priorityWeight = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };

  const stats = useMemo(() => {
    return {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'Open').length,
      pending: tickets.filter(t => t.status === 'Pending').length,
      resolved: tickets.filter(t => t.status === 'Resolved').length,
      activeCalls: activeCalls.length,
      critical: tickets.filter(t => t.priority === 'Critical' && t.status !== 'Resolved').length
    };
  }, [tickets, activeCalls]);

  const activityData = useMemo(() => {
    const hours = ['9 AM', '12 PM', '3 PM', '6 PM', '9 PM', '12 AM'];
    return hours.map((hour, index) => {
      const count = tickets.filter(t => {
        const h = new Date(t.createdAt).getHours();
        // Map 24h to these slots: 9AM(8-11), 12PM(12-14), 3PM(15-17), 6PM(18-20), 9PM(21-23), 12AM(0-7)
        if (index === 0) return h >= 8 && h < 12;
        if (index === 1) return h >= 12 && h < 15;
        if (index === 2) return h >= 15 && h < 18;
        if (index === 3) return h >= 18 && h < 21;
        if (index === 4) return h >= 21 && h < 24;
        if (index === 5) return h >= 0 && h < 8;
        return false;
      }).length;
      return { 
        name: hour, 
        tickets: count 
      };
    });
  }, [tickets]);

  const processedTickets = useMemo(() => {
    let result = tickets.filter(t => {
      const matchesFilter = filter === 'All' || filter === 'History' || t.status === filter;
      const matchesSearch = t.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           t.subject.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });

    return result.sort((a, b) => {
      let comparison = 0;
      if (sortKey === 'date') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortKey === 'user') {
        comparison = a.userEmail.localeCompare(b.userEmail);
      } else if (sortKey === 'priority') {
        comparison = (priorityWeight[a.priority as keyof typeof priorityWeight] || 0) - 
                     (priorityWeight[b.priority as keyof typeof priorityWeight] || 0);
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [tickets, filter, searchQuery, sortKey, sortDirection]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-6 animate-in fade-in duration-500 overflow-hidden">
      {activeCallRoom && (
        <CallOverlay 
          roomId={activeCallRoom.room} 
          reason={activeCallRoom.reason}
          targetUserId={activeCallRoom.userId}
          isAgent={true} 
          onEndCall={() => {
            setActiveCallRoom(null);
            loadTickets();
            if (filter === 'History') loadCallHistory();
          }} 
        />
      )}

      <div className="flex flex-col md:flex-row justify-between items-end gap-4 shrink-0 px-2">
        <div>
           <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Support Help Desk</h1>
           <p className="text-slate-500 dark:text-slate-400 mt-1">Manage user concerns and session logs.</p>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={() => { loadTickets(); loadCalls(); loadCallHistory(); }}
             className="p-2 bg-white dark:bg-[#2B5748]/40 border border-slate-200 dark:border-[#9CB080]/20 rounded-xl text-slate-500 hover:text-emerald-600 transition shadow-sm"
             title="Refresh Data"
           >
             <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
           </button>
           <div className="flex gap-1 p-1 bg-[#273338]/5 dark:bg-[#2B5748]/40 rounded-2xl overflow-x-auto border border-[#273338]/10 dark:border-[#9CB080]/20">
              {[ 
                { id: 'overview', label: 'Overview', icon: History },
                { id: 'tickets', label: 'Tickets', icon: MessageSquare },
                { id: 'calls', label: 'Call Center', icon: PhoneCall },
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition whitespace-nowrap ${ 
                    activeTab === tab.id 
                    ? 'bg-white dark:bg-[#2B5748]/50 shadow-sm' 
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                  style={activeTab === tab.id ? { color: '#2B5748' } : {}}
                >
                  <tab.icon className="w-3.5 h-3.5" /> {tab.label}
                </button>
              ))}
           </div>
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 overflow-y-auto pr-2 scrollbar-hide">
          <div className="rounded-[2rem] p-8 text-white relative overflow-hidden" style={{ background: '#273338', boxShadow: '0 12px 40px -8px rgba(0,0,0,0.25)' }}>
             <div className="absolute inset-0 dot-pattern-dark opacity-50 rounded-[2rem]"></div>
             <div className="absolute top-0 right-0 w-72 h-72 rounded-full blur-3xl opacity-15" style={{ background: "#2B5748", transform: 'translate(20%, -20%)' }}></div>
             <div className="relative z-10">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold mb-3 px-3 py-1 rounded-full bg-[#2B5748]/20 border border-[#2B5748]/30 text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2B5748] animate-pulse-dot inline-block"></span>
                  Support Dashboard
                </span>
                <h2 className="font-display text-3xl text-white mb-2">Welcome back, {user?.email.split('@')[0]}!</h2>
                <p className="text-slate-400 font-medium text-sm">You have <span className="font-bold text-[#2B5748]">{stats.open}</span> tickets waiting for your response.</p>
             </div>
             <MessageSquare className="absolute -right-8 -bottom-8 w-44 h-44 text-white/5 rotate-12" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            {[
              { label: 'Total Tickets', value: stats.total, icon: MessageSquare, color: 'text-slate-600', bg: 'bg-slate-50' },
              { label: 'Open', value: stats.open, icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Awaiting', value: stats.pending, icon: Send, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Resolved', value: stats.resolved, icon: CheckCircle, color: 'text-slate-400', bg: 'bg-slate-50' },
              { label: 'Live Calls', value: stats.activeCalls, icon: PhoneCall, color: 'text-rose-600', bg: 'bg-rose-50' },
              { label: 'Critical', value: stats.critical, icon: AlertTriangle, color: 'text-rose-700', bg: 'bg-rose-100 animate-pulse' },
            ].map((s, i) => (
              <div key={i} className="bg-white dark:bg-[#2B5748]/40 p-6 rounded-2xl border border-slate-100 dark:border-[#9CB080]/20 shadow-sm">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-4`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white">{s.value}</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white dark:bg-[#2B5748]/40 p-6 rounded-2xl border border-slate-100 dark:border-[#9CB080]/20 shadow-sm h-[320px] flex flex-col">
              <h3 className="font-bold text-slate-800 dark:text-white mb-6">Support Activity</h3>
              <div className="flex-1 min-h-0">
                 <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityData}>
                    <defs>
                      <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:opacity-10"/>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                    <YAxis hide />
                    <RechartsTooltip contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: '#0f172a', color: '#fff', fontSize: '10px'}} itemStyle={{color: '#10b981', fontWeight: 'bold'}} />
                    <Area type="monotone" dataKey="tickets" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTickets)" animationDuration={1500} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-4 bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-emerald-400 mb-2">Support Performance</h3>
                <p className="text-xs text-slate-400">Response time and resolution rate.</p>
              </div>
              <div className="space-y-4 my-6">
                <div>
                  <div className="flex justify-between text-[10px] font-bold mb-1 uppercase tracking-widest">
                    <span>Resolution Rate</span>
                    <span className="text-emerald-400">88%</span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: '88%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-bold mb-1 uppercase tracking-widest">
                    <span>Avg Response Time</span>
                    <span className="text-emerald-400">4.2m</span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: '75%' }}></div>
                  </div>
                </div>
              </div>
              <button onClick={() => setActiveTab('tickets')} className="w-full py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2">
                Go to Ticket Queue <ArrowUpDown className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'calls' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 overflow-hidden animate-in slide-in-from-right-4 duration-500">
           <div className="lg:col-span-4 flex flex-col bg-slate-900 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-emerald-600/10">
                 <div className="flex items-center gap-3 text-white">
                    <PhoneCall className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-bold uppercase tracking-widest text-sm">Live Queue</h3>
                 </div>
                 {activeCalls.length > 0 && <span className="bg-rose-500 text-[10px] px-2 py-0.5 rounded-full animate-pulse font-black text-white">LIVE</span>}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                 {activeCalls.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-40">
                       <PhoneCall className="w-12 h-12 mb-4 text-slate-500" />
                       <p className="text-sm font-medium text-slate-400">No active calls in queue</p>
                    </div>
                 ) : (
                    activeCalls.map(call => (
                       <div key={call.user_id} className="p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition group">
                          <div className="flex justify-between items-start mb-3">
                             <div>
                                <h4 className="font-bold text-white text-sm truncate max-w-[200px]">{call.user_email}</h4>
                                <p className="text-[10px] text-slate-400 font-mono">ID: {call.room_name.split('-')[1]}</p>
                             </div>
                             <span className="text-[10px] text-emerald-400 font-bold bg-emerald-400/10 px-2 py-0.5 rounded-full">
                                {Math.max(0, Math.floor((Date.now() - new Date(call.started_at).getTime()) / 60000))}m wait
                             </span>
                          </div>
                          <button onClick={() => handleJoinCall(call.room_name, call.reason, call.user_id)} className="w-full py-3 rounded-full text-xs font-black uppercase transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 text-white bg-[#2B5748]" style={{ boxShadow: '0 4px 16px -4px rgba(43, 87, 72,0.35)' }}>
                             <PhoneCall className="w-4 h-4" /> Connect Now
                          </button>
                       </div>
                    ))
                 )}
              </div>
           </div>

           <div className="lg:col-span-8 flex flex-col bg-white dark:bg-[#2B5748]/40 rounded-2xl border border-slate-200 dark:border-[#9CB080]/20 shadow-xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-[#9CB080]/20 flex justify-between items-center bg-slate-50 dark:bg-[#273338]/20">
                 <div className="flex items-center gap-3">
                    <History className="w-5 h-5 text-slate-400" />
                    <h3 className="font-bold text-slate-800 dark:text-white">Recent Call Logs</h3>
                 </div>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                 <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-[#273338] z-10 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-[#9CB080]/20">
                       <tr>
                          <th className="px-6 py-4">User</th>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4 text-center">Duration</th>
                          <th className="px-6 py-4 text-right">Status</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                       {callHistory.length === 0 ? (
                          <tr><td colSpan={4} className="py-20 text-center text-slate-400 text-sm italic px-10">No call history logs found.</td></tr>
                       ) : (
                          callHistory.map(call => (
                             <tr key={call.id} className="hover:bg-slate-50 dark:hover:bg-[#2B5748]/50/30 transition group">
                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white text-xs">{call.user_email}</td>
                                <td className="px-6 py-4 text-[11px] text-slate-500">{new Date(call.started_at).toLocaleString()}</td>
                                <td className="px-6 py-4 text-center">
                                   <span className="text-[10px] font-bold bg-slate-100 dark:bg-[#2B5748]/50 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
                                      {formatDuration(call.duration_seconds)}
                                   </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                   <span className="text-[10px] font-black uppercase tracking-tighter text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">Completed</span>
                                </td>
                             </tr>
                          ))
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 overflow-hidden ${activeTab !== 'tickets' ? 'hidden' : ''}`}>
         <div className={`lg:col-span-4 flex flex-col gap-6 overflow-hidden ${selectedTicket ? 'hidden lg:flex' : 'flex'}`}>
            <div className="flex-1 flex flex-col bg-white dark:bg-[#2B5748]/40 rounded-2xl border border-slate-200 dark:border-[#9CB080]/20 shadow-sm overflow-hidden min-h-0">
               <div className="p-4 border-b border-slate-100 dark:border-[#9CB080]/20 space-y-4 bg-slate-50/50 dark:bg-[#273338]/20">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                     {(['All', 'Open', 'Resolved'] as const).map(f => (
                       <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${filter === f ? 'bg-[#2B5748] dark:bg-[#9CB080] text-white dark:text-[#273338]' : 'bg-[#273338]/5 dark:bg-[#273338] text-slate-400 hover:text-slate-600'}`} style={filter === f ? { boxShadow: '0 4px 12px -3px rgba(43, 87, 72,0.3)' } : {}}>
                         {f}
                       </button>
                     ))}
                  </div>
                  <div className="relative">
                     <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                     <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search tickets..." className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-[#273338] border border-transparent focus:border-[#2B5748] rounded-xl text-sm outline-none transition-all" />
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700 scrollbar-hide">
                  {isLoading ? (
                     <div className="flex items-center justify-center py-20">
                       <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                     </div>
                  ) : processedTickets.length === 0 ? (
                     <div className="py-20 text-center text-slate-400 text-sm italic px-10">No tickets found.</div>
                  ) : (
                     processedTickets.map(ticket => (
                        <div key={ticket.id} onClick={() => setSelectedTicket(ticket)} className={`p-4 cursor-pointer transition relative group border-l-4 ${selectedTicket?.id === ticket.id ? 'bg-[#2B5748]/5 dark:bg-[#2B5748]/8' : 'hover:bg-[#273338]/5 dark:hover:bg-[#2B5748]/50/30 border-l-transparent'}`} style={selectedTicket?.id === ticket.id ? { borderLeftColor: '#2B5748' } : {}}>
                           <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-slate-900 dark:text-white text-sm truncate max-w-[150px]">{ticket.userEmail}</span>
                              <span className="text-[10px] text-slate-400">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                           </div>
                           <h4 className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">{ticket.subject}</h4>
                           <div className="mt-2 flex items-center gap-2">
                              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${ticket.priority === 'Critical' ? 'bg-rose-100 text-rose-700' : ticket.priority === 'High' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{ticket.priority}</span>
                              <span className={`text-[9px] font-black uppercase tracking-wider ${ticket.status === 'Open' ? 'text-emerald-600' : ticket.status === 'Resolved' ? 'text-slate-400' : 'text-blue-500'}`}>{ticket.status}</span>
                           </div>
                        </div>
                     ))
                  )}
               </div>
            </div>

            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl shrink-0 max-h-[200px] flex flex-col">
               <div className="flex items-center gap-3 mb-4 shrink-0">
                  <PhoneCall className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-sm uppercase tracking-wider">Live Queue</span>
                  {activeCalls.length > 0 && <span className="ml-auto bg-rose-500 text-[10px] px-2 py-0.5 rounded-full animate-pulse font-black">LIVE</span>}
               </div>
               <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide">
                  {activeCalls.length === 0 ? <p className="text-[10px] text-slate-400 italic">No active requests.</p> : activeCalls.map(call => (
                    <div key={call.user_id} className="p-3 bg-white/5 rounded-xl border border-white/10 flex justify-between items-center">
                       <span className="text-[10px] font-bold truncate max-w-[120px]">{call.user_email}</span>
                       <button onClick={() => handleJoinCall(call.room_name, call.reason, call.user_id)} className="px-3 py-1 rounded-full text-[9px] font-black uppercase text-white hover:scale-105 transition-all bg-[#2B5748]">Connect</button>
                    </div>
                  ))}
               </div>
            </div>
         </div>

         <div className={`lg:col-span-8 flex flex-col bg-white dark:bg-[#2B5748]/40 rounded-2xl border border-slate-200 dark:border-[#9CB080]/20 shadow-xl overflow-hidden min-h-0 ${!selectedTicket ? 'hidden lg:flex' : 'flex'}`}>
            {selectedTicket ? (
               <div className="flex flex-1 overflow-hidden">
                  <div className="flex-1 flex flex-col min-w-0">
                     <div className="p-4 border-b border-slate-100 dark:border-[#9CB080]/20 bg-slate-50 dark:bg-[#273338] flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-3">
                           <button onClick={() => setSelectedTicket(null)} className="lg:hidden p-1.5 hover:bg-slate-200 dark:hover:bg-[#2B5748]/50 rounded-lg transition"><ArrowLeft className="w-5 h-5" /></button>
                           <div>
                              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">{selectedTicket.subject} <span className="text-[10px] text-slate-400">#{selectedTicket.ticketNum}</span></h3>
                              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                                 <span className="flex items-center gap-1"><UserIcon className="w-3 h-3" /> {selectedTicket.userEmail}</span>
                              </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="relative group/status">
                              <button className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition border ${selectedTicket.status === 'Open' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : selectedTicket.status === 'Pending' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                 <div className={`w-2 h-2 rounded-full ${selectedTicket.status === 'Open' ? 'bg-emerald-500' : selectedTicket.status === 'Pending' ? 'bg-blue-500' : 'bg-slate-400'}`} />
                                 {selectedTicket.status} <ChevronDown className="w-3 h-3" />
                              </button>
                              <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-[#2B5748]/40 border border-slate-200 rounded-xl shadow-xl py-1 z-50 opacity-0 invisible group-hover/status:opacity-100 group-hover/status:visible transition-all">
                                 {(['Open', 'Pending', 'Resolved'] as const).map(s => (
                                    <button key={s} onClick={() => handleStatusUpdate(selectedTicket.id, s)} className="w-full text-left px-4 py-2 text-xs font-bold hover:bg-slate-50 text-slate-600 transition">{s}</button>
                                 ))}
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-[#273338]/30 scrollbar-hide">
                        {selectedTicket.messages?.map((msg, idx) => (
                           <div key={idx} className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${msg.sender === 'agent' ? 'text-white rounded-tr-none' : 'bg-white dark:bg-[#2B5748]/50 text-slate-800 dark:text-white border border-[#273338]/10 dark:border-[#9CB080]/20 rounded-tl-none'}`} style={msg.sender === 'agent' ? { background: '#2B5748' } : {}}>
                                 {msg.text}
                              </div>
                           </div>
                        ))}
                     </div>

                     {selectedTicket.status !== 'Resolved' && (
                        <div className="p-4 bg-white dark:bg-[#2B5748]/40 border-t border-slate-100 dark:border-[#9CB080]/20 shrink-0 space-y-3">
                           <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                              {[{ label: 'Greeting', text: 'Mabuhay! How can I help you?' }, { label: 'Checking', text: 'Wait lang po, let me check.' }, { label: 'Resolved', text: 'Resolved na po!' }].map((qr, i) => (
                                 <button key={i} onClick={() => setReply(qr.text)} className="px-2 py-1 bg-slate-100 dark:bg-[#273338] text-slate-500 rounded-md text-[10px] font-bold hover:bg-emerald-50 transition whitespace-nowrap">{qr.label}</button>
                              ))}
                           </div>
                           <form onSubmit={handleSendReply} className="flex gap-3">
                              <textarea rows={1} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type reply..." className="flex-1 bg-slate-100 dark:bg-[#273338] border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none" />
                              <button type="submit" disabled={isSending || !reply.trim()} className="bg-emerald-600 text-white rounded-xl px-4 py-2.5 font-bold text-sm hover:bg-emerald-700 transition shadow-lg flex items-center gap-2 disabled:opacity-50">
                                 {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                 <span className="hidden sm:inline">Reply</span>
                              </button>
                           </form>
                        </div>
                     )}
                  </div>

                  <div className="hidden xl:flex w-72 border-l border-slate-100 dark:border-[#9CB080]/20 flex-col bg-slate-50 dark:bg-[#273338]/10">
                     <div className="p-6 border-b border-slate-100 dark:border-[#9CB080]/20 text-center">
                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner"><UserIcon className="w-8 h-8" /></div>
                        <h4 className="font-bold text-slate-800 dark:text-white truncate">{userProfile?.businessName || 'Anonymous'}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{userProfile?.industry || 'General SME'}</p>
                     </div>
                     <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                        <div>
                           <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Wallet Info</h5>
                           <div className="p-3 bg-white dark:bg-[#2B5748]/40 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-xs text-slate-500 mb-1">Current Balance</p>
                              <p className="text-lg font-black text-slate-800 dark:text-white">₱{userProfile?.wallet?.balance?.toLocaleString() || '0'}</p>
                           </div>
                        </div>
                        <button onClick={() => { const suffix = selectedTicket.userId.substring(selectedTicket.userId.length - 4); handleJoinCall(`KawayanSupport-${suffix}`, selectedTicket.subject, selectedTicket.userId); }} className="w-full py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition">
                           <PhoneCall className="w-3.5 h-3.5" /> Call Customer
                        </button>
                     </div>
                  </div>
               </div>
            ) : (
               <div className="flex-1 flex flex-col items-center justify-center text-center p-10 space-y-4">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-[#2B5748]/50 rounded-full flex items-center justify-center shadow-inner"><MessageSquare className="w-10 h-10 text-slate-300" /></div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white">Select a Ticket</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Pick a user from the left to start the conversation.</p>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default SupportDashboard;