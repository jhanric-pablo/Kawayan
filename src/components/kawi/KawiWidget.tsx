import React, { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import TextareaAutosize from 'react-textarea-autosize';
import { ArrowUp, BarChart3, CalendarDays, CalendarPlus, Link2, Loader2, MessageSquare, PencilLine, Phone, Settings, ThumbsDown, ThumbsUp, Video, Wallet, X } from 'lucide-react';
import clsx from 'clsx';
import Kawi from '../KawiMascot';
import { askKawi, summarizeKawi, type KawiAction, type KawiTurn } from '../../services/aiService';
import type { KawiHandoff } from '../HelpPanel';
import './kawi.css';

type Mode = KawiHandoff['mode'];
interface Msg { id: number; role: 'user' | 'assistant'; text: string; actions?: KawiAction[]; rated?: 'up' | 'down' }

const CHIPS = ['Bakit hindi lumabas ang post ko?', 'Paano mag-connect ng Facebook Page?', 'Ano ang kasama sa Pro?', 'Paano mag-top up?'];
const ACTION: Record<Exclude<KawiAction, 'talk_to_person'>, { label: string; Icon: React.ElementType }> = {
  open_calendar: { label: 'Open Calendar', Icon: CalendarDays },
  open_planner: { label: 'Open Month planner', Icon: CalendarPlus },
  open_studio: { label: 'Open Post studio', Icon: PencilLine },
  open_channels: { label: 'Open Channels', Icon: Link2 },
  open_billing: { label: 'Open Plan and billing', Icon: Wallet },
  open_settings: { label: 'Open Settings', Icon: Settings },
  open_insights: { label: 'Open Insights', Icon: BarChart3 },
};
const WAYS: [Mode, React.ElementType, string, string][] = [
  ['chat', MessageSquare, 'Chat', 'Type here'],
  ['voice', Phone, 'Voice call', 'Talk it through'],
  ['video', Video, 'Video call', 'Show the screen'],
];
const SEEN_KEY = 'kawayan_kawi_seen';
let nextId = 1;

interface Props {
  /** Short plain-text summary of the owner's plan, pages and posts, so answers are about them. */
  account: string;
  businessName: string;
  /** Hidden while the help panel is open: that's where the live conversation continues. */
  hidden?: boolean;
  onAction: (action: Exclude<KawiAction, 'talk_to_person'>) => void;
  onHandoff: (handoff: Omit<KawiHandoff, 'key'>) => void;
}

/**
 * Kawi, the help bubble on every owner page (same Kawi as the tour). Answers come from the Kawayan fact
 * sheet plus the owner's account; "Talk to a person" hands the conversation, with a summary, to the
 * Help Desk team as a chat, voice call or video call in the help panel.
 */
const KawiWidget: React.FC<Props> = ({ account, businessName, hidden, onAction, onHandoff }) => {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState(false); // the "Talk to a person" card
  const [mode, setMode] = useState<Mode>('chat');
  const [handing, setHanding] = useState(false);
  const [seen, setSeen] = useState(() => { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return true; } });
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    if (!seen) { setSeen(true); try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode */ } }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, seen]);

  // Newest message (or the handoff card) in view.
  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' }); }, [msgs, busy, offer]);

  const turns = (list: Msg[]): KawiTurn[] => list.map((m) => ({ role: m.role, text: m.text }));

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    const mine: Msg = { id: nextId++, role: 'user', text };
    const before = msgs;
    setMsgs([...before, mine]);
    setInput('');
    setBusy(true);
    try {
      const answer = await askKawi(text, turns(before), account);
      setMsgs((m) => [...m, { id: nextId++, role: 'assistant', text: answer.reply, actions: answer.actions.filter((a) => a !== 'talk_to_person') }]);
      if (answer.handoff || answer.actions.includes('talk_to_person')) setOffer(true);
    } catch {
      setMsgs((m) => [...m, { id: nextId++, role: 'assistant', text: 'Hindi ako makasagot ngayon. A person from our team can help you instead.' }]);
      setOffer(true);
    } finally {
      setBusy(false);
    }
  };

  // Two "not helpful" answers in a row: offer a person.
  const rate = (id: number, rated: 'up' | 'down') => {
    const next = msgs.map((m) => (m.id === id ? { ...m, rated } : m));
    setMsgs(next);
    const lastTwo = next.filter((m) => m.role === 'assistant').slice(-2);
    if (rated === 'down' && lastTwo.length === 2 && lastTwo.every((m) => m.rated === 'down')) setOffer(true);
  };

  const connect = async () => {
    if (handing) return;
    setHanding(true);
    const history = turns(msgs);
    const summary = history.length ? await summarizeKawi(history) : null;
    const firstAsk = msgs.find((m) => m.role === 'user')?.text;
    const wants = mode === 'chat' ? 'a chat' : mode === 'voice' ? 'a voice call' : 'a video call';
    const transcript = history.map((t) => `${t.role === 'user' ? 'Owner' : 'Kawi'}: ${t.text}`).join('\n');
    const text = [
      firstAsk || 'I’d like to talk to a person.',
      '',
      `From Kawi · wants ${wants}`,
      summary ? `Summary:\n${summary}` : '',
      transcript ? `Conversation with Kawi:\n${transcript}` : '',
    ].filter(Boolean).join('\n').slice(0, 4800);
    onHandoff({ subject: (firstAsk || 'Help from Kawi').slice(0, 80), text, mode });
    setMsgs((m) => [...m, { id: nextId++, role: 'assistant', text: `Okay! I sent our conversation to the team. ${mode === 'chat' ? 'Continue in Messages.' : 'Your call starts in Messages.'}` }]);
    setOffer(false);
    setHanding(false);
    setOpen(false);
  };

  const act = (a: Exclude<KawiAction, 'talk_to_person'>) => {
    onAction(a);
    if (window.matchMedia('(max-width: 639px)').matches) setOpen(false);
  };

  if (hidden) return null;

  if (!open) {
    return (
      <div className="kw-kawi-launch">
        {!seen && <button type="button" className="kw-kawi-say" onClick={() => setOpen(true)}>Hi! Ako si Kawi. Ask me anything about Kawayan.</button>}
        <button type="button" className="kw-kawi-btn" onClick={() => setOpen(true)} aria-label="Ask Kawi for help">
          <Kawi className="kw-kawi-bot" />
        </button>
      </div>
    );
  }

  return (
    <section className="kw-kawi" role="dialog" aria-label="Kawi help">
      <span className="kw-kawi-hop" aria-hidden><Kawi className="kw-kawi-bot" /></span>
      <header className="kw-kawi-head">
        <div className="min-w-0">
          <b>Kawi</b>
          <small><span className="kw-kawi-dot" aria-hidden />Answers from Kawayan and your account</small>
        </div>
        <button type="button" className="kw-kawi-x" onClick={() => setOpen(false)} aria-label="Close Kawi"><X className="h-4 w-4" aria-hidden /></button>
      </header>

      <div ref={bodyRef} className="kw-kawi-body" aria-live="polite">
        <div className="kw-kawi-m is-bot">Hi! Ako si Kawi. Ask me anything about Kawayan{businessName ? ` and ${businessName}` : ''}: posts, pages, plans or your wallet.</div>
        {msgs.length === 0 && (
          <div className="flex flex-wrap gap-1.5">
            {CHIPS.map((c) => <button key={c} type="button" className="kw-kawi-chip" onClick={() => send(c)}>{c}</button>)}
          </div>
        )}
        {msgs.map((m) => m.role === 'user' ? (
          <div key={m.id} className="kw-kawi-m is-me">{m.text}</div>
        ) : (
          <div key={m.id} className="grid gap-1">
            <div className="kw-kawi-m is-bot">
              <div className="kw-kawi-md"><Markdown>{m.text}</Markdown></div>
              {!!m.actions?.length && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.actions.map((a, i) => {
                    const { label, Icon } = ACTION[a as Exclude<KawiAction, 'talk_to_person'>] ?? {};
                    return label ? (
                      <button key={a} type="button" className={clsx('btn btn-sm', i === 0 ? 'btn-primary' : 'btn-outline')} onClick={() => act(a as Exclude<KawiAction, 'talk_to_person'>)}>
                        <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
                      </button>
                    ) : null;
                  })}
                </div>
              )}
            </div>
            <div className="kw-kawi-rate">
              Helpful?
              <button type="button" aria-label="Helpful" aria-pressed={m.rated === 'up'} onClick={() => rate(m.id, 'up')}><ThumbsUp className="h-3.5 w-3.5" aria-hidden /></button>
              <button type="button" aria-label="Not helpful" aria-pressed={m.rated === 'down'} onClick={() => rate(m.id, 'down')}><ThumbsDown className="h-3.5 w-3.5" aria-hidden /></button>
            </div>
          </div>
        ))}
        {busy && <div className="kw-kawi-m is-bot kw-kawi-typing" aria-label="Kawi is typing"><i /><i /><i /></div>}

        {offer && (
          <div className="kw-kawi-handoff">
            <b>Talk to a person</b>
            <p>Kawi will send our conversation to the team so you don’t have to repeat yourself.</p>
            <div className="kw-kawi-ways" role="radiogroup" aria-label="How to talk">
              {WAYS.map(([k, Icon, label, sub]) => (
                <button key={k} type="button" role="radio" aria-checked={mode === k} className="kw-kawi-way" onClick={() => setMode(k)}>
                  <Icon className="h-4 w-4" aria-hidden />{label}<small>{sub}</small>
                </button>
              ))}
            </div>
            <p className="text-xs">Our team replies in Messages and by email.</p>
            <button type="button" className="btn btn-primary justify-center" onClick={connect} disabled={handing}>
              {handing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} {handing ? 'Connecting…' : 'Connect me'}
            </button>
          </div>
        )}
      </div>

      <footer className="kw-kawi-foot">
        <form className="kw-kawi-compose" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <TextareaAutosize
            ref={inputRef}
            minRows={1}
            maxRows={4}
            value={input}
            maxLength={1000}
            placeholder="Ask Kawi…"
            aria-label="Ask Kawi"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <button type="submit" className="kw-kawi-send" disabled={busy || !input.trim()} aria-label="Send"><ArrowUp className="h-4 w-4" aria-hidden /></button>
        </form>
        {!offer && <p className="kw-kawi-human">Prefer a person? <button type="button" onClick={() => setOffer(true)}>Talk to a person</button></p>}
      </footer>
    </section>
  );
};

export default KawiWidget;
