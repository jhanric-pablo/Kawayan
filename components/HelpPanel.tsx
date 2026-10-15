import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Phone, FileText, Loader2, ArrowLeft, Bot, Headset, Brain, ChevronDown, ChevronUp, Wrench, CreditCard } from 'lucide-react';
import clsx from 'clsx';
import { chatWithSupportBot } from '../services/aiService';
import { supportService } from '../services/supportService';
import { supportRealtime } from '../services/supportRealtime';
import CallOverlay from './CallOverlay';
import { useToast } from './ui/Toast';

const INPUT =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--bg-alt)] px-3 py-2 text-sm text-[var(--fg)] outline-none transition-colors focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]';
const LABEL = 'mb-1 block text-xs font-semibold text-[var(--fg-muted)]';

/**
 * Help and support, docked on the right: the AI assistant, support tickets (with live agent
 * replies) and live calls. Opened from the sidebar's "Ask AI / Help", ⌘K, or the phone menu.
 * It slides over the page without a backdrop, so the timeline stays usable.
 */
const HelpPanel: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const toast = useToast();
  const panelRef = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<'menu' | 'chat' | 'ticket' | 'call'>('menu');
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [callReason, setCallReason] = useState('');

  // Ticket State
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketPriority, setTicketPriority] = useState('Medium');
  const [ticketCategory, setTicketCategory] = useState<'Technical' | 'Billing' | 'General'>('General');

  const [chatHistory, setChatHistory] = useState<{sender: 'user'|'bot'|'system'|'agent', text: string, timestamp?: string}[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [sessionCallId, setSessionCallId] = useState<string>('');
  const [expandedThinking, setExpandedThinking] = useState<{[key: number]: boolean}>({});

  const parseThinking = (text: string) => {
    const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/);
    if (thinkMatch) {
      const reasoning = thinkMatch[1].trim();
      const content = text.replace(/<think>[\s\S]*?<\/think>/, '').trim();
      return { reasoning, content };
    }
    return { reasoning: null, content: text };
  };

  const toggleThinking = (idx: number) => {
    setExpandedThinking(prev => ({...prev, [idx]: !prev[idx]}));
  };

  useEffect(() => {
    // Generate a fresh random 4-digit ID for this session
    const randomId = Math.floor(1000 + Math.random() * 9000).toString();
    setSessionCallId(randomId);
    // Reset to menu when opening
    if (open) {
      setMode('menu');
      panelRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    supportRealtime.connect();
  }, [open]);

  // Escape closes the panel, unless it's meant for a dialog on top (focus is there, not here).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as Node;
      if (e.key === 'Escape' && (target === document.body || panelRef.current?.contains(target))) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Real-time ticket messages from support agent
  useEffect(() => {
    if (!activeTicketId) return;

    const unsub = supportRealtime.onTicketUpdated((ticket) => {
      if (ticket.id !== activeTicketId) return;
      setChatHistory((prev) => {
        const system = prev.filter((m) => m.sender === 'system');
        return [...system, ...(ticket.messages || [])];
      });
    });

    return unsub;
  }, [activeTicketId]);

  const handleStartCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callReason.trim()) return;

    const userSession = JSON.parse(localStorage.getItem('kawayan_session') || '{}');
    if (userSession?.id) {
      try {
        const ticket = await supportService.createTicket(
          userSession,
          `Live call: ${callReason.trim().slice(0, 80)}`,
          'High',
          `User requested live support call. Reason: ${callReason.trim()}`,
          'General'
        );
        if (ticket) {
          setActiveTicketId(ticket.id);
        }
      } catch (err) {
        console.warn('Could not create call ticket (call will still proceed):', err);
      }
    }

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
        const ticket = await supportService.createTicket(userSession, ticketSubject, ticketPriority, "Initial Request: " + ticketSubject, ticketCategory);
        if (ticket) {
          setActiveTicketId(ticket.id);
          setMode('chat');
          setChatHistory([
            { sender: 'system' as const, text: `🎫 Ticket Created: #${ticket.ticketNum}` },
            { sender: 'user', text: ticketSubject }
          ]);
          setTicketSubject('');
        } else {
           toast.error("Couldn't create the ticket. Please try again.");
        }
      } catch (error) {
        console.error("Ticket creation failed", error);
        toast.error("Couldn't create the ticket. Please try again.");
      }
    } else {
      toast.error("Please sign in to submit a ticket.");
    }
  };

  const options: { title: string; sub: string; Icon: React.ElementType; go: () => void }[] = [
    { title: 'Ask the AI assistant', sub: 'Instant answers, 24/7', Icon: Bot, go: () => setMode('chat') },
    { title: 'Call us', sub: 'Talk to a human agent live', Icon: Headset, go: () => setMode('call') },
    { title: 'Technical issue', sub: 'App, posting or sync problems', Icon: Wrench, go: () => { setTicketCategory('Technical'); setMode('ticket'); } },
    { title: 'Billing concern', sub: 'Wallet, payments or subscription', Icon: CreditCard, go: () => { setTicketCategory('Billing'); setMode('ticket'); } },
    { title: 'New ticket', sub: 'Submit a formal request', Icon: FileText, go: () => { setTicketCategory('General'); setMode('ticket'); } },
  ];

  const title =
    mode === 'menu' ? 'Help and support' : mode === 'chat' ? (activeTicketId ? `Ticket #${activeTicketId.slice(-4)}` : 'AI assistant') : mode === 'ticket' ? 'Submit a ticket' : 'Request a call';

  return (
    <>
      {isCalling && <CallOverlay onEndCall={() => setIsCalling(false)} reason={callReason} roomId={`KawayanSupport-${sessionCallId}`} />}

      <aside
        ref={panelRef}
        role="dialog"
        aria-label="Help and support"
        tabIndex={-1}
        inert={!open}
        className={clsx(
          'fixed inset-y-0 right-0 z-[85] flex w-full max-w-[400px] flex-col border-l border-[var(--border-strong)] bg-[var(--card)] text-[var(--fg)] shadow-2xl outline-none transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] px-3">
          {mode !== 'menu' && (
            <button type="button" onClick={() => setMode('menu')} aria-label="Back to help menu" className="grid h-8 w-8 place-items-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--bg-alt)] hover:text-[var(--fg)]">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className={clsx('min-w-0 flex-1', mode === 'menu' && 'pl-1.5')}>
            <p className="truncate text-sm font-bold">{title}</p>
            {isCalling && sessionCallId && <p className="text-[11px] font-bold text-[var(--primary)]">Call ID: {sessionCallId}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close help" className="grid h-8 w-8 place-items-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--bg-alt)] hover:text-[var(--fg)]">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col">
          {mode === 'menu' && (
            <div className="flex-1 space-y-2 overflow-y-auto bg-[var(--bg)] p-4">
              <p className="pb-1 text-sm text-[var(--fg-muted)]">How can we help you today?</p>
              {options.map(({ title: t, sub, Icon, go }) => (
                <button
                  key={t}
                  type="button"
                  onClick={go}
                  className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--card-hover)]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--badge-border)] bg-[var(--badge-bg)] text-[var(--badge-text)]">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{t}</span>
                    <span className="block text-xs text-[var(--fg-muted)]">{sub}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {mode === 'chat' && (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto bg-[var(--bg)] p-4">
                {!activeTicketId && chatHistory.length === 0 && (
                  <div className="mt-8 px-2 text-center">
                    <Bot className="mx-auto mb-2 h-10 w-10 text-[var(--primary)]" />
                    <p className="mb-3 text-sm text-[var(--fg-muted)]">AI answers instantly. For a human agent, submit a ticket or request a call from the menu.</p>
                    <button type="button" onClick={() => setMode('menu')} className="text-xs font-semibold text-[var(--primary)] hover:underline">
                      ← Back to the help menu
                    </button>
                  </div>
                )}
                {activeTicketId && chatHistory.length === 0 && (
                  <p className="mt-8 px-2 text-center text-sm text-[var(--fg-muted)]">Your ticket is open. Type below — a support agent will see your messages.</p>
                )}
                {chatHistory.map((msg, idx) => {
                  const { reasoning, content } = parseThinking(msg.text);
                  const isExpanded = expandedThinking[idx];

                  return (
                    <div key={idx} className={`flex flex-col gap-1 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                      {reasoning && (
                        <div className="flex max-w-[85%] flex-col items-start">
                          <button
                            type="button"
                            onClick={() => toggleThinking(idx)}
                            className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[10.5px] text-[var(--fg-muted)] hover:text-[var(--fg)]"
                          >
                            <Brain className="h-3 w-3" />
                            <span>AI thinking…</span>
                            {isExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                          </button>
                          {isExpanded && (
                            <div className="mt-1 rounded-xl border border-[var(--border)] bg-[var(--bg-alt)] p-2 text-[11px] italic leading-relaxed text-[var(--fg-muted)]">
                              {reasoning}
                            </div>
                          )}
                        </div>
                      )}
                      <div
                        className={clsx(
                          'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[13px] leading-snug',
                          msg.sender === 'user' && 'rounded-br-md bg-[var(--primary-accent)] text-[var(--primary-accent-fg)]',
                          msg.sender === 'system' && 'w-full max-w-full rounded-lg bg-[var(--bg-alt)] text-center italic text-[var(--fg-muted)]',
                          msg.sender === 'agent' && 'rounded-bl-md border-l-4 border-[var(--primary)] bg-[var(--badge-bg)] text-[var(--fg)]',
                          msg.sender === 'bot' && 'rounded-bl-md border border-[var(--border)] bg-[var(--card)]',
                        )}
                      >
                        {content}
                      </div>
                    </div>
                  );
                })}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-md border border-[var(--border)] bg-[var(--card)] p-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--fg-subtle)]" />
                    </div>
                  </div>
                )}
              </div>
              <form onSubmit={handleSend} className="flex gap-2 border-t border-[var(--border)] p-3">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={activeTicketId ? 'Message the support agent…' : 'Ask the AI assistant…'}
                  aria-label={activeTicketId ? 'Message the support agent' : 'Ask the AI assistant'}
                  autoFocus
                  disabled={isTyping}
                  className={clsx(INPUT, 'rounded-full px-4 disabled:opacity-50')}
                />
                <button type="submit" disabled={isTyping} aria-label="Send" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--primary-accent)] text-[var(--primary-accent-fg)] transition-colors hover:bg-[var(--primary-accent-hover)] disabled:opacity-50">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}

          {mode === 'ticket' && (
            <form onSubmit={handleSubmitTicket} className="flex-1 space-y-4 overflow-y-auto p-4">
              <div>
                <label className={LABEL} htmlFor="help-category">Category</label>
                <select id="help-category" value={ticketCategory} onChange={(e) => setTicketCategory(e.target.value as typeof ticketCategory)} className={INPUT}>
                  <option value="Technical">Technical</option>
                  <option value="Billing">Billing</option>
                  <option value="General">General</option>
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="help-subject">Subject</label>
                <input id="help-subject" required type="text" value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} className={INPUT} placeholder="Brief summary of the issue" />
              </div>
              <div>
                <label className={LABEL} htmlFor="help-priority">Priority</label>
                <select id="help-priority" value={ticketPriority} onChange={(e) => setTicketPriority(e.target.value)} className={INPUT}>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary w-full">Submit ticket</button>
            </form>
          )}

          {mode === 'call' && (
            <form onSubmit={handleStartCall} className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="py-4 text-center">
                <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full border border-[var(--badge-border)] bg-[var(--badge-bg)] text-[var(--badge-text)]">
                  <Phone className="h-7 w-7" />
                </div>
                <h4 className="font-bold">Request live support</h4>
                <p className="mt-1 text-sm text-[var(--fg-muted)]">Talk directly to one of our support agents.</p>
              </div>
              <div>
                <label className={LABEL} htmlFor="help-reason">What do you need help with?</label>
                <textarea id="help-reason" required value={callReason} onChange={(e) => setCallReason(e.target.value)} className={clsx(INPUT, 'resize-none')} rows={3} placeholder="e.g. Account issues, billing…" />
              </div>
              <button type="submit" className="btn btn-primary w-full">Start call</button>
            </form>
          )}
        </div>
      </aside>
    </>
  );
};

export default HelpPanel;
