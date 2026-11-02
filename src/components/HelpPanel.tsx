import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { Channel } from 'stream-chat';
import TextareaAutosize from 'react-textarea-autosize';
import Markdown from 'react-markdown';
import { AnimatePresence, LazyMotion, MotionConfig, domMax, m } from 'motion/react';
import { ArrowLeft, ArrowUp, ChevronRight, House, Loader2, MessageSquare, MessagesSquare, Phone, Search, Sparkles, Video, X } from 'lucide-react';
import clsx from 'clsx';
import type { Ticket } from '../types';
import { chatWithSupportBot } from '../services/aiService';
import { supportService } from '../services/supportService';
import { supportRealtime } from '../services/supportRealtime';
import { callIdFor, streamSession, supportApi, ticketChannel, type StreamSession } from '../services/supportChat';
import { readCachedUser } from '../utils/authSession';
import ChatThread, { type CallInfo } from './support/ChatThread';
import { useToast } from './ui/Toast';
import './support/support.css';

const CallWindow = lazy(() => import('./support/CallWindow'));

type Screen = 'home' | 'messages' | 'assistant' | 'thread' | 'new';
type Mode = 'chat' | CallInfo['kind'];
const PUSHED: Screen[] = ['thread', 'new'];
const TABS = [['home', 'Home', House], ['messages', 'Messages', MessagesSquare], ['assistant', 'Assistant', Sparkles]] as const;
const CATEGORIES: Ticket['category'][] = ['Technical', 'Billing', 'General'];
const STATUS_DOT: Record<Ticket['status'], string> = { Open: 'bg-(--primary)', Pending: 'bg-amber-500', Resolved: 'bg-(--border-strong)' };
const STATUS_TEXT: Record<Ticket['status'], string> = { Open: 'Waiting for support', Pending: 'Support replied', Resolved: 'Resolved' };
const SUGGESTED = ['Why didn’t my scheduled post go out?', 'How do I connect my Facebook Page?', 'What does Pro include?', 'How do I top up my wallet?'];
const NEW_TITLE: Record<Mode, string> = { chat: 'New message', voice: 'Voice call', video: 'Video call' };
const initials = (name?: string | null) => (name || 'K').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const ago = (iso?: string) => {
  if (!iso) return '';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (min < 1440) return `${Math.round(min / 60)} h ago`;
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
};

/**
 * Help and support for business owners, docked on the right (sidebar "Ask AI / Help", ⌘K, or the
 * phone menu). Home offers every way to reach us (message, voice call, video call, the assistant);
 * Messages lists past conversations; a conversation opens on top with calls inside it. A call docks
 * at the top of the panel so the chat stays usable, and floats in the corner if the panel closes.
 */
const HelpPanel: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const toast = useToast();
  const panelRef = useRef<HTMLElement>(null);
  const me = readCachedUser();
  const [screen, setScreen] = useState<Screen>('home');
  const [tab, setTab] = useState<Screen>('home'); // the tab a pushed screen goes back to
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [conv, setConv] = useState<{ ticketId: string; channel: Channel } | null>(null);
  const [session, setSession] = useState<StreamSession | null>(null);
  const [chatError, setChatError] = useState('');
  const [mode, setMode] = useState<Mode>('chat');
  const [draft, setDraft] = useState('');
  const [category, setCategory] = useState<Ticket['category']>('Technical');
  const [starting, setStarting] = useState(false);
  const [call, setCall] = useState<CallInfo | null>(null);
  const [pendingCall, setPendingCall] = useState<CallInfo['kind'] | null>(null);
  const [ai, setAi] = useState<{ sender: 'user' | 'bot'; text: string }[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  const active = tickets?.find((t) => t.id === activeId) ?? null;
  const channel = conv && conv.ticketId === activeId ? conv.channel : null; // never another ticket's chat
  const ongoing = tickets?.find((t) => t.status !== 'Resolved') ?? null;
  const openCount = tickets?.filter((t) => t.status !== 'Resolved').length ?? 0;
  const pushed = PUSHED.includes(screen);

  const go = (next: Screen) => {
    if (!PUSHED.includes(next)) setTab(next);
    setScreen(next);
  };

  const loadTickets = useCallback(async () => {
    const list = await supportService.getAllTickets();
    setTickets(list);
    return list;
  }, []);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    supportRealtime.connect();
    loadTickets();
  }, [open, loadTickets]);

  // Status changes from support (assigned, replied, resolved) arrive live.
  useEffect(() => supportRealtime.onTicketUpdated((t) => {
    setTickets((list) => (list ? (list.some((x) => x.id === t.id) ? list.map((x) => (x.id === t.id ? { ...x, ...t } : x)) : [t, ...list]) : list));
  }), []);

  // Open the active conversation's chat channel.
  useEffect(() => {
    if (!open || !activeId) return;
    let cancelled = false;
    setChatError('');
    Promise.all([ticketChannel(activeId), streamSession()])
      .then(([channel, s]) => { if (!cancelled) { setConv({ ticketId: activeId, channel }); setSession(s); } })
      .catch(() => { if (!cancelled) setChatError('Could not open the conversation. Check your connection and try again.'); });
    return () => { cancelled = true; };
  }, [open, activeId]);

  const openThread = (id: string) => {
    setActiveId(id);
    go('thread');
  };

  const startCall = useCallback(async (kind: CallInfo['kind']) => {
    if (!channel || !active || call) return;
    const info: CallInfo = { id: callIdFor(active.id), kind, status: 'started' };
    try {
      await channel.sendMessage({ text: '', call: info } as never);
      supportApi('/calls/register', { method: 'POST', body: JSON.stringify({ roomName: info.id, reason: active.subject }) }).catch(() => undefined);
      setCall(info);
    } catch {
      toast.error('Could not start the call. Try again.');
    }
  }, [channel, active, call, toast]);

  // A call asked for before its conversation finished opening starts once it has.
  useEffect(() => {
    if (pendingCall && channel && active) {
      setPendingCall(null);
      startCall(pendingCall);
    }
  }, [pendingCall, channel, active, startCall]);

  const endCall = async (durationSec: number) => {
    const ended = call;
    setCall(null);
    if (!ended) return;
    channel?.sendMessage({ text: '', call: { ...ended, status: 'ended', durationSec } } as never).catch(() => undefined);
    supportApi('/calls/unregister', { method: 'POST', body: JSON.stringify({ agentId: null }) }).catch(() => undefined);
  };

  /** From Home: calls join the open conversation if there is one, otherwise ask what it's about first. */
  const contact = (next: Mode) => {
    if (next !== 'chat' && ongoing) {
      openThread(ongoing.id);
      setPendingCall(next);
      return;
    }
    setMode(next);
    setDraft('');
    go('new');
  };

  const startConversation = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = draft.trim();
    if (text.length < 3 || !me) return;
    setStarting(true);
    const ticket = await supportService.createTicket(me, text.split('\n')[0].slice(0, 80), 'Medium', text, category);
    setStarting(false);
    if (!ticket) return toast.error('Could not start the conversation. Try again.');
    setTickets((list) => [ticket, ...(list || [])]);
    setDraft('');
    openThread(ticket.id);
    if (mode !== 'chat') setPendingCall(mode);
  };

  const markReplied = () => {
    if (activeId) supportApi(`/tickets/${encodeURIComponent(activeId)}/replied`, { method: 'POST' }).catch(() => undefined);
  };

  const rate = async (ticket: Ticket, rating: number) => {
    try {
      const fresh = await supportApi<Ticket>(`/tickets/${encodeURIComponent(ticket.id)}/rating`, { method: 'POST', body: JSON.stringify({ rating }) });
      setTickets((list) => list?.map((t) => (t.id === fresh.id ? fresh : t)) ?? list);
      toast.success('Thanks for the rating');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const askAi = async (question?: string) => {
    const q = (question ?? aiInput).trim();
    if (!q || aiBusy) return;
    go('assistant');
    const history = [...ai, { sender: 'user' as const, text: q }];
    setAi(history);
    setAiInput('');
    setAiBusy(true);
    try {
      const answer = (await chatWithSupportBot(q, ai)).replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      setAi([...history, { sender: 'bot', text: answer || 'I don’t have an answer for that. A person from our team can help.' }]);
    } catch {
      setAi([...history, { sender: 'bot', text: 'The assistant isn’t available right now. You can talk to a person instead.' }]);
    } finally {
      setAiBusy(false);
    }
  };

  const talkToPerson = () => {
    setMode('chat');
    setDraft([...ai].reverse().find((x) => x.sender === 'user')?.text ?? '');
    go('new');
  };

  // Escape steps back from a conversation, then closes the panel (not during a call).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as Node;
      if (e.key !== 'Escape' || call || !(target === document.body || panelRef.current?.contains(target))) return;
      if (pushed) setScreen(tab);
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, call, pushed, tab]);

  const header = {
    home: { title: 'Kawayan support', sub: 'Usually replies within a few hours' },
    messages: { title: 'Messages', sub: openCount ? `${openCount} open` : 'All conversations' },
    assistant: { title: 'Assistant', sub: 'Instant answers, any time' },
    new: { title: NEW_TITLE[mode], sub: mode === 'chat' ? 'A person from our team replies here' : 'Tell us what it’s about, then we’ll connect you' },
    thread: { title: active?.assigneeName ? `${active.assigneeName} · Kawayan` : 'Kawayan support', sub: active ? `#${active.ticketNum} · ${active.subject}` : '' },
  }[screen];

  return (
    <LazyMotion features={domMax}>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}>
        {call && session && (
          <Suspense fallback={null}>
            <CallWindow
              apiKey={session.apiKey}
              token={session.token}
              user={{ id: session.userId, name: session.name }}
              callId={call.id}
              kind={call.kind}
              title={active?.subject || 'Kawayan support'}
              docked={open}
              onLeave={endCall}
            />
          </Suspense>
        )}

        <aside
          ref={panelRef}
          role="dialog"
          aria-label="Help and support"
          tabIndex={-1}
          inert={!open}
          className={clsx(
            'fixed inset-y-0 right-0 z-85 flex w-full max-w-[400px] flex-col border-l border-(--border-strong) bg-(--card) text-(--fg) outline-hidden transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
            open ? 'translate-x-0 shadow-2xl' : 'translate-x-full',
          )}
        >
          {call && open && <div className="cw-dock-space shrink-0" aria-hidden />}

          <header className="flex shrink-0 items-center gap-2.5 border-b border-(--border) px-3 py-3">
            {pushed ? (
              <button type="button" className="sp-ib" onClick={() => setScreen(tab)} aria-label="Back"><ArrowLeft aria-hidden /></button>
            ) : (
              <span className="sp-av agent ml-1" aria-hidden>K</span>
            )}
            {screen === 'thread' && active?.assigneeName && <span className="sp-av agent" aria-hidden>{initials(active.assigneeName)}</span>}
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold">{header.title}</p>
              <p className="truncate text-xs text-(--fg-subtle)">{header.sub}</p>
            </div>
            {screen === 'thread' && active && active.status !== 'Resolved' && (
              <>
                <button type="button" className="sp-ib" onClick={() => startCall('voice')} disabled={!channel || !!call} aria-label="Start a voice call" title="Voice call"><Phone aria-hidden /></button>
                <button type="button" className="sp-ib" onClick={() => startCall('video')} disabled={!channel || !!call} aria-label="Start a video call" title="Video call"><Video aria-hidden /></button>
              </>
            )}
            <button type="button" className="sp-ib" onClick={onClose} aria-label="Close help"><X aria-hidden /></button>
          </header>

          <div className="relative min-h-0 flex-1 overflow-hidden bg-(--bg)">
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={screen}
                className="absolute inset-0 flex flex-col"
                initial={{ opacity: 0, x: PUSHED.includes(screen) ? 28 : 0 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: PUSHED.includes(screen) ? 28 : 0, transition: { duration: 0.14 } }}
              >
                {/* ── Home ── */}
                {screen === 'home' && (
                  <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 *:shrink-0">
                    <div className="px-1 pt-1">
                      <p className="text-xl font-bold tracking-tight">Hi{me?.businessName ? `, ${me.businessName}` : ''}</p>
                      <p className="text-[15px] text-(--fg-muted)">How can we help today?</p>
                    </div>

                    {ongoing && (
                      <button type="button" onClick={() => openThread(ongoing.id)} className="sp-card group flex items-center gap-3 p-3.5 text-left">
                        <span className="sp-av agent" aria-hidden>{initials(ongoing.assigneeName)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-(--fg-subtle)">Your conversation</span>
                          <span className="block truncate text-sm font-semibold">{ongoing.subject}</span>
                          <span className="flex items-center gap-1.5 text-xs text-(--fg-muted)">
                            <i className={clsx('h-1.5 w-1.5 rounded-full', STATUS_DOT[ongoing.status])} aria-hidden />
                            {STATUS_TEXT[ongoing.status]} · {ago(ongoing.updatedAt || ongoing.createdAt)}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-(--fg-subtle) transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </button>
                    )}

                    <section className="sp-card overflow-hidden" aria-labelledby="hp-talk">
                      <h2 id="hp-talk" className="px-4 pb-1 pt-3.5 text-xs font-semibold text-(--fg-subtle)">Talk to us</h2>
                      {([
                        ['chat', MessageSquare, ongoing ? 'Send a new message' : 'Send a message', 'We reply here, usually within a few hours'],
                        ['voice', Phone, 'Voice call', ongoing ? 'Calls the team about your conversation' : 'Talk to someone from our team'],
                        ['video', Video, 'Video call', 'Talk face to face and share your screen'],
                      ] as const).map(([id, Icon, label, hint]) => (
                        <button key={id} type="button" onClick={() => contact(id)} className="sp-row group">
                          <span className="sp-row__ic"><Icon aria-hidden /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">{label}</span>
                            <span className="block truncate text-xs text-(--fg-muted)">{hint}</span>
                          </span>
                          <ChevronRight className="h-4 w-4 text-(--fg-subtle) transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </button>
                      ))}
                    </section>

                    <section className="grid gap-2" aria-labelledby="hp-ask">
                      <h2 id="hp-ask" className="px-1 text-xs font-semibold text-(--fg-subtle)">Quick answers</h2>
                      <form onSubmit={(e) => { e.preventDefault(); askAi(); }} className="sp-search">
                        <Search aria-hidden />
                        <input value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder="Ask a question" aria-label="Ask the assistant a question" />
                        {aiInput.trim() && <button type="submit" className="sp-send"><ArrowUp aria-hidden /></button>}
                      </form>
                      <div className="sp-card overflow-hidden">
                        {SUGGESTED.map((q) => (
                          <button key={q} type="button" onClick={() => askAi(q)} className="sp-row group py-2.5">
                            <span className="min-w-0 flex-1 text-sm">{q}</span>
                            <ChevronRight className="h-4 w-4 text-(--fg-subtle)" aria-hidden />
                          </button>
                        ))}
                      </div>
                    </section>
                  </div>
                )}

                {/* ── Messages ── */}
                {screen === 'messages' && (
                  <div className="flex flex-1 flex-col">
                    <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4 *:shrink-0">
                      {tickets === null ? (
                        <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-(--fg-subtle)" aria-label="Loading" />
                      ) : tickets.length === 0 ? (
                        <div className="m-auto grid justify-items-center gap-1.5 text-center">
                          <MessagesSquare className="h-6 w-6 text-(--fg-subtle)" aria-hidden />
                          <p className="text-sm font-semibold">No conversations yet</p>
                          <p className="text-xs text-(--fg-muted)">Messages with our team show up here.</p>
                        </div>
                      ) : (
                        tickets.map((t) => (
                          <div key={t.id} className="sp-card overflow-hidden">
                            <button type="button" onClick={() => openThread(t.id)} className="sp-row group">
                              <span className="sp-av agent" aria-hidden>{initials(t.assigneeName)}</span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-baseline gap-2">
                                  <b className="min-w-0 flex-1 truncate text-sm font-semibold">{t.subject}</b>
                                  <span className="shrink-0 text-[11px] text-(--fg-subtle)">{ago(t.updatedAt || t.createdAt)}</span>
                                </span>
                                <span className="flex items-center gap-1.5 text-xs text-(--fg-muted)">
                                  <i className={clsx('h-1.5 w-1.5 rounded-full', STATUS_DOT[t.status])} aria-hidden />
                                  {STATUS_TEXT[t.status]} · #{t.ticketNum}
                                </span>
                              </span>
                            </button>
                            {t.status === 'Resolved' && !t.rating && (
                              <div className="flex items-center gap-2 border-t border-(--border) px-3.5 py-2.5">
                                <span className="flex-1 text-xs font-semibold">Was this helpful?</span>
                                <div className="flex gap-1" role="group" aria-label="Rate from 1 (not helpful) to 5 (very helpful)">
                                  {[1, 2, 3, 4, 5].map((n) => (
                                    <button key={n} type="button" onClick={() => rate(t, n)} aria-label={`${n} of 5`} className="h-7 w-7 rounded-md border border-(--border-strong) bg-(--bg) text-xs font-semibold text-(--fg-muted) transition-colors hover:border-(--primary) hover:text-(--primary)">{n}</button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {t.rating ? <p className="border-t border-(--border) px-3.5 py-2 text-xs text-(--fg-subtle)">You rated this {t.rating} of 5</p> : null}
                          </div>
                        ))
                      )}
                    </div>
                    <div className="shrink-0 border-t border-(--border) bg-(--card) p-3">
                      <button type="button" className="btn btn-primary w-full" onClick={() => contact('chat')}><MessageSquare className="h-4 w-4" aria-hidden /> Send us a message</button>
                    </div>
                  </div>
                )}

                {/* ── Assistant ── */}
                {screen === 'assistant' && (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4" role="log" aria-live="polite">
                      {ai.length === 0 ? (
                        <div className="grid gap-2">
                          <p className="text-sm text-(--fg-muted)">Ask anything about Kawayan. If the assistant can’t help, a person can.</p>
                          {SUGGESTED.map((q) => (
                            <button key={q} type="button" onClick={() => askAi(q)} className="sp-card px-3 py-2 text-left text-sm">{q}</button>
                          ))}
                        </div>
                      ) : (
                        ai.map((x, i) => (
                          <div key={i} className={clsx('sp-grp', x.sender === 'user' && 'is-right')}>
                            {x.sender === 'bot' && <span className="sp-sender"><span className="sp-av sm" aria-hidden><Sparkles className="h-3 w-3" /></span>Assistant</span>}
                            {x.sender === 'bot' ? <div className="sp-bub sp-md"><Markdown>{x.text}</Markdown></div> : <div className="sp-bub">{x.text}</div>}
                          </div>
                        ))
                      )}
                      {aiBusy && <div className="sp-typing" aria-label="The assistant is writing"><i /><i /><i /></div>}
                      {ai.length > 0 && !aiBusy && (
                        <button type="button" onClick={talkToPerson} className="sp-card flex items-center gap-2.5 self-start px-3 py-2 text-sm font-semibold">
                          <MessageSquare className="h-4 w-4 text-(--primary)" aria-hidden /> Talk to a person instead
                        </button>
                      )}
                    </div>
                    <div className="sp-composer">
                      <div className="sp-box">
                        <TextareaAutosize
                          minRows={1}
                          maxRows={6}
                          value={aiInput}
                          onChange={(e) => setAiInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askAi(); } }}
                          placeholder="Ask a question…"
                          aria-label="Ask the assistant"
                          className="sp-input"
                        />
                        <div className="sp-box__row">
                          <span className="sp-hint">Answers are automatic and can be wrong.</span>
                          <button type="button" className="sp-send" onClick={() => askAi()} disabled={!aiInput.trim() || aiBusy}><ArrowUp aria-hidden /> Ask</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── New conversation (message or call) ── */}
                {screen === 'new' && (
                  <form onSubmit={startConversation} className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
                    <div className="kw-seg w-full" role="group" aria-label="How to reach us">
                      {(['chat', 'voice', 'video'] as const).map((x) => {
                        const Icon = x === 'chat' ? MessageSquare : x === 'voice' ? Phone : Video;
                        return (
                          <button key={x} type="button" aria-pressed={mode === x} onClick={() => setMode(x)} className={clsx('flex flex-1 items-center justify-center gap-1.5', mode === x && 'bg-(--card) shadow-[0_0_0_1px_var(--border)]')}>
                            <Icon className="h-3.5 w-3.5" aria-hidden />{x === 'chat' ? 'Message' : x === 'voice' ? 'Voice' : 'Video'}
                          </button>
                        );
                      })}
                    </div>
                    <label className="grid gap-1.5">
                      <span className="text-sm font-semibold">What do you need help with?</span>
                      <span className="sp-box">
                        <TextareaAutosize
                          minRows={4}
                          maxRows={10}
                          maxLength={2000}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="e.g. My scheduled post didn’t go out on Facebook this morning."
                          className="sp-input"
                          autoFocus
                        />
                      </span>
                    </label>
                    <div className="grid gap-1.5">
                      <span className="text-sm font-semibold">It’s about</span>
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Topic">
                        {CATEGORIES.map((c) => (
                          <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={clsx('rounded-full border px-3 py-1 text-sm font-medium transition-colors', category === c ? 'border-(--primary) bg-(--kw-green-pale) text-(--primary)' : 'border-(--border-strong) text-(--fg-muted) hover:text-(--fg)')}>{c}</button>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-(--fg-subtle)">
                      {mode === 'chat' ? 'We’ll reply in this chat. You can call us from it any time.' : 'We open a chat for this, then call. If nobody picks up, leave a message there and we’ll reply.'}
                    </p>
                    <button type="submit" className="btn btn-primary mt-auto w-full" disabled={draft.trim().length < 3 || starting}>
                      {starting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : mode === 'chat' ? <ArrowUp className="h-4 w-4" aria-hidden /> : mode === 'voice' ? <Phone className="h-4 w-4" aria-hidden /> : <Video className="h-4 w-4" aria-hidden />}
                      {mode === 'chat' ? 'Send message' : mode === 'voice' ? 'Start voice call' : 'Start video call'}
                    </button>
                  </form>
                )}

                {/* ── Conversation ── */}
                {screen === 'thread' && (
                  chatError ? (
                    <div className="grid flex-1 place-content-center justify-items-center gap-3 p-6 text-center">
                      <p className="text-sm text-(--fg-muted)">{chatError}</p>
                      <button type="button" className="btn btn-glass btn-sm" onClick={() => { const id = activeId; setActiveId(null); setTimeout(() => setActiveId(id), 0); }}>Try again</button>
                    </div>
                  ) : channel && active && session ? (
                    <>
                      {active.status === 'Resolved' && (
                        <p className="shrink-0 border-b border-(--border) bg-(--bg-alt) px-4 py-2 text-xs text-(--fg-muted)">This was resolved. Write below if you still need help, and it reopens.</p>
                      )}
                      {pendingCall && <p className="shrink-0 border-b border-(--border) bg-(--card) px-4 py-2 text-xs text-(--fg-muted)">Starting your {pendingCall} call…</p>}
                      <div className="min-h-0 flex-1">
                        <ChatThread
                          key={channel.cid}
                          channel={channel}
                          meId={session.userId}
                          variant="owner"
                          onSent={markReplied}
                          onJoinCall={(c) => !call && setCall({ ...c, status: 'started' })}
                          activeCallId={call?.id ?? null}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="grid flex-1 place-content-center justify-items-center gap-2 text-sm text-(--fg-muted)">
                      <Loader2 className="h-5 w-5 animate-spin text-(--fg-subtle)" aria-hidden />
                      Opening your conversation…
                    </div>
                  )
                )}
              </m.div>
            </AnimatePresence>
          </div>

          {!pushed && (
            <nav className="grid shrink-0 grid-cols-3 border-t border-(--border) bg-(--card)" aria-label="Help sections">
              {TABS.map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => go(id)}
                  aria-current={screen === id ? 'page' : undefined}
                  className={clsx('relative grid justify-items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors', screen === id ? 'text-(--primary)' : 'text-(--fg-subtle) hover:text-(--fg)')}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  {label}
                  {id === 'messages' && openCount > 0 && <span className="absolute left-[calc(50%+6px)] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-(--primary-accent) px-1 text-[10px] text-(--primary-accent-fg) tabular-nums">{openCount}</span>}
                </button>
              ))}
            </nav>
          )}
        </aside>
      </MotionConfig>
    </LazyMotion>
  );
};

export default HelpPanel;
