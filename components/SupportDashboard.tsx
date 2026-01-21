import React, { useState, useEffect, useMemo } from 'react';
import { MessageSquare, Clock, User, PhoneCall, Search, Loader2, Send, ArrowLeft, MoreVertical, CheckCircle, History, ArrowUpDown, ChevronDown } from 'lucide-react';
import { supportService } from '../services/supportService';
import { Ticket } from '../types';
import CallOverlay from './CallOverlay';

type SortKey = 'date' | 'user' | 'priority' | 'duration';
type SortDirection = 'asc' | 'desc';

const SupportDashboard: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeCalls, setActiveCalls] = useState<any[]>([]);
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
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
    if (filter === 'History') loadCallHistory();

    const callInterval = setInterval(loadCalls, 5000);
    return () => clearInterval(callInterval);
  }, [filter]);

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

  const handleResolve = async (id: string) => {
    await supportService.updateTicketStatus(id, 'Resolved');
    if (selectedTicket?.id === id) {
      setSelectedTicket({ ...selectedTicket, status: 'Resolved' });
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

  // Advanced Sorting & Filtering Logic
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

  const processedHistory = useMemo(() => {
    let result = callHistory.filter(c => 
      c.user_email.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.reason && c.reason.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.call_id && c.call_id.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return result.sort((a, b) => {
      let comparison = 0;
      if (sortKey === 'date') {
        comparison = new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
      } else if (sortKey === 'user') {
        comparison = a.user_email.localeCompare(b.user_email);
      } else if (sortKey === 'duration') {
        comparison = (a.duration_seconds || 0) - (b.duration_seconds || 0);
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [callHistory, searchQuery, sortKey, sortDirection]);

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

      <div className="flex justify-between items-end shrink-0 px-2">
        <div>
           <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Support Help Desk</h1>
           <p className="text-slate-500 dark:text-slate-400 mt-1">Manage user concerns and session logs.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 overflow-hidden">
         
         {/* LEFT SIDEBAR: List, Search, Sort, Queue */}
         <div className={`lg:col-span-4 flex flex-col gap-6 overflow-hidden ${selectedTicket ? 'hidden lg:flex' : 'flex'}`}>
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden min-h-0">
               {/* Sidebar Navigation */}
               <div className="p-4 border-b border-slate-100 dark:border-slate-700 space-y-4 bg-slate-50/50 dark:bg-slate-900/20">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                     {(['All', 'Open', 'Resolved', 'History'] as const).map(f => (
                       <button 
                        key={f}
                        onClick={() => setFilter(f)} 
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${filter === f ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-850'}`}
                       >
                         {f === 'History' ? 'Call Logs' : f}
                       </button>
                     ))}
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                       <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                       <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..." 
                        className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-emerald-500 rounded-xl text-sm outline-none transition-all" 
                       />
                    </div>
                    {/* Sort Dropdown */}
                    <div className="relative group">
                       <button className="p-2 bg-slate-100 dark:bg-slate-900 rounded-xl border border-transparent hover:border-slate-300 dark:hover:border-slate-700 text-slate-500 transition-all flex items-center gap-1">
                          <ArrowUpDown className="w-4 h-4" />
                          <ChevronDown className="w-3 h-3" />
                       </button>
                       <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl py-2 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                          <p className="px-4 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sort By</p>
                          <button onClick={() => setSortKey('date')} className={`w-full text-left px-4 py-2 text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 ${sortKey === 'date' ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-300'}`}>Date</button>
                          <button onClick={() => setSortKey('user')} className={`w-full text-left px-4 py-2 text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 ${sortKey === 'user' ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-300'}`}>User (A-Z)</button>
                          {filter !== 'History' && <button onClick={() => setSortKey('priority')} className={`w-full text-left px-4 py-2 text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 ${sortKey === 'priority' ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-300'}`}>Priority</button>}
                          {filter === 'History' && <button onClick={() => setSortKey('duration')} className={`w-full text-left px-4 py-2 text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 ${sortKey === 'duration' ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-300'}`}>Duration</button>}
                          <hr className="my-1 border-slate-100 dark:border-slate-700" />
                          <button onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')} className="w-full text-left px-4 py-2 text-xs font-bold text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                             {sortDirection === 'desc' ? 'Descending' : 'Ascending'}
                          </button>
                       </div>
                    </div>
                  </div>
               </div>

               {/* Scrollable List Area */}
               <div className="flex-1 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700 scrollbar-hide">
                  {isLoading ? (
                     <div className="flex items-center justify-center py-20">
                       <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                     </div>
                  ) : filter === 'History' ? (
                     processedHistory.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 text-sm italic px-10">No call history logs found.</div>
                     ) : (
                        processedHistory.map(call => (
                           <div key={call.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition border-l-4 border-l-transparent hover:border-l-indigo-500">
                              <div className="flex justify-between items-start mb-1">
                                 <span className="font-bold text-slate-900 dark:text-white text-xs truncate max-w-[150px]">{call.user_email}</span>
                                 <span className="text-[10px] text-slate-400 font-medium">{new Date(call.started_at).toLocaleDateString()}</span>
                              </div>
                              <p className="text-[10px] text-slate-500 line-clamp-1 italic mb-2">"{call.reason || 'No reason provided'}"</p>
                              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tighter">
                                 <span className="text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">Duration: {formatDuration(call.duration_seconds)}</span>
                                 <span className="text-slate-400">ID: {call.call_id || 'N/A'}</span>
                              </div>
                           </div>
                        ))
                     )
                  ) : processedTickets.length === 0 ? (
                     <div className="py-20 text-center text-slate-400 text-sm italic px-10">No tickets matching filters.</div>
                  ) : (
                     processedTickets.map(ticket => (
                        <div 
                           key={ticket.id} 
                           onClick={() => setSelectedTicket(ticket)}
                           className={`p-4 cursor-pointer transition relative group ${selectedTicket?.id === ticket.id ? 'bg-emerald-50 dark:bg-emerald-900/10 border-l-4 border-l-emerald-500 shadow-inner' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30 border-l-4 border-l-transparent'}`}
                        >
                           <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-slate-900 dark:text-white text-sm truncate max-w-[150px]">{ticket.userEmail}</span>
                              <span className="text-[10px] text-slate-400 font-medium">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                           </div>
                           <h4 className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate mb-3">{ticket.subject}</h4>
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                 <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm ${
                                    ticket.priority === 'Critical' ? 'bg-rose-100 text-rose-700' :
                                    ticket.priority === 'High' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                 }`}>{ticket.priority}</span>
                                 <span className={`text-[9px] font-black uppercase tracking-wider ${ticket.status === 'Open' ? 'text-emerald-600' : ticket.status === 'Resolved' ? 'text-slate-400' : 'text-blue-500'}`}>{ticket.status}</span>
                              </div>
                              <button 
                                 onClick={(e) => {
                                    e.stopPropagation();
                                    const suffix = ticket.userId.substring(ticket.userId.length - 4);
                                    handleJoinCall(`KawayanSupport-${suffix}`, ticket.subject, ticket.userId);
                                 }}
                                 className="opacity-0 group-hover:opacity-100 transition p-1.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-800"
                                 title="Call this user"
                              >
                                 <PhoneCall className="w-3.5 h-3.5" />
                              </button>
                           </div>
                        </div>
                     ))
                  )}
               </div>
            </div>

            {/* Live Queue - Now also scrollable if many calls */}
            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl shrink-0 max-h-[300px] flex flex-col">
               <div className="flex items-center gap-3 mb-4 shrink-0">
                  <PhoneCall className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-sm uppercase tracking-wider">Live Call Queue</span>
                  {activeCalls.length > 0 && (
                    <span className="ml-auto bg-rose-500 text-[10px] px-2 py-0.5 rounded-full animate-pulse font-black">LIVE</span>
                  )}
               </div>
               
               <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide">
                  {activeCalls.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">No active call requests.</p>
                  ) : (
                    activeCalls.map(call => (
                                               <div key={call.user_id} className="p-3 bg-slate-800/50 rounded-xl border border-slate-700 flex flex-col gap-2">
                                                  <div className="flex justify-between items-start">
                                                     <div className="flex flex-col min-w-0">
                                                        <span className="text-[10px] font-bold text-slate-300 truncate">{call.user_email}</span>
                                                        <span className="text-[9px] text-slate-500 font-bold">ID: {call.room_name.split('-')[1]}</span>
                                                     </div>
                                                     <span className="text-[9px] text-emerald-400 font-mono shrink-0">
                                                        {Math.max(0, Math.floor((Date.now() - new Date(call.started_at).getTime()) / 60000))}m wait
                                                     </span>
                                                  </div>                        <p className="text-[10px] text-slate-400 line-clamp-2 bg-black/20 p-1.5 rounded-lg border border-white/5 italic">
                            "{call.reason || 'No specific reason provided'}"
                        </p>
                        <button 
                            onClick={() => handleJoinCall(call.room_name, call.reason, call.user_id)}
                            className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-[10px] font-black uppercase transition shadow-md"
                        >
                            Connect
                        </button>
                      </div>
                    ))
                  )}
               </div>
            </div>
         </div>

         {/* RIGHT: Conversation Area - Independently scrollable */}
         <div className={`lg:col-span-8 flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden min-h-0 ${!selectedTicket ? 'hidden lg:flex' : 'flex'}`}>
            {selectedTicket ? (
               <>
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 flex justify-between items-center shrink-0">
                     <div className="flex items-center gap-3">
                        <button onClick={() => setSelectedTicket(null)} className="lg:hidden p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition">
                           <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                        </button>
                        <div>
                           <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                              {selectedTicket.subject}
                              <span className="text-[10px] text-slate-400 font-normal">#{selectedTicket.ticketNum}</span>
                           </h3>
                           <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1"><User className="w-3 h-3" /> {selectedTicket.userEmail}</span>
                              <span className="font-bold text-emerald-600 uppercase">Call ID: {selectedTicket.userId.substring(selectedTicket.userId.length - 4)}</span>
                           </div>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        {selectedTicket.status !== 'Resolved' && (
                           <button 
                              onClick={() => handleResolve(selectedTicket.id)}
                              className="px-3 py-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-200 transition"
                           >
                              <CheckCircle className="w-3 h-3" /> Resolve
                           </button>
                        )}
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 transition"><MoreVertical className="w-4 h-4" /></button>
                     </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/30">
                     {selectedTicket.messages?.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
                           <div className={`max-w-[70%] group`}>
                              <div className={`flex items-center gap-2 mb-1 ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
                                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{msg.sender}</span>
                              </div>
                              <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                                 msg.sender === 'agent' 
                                    ? 'bg-slate-900 dark:bg-emerald-600 text-white rounded-tr-none' 
                                    : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600 rounded-tl-none'
                              }`}>
                                 {msg.text}
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>

                  {selectedTicket.status !== 'Resolved' ? (
                     <form onSubmit={handleSendReply} className="p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-3 shrink-0">
                        <textarea 
                           rows={1}
                           value={reply}
                           onChange={(e) => setReply(e.target.value)}
                           onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                 e.preventDefault();
                                 handleSendReply(e);
                              }
                           }}
                           placeholder="Type your reply here..."
                           className="flex-1 bg-slate-100 dark:bg-slate-900 border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                        />
                        <button 
                           type="submit" 
                           disabled={isSending || !reply.trim()}
                           className="bg-emerald-600 text-white rounded-xl px-4 py-2.5 font-bold text-sm hover:bg-emerald-700 transition shadow-lg flex items-center gap-2 disabled:opacity-50"
                        >
                           {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                           <span>Reply</span>
                        </button>
                     </form>
                  ) : (
                     <div className="p-6 bg-slate-50 dark:bg-slate-900/50 text-center shrink-0 border-t border-slate-100 dark:border-slate-700">
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium italic">Resolved.</p>
                     </div>
                  )}
               </>
            ) : (
               <div className="flex-1 flex flex-col items-center justify-center text-center p-10 space-y-4">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                     <MessageSquare className="w-10 h-10 text-slate-300" />
                  </div>
                  <div className="max-w-xs">
                     <h3 className="text-xl font-bold text-slate-800 dark:text-white">Select a Ticket</h3>
                     <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Start assisting your users.</p>
                  </div>
                                   </div>
                                 )}
               
                                 <div className="pt-2 mt-4 border-t border-slate-800">
                                   <p className="text-[9px] text-slate-500 uppercase font-bold mb-2 tracking-widest">Manual Join</p>
                                   <div className="flex gap-2">
                                      <input 
                                       id="manualCallId" 
                                       type="text" 
                                       placeholder="Enter ID" 
                                       className="w-full bg-slate-800 border-none rounded-lg px-3 py-2 text-[10px] text-white outline-none focus:ring-1 focus:ring-emerald-500" 
                                      />
                                      <button 
                                         onClick={() => {
                                            const id = (document.getElementById('manualCallId') as HTMLInputElement).value;
                                            if (id) handleJoinCall(`KawayanSupport-${id}`);
                                         }}
                                         className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-[10px] font-bold transition"
                                      >Join</button>
                                   </div>
                                 </div>
                              </div>
                           </div>
                        </div>  );
};

export default SupportDashboard;