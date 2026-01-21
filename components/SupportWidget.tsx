import React, { useState, useEffect } from 'react';
import { MessageCircle, X, Send, Phone, FileText, Loader2, ArrowLeft, Bot, Headset } from 'lucide-react';
import { chatWithSupportBot } from '../services/geminiService';
import { supportService } from '../services/supportService';
import CallOverlay from './CallOverlay';

const SupportWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'menu' | 'chat' | 'ticket' | 'call'>('menu');
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [callReason, setCallReason] = useState('');
  
  // Ticket State
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketPriority, setTicketPriority] = useState('Medium');

  const [chatHistory, setChatHistory] = useState<{sender: 'user'|'bot'|'system'|'agent', text: string, timestamp?: string}[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [sessionCallId, setSessionCallId] = useState<string>('');

  useEffect(() => {
    // Generate a fresh random 4-digit ID for this session
    const randomId = Math.floor(1000 + Math.random() * 9000).toString();
    setSessionCallId(randomId);
    // Reset to menu when opening
    if (isOpen) {
      setMode('menu');
    }
  }, [isOpen]);

  // Poll for ticket updates
  useEffect(() => {
    let interval: any;
    if (activeTicketId && isOpen) {
      interval = setInterval(async () => {
        try {
          const response = await fetch('/api/support/tickets', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('kawayan_jwt')}` }
          });
          if (response.ok) {
            const tickets = await response.json();
            const current = tickets.find((t: any) => t.id === activeTicketId);
            if (current && current.messages) {
               if (current.messages.length > chatHistory.filter(m => m.sender !== 'bot' && m.sender !== 'system').length) {
                  const newHistory = current.messages;
                  setChatHistory(newHistory);
               }
            }
          }
        } catch (e) { console.error("Polling error", e); }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [activeTicketId, isOpen, chatHistory]);

  const handleStartCall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!callReason.trim()) return;
    setIsCalling(true);
    setMode('chat');
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    if (activeTicketId) {
       const userMsg = { sender: 'user' as const, text: message, timestamp: new Date().toISOString() };
       const updatedHistory = [...chatHistory, userMsg];
       setChatHistory(updatedHistory);
       setMessage('');
       
       try {
         await fetch(`/api/support/tickets/${activeTicketId}`, {
           method: 'PUT',
           headers: {
             'Authorization': `Bearer ${localStorage.getItem('kawayan_jwt')}`,
             'Content-Type': 'application/json'
           },
           body: JSON.stringify({ 
             status: 'Open',
             messages: updatedHistory.filter(m => m.sender === 'user' || m.sender === 'agent') 
           })
         });
       } catch (e) { console.error("Failed to send message to ticket", e); }
       return;
    }

    const newHistory = [...chatHistory, { sender: 'user' as const, text: message }];
    setChatHistory(newHistory);
    setMessage('');
    setIsTyping(true);

    try {
      const response = await chatWithSupportBot(message, chatHistory as any);
      setChatHistory(prev => [...prev, { sender: 'bot', text: response }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { sender: 'bot', text: "Sorry, I'm having trouble connecting right now." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const userSession = JSON.parse(localStorage.getItem('kawayan_session') || '{}');
    if (userSession && userSession.id) {
      try {
        const ticket = await supportService.createTicket(userSession, ticketSubject, ticketPriority, "Initial Request: " + ticketSubject);
        if (ticket) {
          setActiveTicketId(ticket.id);
          setMode('chat');
          setChatHistory([
            { sender: 'system' as const, text: `🎫 Ticket Created: #${ticket.ticketNum}` },
            { sender: 'user', text: ticketSubject }
          ]);
          setTicketSubject('');
        } else {
           alert("Failed to create ticket. Please try again.");
        }
      } catch (error) {
        console.error("Ticket creation failed", error);
        alert("An error occurred while creating the ticket.");
      }
    } else {
      alert("Please login to submit a ticket.");
    }
  };

  return (
    <>
      {isCalling && <CallOverlay onEndCall={() => setIsCalling(false)} reason={callReason} roomId={`KawayanSupport-${sessionCallId}`} />}
      
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end space-y-4">
        {isOpen && (
          <div className="bg-white dark:bg-slate-800 w-80 h-[500px] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
            {/* Header */}
            <div className="bg-slate-900 dark:bg-emerald-600 p-4 flex justify-between items-center text-white shrink-0">
              <div className="flex items-center gap-2 overflow-hidden">
                {(mode !== 'menu') && (
                  <button onClick={() => setMode('menu')} className="mr-1 hover:text-slate-300 transition-colors">
                    <ArrowLeft className="w-4 h-4"/>
                  </button>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-xs truncate">
                    {mode === 'menu' ? 'Kawayan Support' : 
                     mode === 'chat' ? 'AI Assistant' : 
                     mode === 'ticket' ? 'Submit Ticket' : 'Request Call'}
                  </span>
                  {isCalling && sessionCallId && (
                    <span className="text-[11px] font-black text-emerald-400">CALL ID: {sessionCallId}</span>
                  )}
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:text-slate-300 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col relative">
              
              {mode === 'menu' && (
                <div className="flex-1 p-6 flex flex-col gap-4 justify-center bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-2">How can we help you today?</p>
                  
                  <button 
                    onClick={() => setMode('chat')}
                    className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-md transition-all group text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white text-sm">AI Assist</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Instant answers 24/7</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => setMode('ticket')}
                    className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all group text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white text-sm">New Ticket</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Submit a formal request</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => setMode('call')}
                    className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-purple-500 dark:hover:border-purple-500 hover:shadow-md transition-all group text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                      <Headset className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white text-sm">Call Us</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Talk to a human agent</p>
                    </div>
                  </button>
                </div>
              )}

              {mode === 'chat' && (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-900/50">
                    {chatHistory.length === 0 && (
                      <div className="text-center mt-10 opacity-50">
                        <Bot className="w-12 h-12 mx-auto mb-2 text-emerald-500"/>
                        <p className="text-xs">Ask me anything about your business!</p>
                      </div>
                    )}
                    {chatHistory.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs ${
                          msg.sender === 'user' 
                            ? 'bg-emerald-600 text-white rounded-br-none' 
                            : msg.sender === 'system'
                            ? 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 italic text-center w-full'
                            : msg.sender === 'agent'
                            ? 'bg-slate-900 dark:bg-emerald-700 text-white rounded-bl-none shadow-md border-l-4 border-emerald-400'
                            : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-bl-none shadow-sm'
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-white dark:bg-slate-700 p-2 rounded-2xl rounded-bl-none shadow-sm border border-slate-200 dark:border-slate-600">
                          <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                        </div>
                      </div>
                    )}
                  </div>
                  <form onSubmit={handleSend} className="p-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-2">
                    <input 
                      type="text" 
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type your concern..."
                      disabled={isTyping}
                      className="flex-1 text-sm bg-slate-100 dark:bg-slate-900 border-none rounded-full px-4 focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white disabled:opacity-50"
                    />
                    <button type="submit" disabled={isTyping} className="p-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition shadow-md disabled:opacity-50">
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </>
              )}

              {mode === 'ticket' && (
                <form onSubmit={handleSubmitTicket} className="flex-1 p-4 space-y-4 bg-white dark:bg-slate-800 overflow-y-auto">
                   <div>
                     <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Subject</label>
                     <input required type="text" value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-white text-sm" placeholder="Brief summary of issue" />
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                     <select value={ticketPriority} onChange={(e) => setTicketPriority(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-white text-sm">
                       <option>Low</option>
                       <option>Medium</option>
                       <option>High</option>
                       <option>Critical</option>
                     </select>
                   </div>
                   <button type="submit" className="w-full py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 shadow-sm mt-4">Submit Ticket</button>
                </form>
              )}

              {mode === 'call' && (
                <form onSubmit={handleStartCall} className="flex-1 p-4 space-y-4 bg-white dark:bg-slate-800 overflow-y-auto">
                   <div className="text-center py-4">
                      <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4"><Phone className="w-8 h-8 text-emerald-600" /></div>
                      <h4 className="font-bold text-slate-900 dark:text-white">Request Live Support</h4>
                      <p className="text-xs text-slate-500 mt-1">Talk directly to one of our support agents.</p>
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">What do you need help with?</label>
                     <textarea required value={callReason} onChange={(e) => setCallReason(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-white text-sm resize-none" rows={3} placeholder="e.g. Account issues, billing..." />
                   </div>
                   <button type="submit" className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 shadow-lg transition transform active:scale-95">Start Call Bridge</button>
                </form>
              )}
            </div>

          </div>
        )}
        <button onClick={() => setIsOpen(!isOpen)} className="group relative flex items-center justify-center w-14 h-14 bg-slate-900 dark:bg-emerald-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300">
          {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        </button>
      </div>
    </>
  );
};

export default SupportWidget;