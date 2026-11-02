import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Channel } from 'stream-chat';
import TextareaAutosize from 'react-textarea-autosize';
import Markdown from 'react-markdown';
import { ArrowLeft, ArrowUp, CheckCircle2, Loader2, MessagesSquare, Plus, Search, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import type { Ticket } from '../types';
import { chatWithSupportBot } from '../services/aiService';
import { supportService } from '../services/supportService';
import { supportRealtime } from '../services/supportRealtime';
import { streamSession, supportApi, ticketChannel, type StreamSession } from '../services/supportChat';
import { readCachedUser } from '../utils/authSession';
import ChatThread from './support/ChatThread';
import { useToast } from './ui/Toast';
import './support/support.css';
import { ListSkeleton, ThreadSkeleton } from './ui/skeletons';

const CATEGORIES: Ticket['category'][] = ['Technical', 'Billing', 'General'];
const PRIORITIES: Ticket['priority'][] = ['Low', 'Medium', 'High'];

const ago = (iso?: string) => {
  if (!iso) return '';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
};

const StatusBadge: React.FC<{ status: Ticket['status'] }> = ({ status }) =>
  status === 'Resolved' ? (
    <span className="badge badge-green shrink-0"><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />Resolved</span>
  ) : status === 'Pending' ? (
    <span className="badge badge-sage shrink-0"><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />Replied</span>
  ) : (
    <span className="badge badge-amber shrink-0"><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />Open</span>
  );

/**
 * Help desk page for owners (mockup "Help desk"): ticket list with search, the conversation on the
 * right (your messages tinted green, attach a screenshot), "Ask the assistant" and New ticket.
 * The same tickets and chat as the Help panel (⌘/), which keeps voice and video calls.
 */
const HelpDesk: React.FC<{ initialTicketId?: string | null }> = ({ initialTicketId }) => {
  const toast = useToast();
  const me = readCachedUser();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(initialTicketId ?? null);
  const [composing, setComposing] = useState(false);
  const [conv, setConv] = useState<{ ticketId: string; channel: Channel } | null>(null);
  const [session, setSession] = useState<StreamSession | null>(null);
  const [chatError, setChatError] = useState('');
  const [retry, setRetry] = useState(0);
  const [resolving, setResolving] = useState(false);
  // New ticket
  const [draft, setDraft] = useState('');
  const [category, setCategory] = useState<Ticket['category']>('Technical');
  const [priority, setPriority] = useState<Ticket['priority']>('Medium');
  const [starting, setStarting] = useState(false);
  // Assistant
  const [aiInput, setAiInput] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [ai, setAi] = useState<{ sender: 'user' | 'bot'; text: string }[]>([]);

  const load = useCallback(async () => {
    const list = await supportService.getAllTickets();
    setTickets(list);
    // Open the newest conversation on wide screens when nothing is picked.
    setActiveId((id) => id ?? (window.matchMedia('(min-width: 1024px)').matches ? list[0]?.id ?? null : null));
  }, []);

  useEffect(() => {
    supportRealtime.connect();
    load();
  }, [load]);

  useEffect(() => supportRealtime.onTicketUpdated((t) => {
    setTickets((list) => (list ? (list.some((x) => x.id === t.id) ? list.map((x) => (x.id === t.id ? { ...x, ...t } : x)) : [t, ...list]) : list));
  }), []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setChatError('');
    Promise.all([ticketChannel(activeId), streamSession()])
      .then(([channel, s]) => { if (!cancelled) { setConv({ ticketId: activeId, channel }); setSession(s); } })
      .catch(() => { if (!cancelled) setChatError('Could not open the conversation. Check your connection and try again.'); });
    return () => { cancelled = true; };
  }, [activeId, retry]);

  const active = tickets?.find((t) => t.id === activeId) ?? null;
  const channel = conv && conv.ticketId === activeId ? conv.channel : null;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!tickets) return [];
    if (!q) return tickets;
    return tickets.filter((t) => t.subject.toLowerCase().includes(q) || String(t.ticketNum).includes(q.replace('#', '')) || t.category.toLowerCase().includes(q));
  }, [tickets, query]);

  const open = (id: string) => {
    setComposing(false);
    setActiveId(id);
  };

  const newTicket = () => {
    setComposing(true);
    setActiveId(null);
  };

  const startTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (text.length < 3 || !me) return;
    setStarting(true);
    const ticket = await supportService.createTicket(me, text.split('\n')[0].slice(0, 80), priority, text, category);
    setStarting(false);
    if (!ticket) return toast.error('Could not send your ticket. Try again.');
    setTickets((list) => [ticket, ...(list || [])]);
    setDraft('');
    open(ticket.id);
  };

  const markResolved = async () => {
    if (!active) return;
    setResolving(true);
    await supportService.updateTicketStatus(active.id, 'Resolved');
    setTickets((list) => list?.map((t) => (t.id === active.id ? { ...t, status: 'Resolved' } : t)) ?? list);
    setResolving(false);
    toast.success('Marked as resolved');
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

  const askAi = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = aiInput.trim();
    if (!q || aiBusy) return;
    const history = [...ai, { sender: 'user' as const, text: q }];
    setAi(history);
    setAiInput('');
    setAiBusy(true);
    try {
      const answer = (await chatWithSupportBot(q, ai)).replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      setAi([...history, { sender: 'bot', text: answer || 'I don’t have an answer for that. A person from our team can help.' }]);
    } catch {
      setAi([...history, { sender: 'bot', text: 'The assistant isn’t available right now. You can open a ticket instead.' }]);
    } finally {
      setAiBusy(false);
    }
  };

  const lastAnswer = [...ai].reverse().find((x) => x.sender === 'bot');
  const askPerson = () => {
    setDraft([...ai].reverse().find((x) => x.sender === 'user')?.text ?? '');
    newTicket();
  };

  const showRight = composing || !!activeId;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="kw-page-h">
        <div>
          <h1>Help desk</h1>
          <p>Ask a question or report a problem. A person replies here and by email.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={newTicket}><Plus className="h-4 w-4" aria-hidden /> New ticket</button>
      </div>

      <div className="card overflow-hidden">
        <div className="kw-split">
          {/* ── Tickets ── */}
          <div className={clsx('kw-split__list', showRight && 'is-away')}>
            <div className="p-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--fg-muted)" aria-hidden />
                <input className="input" style={{ paddingLeft: 34 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your tickets" aria-label="Search tickets" />
              </label>
            </div>
            <div className="kw-tlist" role="list">
              {tickets === null ? (
                <ListSkeleton rows={3} />
              ) : shown.length === 0 ? (
                <p className="px-4 py-8 text-center text-ui text-(--fg-muted)">{tickets.length ? 'No tickets match.' : 'No tickets yet. Open one when you need us.'}</p>
              ) : (
                shown.map((t) => (
                  <button key={t.id} type="button" role="listitem" aria-current={t.id === activeId || undefined} onClick={() => open(t.id)}>
                    <span className="flex items-start justify-between gap-2">
                      <b className="min-w-0 truncate">{t.subject}</b>
                      <StatusBadge status={t.status} />
                    </span>
                    <span className="text-xs text-(--fg-muted)">
                      #{t.ticketNum} · {t.status === 'Pending' && t.assigneeName ? `${t.assigneeName} replied ${ago(t.updatedAt)}` : ago(t.updatedAt || t.createdAt)}
                    </span>
                  </button>
                ))
              )}
            </div>

            <form onSubmit={askAi} className="card m-3 flex flex-col gap-2 p-3.5">
              <b className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-(--green-ink)" aria-hidden /> Ask the assistant</b>
              <p className="kw-hint">Quick answers about using Kawayan. It can’t see your account.</p>
              <div className="relative">
                <input className="input" style={{ paddingRight: 40 }} value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder="How do I change my posting time?" aria-label="Ask the assistant a question" />
                <button type="submit" className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-(--fg-muted) hover:bg-(--muted) disabled:opacity-40" disabled={!aiInput.trim() || aiBusy} aria-label="Ask">
                  {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowUp className="h-4 w-4" aria-hidden />}
                </button>
              </div>
              {lastAnswer && (
                <div className="grid gap-2" aria-live="polite">
                  <div className="sp-md max-h-56 overflow-y-auto rounded-lg bg-(--muted) px-3 py-2 text-ui"><Markdown>{lastAnswer.text}</Markdown></div>
                  <button type="button" className="btn btn-ghost btn-sm self-start" onClick={askPerson}>Ask a person instead</button>
                </div>
              )}
            </form>
          </div>

          {/* ── Conversation / new ticket ── */}
          <div className={clsx('kw-split__main', !showRight && 'is-away')}>
            {composing ? (
              <form onSubmit={startTicket} className="flex flex-1 flex-col gap-4 p-5">
                <div className="flex items-center gap-2">
                  <span className="lg:hidden"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setComposing(false)} aria-label="Back to tickets"><ArrowLeft className="h-4 w-4" aria-hidden /></button></span>
                  <h3 className="text-base font-semibold">New ticket</h3>
                </div>
                <label className="kw-field">
                  <span className="kw-label">What do you need help with?</span>
                  <TextareaAutosize minRows={5} maxRows={12} maxLength={2000} value={draft} onChange={(e) => setDraft(e.target.value)} className="input" placeholder="e.g. My scheduled post didn’t go out on Facebook this morning." autoFocus />
                  <span className="kw-hint">The first line becomes the title. You can attach screenshots once it’s open.</span>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="kw-field">
                    <span className="kw-label">It’s about</span>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Topic">
                      {CATEGORIES.map((c) => <button key={c} type="button" className="kw-chip" aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}
                    </div>
                  </div>
                  <div className="kw-field">
                    <span className="kw-label">How urgent?</span>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Priority">
                      {PRIORITIES.map((p) => <button key={p} type="button" className="kw-chip" aria-pressed={priority === p} onClick={() => setPriority(p)}>{p}</button>)}
                    </div>
                  </div>
                </div>
                <div className="mt-auto flex justify-end gap-2">
                  <button type="button" className="btn btn-ghost" onClick={() => setComposing(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={draft.trim().length < 3 || starting}>
                    {starting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Send ticket
                  </button>
                </div>
              </form>
            ) : active ? (
              <>
                <div className="kw-card-h">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 lg:hidden"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setActiveId(null)} aria-label="Back to tickets"><ArrowLeft className="h-4 w-4" aria-hidden /></button></span>
                    <div className="min-w-0">
                      <h3 className="truncate">{active.subject}</h3>
                      <span className="kw-hint">#{active.ticketNum} · opened {new Date(active.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} · {active.priority}{active.assigneeName ? ` · ${active.assigneeName}` : ''}</span>
                    </div>
                  </div>
                  {active.status !== 'Resolved' ? (
                    <button type="button" className="btn btn-outline btn-sm shrink-0" onClick={markResolved} disabled={resolving}>
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Mark resolved
                    </button>
                  ) : (
                    <StatusBadge status="Resolved" />
                  )}
                </div>
                {active.status === 'Resolved' && (
                  <div className="flex flex-wrap items-center gap-2 border-b border-(--border) bg-(--muted) px-4 py-2 text-xs text-(--fg-muted)">
                    <span className="flex-1">This was resolved. Write below if you still need help, and it reopens.</span>
                    {active.rating ? (
                      <span>You rated this {active.rating} of 5</span>
                    ) : (
                      <span className="flex items-center gap-1" role="group" aria-label="Rate from 1 (not helpful) to 5 (very helpful)">
                        Helpful?
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} type="button" onClick={() => rate(active, n)} aria-label={`${n} of 5`} className="h-6 w-6 rounded-md border border-(--border) bg-(--card) font-semibold hover:border-(--green)">{n}</button>
                        ))}
                      </span>
                    )}
                  </div>
                )}
                <div className="min-h-0 flex-1">
                  {chatError ? (
                    <div className="grid h-full place-content-center justify-items-center gap-3 p-6 text-center">
                      <p className="text-sm text-(--fg-muted)">{chatError}</p>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setRetry((n) => n + 1)}>Try again</button>
                    </div>
                  ) : channel && session ? (
                    <ChatThread key={channel.cid} channel={channel} meId={session.userId} variant="owner" onSent={markReplied} placeholder="Write a reply…" />
                  ) : (
                    <ThreadSkeleton />
                  )}
                </div>
              </>
            ) : (
              <div className="m-auto grid justify-items-center gap-2 p-8 text-center">
                <MessagesSquare className="h-6 w-6 text-(--fg-muted)" aria-hidden />
                <p className="font-semibold">Pick a ticket, or open a new one</p>
                <p className="kw-hint max-w-xs">We usually reply within a few hours. You’ll get an email too.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpDesk;
