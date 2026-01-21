import React, { useState, useEffect } from 'react';
import { MessageSquare, Clock, User, PhoneCall, Search, Loader2, Send, ArrowLeft, MoreVertical, CheckCircle } from 'lucide-react';
import { supportService } from '../services/supportService';
import { Ticket } from '../types';
import CallOverlay from './CallOverlay';

const SupportDashboard: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeCalls, setActiveCalls] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [filter, setFilter] = useState<'All' | 'Open' | 'Resolved'>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [isSending, setIsTyping] = useState(false);
  const [activeCallRoom, setActiveCallRoom] = useState<{room: string, reason?: string, userId?: string} | null>(null);

  useEffect(() => {
    loadTickets();
    loadCalls();

    const callInterval = setInterval(loadCalls, 5000);
    return () => clearInterval(callInterval);
  }, [filter]);

  useEffect(() => {
    if (activeCalls.length > 0) {
       console.log("ALERT: New incoming call in queue!");
    }
  }, [activeCalls.length]);

  const loadTickets = async () => {
    setIsLoading(true);
    const all = await supportService.getAllTickets();
    if (filter === 'All') setTickets(all);
    else setTickets(all.filter(t => t.status === filter));
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

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-6 animate-in fade-in duration-500">
      {activeCallRoom && (
        <CallOverlay 
          roomId={activeCallRoom.room} 
          reason={activeCallRoom.reason}
          isAgent={true} 
          onEndCall={() => setActiveCallRoom(null)} 
        />
      )}
      <div className="flex justify-between items-end shrink-0">
        <div>
           <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Support Help Desk</h1>
           <p className="text-slate-500 dark:text-slate-400 mt-1">Manage user concerns and incoming requests.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 overflow-hidden">
         
         <div className={`lg:col-span-4 flex flex-col gap-6 ${selectedTicket ? 'hidden lg:flex' : 'flex'}`}>
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
               <div className="p-4 border-b border-slate-100 dark:border-slate-700 space-y-4">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                     <button onClick={() => setFilter('All')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${filter === 'All' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400'}`}>All</button>
                     <button onClick={() => setFilter('Open')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${filter === 'Open' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400'}`}>Open</button>
                     <button onClick={() => setFilter('Resolved')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${filter === 'Resolved' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400'}`}>Resolved</button>
                  </div>
                  <div className="relative">
                     <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                     <input type="text" placeholder="Search tickets..." className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-900 border-none rounded-xl text-sm outline-none" />
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                  {isLoading ? (
                     <div className="flex items-center justify-center py-20">
                       <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                     </div>
                  ) : tickets.length === 0 ? (
                     <div className="py-20 text-center text-slate-400 text-sm italic px-10">No {filter !== 'All' ? filter.toLowerCase() : ''} tickets.</div>
                  ) : (
                     tickets.map(ticket => (
                        <div 
                           key={ticket.id} 
                           onClick={() => setSelectedTicket(ticket)}
                           className={`p-4 cursor-pointer transition relative group ${selectedTicket?.id === ticket.id ? 'bg-emerald-50 dark:bg-emerald-900/10 border-l-4 border-l-emerald-500' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30 border-l-4 border-l-transparent'}`}
                        >
                           <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-slate-900 dark:text-white text-sm truncate max-w-[150px]">{ticket.userEmail}</span>
                              <span className="text-[10px] text-slate-400 font-medium">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                           </div>
                           <h4 className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate mb-2">{ticket.subject}</h4>
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                 <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                    ticket.priority === 'Critical' ? 'bg-rose-100 text-rose-700' :
                                    ticket.priority === 'High' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                 }`}>{ticket.priority}</span>
                                 <span className={`text-[9px] font-bold uppercase ${ticket.status === 'Open' ? 'text-emerald-600' : ticket.status === 'Resolved' ? 'text-slate-400' : 'text-blue-500'}`}>{ticket.status}</span>
                              </div>
                              <button 
                                 onClick={(e) => {
                                    e.stopPropagation();
                                    const suffix = ticket.userId.substring(ticket.userId.length - 4);
                                    handleJoinCall(`KawayanSupport-${suffix}`, ticket.subject);
                                 }}
                                 className="opacity-0 group-hover:opacity-100 transition p-1 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200"
                                 title="Call this user"
                              >
                                 <PhoneCall className="w-3 h-3" />
                              </button>
                           </div>
                        </div>
                     ))
                  )}
               </div>
            </div>

            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl shrink-0">
               <div className="flex items-center gap-3 mb-4">
                  <PhoneCall className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-sm uppercase tracking-wider">Call Queue</span>
                  {activeCalls.length > 0 && (
                    <span className="ml-auto bg-rose-500 text-[10px] px-2 py-0.5 rounded-full animate-pulse font-black">LIVE</span>
                  )}
               </div>
               
               <div className="space-y-4">
                  {activeCalls.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">No active call requests.</p>
                  ) : (
                    <div className="space-y-2">
                       {activeCalls.map(call => (
                         <div key={call.user_id} className="p-3 bg-slate-800/50 rounded-xl border border-slate-700 flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                               <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-slate-300 truncate max-w-[120px]">{call.user_email}</span>
                                  <span className="text-[9px] text-slate-500">ID: {call.user_id.substring(call.user_id.length - 4)}</span>
                               </div>
                               <span className="text-[9px] text-emerald-400 font-mono shrink-0">
                                  {Math.max(0, Math.floor((Date.now() - new Date(call.started_at).getTime()) / 60000))}m wait
                               </span>
                            </div>
                            <p className="text-[10px] text-slate-400 line-clamp-2 bg-black/20 p-1.5 rounded-lg border border-white/5 italic">
                               "{call.reason || 'No specific reason provided'}"
                            </p>
                            <button 
                               onClick={() => handleJoinCall(call.room_name, call.reason)}
                               className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-[10px] font-black uppercase transition shadow-md"
                            >
                               Connect
                            </button>
                         </div>
                       ))}
                    </div>
                  )}
               </div>
            </div>
         </div>

         <div className={`lg:col-span-8 flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden ${!selectedTicket ? 'hidden lg:flex' : 'flex'}`}>
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
         </div>
      </div>
    </div>
  );
};

export default SupportDashboard;