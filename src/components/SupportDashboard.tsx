import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import type { Channel } from 'stream-chat';
import { BarChart3, Check, Clock, Inbox, Loader2, MessageSquareText, Phone, PhoneCall, Search, Video, X } from 'lucide-react';
import clsx from 'clsx';
import type { CannedReply, Ticket, TicketNote } from '../types';
import { supportService } from '../services/supportService';
import { supportRealtime } from '../services/supportRealtime';
import { REPLY_TARGET_MIN, callIdFor, streamSession, supportApi, ticketChannel, type StreamSession } from '../services/supportChat';
import { getStoredToken, readCachedUser } from '../utils/authSession';
import ChatThread, { type CallInfo } from './support/ChatThread';
import { useToast } from './ui/Toast';
import './support/support.css';

const CallWindow = lazy(() => import('./support/CallWindow'));

type View = 'inbox' | 'calls' | 'reports' | 'replies';
type Scope = 'mine' | 'unassigned' | 'all';
type StatusTab = 'open' | 'waiting' | 'snoozed' | 'resolved';

const PRIORITIES: Ticket['priority'][] = ['Low', 'Medium', 'High', 'Critical'];
const SNOOZES = [{ label: '1 hour', h: 1 }, { label: '4 hours', h: 4 }, { label: 'Tomorrow', h: 24 }, { label: 'Next week', h: 168 }];

const isSnoozed = (t: Ticket) => !!t.snoozedUntil && new Date(t.snoozedUntil) > new Date() && t.status !== 'Resolved';
const statusOf = (t: Ticket): StatusTab => (t.status === 'Resolved' ? 'resolved' : isSnoozed(t) ? 'snoozed' : t.status === 'Pending' ? 'waiting' : 'open');
const DOT: Record<StatusTab, string> = { open: 'bg-(--primary)', waiting: 'bg-(--amber)', snoozed: 'bg-sky-500', resolved: 'bg-(--border-strong)' };
const owner = (t: Ticket) => t.ownerName || t.userEmail.split('@')[0];
const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const mins = (ms: number) => Math.round(ms / 60000);
const span = (m: number) => (m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`);
const ago = (iso?: string) => {
  if (!iso) return '';
  const m = mins(Date.now() - new Date(iso).getTime());
  return m < 1 ? 'now' : m < 1440 ? span(m) : new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
};

/** "Reply due in 12m" / "Overdue 5m" until the first staff reply; null after. */
const dueText = (t: Ticket) => {
  if (t.firstResponseAt || t.status === 'Resolved') return null;
  const left = mins(new Date(t.createdAt).getTime() + (REPLY_TARGET_MIN[t.priority] ?? 240) * 60000 - Date.now());
  return left >= 0 ? { text: `Reply due in ${span(left)}`, late: false } : { text: `Overdue ${span(-left)}`, late: true };
};

const authJson = async <T,>(url: string): Promise<T | null> => {
  const token = getStoredToken();
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return res.ok ? res.json() : null;
};

/**
 * The support team's workspace. Inbox: every conversation is a ticket; filter by who has it and its
 * state, reply or call from the conversation, keep private notes, insert saved replies with "/".
 * Calls: owners waiting on a call, and past calls. Reports: reply and resolve times, ratings.
 */
const SupportDashboard: React.FC = () => {
  const toast = useToast();
  const me = readCachedUser();
  const [view, setView] = useState<View>('inbox');
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [scope, setScope] = useState<Scope>('mine');
  const [statusTab, setStatusTab] = useState<StatusTab>('open');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [session, setSession] = useState<StreamSession | null>(null);
  const [chatError, setChatError] = useState('');
  const [notes, setNotes] = useState<TicketNote[]>([]);
  const [canned, setCanned] = useState<CannedReply[]>([]);
  const [biz, setBiz] = useState<{ profile: any; wallet: any; summary?: { verificationStatus?: string; channels?: { platform: string; username?: string; isActive: boolean }[] | null } | null } | null>(null);
  const [calls, setCalls] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [call, setCall] = useState<(CallInfo & { title: string }) | null>(null);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [labelDraft, setLabelDraft] = useState('');
  const [, setClock] = useState(0);

  const selected = tickets?.find((t) => t.id === selectedId) ?? null;

  const load = useCallback(async () => setTickets(await supportService.getAllTickets()), []);
  const loadCalls = useCallback(async () => {
    setCalls((await authJson<any[]>('/api/support/calls')) ?? []);
    setHistory((await authJson<any[]>('/api/support/call-history')) ?? []);
  }, []);
  const loadNotes = useCallback(async (id: string) => setNotes(await supportApi<TicketNote[]>(`/tickets/${encodeURIComponent(id)}/notes`).catch(() => [])), []);

  useEffect(() => {
    load();
    loadCalls();
    supportApi<CannedReply[]>('/canned').then(setCanned).catch(() => setCanned([]));
    supportRealtime.connect();
    const offs = [
      supportRealtime.onTicketCreated((t) => setTickets((list) => (list ? [t, ...list.filter((x) => x.id !== t.id)] : [t]))),
      supportRealtime.onTicketUpdated((t) => setTickets((list) => list?.map((x) => (x.id === t.id ? { ...x, ...t } : x)) ?? list)),
      supportRealtime.onCallsChanged(loadCalls),
    ];
    const tick = setInterval(() => setClock((c) => c + 1), 30_000); // keeps "due in" fresh
    return () => { offs.forEach((off) => off()); clearInterval(tick); };
  }, [load, loadCalls]);

  // Open the selected ticket: its chat, notes and the business behind it.
  useEffect(() => {
    if (!selected) { setChannel(null); setNotes([]); setBiz(null); return; }
    let cancelled = false;
    setChannel(null);
    setChatError('');
    Promise.all([ticketChannel(selected.id), streamSession()])
      .then(([ch, s]) => { if (!cancelled) { setChannel(ch); setSession(s); } })
      .catch(() => !cancelled && setChatError('Could not open this conversation. Check your connection, then pick it again.'));
    loadNotes(selected.id);
    Promise.all([authJson(`/api/profiles/${selected.userId}`), authJson(`/api/wallet/${selected.userId}`), Promise.resolve(authJson(`/api/staff/owners/${selected.userId}/summary`)).catch(() => null)]).then(([profile, wallet, summary]) => !cancelled && setBiz({ profile, wallet, summary }));
    setLabelDraft((selected.labels || []).join(', '));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Ticket history lines (assigned, resolved…) come back with each ticket update.
  useEffect(() => { if (selectedId) loadNotes(selectedId); }, [selected?.updatedAt, selectedId, loadNotes]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tickets ?? [])
      .filter((t) => (scope === 'mine' ? t.assigneeId === me?.id : scope === 'unassigned' ? !t.assigneeId : true))
      .filter((t) => statusOf(t) === statusTab)
      .filter((t) => !q || `${t.subject} ${owner(t)} ${t.userEmail} ${t.ticketNum} ${(t.labels || []).join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const da = dueText(a), db = dueText(b);
        if (da?.late !== db?.late) return da?.late ? -1 : 1; // overdue first
        return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
      });
  }, [tickets, scope, statusTab, query, me?.id]);

  const counts = useMemo(() => {
    const base = (tickets ?? []).filter((t) => statusOf(t) === 'open' || statusOf(t) === 'waiting');
    return { mine: base.filter((t) => t.assigneeId === me?.id).length, unassigned: base.filter((t) => !t.assigneeId).length, all: base.length };
  }, [tickets, me?.id]);

  const update = async (body: Record<string, unknown>) => {
    if (!selected) return;
    try {
      const fresh = await supportApi<Ticket>(`/tickets/${encodeURIComponent(selected.id)}`, { method: 'PATCH', body: JSON.stringify(body) });
      setTickets((list) => list?.map((t) => (t.id === fresh.id ? { ...t, ...fresh } : t)) ?? list);
      loadNotes(selected.id);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const replied = () => {
    if (!selected) return;
    supportApi<Ticket>(`/tickets/${encodeURIComponent(selected.id)}/replied`, { method: 'POST' })
      .then((fresh) => setTickets((list) => list?.map((t) => (t.id === fresh.id ? { ...t, ...fresh } : t)) ?? list))
      .catch(() => undefined);
  };

  const addNote = async (body: string) => {
    if (!selected) return;
    await supportApi(`/tickets/${encodeURIComponent(selected.id)}/notes`, { method: 'POST', body: JSON.stringify({ body }) });
    await loadNotes(selected.id);
  };

  const startCall = async (kind: CallInfo['kind']) => {
    if (!selected || !channel || call) return;
    const info: CallInfo = { id: callIdFor(selected.id), kind, status: 'started' };
    try {
      await channel.sendMessage({ text: '', call: info } as never);
      setCall({ ...info, title: `${owner(selected)} · ${selected.subject}` });
    } catch {
      toast.error('Could not start the call.');
    }
  };

  const endCall = async (durationSec: number) => {
    const ended = call;
    setCall(null);
    if (!ended) return;
    if (channel && selected && callIdFor(selected.id) === ended.id) {
      channel.sendMessage({ text: '', call: { id: ended.id, kind: ended.kind, status: 'ended', durationSec } } as never).catch(() => undefined);
    }
    const waiting = calls.find((c) => c.room_name === ended.id);
    if (waiting) await supportApi('/calls/unregister', { method: 'POST', body: JSON.stringify({ userId: waiting.user_id }) }).catch(() => undefined);
    loadCalls();
  };

  // Keyboard: E resolves or reopens, J/K move through the list (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (view !== 'inbox' || e.metaKey || e.ctrlKey || e.altKey || el.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'e' && selected) update({ status: selected.status === 'Resolved' ? 'Open' : 'Resolved' });
      if (e.key === 'j' || e.key === 'k') {
        const i = visible.findIndex((t) => t.id === selectedId);
        const next = visible[Math.min(visible.length - 1, Math.max(0, i + (e.key === 'j' ? 1 : -1)))];
        if (next) setSelectedId(next.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const waitingCall = selected ? calls.find((c) => c.user_id === selected.userId) : null;
  const due = selected ? dueText(selected) : null;
  const earlier = selected ? (tickets ?? []).filter((t) => t.userId === selected.userId && t.id !== selected.id).slice(0, 5) : [];

  return (
    <div className="sp-inbox grid h-[calc(100dvh-3.5rem)] min-h-[560px] grid-cols-[3.5rem_minmax(0,1fr)] bg-(--card) text-[13px] 2xl:grid-cols-[12rem_minmax(0,1fr)]">
      {call && session && (
        <Suspense fallback={null}>
          <CallWindow apiKey={session.apiKey} token={session.token} user={{ id: session.userId, name: session.name }} callId={call.id} kind={call.kind} title={call.title} onLeave={endCall} />
        </Suspense>
      )}

      {/* ── Navigation ── */}
      <nav className="flex flex-col gap-0.5 border-r border-(--border) bg-(--bg) p-2 2xl:p-3" aria-label="Support">
        {([
          ['inbox', 'Inbox', Inbox, counts.all],
          ['calls', 'Calls', PhoneCall, calls.length],
          ['reports', 'Reports', BarChart3, 0],
          ['replies', 'Saved replies', MessageSquareText, 0],
        ] as const).map(([id, label, Icon, n]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            aria-current={view === id ? 'page' : undefined}
            title={label}
            className={clsx('flex h-9 items-center justify-center gap-2.5 rounded-lg px-2.5 font-medium transition-colors 2xl:justify-start', view === id ? 'bg-(--card) font-semibold text-(--fg) shadow-[0_0_0_1px_var(--border)]' : 'text-(--fg-muted) hover:text-(--fg)')}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden flex-1 text-left 2xl:inline">{label}</span>
            {n > 0 && <span className="hidden text-xs tabular-nums text-(--fg-subtle) 2xl:inline">{n}</span>}
          </button>
        ))}
      </nav>

      {view === 'inbox' && (
        <div className="grid min-h-0 grid-cols-1 md:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)_17rem]">
          {/* ── List ── */}
          <section className={clsx('flex min-h-0 flex-col border-r border-(--border)', selected && 'max-md:hidden')} aria-label="Conversations">
            <div className="flex items-center gap-2 px-3.5 pb-2 pt-3.5">
              <h1 className="text-base font-semibold">Inbox</h1>
              <div className="ml-auto flex items-center gap-1.5 rounded-md border border-(--border) bg-(--bg) px-2">
                <Search className="h-3.5 w-3.5 text-(--fg-subtle)" aria-hidden />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search conversations" className="h-7 w-28 bg-transparent text-[13px] outline-none" />
              </div>
            </div>
            <div className="flex gap-3.5 border-b border-(--border) px-3.5 text-[12.5px]" role="tablist" aria-label="Whose">
              {([['mine', 'Mine'], ['unassigned', 'Unassigned'], ['all', 'All']] as const).map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={scope === id} onClick={() => setScope(id)} className={clsx('-mb-px border-b-2 pb-2 pt-1 font-semibold', scope === id ? 'border-(--fg) text-(--fg)' : 'border-transparent text-(--fg-subtle) hover:text-(--fg)')}>
                  {label} <span className="font-normal tabular-nums text-(--fg-subtle)">{counts[id]}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-0.5 overflow-x-auto px-2.5 py-2 [scrollbar-width:none]">
              {([['open', 'Open'], ['waiting', 'Waiting'], ['snoozed', 'Snoozed'], ['resolved', 'Resolved']] as const).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={statusTab === id} onClick={() => setStatusTab(id)} className={clsx('inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold', statusTab === id ? 'bg-(--bg-alt) text-(--fg)' : 'text-(--fg-subtle) hover:text-(--fg)')}>
                  <i className={clsx('h-1.5 w-1.5 rounded-full', DOT[id])} aria-hidden />{label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tickets === null ? (
                <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-(--fg-subtle)" aria-label="Loading" />
              ) : visible.length === 0 ? (
                <p className="px-4 py-8 text-center text-(--fg-subtle)">Nothing here.</p>
              ) : (
                visible.map((t) => {
                  const d = dueText(t);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className={clsx('relative grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-0.5 border-b border-(--border) px-3.5 py-3 text-left transition-colors', t.id === selectedId ? 'bg-(--bg)' : 'hover:bg-(--bg)')}
                    >
                      {t.id === selectedId && <span className="absolute inset-y-0 left-0 w-0.5 bg-(--green)" aria-hidden />}
                      <i className={clsx('h-2 w-2 rounded-full', DOT[statusOf(t)])} aria-hidden />
                      <span className="truncate font-semibold">{owner(t)}</span>
                      <span className="text-xs tabular-nums text-(--fg-subtle)">{ago(t.updatedAt || t.createdAt)}</span>
                      <span className="col-start-2 col-end-4 truncate text-(--fg-muted)">{t.subject}</span>
                      <span className="col-start-2 col-end-4 flex flex-wrap gap-x-2.5 text-xs text-(--fg-subtle)">
                        <span>#{t.ticketNum}</span>
                        {(t.priority === 'High' || t.priority === 'Critical') && <span className="text-(--fg-muted)">{t.priority}</span>}
                        {calls.some((c) => c.user_id === t.userId) && <span className="font-medium text-(--green-ink)">Waiting on a call</span>}
                        {d && <span className={clsx(d.late && 'font-semibold text-(--danger)')}>{d.text}</span>}
                        {!t.assigneeId && scope !== 'unassigned' && <span>Unassigned</span>}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* ── Conversation ── */}
          <section className={clsx('flex min-h-0 flex-col bg-(--bg)', !selected && 'max-md:hidden')} aria-label="Conversation">
            {!selected ? (
              <div className="m-auto grid justify-items-center gap-2 p-8 text-center text-(--fg-subtle)">
                <Inbox className="h-6 w-6" aria-hidden />
                <p>Pick a conversation. <kbd className="rounded border border-(--border-strong) px-1 text-xs">J</kbd> <kbd className="rounded border border-(--border-strong) px-1 text-xs">K</kbd> move through the list.</p>
              </div>
            ) : (
              <>
                <header className="flex flex-wrap items-center gap-2.5 border-b border-(--border) bg-(--card) px-4 py-2.5">
                  <button type="button" className="sp-ib md:hidden" onClick={() => setSelectedId(null)} aria-label="Back to list"><X aria-hidden /></button>
                  <span className="sp-av" aria-hidden>{initials(owner(selected))}</span>
                  <div className="min-w-[14rem] flex-1 leading-tight">
                    <p className="truncate text-[14.5px] font-semibold">{selected.subject}</p>
                    <p className="truncate text-xs text-(--fg-subtle)">{owner(selected)} · #{selected.ticketNum} · opened {ago(selected.createdAt)}{selected.status !== 'Resolved' && due ? ` · ${due.text}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {waitingCall && !call ? (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setCall({ id: waitingCall.room_name, kind: 'video', status: 'started', title: `${owner(selected)} · ${selected.subject}` })}>
                        <PhoneCall className="h-4 w-4" aria-hidden /> Join their call
                      </button>
                    ) : (
                      <>
                        <button type="button" className="sp-ib" onClick={() => startCall('voice')} disabled={!channel || !!call} aria-label="Voice call"><Phone aria-hidden /></button>
                        <button type="button" className="sp-ib" onClick={() => startCall('video')} disabled={!channel || !!call} aria-label="Video call"><Video aria-hidden /></button>
                      </>
                    )}
                    {selected.status !== 'Resolved' && (
                      <div className="relative">
                        <button type="button" className="btn btn-glass btn-sm" onClick={() => setSnoozeOpen((v) => !v)} aria-expanded={snoozeOpen}>
                          <Clock className="h-4 w-4" aria-hidden /> {isSnoozed(selected) ? 'Snoozed' : 'Snooze'}
                        </button>
                        {snoozeOpen && (
                          <div className="absolute right-0 top-[calc(100%+4px)] z-10 grid w-40 rounded-xl border border-(--border) bg-(--card) p-1 shadow-lg" role="menu">
                            {SNOOZES.map((s) => (
                              <button key={s.h} type="button" role="menuitem" className="rounded-md px-2.5 py-1.5 text-left hover:bg-(--bg-alt)" onClick={() => { setSnoozeOpen(false); update({ snoozeHours: s.h }); }}>{s.label}</button>
                            ))}
                            {isSnoozed(selected) && <button type="button" role="menuitem" className="rounded-md px-2.5 py-1.5 text-left hover:bg-(--bg-alt)" onClick={() => { setSnoozeOpen(false); update({ snoozeHours: 0 }); }}>Unsnooze</button>}
                          </div>
                        )}
                      </div>
                    )}
                    <button type="button" className={clsx('btn btn-sm', selected.status === 'Resolved' ? 'btn-outline' : 'btn-primary')} onClick={() => update({ status: selected.status === 'Resolved' ? 'Open' : 'Resolved' })} title="E">
                      {selected.status === 'Resolved' ? 'Reopen' : <><Check className="h-4 w-4" aria-hidden /> Resolve</>}
                    </button>
                  </div>
                </header>
                <div className="min-h-0 flex-1">
                  {chatError ? (
                    <p className="p-6 text-center text-(--fg-muted)">{chatError}</p>
                  ) : channel && session ? (
                    <ChatThread
                      key={selected.id}
                      channel={channel}
                      meId={session.userId}
                      variant="agent"
                      notes={notes}
                      canned={canned}
                      onSent={replied}
                      onAddNote={addNote}
                      onJoinCall={(c) => setCall({ ...c, title: `${owner(selected)} · ${selected.subject}` })}
                      activeCallId={call?.id ?? null}
                    />
                  ) : (
                    <div className="grid h-full place-items-center"><Loader2 className="h-5 w-5 animate-spin text-(--fg-subtle)" aria-label="Opening" /></div>
                  )}
                </div>
              </>
            )}
          </section>

          {/* ── Details ── */}
          {selected && (
            <aside className="hidden min-h-0 overflow-y-auto border-l border-(--border) xl:block" aria-label="Details">
              <details className="border-b border-(--border)" open>
                <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-(--fg-muted)">Ticket</summary>
                <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2 px-4 pb-4">
                  <dt className="text-(--fg-subtle)">Status</dt>
                  <dd className="flex items-center gap-1.5"><i className={clsx('h-1.5 w-1.5 rounded-full', DOT[statusOf(selected)])} aria-hidden />{{ open: 'Open', waiting: 'Waiting on owner', snoozed: 'Snoozed', resolved: 'Resolved' }[statusOf(selected)]}</dd>
                  <dt className="text-(--fg-subtle)"><label htmlFor="sd-priority">Priority</label></dt>
                  <dd>
                    <select id="sd-priority" value={selected.priority} onChange={(e) => update({ priority: e.target.value })} className="h-7 w-full rounded-md border border-(--border) bg-(--bg) px-1.5 text-[13px]">
                      {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </dd>
                  <dt className="text-(--fg-subtle)">Assignee</dt>
                  <dd className="flex items-center gap-2">
                    <span className="truncate">{selected.assigneeName || 'Nobody'}</span>
                    {selected.assigneeId === me?.id ? (
                      <button type="button" className="ml-auto text-xs font-semibold text-(--fg-subtle) hover:text-(--fg)" onClick={() => update({ assignee: 'none' })}>Unassign</button>
                    ) : (
                      <button type="button" className="ml-auto min-h-8 text-xs font-medium text-(--fg) underline underline-offset-2 hover:text-(--green-ink)" onClick={() => update({ assignee: 'me' })}>Take it</button>
                    )}
                  </dd>
                  <dt className="text-(--fg-subtle)">Category</dt><dd>{selected.category}</dd>
                  <dt className="text-(--fg-subtle)"><label htmlFor="sd-labels">Labels</label></dt>
                  <dd>
                    <input
                      id="sd-labels"
                      value={labelDraft}
                      onChange={(e) => setLabelDraft(e.target.value)}
                      onBlur={() => { const next = labelDraft.split(',').map((l) => l.trim().toLowerCase()).filter(Boolean); if (next.join(',') !== (selected.labels || []).join(',')) update({ labels: next }); }}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                      placeholder="e.g. facebook, billing"
                      className="h-7 w-full rounded-md border border-(--border) bg-(--bg) px-2 text-[13px]"
                    />
                  </dd>
                  <dt className="text-(--fg-subtle)">First reply</dt>
                  <dd>{selected.firstResponseAt ? `${span(mins(new Date(selected.firstResponseAt).getTime() - new Date(selected.createdAt).getTime()))} (target ${span(REPLY_TARGET_MIN[selected.priority] ?? 240)})` : due ? <span className={clsx(due.late && 'font-semibold text-(--danger)')}>{due.text}</span> : '—'}</dd>
                  {selected.rating ? <><dt className="text-(--fg-subtle)">Rating</dt><dd>{selected.rating} of 5</dd></> : null}
                </dl>
              </details>
              <details className="border-b border-(--border)" open>
                <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-(--fg-muted)">Business</summary>
                <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2.5 gap-y-2 px-4 pb-4">
                  <dt className="text-(--fg-subtle)">Name</dt><dd className="truncate">{biz?.profile?.businessName || owner(selected)}</dd>
                  <dt className="text-(--fg-subtle)">Industry</dt><dd className="truncate">{biz?.profile?.industry || '—'}</dd>
                  <dt className="text-(--fg-subtle)">Plan</dt><dd>{biz?.wallet?.subscription ? (biz.wallet.subscription === 'PRO' ? 'Pro' : biz.wallet.subscription === 'FREE' ? 'Free' : biz.wallet.subscription) : '—'}</dd>
                  <dt className="text-(--fg-subtle)">Wallet</dt><dd>{biz?.wallet?.balance != null ? `₱${Number(biz.wallet.balance).toLocaleString('en-PH')}` : '—'}</dd>
                  <dt className="text-(--fg-subtle)">Verification</dt>
                  <dd>{({ verified: 'Approved', approved: 'Approved', pending: 'Waiting for review', rejected: 'Sent back', none: 'Not submitted' } as Record<string, string>)[biz?.summary?.verificationStatus ?? ''] ?? '—'}</dd>
                  <dt className="text-(--fg-subtle)">Channels</dt>
                  <dd>
                    {biz?.summary?.channels == null ? '—' : biz.summary.channels.length === 0 ? 'None connected' : (
                      <span className="flex flex-wrap gap-x-2 gap-y-0.5">
                        {biz.summary.channels.map((c) => (
                          <span key={c.platform + (c.username ?? '')} className={clsx(!c.isActive && 'font-semibold text-(--danger)')}>
                            {c.platform === 'facebook' ? 'FB' : c.platform === 'instagram' ? 'IG' : c.platform} {c.isActive ? '✓' : '· expired'}
                          </span>
                        ))}
                      </span>
                    )}
                  </dd>
                  <dt className="text-(--fg-subtle)">Email</dt><dd className="truncate">{selected.userEmail}</dd>
                </dl>
              </details>
              <details open>
                <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-(--fg-muted)">Other tickets</summary>
                <div className="grid gap-1 px-2 pb-4">
                  {earlier.length === 0 ? <p className="px-2 text-(--fg-subtle)">None</p> : earlier.map((t) => (
                    <button key={t.id} type="button" onClick={() => setSelectedId(t.id)} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-(--bg)">
                      <i className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', DOT[statusOf(t)])} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{t.subject}</span>
                      <span className="text-xs text-(--fg-subtle)">{t.rating ? `${t.rating}/5` : ago(t.createdAt)}</span>
                    </button>
                  ))}
                </div>
              </details>
            </aside>
          )}
        </div>
      )}

      {view === 'calls' && <CallsView calls={calls} history={history} tickets={tickets ?? []} onJoin={(c) => setCall({ id: c.room_name, kind: 'video', status: 'started', title: `${c.user_email} · ${c.reason || 'Support call'}` })} />}
      {view === 'reports' && <ReportsView tickets={tickets ?? []} />}
      {view === 'replies' && <RepliesView replies={canned} onChange={setCanned} />}
    </div>
  );
};

/* ── Calls ── */
const CallsView: React.FC<{ calls: any[]; history: any[]; tickets: Ticket[]; onJoin: (c: any) => void }> = ({ calls, history, tickets, onJoin }) => {
  const nameOf = (userId: string, email: string) => tickets.find((t) => t.userId === userId)?.ownerName || email.split('@')[0];
  return (
    <div className="min-h-0 overflow-y-auto p-5 lg:p-7">
      <h1 className="text-lg font-semibold">Calls</h1>
      <p className="mt-0.5 text-(--fg-muted)">Owners waiting for someone to join, and past calls.</p>
      <h2 className="mt-6 text-xs font-semibold text-(--fg-muted)">Waiting now</h2>
      <div className="mt-2 grid gap-2">
        {calls.length === 0 ? <p className="rounded-lg border border-dashed border-(--border) p-4 text-(--fg-subtle)">Nobody is waiting.</p> : calls.map((c) => (
          <div key={c.user_id} className="flex items-center gap-3 rounded-xl border border-(--green) bg-(--card) p-3 shadow-[0_0_0_1px_var(--green)]">
            <span className="sp-av" aria-hidden>{initials(nameOf(c.user_id, c.user_email))}</span>
            <div className="min-w-0 flex-1"><b className="block font-semibold">{nameOf(c.user_id, c.user_email)}</b><span className="block truncate text-(--fg-muted)">{c.reason || 'Support call'} · waiting {ago(c.started_at)}</span></div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onJoin(c)}><PhoneCall className="h-4 w-4" aria-hidden /> Join</button>
          </div>
        ))}
      </div>
      <h2 className="mt-7 text-xs font-semibold text-(--fg-muted)">Past calls</h2>
      <div className="mt-2 overflow-x-auto rounded-xl border border-(--border)">
        <table className="w-full min-w-[34rem] text-left">
          <thead className="text-xs text-(--fg-subtle)"><tr><th className="px-3 py-2 font-semibold">Who</th><th className="px-3 py-2 font-semibold">About</th><th className="px-3 py-2 font-semibold">When</th><th className="px-3 py-2 text-right font-semibold">Length</th></tr></thead>
          <tbody>
            {history.length === 0 ? <tr><td colSpan={4} className="px-3 py-4 text-(--fg-subtle)">No calls yet.</td></tr> : history.slice(0, 50).map((h) => (
              <tr key={h.id} className="border-t border-(--border)">
                <td className="px-3 py-2 font-medium">{nameOf(h.user_id, h.user_email)}</td>
                <td className="max-w-[16rem] truncate px-3 py-2 text-(--fg-muted)">{h.reason || '—'}</td>
                <td className="px-3 py-2 text-(--fg-muted)">{new Date(h.started_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                <td className="px-3 py-2 text-right tabular-nums">{h.duration_seconds != null ? `${Math.floor(h.duration_seconds / 60)}:${String(h.duration_seconds % 60).padStart(2, '0')}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ── Reports ── */
const ReportsView: React.FC<{ tickets: Ticket[] }> = ({ tickets }) => {
  const r = useMemo(() => {
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    const firstReplies = tickets.filter((t) => t.firstResponseAt).map((t) => mins(new Date(t.firstResponseAt!).getTime() - new Date(t.createdAt).getTime()));
    const resolves = tickets.filter((t) => t.resolvedAt).map((t) => mins(new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()));
    const ratings = tickets.filter((t) => t.rating).map((t) => t.rating!);
    const onTime = tickets.filter((t) => t.firstResponseAt).filter((t) => mins(new Date(t.firstResponseAt!).getTime() - new Date(t.createdAt).getTime()) <= (REPLY_TARGET_MIN[t.priority] ?? 240)).length;
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (13 - i));
      return { d, n: tickets.filter((t) => new Date(t.createdAt).toDateString() === d.toDateString()).length };
    });
    const byCat = (['Technical', 'Billing', 'General'] as const).map((c) => ({ c, n: tickets.filter((t) => t.category === c).length }));
    return {
      open: tickets.filter((t) => t.status !== 'Resolved').length,
      overdue: tickets.filter((t) => dueText(t)?.late).length,
      firstReply: avg(firstReplies), resolve: avg(resolves), rating: avg(ratings), ratingN: ratings.length,
      onTime: firstReplies.length ? Math.round((onTime / firstReplies.length) * 100) : null,
      days, byCat, max: Math.max(1, ...days.map((x) => x.n)),
    };
  }, [tickets]);
  const kpis = [
    { label: 'Open now', value: String(r.open), sub: r.overdue ? `${r.overdue} overdue` : 'None overdue', bad: r.overdue > 0 },
    { label: 'First reply', value: r.firstReply == null ? '—' : span(Math.round(r.firstReply)), sub: r.onTime == null ? 'No replies yet' : `${r.onTime}% within target` },
    { label: 'Time to resolve', value: r.resolve == null ? '—' : span(Math.round(r.resolve)), sub: 'Average' },
    { label: 'Rating', value: r.rating == null ? '—' : r.rating.toFixed(1), sub: r.ratingN ? `From ${r.ratingN} rating${r.ratingN === 1 ? '' : 's'}` : 'No ratings yet' },
  ];
  return (
    <div className="min-h-0 overflow-y-auto p-5 lg:p-7">
      <h1 className="text-lg font-semibold">Reports</h1>
      <p className="mt-0.5 text-(--fg-muted)">All tickets so far. Reply targets: Critical 15m, High 1h, Medium 4h, Low 1 day.</p>
      <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-xl border border-(--border) lg:grid-cols-4">
        {kpis.map((k, i) => (
          <div key={k.label} className={clsx('p-4', i > 0 && 'border-l border-(--border)', i === 2 && 'max-lg:border-l-0 max-lg:border-t', i === 3 && 'max-lg:border-t')}>
            <p className="text-xs font-semibold text-(--fg-muted)">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{k.value}</p>
            <p className={clsx('text-xs', k.bad ? 'font-semibold text-(--danger)' : 'text-(--fg-subtle)')}>{k.sub}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-(--border) p-4">
          <p className="text-xs font-semibold text-(--fg-muted)">New tickets, last 14 days</p>
          <div className="mt-4 flex h-32 items-end gap-1.5" role="img" aria-label="New tickets per day for the last 14 days">
            {r.days.map((x) => (
              <div key={x.d.toISOString()} className="flex flex-1 flex-col items-center gap-1" title={`${x.d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}: ${x.n}`}>
                <span className="text-[10px] tabular-nums text-(--fg-subtle)">{x.n || ''}</span>
                <div className="w-full rounded-t-sm bg-(--green)" style={{ height: `${Math.max(2, (x.n / r.max) * 100)}px`, opacity: x.n ? 1 : 0.2 }} />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-(--fg-subtle)"><span>{r.days[0].d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span><span>Today</span></div>
        </div>
        <div className="rounded-xl border border-(--border) p-4">
          <p className="text-xs font-semibold text-(--fg-muted)">By topic</p>
          <div className="mt-3 grid gap-3">
            {r.byCat.map(({ c, n }) => (
              <div key={c}>
                <div className="flex justify-between text-[13px]"><span>{c}</span><span className="tabular-nums text-(--fg-muted)">{n}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-(--bg-alt)"><div className="h-full rounded-full bg-(--green)" style={{ width: `${tickets.length ? (n / tickets.length) * 100 : 0}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Saved replies ── */
const RepliesView: React.FC<{ replies: CannedReply[]; onChange: (r: CannedReply[]) => void }> = ({ replies, onChange }) => {
  const toast = useToast();
  const empty = { id: '', shortcut: '', title: '', body: '' };
  const [form, setForm] = useState<CannedReply>(empty);
  const [saving, setSaving] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      onChange(await supportApi<CannedReply[]>('/canned', { method: 'POST', body: JSON.stringify({ ...form, id: form.id || undefined }) }));
      setForm(empty);
      toast.success('Saved reply stored');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };
  const remove = async (id: string) => {
    try { onChange(await supportApi<CannedReply[]>(`/canned/${encodeURIComponent(id)}`, { method: 'DELETE' })); } catch (err: any) { toast.error(err.message); }
  };
  return (
    <div className="grid min-h-0 gap-6 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:p-7">
      <div>
        <h1 className="text-lg font-semibold">Saved replies</h1>
        <p className="mt-0.5 text-(--fg-muted)">Type <kbd className="rounded border border-(--border-strong) px-1 text-xs">/</kbd> and the shortcut in any reply to insert one.</p>
        <div className="mt-5 grid overflow-hidden rounded-xl border border-(--border)">
          {replies.length === 0 ? <p className="p-4 text-(--fg-subtle)">No saved replies yet. If the list stays empty, run the support SQL in Supabase first.</p> : replies.map((r, i) => (
            <div key={r.id} className={clsx('grid gap-1 p-4', i > 0 && 'border-t border-(--border)')}>
              <div className="flex items-center gap-2">
                <code className="mono text-xs font-medium text-(--fg)">/{r.shortcut}</code>
                <b className="font-semibold">{r.title}</b>
                <button type="button" className="ml-auto text-xs font-semibold text-(--fg-subtle) hover:text-(--fg)" onClick={() => setForm(r)}>Edit</button>
                <button type="button" className="text-xs font-semibold text-(--fg-subtle) hover:text-(--danger)" onClick={() => remove(r.id)}>Delete</button>
              </div>
              <p className="line-clamp-2 text-(--fg-muted)">{r.body}</p>
            </div>
          ))}
        </div>
      </div>
      <form onSubmit={save} className="grid h-max gap-3 rounded-xl border border-(--border) bg-(--bg) p-4">
        <b className="font-semibold">{form.id ? 'Edit saved reply' : 'New saved reply'}</b>
        <label className="grid gap-1 text-xs font-semibold text-(--fg-muted)">Shortcut
          <span className="flex items-center rounded-md border border-(--border) bg-(--card) px-2"><span className="text-(--fg-subtle)">/</span>
            <input required value={form.shortcut} onChange={(e) => setForm({ ...form, shortcut: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} maxLength={30} className="h-8 flex-1 bg-transparent px-1 text-[13px] font-normal text-(--fg) outline-none" placeholder="reconnect" />
          </span>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-(--fg-muted)">Title
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} className="h-8 rounded-md border border-(--border) bg-(--card) px-2 text-[13px] font-normal text-(--fg)" placeholder="Reconnect your Facebook Page" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-(--fg-muted)">Reply
          <textarea required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={6} maxLength={4000} className="rounded-md border border-(--border) bg-(--card) p-2 text-[13px] font-normal text-(--fg)" />
        </label>
        <div className="flex gap-2">
          {form.id && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(empty)}>Cancel</button>}
          <button type="submit" className="btn btn-primary btn-sm ml-auto" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
};

export default SupportDashboard;
