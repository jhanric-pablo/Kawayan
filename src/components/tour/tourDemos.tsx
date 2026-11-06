import React, { useEffect, useState } from 'react';
import { Bell, Check, Send } from 'lucide-react';
import { KawayanMark } from '../KawayanLogo';

/**
 * Small looping previews for the tour card: each one acts out what happens when you use the part
 * the tour is pointing at (a cursor clicks Plan month, the month fills with ideas, and so on).
 * Built from plain markup and the app's colour tokens, so they follow light and dark mode.
 * With reduced motion each one rests on its finished frame.
 */

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Counts 0…n-1, one step every `ms`, then starts over. */
function usePhase(n: number, ms: number) {
  const [p, setP] = useState(() => (reduced() ? n - 1 : 0));
  useEffect(() => {
    if (reduced()) return;
    const t = window.setInterval(() => setP((x) => (x + 1) % n), ms);
    return () => window.clearInterval(t);
  }, [n, ms]);
  return p;
}

const Cursor: React.FC<{ x: number; y: number; down?: boolean }> = ({ x, y, down }) => (
  <span className={`td-cursor${down ? ' is-down' : ''}`} style={{ left: `${x}%`, top: `${y}%` }}>
    <svg viewBox="0 0 24 24"><path d="M4 3l7 18 2.6-7.4L21 11z" /></svg>
  </span>
);

/** A two-week strip of days; `cls(i)` styles day i. */
const Days: React.FC<{ cls?: (i: number) => string; big?: boolean; children?: (i: number) => React.ReactNode }> = ({ cls, big, children }) => (
  <div className={`td-days${big ? ' td-days--big' : ''}`}>
    {Array.from({ length: 14 }, (_, i) => (
      <i key={i} className={cls?.(i)} style={{ transitionDelay: `${i * 35}ms` }}>
        <small>{i + 2}</small>
        {children?.(i)}
      </i>
    ))}
  </div>
);

type Demo = React.FC<{ biz: string }>;

const Welcome: Demo = () => {
  const p = usePhase(4, 1300);
  const on = (z: number) => (p === z || p === 3 ? ' is-hi' : '');
  return (
    <div className="td td-app">
      <div className={`td-app__side${on(2)}`}>
        {[0, 1, 2, 3, 4].map((i) => <i key={i} />)}
        {p === 2 && <b className="td-tag">Your account</b>}
      </div>
      <div className="td-app__main">
        <div className={`td-app__top${on(1)}`}>
          <span className="td-pill">Plan month</span><span className="td-pill td-pill--go">New post</span>
          {p === 1 && <b className="td-tag">Make posts</b>}
        </div>
        <div className={`td-app__grid${on(0)}`}>
          <Days cls={(i) => ([1, 4, 8, 11].includes(i) ? 'has' : '')} />
          {p === 0 && <b className="td-tag">Your calendar</b>}
        </div>
      </div>
    </div>
  );
};

const Views: Demo = () => {
  const p = usePhase(3, 1700);
  return (
    <div className="td">
      <div className="td-seg" style={{ '--i': p } as React.CSSProperties}>
        <span className="td-seg__thumb" />
        {['Month', 'Timeline', 'List'].map((l, i) => <span key={l} className={i === p ? 'on' : ''}>{l}</span>)}
      </div>
      <div className="td-panel">
        {p === 0 && <div className="td-in"><Days cls={(i) => ([0, 3, 5, 8, 10, 12].includes(i) ? 'has' : '')} /></div>}
        {p === 1 && (
          <div className="td-lanes td-in">
            <div><b className="td-logo td-logo--fb">f</b><span style={{ left: '6%' }} /><span style={{ left: '40%' }} /><span style={{ left: '72%' }} /></div>
            <div><b className="td-logo td-logo--ig" /><span style={{ left: '22%' }} /><span style={{ left: '58%' }} /></div>
          </div>
        )}
        {p === 2 && (
          <ul className="td-list td-in">
            {[['Mon 2', 'Pandesal, fresh at 6 AM'], ['Wed 4', 'Ube ensaymada is back'], ['Fri 6', 'Payday promo'], ['Sat 7', 'Weekend pasalubong box']].map(([d, t]) => (
              <li key={d}><span>{d}</span>{t}</li>
            ))}
          </ul>
        )}
      </div>
      <Cursor x={14 + p * 32} y={11} down />
    </div>
  );
};

const STATUS: Record<number, [string, string]> = { 1: ['idea', 'Idea'], 3: ['draft', 'Draft'], 8: ['sched', '7:30'], 10: ['posted', 'Posted'], 5: ['failed', 'Failed'] };
const Grid: Demo = () => {
  const p = usePhase(4, 1150);
  return (
    <div className="td">
      <Days big cls={(i) => (i === 8 && p >= 1 ? 'is-hot' : '')}>
        {(i) => STATUS[i] && <em className={`td-chip td-chip--${STATUS[i][0]}`}>{STATUS[i][1]}</em>}
      </Days>
      {p >= 2 && (
        <div className="td-pop td-in">
          <b>Fri 10 · 7:30 AM</b>
          <span className="td-chip td-chip--sched">Scheduled</span>
          <small>Facebook · Instagram</small>
          <p>Mainit pa ang pandesal! Open na kami 6 AM, kita-kits suki.</p>
        </div>
      )}
      <Cursor x={p === 0 ? 86 : 23} y={p === 0 ? 30 : 74} down={p === 1} />
    </div>
  );
};

const MonthNav: Demo = () => {
  const p = usePhase(5, 1000);
  const dec = p === 2 || p === 3;
  return (
    <div className="td">
      <div className="td-mnav">
        <span className="td-btn">‹</span>
        <span className={`td-btn${dec ? ' is-hot' : ''}${p === 3 ? ' is-down' : ''}`}>{dec ? 'Back to today' : 'Today'}</span>
        <span className={`td-btn${p === 1 ? ' is-down' : ''}`}>›</span>
        <span className="td-month"><span style={{ transform: `translateY(${dec ? -50 : 0}%)` }}><b>November 2026</b><b>December 2026</b></span></span>
      </div>
      <div className="td-panel">
        <Days cls={(i) => ((dec ? [2, 6, 9, 13] : [0, 3, 5, 8, 10, 12]).includes(i) ? 'has' : '')} />
      </div>
      <Cursor x={dec ? 22 : 34} y={13} down={p === 1 || p === 3} />
    </div>
  );
};

const UpNext: Demo = () => {
  const p = usePhase(5, 900);
  const rows: [string, string, string][] = [['go', 'Today · Pandesal post', '6:00 AM'], ['warn', '2 drafts to review', 'This week'], ['bad', '1 post failed', 'Retry']];
  return (
    <div className="td td-stack">
      <b className="td-h">Up next</b>
      {rows.map(([k, t, s], i) => p > i && (
        <div key={t} className={`td-row td-in${p === 4 && i === 2 ? ' is-hot' : ''}`}><i className={`td-dot td-dot--${k}`} /><span>{t}</span><small>{s}</small></div>
      ))}
      <Cursor x={p === 4 ? 84 : 94} y={p === 4 ? 76 : 96} down={p === 4} />
    </div>
  );
};

const Plan: Demo = () => {
  const p = usePhase(5, 1300);
  const ideas = [0, 2, 4, 7, 9, 11];
  return (
    <div className="td">
      <div className="td-bar"><span className={`td-pill${p === 0 ? ' is-down' : ''}`}>Plan month</span><span className="td-pill td-pill--go">New post</span></div>
      <div className="td-panel"><Days cls={(i) => (p >= 3 && ideas.includes(i) ? (p === 4 ? 'has' : 'has is-idea') : '')} /></div>
      {(p === 1 || p === 2) && (
        <div className="td-dialog td-in">
          <b>Plan November</b>
          <small>How many posts?</small>
          <div className="td-chips"><span>1 a week</span><span className="on">2 a week</span><span>Daily</span></div>
          <small>Focus</small>
          <span className="td-field">Payday promo</span>
          <span className={`td-pill td-pill--go td-pill--block${p === 2 ? ' is-down' : ''}`}><KawayanMark size={14} /> Suggest ideas</span>
        </div>
      )}
      {p === 4 && <div className="td-toast td-in"><Check /> 6 drafts made, ready to approve</div>}
      <Cursor x={p === 0 ? 16 : p === 1 ? 40 : p === 2 ? 50 : 70} y={p === 0 ? 12 : p === 1 ? 50 : p === 2 ? 83 : 72} down={p === 0 || p === 2} />
    </div>
  );
};

const Create: Demo = () => {
  const p = usePhase(4, 1550);
  return (
    <div className="td td-stack">
      <div className="td-steps">
        {['Idea', 'Caption', 'Image'].map((s, i) => (
          <span key={s} className={i < p ? 'done' : i === p ? 'on' : ''}><i>{i < p ? <Check /> : i + 1}</i>{s}</span>
        ))}
      </div>
      {p === 0 && <div className="td-in td-stack"><small>What’s the post about?</small><span className="td-field td-type">Weekend ube ensaymada promo</span></div>}
      {p === 1 && (
        <div className="td-in td-stack">
          <p className="td-caption">Weekend na! Ube ensaymada, 3 for ₱120 hanggang Sunday lang.</p>
          <div className="td-chips"><span>Shorter</span><span>More playful</span><span className="on">Reach 82</span></div>
        </div>
      )}
      {p === 2 && <div className="td-in td-imgs"><span className="td-img" /><span className="td-img td-img--b" /><span className="td-img td-img--up">Upload</span></div>}
      {p === 3 && (
        <div className="td-in td-stack">
          <div className="td-chips"><span className="on">Fri 7:30 AM · Best</span><span>Facebook</span><span>Instagram</span></div>
          <div className="td-toast td-toast--inline"><Check /> Scheduled</div>
        </div>
      )}
    </div>
  );
};

const Notifs: Demo = () => {
  const p = usePhase(3, 1500);
  const items: [string, string, string][] = [['go', 'Posted to Facebook', '6:00 AM'], ['bad', 'Instagram post failed', 'Retry'], ['warn', 'Reconnect your Facebook page', 'Expired']];
  return (
    <div className="td">
      <div className="td-bar td-bar--end"><span className={`td-bell${p === 0 ? ' is-down' : ''}`}><Bell /><em>3</em></span></div>
      {p > 0 && (
        <div className="td-drop td-in">
          {items.map(([k, t, s], i) => (
            <div key={t} className="td-row td-in" style={{ animationDelay: `${i * 120}ms` }}><i className={`td-dot td-dot--${k}`} /><span>{t}</span><small>{s}</small></div>
          ))}
        </div>
      )}
      <Cursor x={p === 0 ? 90 : 72} y={p === 0 ? 13 : 58} down={p === 0} />
    </div>
  );
};

const Quota: Demo = () => {
  const p = usePhase(4, 1100);
  const used = [3, 4, 5, 0][p];
  return (
    <div className="td td-center">
      <div className="td-card">
        <div className="td-split"><b>November posts</b><span className="td-mono">{used} / 8</span></div>
        <div className="td-meter"><i style={{ width: `${(used / 8) * 100}%` }} /></div>
        <small>{p === 3 ? 'December 1: back to zero' : 'Resets Dec 1. Drafts count too.'}</small>
      </div>
      <div className="td-chips"><span>Free · 8</span><span>Pro · 16</span><span>Extra · ₱150</span></div>
    </div>
  );
};

const Insights: Demo = () => {
  const p = usePhase(3, 1500);
  const h = [38, 52, 30, 60, 92, 70, 44];
  return (
    <div className="td td-stack">
      <div className="td-kpis">
        <div><small>Reach</small><b>{p === 0 ? '8.1k' : '12.4k'}</b><em>+18%</em></div>
        <div><small>Engagement</small><b>{p === 0 ? '4.2%' : '6.8%'}</b><em>+2.6</em></div>
      </div>
      <div className="td-bars">
        {h.map((v, i) => <span key={i} className={p === 2 && i === 4 ? 'best' : ''} style={{ height: `${p === 0 ? v * 0.35 : v}%` }}><small>{'MTWTFSS'[i]}</small></span>)}
        {p === 2 && <b className="td-tag td-in" style={{ left: '50%', top: 0 }}>Best: Fri 7:30 AM</b>}
      </div>
    </div>
  );
};

const Social: Demo = ({ biz }) => {
  const p = usePhase(5, 1000);
  const fb = p >= 1, ig = p >= 3;
  return (
    <div className="td td-center">
      <div className="td-acct"><b className="td-logo td-logo--fb">f</b><span><b>Facebook Page</b><small>{biz}</small></span><span className={`td-pill${fb ? ' td-pill--ok' : ''}${p === 0 ? ' is-down' : ''}`}>{fb ? <><Check /> Connected</> : 'Connect'}</span></div>
      <div className="td-acct"><b className="td-logo td-logo--ig" /><span><b>Instagram</b><small>Business account</small></span><span className={`td-pill${ig ? ' td-pill--ok' : ''}${p === 2 ? ' is-down' : ''}`}>{ig ? <><Check /> Connected</> : 'Connect'}</span></div>
      {p === 4 && <div className="td-toast td-in"><Send /> Kawayan can post for you now</div>}
      <Cursor x={85} y={p < 2 ? 34 : 56} down={p === 0 || p === 2} />
    </div>
  );
};

const Billing: Demo = () => {
  const p = usePhase(4, 1200);
  return (
    <div className="td td-stack">
      <div className="td-plans">
        <div className={p === 0 ? 'is-cur' : ''}><b>Free</b><small>8 posts a month</small></div>
        <div className={`td-plans__pro${p >= 1 ? ' is-cur' : ''}`}><b>Pro</b><small>16 posts a month</small></div>
      </div>
      <div className="td-card">
        <small>Top up your wallet</small>
        <div className="td-chips">{['GCash', 'Maya', 'Card'].map((m, i) => <span key={m} className={p >= 2 && i === 0 ? 'on' : ''}>{m}</span>)}</div>
        <b className="td-mono">{p === 3 ? '₱150 · 1 extra post' : 'Wallet ₱0'}</b>
      </div>
      <Cursor x={p <= 1 ? 78 : 16} y={p <= 1 ? 22 : 62} down={p === 1 || p === 2} />
    </div>
  );
};

const Voice: Demo = () => {
  const p = usePhase(3, 1700);
  return (
    <div className={`td td-stack${p === 2 ? ' td-dark' : ''}`}>
      <div className="td-card">
        <small>Brand voice</small>
        <div className="td-slider"><span>Formal</span><div><i style={{ left: p === 0 ? '15%' : '80%' }} /></div><span>Playful</span></div>
      </div>
      <p key={p === 0 ? 'a' : 'b'} className="td-caption td-in">{p === 0 ? 'Fresh pandesal is available daily from 6:00 AM.' : 'Mainit pa ang pandesal! Tara na, suki!'}</p>
      <div className="td-seg td-seg--sm" style={{ '--i': p === 2 ? 1 : 0, '--n': 2 } as React.CSSProperties}><span className="td-seg__thumb" /><span className={p < 2 ? 'on' : ''}>Light</span><span className={p === 2 ? 'on' : ''}>Dark</span></div>
    </div>
  );
};

const Help: Demo = () => {
  const p = usePhase(4, 1200);
  return (
    <div className="td td-chat">
      <div className="td-bub td-bub--me">Paano mag-schedule ng post?</div>
      {p === 1 && <div className="td-bub td-typing"><i /><i /><i /></div>}
      {p >= 2 && <div className="td-bub td-in">Open <b>New post</b>, write your idea, then pick a time. Kawayan posts it for you.</div>}
      {p === 3 && <div className="td-chips td-in"><span>Send a ticket</span><span>Request a call</span></div>}
    </div>
  );
};

const Done: Demo = ({ biz }) => {
  const p = usePhase(3, 1200);
  return (
    <div className="td td-center">
      <span className="td-burst">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--a': `${i * 36}deg` } as React.CSSProperties} />)}<b><Check /></b></span>
      <b className="td-h">You’re ready, {biz}</b>
      <Days cls={(i) => (p > 0 && i % 2 === 0 ? 'has' : '')} />
    </div>
  );
};

const DEMOS: Record<string, Demo> = {
  welcome: Welcome, 'calendar-views': Views, 'calendar-grid': Grid, 'month-nav': MonthNav, 'up-next': UpNext,
  'plan-month': Plan, 'create-post': Create, notifications: Notifs, 'posts-used': Quota, 'nav-insights': Insights,
  'nav-social': Social, 'nav-billing': Billing, 'nav-settings': Voice, 'help-button': Help, done: Done,
};

/** The preview for one tour step, by its anchor ('welcome' / 'done' for the two centred steps). */
export const TourDemo: React.FC<{ id: string; biz?: string }> = ({ id, biz }) => {
  const D = DEMOS[id] ?? Welcome;
  return <D biz={biz || 'Your shop'} />;
};
