import React, { useState, useEffect } from 'react';
import { MessageSquare, CheckSquare, Clock, Activity, User, PhoneCall, Filter, Search } from 'lucide-react';
import { supportService } from '../services/supportService';
import { Ticket } from '../types';

const SupportDashboard: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState<'All' | 'Open' | 'Resolved'>('All');

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = () => {
    const all = supportService.getAllTickets();
    if (filter === 'All') setTickets(all);
    else setTickets(all.filter(t => t.status === filter));
  };

  const handleResolve = (id: string) => {
    supportService.updateTicketStatus(id, 'Resolved');
    loadTickets();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
           <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Support Help Desk</h1>
           <p className="text-slate-500 dark:text-slate-400 mt-1">Manage user concerns and incoming requests.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full text-sm font-medium border border-blue-100 dark:border-blue-800">
           <Activity className="w-4 h-4" /> Agent Online
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
         {/* Stats */}
         <div className="lg:col-span-1 space-y-4">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
               <p className="text-sm font-bold text-slate-400 uppercase">Queue Status</p>
               <div className="mt-4 space-y-3">
                  <div className="flex justify-between items-center">
                     <span className="text-sm text-slate-600 dark:text-slate-400">Open Tickets</span>
                     <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">{tickets.filter(t => t.status === 'Open').length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                     <span className="text-sm text-slate-600 dark:text-slate-400">Resolved Today</span>
                     <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold">{tickets.filter(t => t.status === 'Resolved').length}</span>
                  </div>
               </div>
            </div>

            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl">
               <div className="flex items-center gap-3 mb-4">
                  <PhoneCall className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold">Live Call Center</span>
               </div>
               <p className="text-xs text-slate-400 leading-relaxed">Incoming VoIP calls will appear here. No active calls currently in queue.</p>
            </div>
         </div>

         {/* Ticket List */}
         <div className="lg:col-span-3">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
               <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                     <button onClick={() => setFilter('All')} className={`text-sm font-bold ${filter === 'All' ? 'text-emerald-600' : 'text-slate-400'}`}>All</button>
                     <button onClick={() => setFilter('Open')} className={`text-sm font-bold ${filter === 'Open' ? 'text-emerald-600' : 'text-slate-400'}`}>Open</button>
                     <button onClick={() => setFilter('Resolved')} className={`text-sm font-bold ${filter === 'Resolved' ? 'text-emerald-600' : 'text-slate-400'}`}>Resolved</button>
                  </div>
                  <div className="relative">
                     <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                     <input type="text" placeholder="Search tickets..." className="pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-900 border-none rounded-lg text-xs outline-none" />
                  </div>
               </div>

               <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-medium">
                     <tr>
                        <th className="px-6 py-4">User</th>
                        <th className="px-6 py-4">Subject</th>
                        <th className="px-6 py-4">Priority</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Action</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                     {tickets.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">No tickets found.</td></tr>
                     ) : (
                        tickets.map(ticket => (
                           <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                              <td className="px-6 py-4">
                                 <div className="font-bold text-slate-800 dark:text-white">{ticket.userEmail}</div>
                                 <div className="text-[10px] text-slate-400">#{ticket.ticketNum}</div>
                              </td>
                              <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{ticket.subject}</td>
                              <td className="px-6 py-4">
                                 <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                    ticket.priority === 'Critical' ? 'bg-red-100 text-red-700' :
                                    ticket.priority === 'High' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                 }`}>{ticket.priority}</span>
                              </td>
                              <td className="px-6 py-4">
                                 <span className={`text-xs font-bold ${ticket.status === 'Open' ? 'text-emerald-600' : 'text-slate-400'}`}>{ticket.status}</span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                 {ticket.status === 'Open' && (
                                    <button onClick={() => handleResolve(ticket.id)} className="text-emerald-600 hover:underline font-bold text-xs">Resolve</button>
                                 )}
                              </td>
                           </tr>
                        ))
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
    </div>
  );
};

export default SupportDashboard;
