import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Channel, MessageResponse, LocalMessage } from 'stream-chat';
import TextareaAutosize from 'react-textarea-autosize';
import { ArrowUp, FileText, Loader2, Paperclip, Phone, Video } from 'lucide-react';
import clsx from 'clsx';
import type { CannedReply, TicketNote } from '../../types';
import { useToast } from '../ui/Toast';
import './support.css';

/** A call, as it appears in the conversation (sent as a message with a `call` field). */
export interface CallInfo {
  id: string;
  kind: 'video' | 'voice';
  status: 'started' | 'ended';
  durationSec?: number;
}

type Msg = (MessageResponse | LocalMessage) & { sent_at?: string; call?: CallInfo };

interface Props {
  channel: Channel;
  meId: string;
  variant: 'owner' | 'agent';
  /** Agent: notes and history lines, shown in the timeline between messages. */
  notes?: TicketNote[];
  /** Agent: saved replies, inserted by typing "/". */
  canned?: CannedReply[];
  placeholder?: string;
  onSent?: () => void;
  onAddNote?: (body: string) => Promise<void>;
  onJoinCall?: (call: CallInfo) => void;
  /** The call this person is in right now, if any (its card says "You're in this call"). */
  activeCallId?: string | null;
}

const GROUP_MS = 5 * 60_000;
const timeOf = (m: Msg) => new Date((m.sent_at as string) || (m.created_at as unknown as string) || Date.now());
const isStaff = (m: Msg) => {
  const u = m.user as { kawayan_role?: string; role?: string } | undefined;
  return u?.kawayan_role ? ['support', 'admin'].includes(u.kawayan_role) : u?.role === 'admin';
};
const initials = (name?: string) => (name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const clock = (d: Date) => d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
const dayLabel = (d: Date) => {
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
};
const duration = (sec = 0) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const kb = (n?: number) => (n ? (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`) : '');

type Item =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'group'; key: string; right: boolean; name: string; msgs: Msg[] }
  | { kind: 'call'; key: string; msg: Msg; ended?: Msg }
  | { kind: 'note'; key: string; note: TicketNote };

/**
 * One support conversation on a Stream channel. Owner and agent see the same thread from their
 * own side (their messages on the right). Agents also see private notes and the ticket's history
 * inline, and can switch the composer to "Note" or insert a saved reply with "/".
 */
const ChatThread: React.FC<Props> = ({ channel, meId, variant, notes = [], canned = [], placeholder, onSent, onAddNote, onJoinCall, activeCallId }) => {
  const toast = useToast();
  const [, setTick] = useState(0);
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nearBottom = useRef(true);
  const agent = variant === 'agent';

  // Re-render on anything that changes the conversation, and mark it read while it's on screen.
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const sub = channel.on((e) => {
      if (['message.new', 'message.updated', 'message.deleted', 'typing.start', 'typing.stop', 'message.read'].includes(e.type)) bump();
      if (e.type === 'message.new' && document.visibilityState === 'visible') channel.markRead().catch(() => undefined);
    });
    channel.markRead().catch(() => undefined);
    return () => sub.unsubscribe();
  }, [channel]);

  const messages = channel.state.messages as unknown as Msg[];

  // Messages, call cards, notes and day headers in time order.
  const items = useMemo<Item[]>(() => {
    const endedBy = new Map<string, Msg>();
    messages.forEach((m) => { if (m.call?.status === 'ended') endedBy.set(m.call.id + ':' + m.call.kind, m); });
    type Row = { at: Date; msg?: Msg; note?: TicketNote };
    const rows: Row[] = [
      ...messages.filter((m) => !(m.call?.status === 'ended')).map((m) => ({ at: timeOf(m), msg: m })),
      ...(agent ? notes.map((n) => ({ at: new Date(n.createdAt), note: n })) : []),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());
    const out: Item[] = [];
    let lastDay = '';
    for (const r of rows) {
      const day = r.at.toDateString();
      if (day !== lastDay) { out.push({ kind: 'day', key: `d-${day}`, label: dayLabel(r.at) }); lastDay = day; }
      if (r.note) { out.push({ kind: 'note', key: `n-${r.note.id}`, note: r.note }); continue; }
      const m = r.msg!;
      if (m.call) { out.push({ kind: 'call', key: `c-${m.id}`, msg: m, ended: [...endedBy.entries()].find(([k, e]) => k.startsWith(m.call!.id + ':') && timeOf(e) >= r.at)?.[1] }); continue; }
      const right = agent ? isStaff(m) : m.user?.id === meId;
      const prev = out[out.length - 1];
      if (prev?.kind === 'group' && prev.msgs[0].user?.id === m.user?.id && r.at.getTime() - timeOf(prev.msgs[prev.msgs.length - 1]).getTime() < GROUP_MS) {
        prev.msgs.push(m);
      } else {
        out.push({ kind: 'group', key: `g-${m.id}`, right, name: m.user?.id === meId ? 'You' : m.user?.name || 'Kawayan', msgs: [m] });
      }
    }
    return out;
  }, [messages, messages.length, notes, agent, meId]);

  // Stay pinned to the newest message unless the reader scrolled up.
  useEffect(() => {
    const el = listRef.current;
    if (el && nearBottom.current) el.scrollTop = el.scrollHeight;
  });

  // "Seen" under my last message once anyone else has read past it.
  const lastMine = [...messages].reverse().find((m) => m.user?.id === meId && !m.call);
  type ReadState = { user?: { id: string }; last_read: string | Date };
  type TypingState = { user?: { id: string; name?: string } };
  const seen = lastMine && (Object.values(channel.state.read || {}) as ReadState[]).some((r) => r.user?.id !== meId && new Date(r.last_read) >= timeOf(lastMine));
  const typing = (Object.values(channel.state.typing || {}) as TypingState[]).filter((t) => t.user?.id !== meId);

  const slashMatches = agent && mode === 'reply' && /^\/[a-z0-9-]*$/i.test(text)
    ? canned.filter((c) => c.shortcut.startsWith(text.slice(1).toLowerCase())).slice(0, 6)
    : [];
  const pickCanned = (c: CannedReply) => { setText(c.body); setSlashIndex(0); };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      if (mode === 'note') {
        await onAddNote?.(body);
      } else {
        await channel.sendMessage({ text: body });
        onSent?.();
      }
      setText('');
      nearBottom.current = true;
    } catch (e: any) {
      toast.error(e?.message || 'Could not send. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  const upload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) return toast.error('Files can be up to 20 MB.');
    setUploading(true);
    try {
      const image = file.type.startsWith('image/');
      const res = image ? await channel.sendImage(file) : await channel.sendFile(file);
      await channel.sendMessage({
        text: '',
        attachments: [image
          ? { type: 'image', image_url: res.file, fallback: file.name, title: file.name, file_size: file.size }
          : { type: 'file', asset_url: res.file, title: file.name, mime_type: file.type, file_size: file.size }],
      });
      nearBottom.current = true;
      onSent?.();
    } catch {
      toast.error('Could not upload that file. Try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="sp-thread">
      <div
        ref={listRef}
        className="sp-list"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        onScroll={(e) => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}
      >
        {items.length === 0 && <p className="sp-empty">No messages yet.</p>}
        {items.map((it) => {
          if (it.kind === 'day') return <p key={it.key} className="sp-day">{it.label}</p>;
          if (it.kind === 'note') {
            return it.note.kind === 'activity' ? (
              <p key={it.key} className="sp-activity"><span className="sp-av sm">{initials(it.note.authorName)}</span><b>{it.note.authorName}</b> {it.note.body} · {clock(new Date(it.note.createdAt))}</p>
            ) : (
              <div key={it.key} className="sp-note"><small>Note · only staff see this</small>{it.note.body}<span>{it.note.authorName} · {clock(new Date(it.note.createdAt))}</span></div>
            );
          }
          if (it.kind === 'call') {
            const c = it.msg.call!;
            const live = !it.ended;
            const Icon = c.kind === 'voice' ? Phone : Video;
            return (
              <div key={it.key} className={clsx('sp-event', live && 'is-live')}>
                <span className="sp-event__ic"><Icon aria-hidden /></span>
                <div>
                  <b>{live && <i className="sp-pulse" aria-hidden />}{c.kind === 'voice' ? 'Voice call' : 'Video call'}{live ? ' in progress' : ''}</b>
                  <small>{live ? `Started by ${it.msg.user?.id === meId ? 'you' : it.msg.user?.name} · ${clock(timeOf(it.msg))}` : `Ended · ${duration(it.ended?.call?.durationSec)}`}</small>
                </div>
                {live && onJoinCall && (
                  <button type="button" className="sp-event__act" onClick={() => onJoinCall(c)} disabled={activeCallId === c.id}>
                    {activeCallId === c.id ? 'You’re in it' : 'Join'}
                  </button>
                )}
              </div>
            );
          }
          const last = it.msgs[it.msgs.length - 1];
          return (
            <div key={it.key} className={clsx('sp-grp', it.right && 'is-right')}>
              {(!it.right || agent) && <span className="sp-sender">{!it.right && <span className="sp-av sm">{initials(it.name)}</span>}{it.name}</span>}
              {it.msgs.map((m) => (
                <React.Fragment key={m.id}>
                  {m.text && <div className="sp-bub">{m.text}</div>}
                  {m.attachments?.map((a, i) =>
                    a.type === 'image' ? (
                      <a key={i} href={a.image_url} target="_blank" rel="noreferrer" className="sp-img"><img src={a.image_url} alt={a.title || 'Attachment'} loading="lazy" /></a>
                    ) : (
                      <a key={i} href={a.asset_url} target="_blank" rel="noreferrer" className="sp-file"><FileText aria-hidden /><span>{a.title}<small>{kb(a.file_size as number)}</small></span></a>
                    ),
                  )}
                </React.Fragment>
              ))}
              <span className="sp-stamp">{clock(timeOf(last))}{last === lastMine && seen ? ' · Seen' : ''}</span>
            </div>
          );
        })}
        {typing.length > 0 && <div className="sp-typing" aria-label={`${typing[0].user?.name || 'Someone'} is typing`}><i /><i /><i /></div>}
      </div>

      <div className="sp-composer">
        {agent && (
          <div className="sp-modes" role="tablist" aria-label="Reply or note">
            <button type="button" role="tab" aria-selected={mode === 'reply'} onClick={() => setMode('reply')}>Reply</button>
            <button type="button" role="tab" aria-selected={mode === 'note'} onClick={() => setMode('note')}>Note</button>
          </div>
        )}
        <div className={clsx('sp-box', mode === 'note' && 'is-note')}>
          {slashMatches.length > 0 && (
            <div className="sp-slash" role="listbox" aria-label="Saved replies">
              {slashMatches.map((c, i) => (
                <button key={c.id} type="button" role="option" aria-selected={i === slashIndex} onMouseDown={(e) => { e.preventDefault(); pickCanned(c); }}>
                  <code>/{c.shortcut}</code><span>{c.title}</span>
                </button>
              ))}
            </div>
          )}
          <TextareaAutosize
            minRows={agent ? 2 : 1}
            maxRows={8}
            value={text}
            placeholder={mode === 'note' ? 'Write a note only staff can see…' : placeholder || 'Write a message…'}
            aria-label={mode === 'note' ? 'Private note' : 'Message'}
            onChange={(e) => { setText(e.target.value); setSlashIndex(0); if (mode === 'reply') channel.keystroke().catch(() => undefined); }}
            onKeyDown={(e) => {
              if (slashMatches.length) {
                if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex((i) => (i + 1) % slashMatches.length); return; }
                if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex((i) => (i - 1 + slashMatches.length) % slashMatches.length); return; }
                if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickCanned(slashMatches[slashIndex]); return; }
              }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            className="sp-input"
          />
          <div className="sp-box__row">
            {mode === 'reply' && (
              <button type="button" className="sp-ib" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Attach a photo or file">
                {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <Paperclip aria-hidden />}
              </button>
            )}
            {agent && mode === 'reply' && <span className="sp-hint">Type <kbd>/</kbd> for saved replies</span>}
            <button type="button" className="sp-send" onClick={send} disabled={!text.trim() || sending}>
              {sending ? <Loader2 className="animate-spin" aria-hidden /> : <ArrowUp aria-hidden />}
              {mode === 'note' ? 'Add note' : 'Send'}
            </button>
          </div>
          <input ref={fileRef} type="file" hidden accept="image/*,.pdf,.doc,.docx,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
        </div>
      </div>
    </div>
  );
};

export default ChatThread;
