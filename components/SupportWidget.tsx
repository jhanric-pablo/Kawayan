import React, { useState } from 'react';
import { MessageCircle, X, Send, Phone, FileText, Loader2, ArrowLeft } from 'lucide-react';
import { chatWithSupportBot } from '../services/geminiService';
import { supportService } from '../services/supportService';
import CallOverlay from './CallOverlay';

const SupportWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'chat' | 'ticket'>('chat');
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  
  // Ticket State
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketPriority, setTicketPriority] = useState('Medium');

  const [chatHistory, setChatHistory] = useState<{sender: 'user'|'bot'|'system', text: string}[]>([
    { sender: 'bot', text: 'Hi! I am the Kawayan AI Support Bot. How can I help you today?' }
  ]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

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

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create Ticket
    const userSession = JSON.parse(localStorage.getItem('kawayan_session') || '{}');
    if (userSession && userSession.id) {
      const ticket = supportService.createTicket(userSession, ticketSubject, ticketPriority);
      
      setMode('chat');
      setChatHistory(prev => [...prev, 
        { sender: 'system' as const, text: `🎫 Ticket Created: #${ticket.ticketNum} - ${ticketSubject}` },
        { sender: 'bot', text: 'I have logged your ticket. A human agent will review it shortly.' }
      ]);
      setTicketSubject('');
    } else {
      alert("Please login to submit a ticket.");
    }
  };

  return (
    <>
      {isCalling && <CallOverlay onEndCall={() => setIsCalling(false)} />}
      
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end space-y-4">
        
        {/* Chat Window */}
        {isOpen && (
          <div className="bg-white dark:bg-slate-800 w-80 h-96 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
            
            {/* Header */}
            <div className="bg-slate-900 dark:bg-emerald-600 p-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                {mode === 'ticket' && (
                  <button onClick={() => setMode('chat')} className="mr-1 hover:text-slate-300"><ArrowLeft className="w-4 h-4"/></button>
                )}
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="font-bold text-sm">{mode === 'chat' ? 'Kawayan Support' : 'Submit Ticket'}</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:text-slate-300 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            {mode === 'chat' ? (
              <>
                {/* Quick Actions */}
                <div className="flex border-b border-slate-100 dark:border-slate-700">
                   <button onClick={() => setMode('ticket')} className="flex-1 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center gap-1 border-r border-slate-100 dark:border-slate-700">
                     <FileText className="w-3 h-3"/> New Ticket
                   </button>
                   <button onClick={() => setIsCalling(true)} className="flex-1 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center gap-1">
                     <Phone className="w-3 h-3"/> Call Us
                   </button>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-900/50">
                  {chatHistory.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs ${
                        msg.sender === 'user' 
                          ? 'bg-emerald-600 text-white rounded-br-none' 
                          : msg.sender === 'system'
                          ? 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 italic text-center w-full'
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

                {/* Input Area */}
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
            ) : (
              /* Ticket Form */
              <form onSubmit={handleSubmitTicket} className="flex-1 p-4 space-y-4 bg-white dark:bg-slate-800">
                 <div>
                   <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Subject</label>
                   <input 
                     required
                     type="text" 
                     value={ticketSubject} 
                     onChange={(e) => setTicketSubject(e.target.value)}
                     className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-white text-sm"
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                   <select 
                     value={ticketPriority} 
                     onChange={(e) => setTicketPriority(e.target.value)}
                     className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-white text-sm"
                   >
                     <option>Low</option>
                     <option>Medium</option>
                     <option>High</option>
                     <option>Critical</option>
                   </select>
                 </div>
                 <button type="submit" className="w-full py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700">Submit Ticket</button>
              </form>
            )}
          </div>
        )}

        {/* Floating Button */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="group relative flex items-center justify-center w-14 h-14 bg-slate-900 dark:bg-emerald-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
        >
          {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
          
          {!isOpen && (
            <span className="absolute right-0 top-0 -mr-1 -mt-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          )}
        </button>
      </div>
    </>
  );
};

export default SupportWidget;