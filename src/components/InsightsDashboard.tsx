import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  ArrowDown, ArrowDownRight, ArrowUp, ArrowUpDown, ArrowUpRight, ChevronDown, Download,
  FileJson, FileSpreadsheet, GitCompareArrows, Image as ImageIcon, Trophy, X,
} from 'lucide-react';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { GeneratedPost } from '../types';
import { useToast } from './ui/Toast';
import { useFocusTrap } from '../utils/useFocusTrap';
import { PostChannels, postChannelsKey, readStored } from '../utils/workspaceFeed';
import { FacebookGlyph, InstagramGlyph } from './SocialAccounts';
import {
  COMPARE_METRICS, Day, Platform, PlatformFilter, PLATFORM_NAMES, PostStats,
  combineHistories, comparePosts, dailyHistory, growthCsv, isoDay, periods, postsCsv, postsInPeriod, summarize,
} from '../utils/insightsData';
import './insights.css';
import KwSelect from './ui/kw-select';

// 'year' = since January 1 (mockup "This year"); the numbers are "last N days".
const RANGES = [7, 30, 90, 'year'] as const;
type Range = (typeof RANGES)[number];
const RANGE_LABEL: Record<string, string> = { 7: 'Last 7 days', 30: 'Last 30 days', 90: 'Last 90 days', year: 'This year' };
const dayOfYear = (d: Date) => Math.max(1, Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 864e5) + 1);
type ChartMetric = 'followers' | 'reach' | 'interactions';
type SortKey = 'date' | 'reach' | 'interactions' | 'clicks' | 'engagementRate';

const MAX_COMPARE = 3;
const LETTERS = ['A', 'B', 'C'];
const CHART_METRICS: { key: ChartMetric; label: string }[] = [
  { key: 'followers', label: 'Followers' },
  { key: 'reach', label: 'Reach' },
  { key: 'interactions', label: 'Interactions' },
];
const GLYPHS: Record<Platform, React.FC<{ className?: string }>> = { facebook: FacebookGlyph, instagram: InstagramGlyph };

const num = (n: number) => Math.round(n).toLocaleString('en-PH');
const pct = (n: number) => `${n.toFixed(2)}%`;
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
const span = (ds: Day[]) => `${shortDate(ds[0].date)} – ${shortDate(ds[ds.length - 1].date)}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

function saveFile(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** +6.2% / −1.3 pts pill. `change` is a fraction, or percentage points when `points`. */
const Delta: React.FC<{ change: number; points?: boolean }> = ({ change, points }) => {
  const shown = points ? change : change * 100;
  const flat = Math.abs(shown) < 0.05;
  const Icon = shown > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`in-delta ${flat ? 'is-flat' : shown > 0 ? 'is-up' : 'is-down'}`} title="Compared with the previous period">
      {!flat && <Icon aria-hidden />}
      {flat ? (points ? '0 pts' : '0%') : `${shown > 0 ? '+' : '−'}${Math.abs(shown).toFixed(1)}${points ? ' pts' : '%'}`}
    </span>
  );
};

const Spark: React.FC<{ values: number[] }> = ({ values }) => {
  if (values.length < 2) return <svg className="in-spark" viewBox="0 0 100 30" aria-hidden />;
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const pts = values.map((v, i) => [(i / Math.max(values.length - 1, 1)) * 100, 27 - ((v - min) / range) * 24]);
  const line = pts.map(([x, y]) => `${x},${y}`).join(' ');
  return (
    <svg className="in-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden>
      <polygon points={`0,30 ${line} 100,30`} fill="var(--green-soft)" />
      <polyline points={line} fill="none" stroke="var(--green)" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

/** Day parts for "Best time to post". */
const DAY_PARTS = [
  { name: 'early morning', range: '5–9 AM', from: 5, to: 9 },
  { name: 'late morning', range: '9 AM–12 NN', from: 9, to: 12 },
  { name: 'lunchtime', range: '12–2 PM', from: 12, to: 14 },
  { name: 'afternoon', range: '2–5 PM', from: 14, to: 17 },
  { name: 'early evening', range: '5–8 PM', from: 17, to: 20 },
  { name: 'night', range: '8 PM–12 MN', from: 20, to: 24 },
];

const Thumb: React.FC<{ post: PostStats; className?: string }> = ({ post, className = 'in-thumb' }) => (
  <span className={className}>{post.imageUrl ? <img src={post.imageUrl} alt="" loading="lazy" /> : <ImageIcon aria-hidden />}</span>
);

interface ChartRow { label: string; prevLabel: string; cur: number; prev: number }

const ChartTip: React.FC<{ active?: boolean; payload?: readonly { payload?: ChartRow }[]; metric: string }> = ({ active, payload, metric }) => {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="in-tip">
      <div className="in-tip__row"><span><i className="in-line" />{row.label}</span><b>{num(row.cur)}</b></div>
      <div className="in-tip__row"><span><i className="in-line is-prev" />{row.prevLabel}</span><b>{num(row.prev)}</b></div>
      <div className="in-tip__foot"><span>{metric}</span><Delta change={row.prev ? (row.cur - row.prev) / row.prev : 0} /></div>
    </div>
  );
};

interface DownloadItem {
  title: string;
  desc: string;
  ext: string;
  Icon: React.ElementType;
  file: () => [name: string, body: string, type: string];
}

const DownloadMenu: React.FC<{ caption: string; items: DownloadItem[]; onDone: (name: string) => void }> = ({ caption, items, onDone }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    wrapRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointer = (e: MouseEvent) => !wrapRef.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const moveFocus = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const els: HTMLElement[] = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const i = els.indexOf(document.activeElement as HTMLElement);
    els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus();
  };

  return (
    <div className="in-dl" ref={wrapRef}>
      <button ref={buttonRef} type="button" className="btn btn-outline btn-sm" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Download className="w-3.5 h-3.5" /> Export CSV <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="in-dl__menu" role="menu" aria-label="Download data" onKeyDown={moveFocus}>
          <div className="in-dl__head">{caption}</div>
          {items.map(({ title, desc, ext, Icon, file }) => (
            <button
              key={title}
              type="button"
              role="menuitem"
              className="in-dl__item"
              onClick={() => {
                const [name, body, type] = file();
                saveFile(name, body, type);
                setOpen(false);
                onDone(name);
              }}
            >
              <span className="in-dl__icon"><Icon /></span>
              <span>
                <span className="in-dl__t">{title}</span>
                <span className="in-dl__d">{desc}</span>
              </span>
              <span className="in-dl__ext">{ext}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const CompareDialog: React.FC<{ posts: PostStats[]; caption: string; onClose: () => void }> = ({ posts, caption, onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  useFocusTrap(sheetRef, true);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { best, wins, winner } = comparePosts(posts);
  const letter = (p: PostStats) => LETTERS[posts.indexOf(p)];
  const runnerUp = posts.filter((p) => p !== winner).sort((a, b) => b.engagementRate - a.engagementRate)[0];
  const times = runnerUp.engagementRate ? winner.engagementRate / runnerUp.engagementRate : 1;
  const versus =
    winner.engagementRate === runnerUp.engagementRate
      ? `the same as Post ${letter(runnerUp)}'s, but it reached more people`
      : times >= 1.05
        ? `${times.toFixed(1)}× Post ${letter(runnerUp)}'s`
        : `just ahead of Post ${letter(runnerUp)}'s`;
  const hasScores = posts.some((p) => p.viralityScore != null);

  // Portalled: the page's fade-in animation makes its own stacking context, which would keep
  // the dialog under the sticky header.
  return createPortal(
    <div className="kw-overlay in-overlay" onClick={onClose}>
      <div ref={sheetRef} className="kw-sheet in-cmp" role="dialog" aria-modal="true" aria-labelledby="in-cmp-title" onClick={(e) => e.stopPropagation()}>
        <div className="in-cmp__head">
          <div>
            <h2 id="in-cmp-title">Compare posts</h2>
            <p>{caption}</p>
          </div>
          <button ref={closeRef} type="button" className="in-cmp__close" onClick={onClose} aria-label="Close comparison">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="in-cmp__body">
          <p className="in-verdict">
            <Trophy aria-hidden />
            <span>
              <b>Post {letter(winner)} · “{winner.topic}”</b> was the most effective. Its engagement rate of {pct(winner.engagementRate)} is {versus},
              and it led {wins(winner.id)} of {COMPARE_METRICS.length} metrics.
            </span>
          </p>

          <div className="in-cmp__grid" style={{ '--n': posts.length } as React.CSSProperties}>
            <div className="in-cmp__corner" />
            {posts.map((p, i) => {
              const Glyph = GLYPHS[p.platform];
              return (
                <div key={p.id} className={`in-cmp__post${p === winner ? ' is-winner' : ''}`}>
                  {p === winner && <span className="in-cmp__crown"><Trophy aria-hidden /> Most effective</span>}
                  <Thumb post={p} className="in-cmp__img" />
                  <div>
                    <div className="in-cmp__topic"><span className="in-cmp__letter">{LETTERS[i]}</span>{p.topic}</div>
                    <div className="in-cmp__caption">{p.caption}</div>
                  </div>
                  <div className="in-cmp__meta"><Glyph className="w-3.5 h-3.5" /> {PLATFORM_NAMES[p.platform]} · {shortDate(p.date)}</div>
                </div>
              );
            })}

            {COMPARE_METRICS.map((m) => {
              const isKey = m.key === 'engagementRate';
              const max = Math.max(...posts.map((p) => p[m.key] as number)) || 1;
              return (
                <React.Fragment key={m.key}>
                  <div className={`in-cmp__label${isKey ? ' is-key' : ''}`}>{m.label}</div>
                  {posts.map((p) => {
                    const v = p[m.key] as number;
                    const isBest = best[m.key].includes(p.id);
                    return (
                      <div key={p.id} className={`in-cmp__cell${isBest ? ' is-best' : ''}${isKey ? ' is-key' : ''}`}>
                        <div className="in-cmp__val">
                          {m.percent ? pct(v) : num(v)}
                          {isBest && <span className="in-chip is-top">Best</span>}
                        </div>
                        <div className="in-cmp__bar"><b style={{ width: `${(v / max) * 100}%` }} /></div>
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}

            {hasScores && (
              <>
                <div className="in-cmp__label" title="The score Kawayan's AI predicted when it wrote the post">Predicted (AI)</div>
                {posts.map((p) => (
                  <div key={p.id} className="in-cmp__cell in-cmp__muted">{p.viralityScore != null ? `${p.viralityScore} / 100` : '—'}</div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

const InsightsDashboard: React.FC<{ userId: string }> = ({ userId }) => {
  const toast = useToast();
  const [today] = useState(() => new Date());
  const [range, setRange] = useState<Range>(30);
  const days = range === 'year' ? dayOfYear(today) : range;
  const [filter, setFilter] = useState<PlatformFilter>('all');
  const [metric, setMetric] = useState<ChartMetric>('reach');
  const [posts, setPosts] = useState<GeneratedPost[] | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'date', dir: -1 });
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const closeCompare = useCallback(() => setComparing(false), []);

  useEffect(() => {
    let cancelled = false;
    new UniversalDatabaseService()
      .getUserPosts(userId)
      .then((p) => !cancelled && setPosts(p))
      .catch((e) => {
        console.error('Could not load posts for Insights', e);
        if (!cancelled) setPosts([]); // the examples still let the page demo
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const histories = useMemo(() => {
    const facebook = dailyHistory(userId, 'facebook', today);
    const instagram = dailyHistory(userId, 'instagram', today);
    return { facebook, instagram, all: combineHistories(facebook, instagram) };
  }, [userId, today]);

  const { current, previous } = periods(histories[filter], days);
  const kpis = summarize(current, previous);
  const byPlatform = (['facebook', 'instagram'] as Platform[]).map((platform) => {
    const p = periods(histories[platform], days);
    const [followers, reach] = summarize(p.current, p.previous);
    return { platform, followers, reach };
  });
  const chartData: ChartRow[] = current.map((d, i) => ({
    label: shortDate(d.date),
    prevLabel: shortDate(previous[i].date),
    cur: d[metric],
    prev: previous[i][metric],
  }));

  const rows = useMemo(() => (posts ? postsInPeriod(posts, userId, days, filter, today) : []), [posts, userId, days, filter, today]);
  const sorted = [...rows].sort(
    (a, b) => (sort.key === 'date' ? a.date.localeCompare(b.date) : (a[sort.key] as number) - (b[sort.key] as number)) * sort.dir,
  );
  const topId = rows.length > 1 ? comparePosts(rows).winner.id : null;

  // Avg reach score: the AI scores of the owner's real posts in this period vs the period before.
  const scoreIn = (from: string, to: string) => {
    const scored = (posts || []).filter((p) => p.date >= from && p.date <= to && typeof p.viralityScore === 'number');
    return scored;
  };
  const curFrom = current[0]?.date ?? '', curTo = current[current.length - 1]?.date ?? '';
  const prevFrom = previous[0]?.date ?? '', prevTo = previous[previous.length - 1]?.date ?? '';
  const scoredNow = scoreIn(curFrom, curTo).sort((a, b) => a.date.localeCompare(b.date));
  const scoredPrev = scoreIn(prevFrom, prevTo);
  const avg = (list: GeneratedPost[]) => (list.length ? Math.round(list.reduce((sum, p) => sum + (p.viralityScore || 0), 0) / list.length) : null);
  const avgNow = avg(scoredNow);
  const avgPrev = avg(scoredPrev);

  // Best time to post: the day part whose posts reached the most people on average.
  // Uses the time each post went out (or was scheduled for) on this device; needs 3+ such posts.
  const channels = readStored<PostChannels>(postChannelsKey(userId), {});
  const timed = rows
    .filter((r) => !r.example)
    .map((r) => {
      const post = (posts || []).find((p) => p.id === r.id);
      const iso = post?.publishedAt || channels[r.id]?.at;
      const hour = iso ? new Date(iso).getHours() : null;
      return hour == null || Number.isNaN(hour) ? null : { hour, reach: r.reach };
    })
    .filter((x): x is { hour: number; reach: number } => !!x);
  const bestPart = (() => {
    if (timed.length < 3) return null;
    const scored = DAY_PARTS.map((part) => {
      const inPart = timed.filter((t) => t.hour >= part.from && t.hour < part.to);
      return { part, n: inPart.length, avg: inPart.length ? inPart.reduce((s2, t) => s2 + t.reach, 0) / inPart.length : 0 };
    }).filter((x) => x.n > 0);
    return scored.sort((a, b) => b.avg - a.avg)[0] ?? null;
  })();
  const reachTotals = byPlatform.map(({ platform, reach }) => ({ platform, total: reach.current, change: reach.change }));
  const reachMax = Math.max(...reachTotals.map((r) => r.total), 1);
  const maxRate = Math.max(...rows.map((r) => r.engagementRate), 1);

  // Only posts still on screen count, so switching the period or platform drops the rest.
  const selectedPosts = selected.map((id) => rows.find((r) => r.id === id)).filter((p): p is PostStats => !!p);
  const selectedIds = selectedPosts.map((p) => p.id);
  const toggle = (id: string) =>
    setSelected(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : selectedIds.length < MAX_COMPARE ? [...selectedIds, id] : selectedIds);

  const scopeName = filter === 'all' ? 'Facebook & Instagram' : PLATFORM_NAMES[filter];
  const scope = `${days}d${filter === 'all' ? '' : `-${filter}`}`;
  const stamp = isoDay(today);
  const report = () => ({
    generatedAt: new Date().toISOString(),
    sampleData: true,
    platform: filter,
    period: { days, from: current[0].date, to: current[current.length - 1].date, previousFrom: previous[0].date, previousTo: previous[previous.length - 1].date },
    summary: kpis.map((k) => ({
      metric: k.key,
      label: k.label,
      current: round2(k.current),
      previous: round2(k.previous),
      change: round2(k.points ? k.change : k.change * 100),
      changeUnit: k.points ? 'points' : 'percent',
    })),
    platforms: byPlatform.map(({ platform, followers, reach }) => ({
      platform,
      followers: { current: followers.current, previous: followers.previous },
      reach: { current: reach.current, previous: reach.previous },
    })),
    daily: current.map((d, i) => ({ ...d, previous: previous[i] })),
    posts: rows.map(({ imageUrl: _image, ...p }) => p),
  });
  const downloads: DownloadItem[] = [
    {
      title: 'Post performance',
      desc: 'Each post in this period with its reach, interactions and clicks.',
      ext: 'CSV',
      Icon: FileSpreadsheet,
      file: () => [`kawayan-posts-${scope}-${stamp}.csv`, postsCsv(sorted), 'text/csv;charset=utf-8'],
    },
    {
      title: 'Growth by day',
      desc: 'Daily followers, reach and interactions beside the previous period.',
      ext: 'CSV',
      Icon: FileSpreadsheet,
      file: () => [`kawayan-growth-${scope}-${stamp}.csv`, growthCsv(current, previous), 'text/csv;charset=utf-8'],
    },
    {
      title: 'Full report',
      desc: 'Summary, platforms, daily numbers and posts in one file.',
      ext: 'JSON',
      Icon: FileJson,
      file: () => [`kawayan-insights-${scope}-${stamp}.json`, JSON.stringify(report(), null, 2), 'application/json'],
    },
  ];

  const sortTh = (key: SortKey, label: string, className = '') => {
    const active = sort.key === key;
    const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
    return (
      <th className={className} aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
        <button
          type="button"
          className={`in-sort${active ? ' is-active' : ''}`}
          onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))}
        >
          {label} <Icon aria-hidden />
        </button>
      </th>
    );
  };

  return (
    <div className="in animate-fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-head__title">Insights</h1>
          <p className="page-head__sub">How your pages are growing and which posts work best.</p>
        </div>
        <div className="in-controls">
          <KwSelect aria-label="Date range" size="sm" className="h-9! w-auto! min-w-36" value={String(range)} onValueChange={(v) => setRange((v === 'year' ? 'year' : Number(v)) as Range)} options={RANGES.map((r) => ({ value: String(r), label: RANGE_LABEL[r] }))} />
          <div className="in-seg" role="group" aria-label="Platform">
            <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
            {(['facebook', 'instagram'] as Platform[]).map((p) => {
              const Glyph = GLYPHS[p];
              return (
                <button key={p} type="button" aria-pressed={filter === p} onClick={() => setFilter(p)}>
                  <Glyph className="w-3.5 h-3.5" /> {PLATFORM_NAMES[p]}
                </button>
              );
            })}
          </div>
          <DownloadMenu caption={`${RANGE_LABEL[range]} · ${scopeName}`} items={downloads} onDone={(name) => toast.success(`Downloaded ${name}`)} />
        </div>
      </div>

      <p className="in-note">
        <i aria-hidden />
        <span>Demo data, generated for each account</span>
        <span>{span(current)} vs {span(previous)}</span>
      </p>

      <div className="in-kpis">
        {kpis.filter((k) => k.key !== 'rate').map((k) => (
          <div key={k.key} className="surface in-kpi">
            <div className="in-kpi__top">
              <span className="in-kpi__label">{k.label}</span>
              <Delta change={k.change} points={k.points} />
            </div>
            <div className="in-kpi__value">{k.points ? pct(k.current) : num(k.current)}</div>
            <div className="in-kpi__prev">
              Previous<span className="in-hide-sm"> {days} days</span> <b>{k.points ? pct(k.previous) : num(k.previous)}</b>
            </div>
            <Spark values={current.map((d) => (k.key === 'rate' ? (d.reach ? d.interactions / d.reach : 0) : d[k.key]))} />
          </div>
        ))}
        <div className="surface in-kpi">
          <div className="in-kpi__top">
            <span className="in-kpi__label">Avg reach score</span>
            {avgNow != null && avgPrev != null && (
              <span className={`in-delta ${avgNow > avgPrev ? 'is-up' : avgNow < avgPrev ? 'is-down' : 'is-flat'}`}>
                {avgNow >= avgPrev ? '+' : '−'}{Math.abs(avgNow - avgPrev)}
              </span>
            )}
          </div>
          <div className="in-kpi__value">{avgNow ?? '—'}</div>
          <div className="in-kpi__prev">
            {avgNow == null ? 'No scored posts in this period' : avgPrev != null ? <>Previous<span className="in-hide-sm"> period</span> <b>{avgPrev}</b></> : `From ${scoredNow.length} post${scoredNow.length > 1 ? 's' : ''}`}
          </div>
          <Spark values={scoredNow.map((p) => p.viralityScore || 0)} />
        </div>
      </div>

      <div className="in-grid">
        <section className="surface in-card">
          <div className="in-card__head">
            <div>
              <h2>Daily {CHART_METRICS.find((m) => m.key === metric)!.label.toLowerCase()}</h2>
              <p>{RANGE_LABEL[range]} against the {days} days before.</p>
            </div>
            <div className="in-seg" role="group" aria-label="Chart metric">
              {CHART_METRICS.map((m) => (
                <button key={m.key} type="button" aria-pressed={metric === m.key} onClick={() => setMetric(m.key)}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="in-legend">
            <span><i className="in-line" /> {span(current)}</span>
            <span><i className="in-line is-prev" /> {span(previous)}</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }} tickMargin={8} minTickGap={28} interval="preserveStartEnd" />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={44}
                tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
                tickFormatter={(v: number) => compact.format(v)}
                domain={metric === 'followers' ? ['auto', 'auto'] : [0, 'auto']}
              />
              <Tooltip
                content={(p) => <ChartTip active={p.active} payload={p.payload as any} metric={CHART_METRICS.find((m) => m.key === metric)!.label} />}
                cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
              />
              <Area type="monotone" dataKey="prev" stroke="var(--fg-muted)" strokeWidth={1.5} strokeDasharray="4 4" fill="none" dot={false} activeDot={false} isAnimationActive={false} />
              <Area
                type="monotone"
                dataKey="cur"
                stroke="var(--green)"
                strokeWidth={2}
                fill="var(--green-soft)"
                fillOpacity={1}
                dot={(props: any) =>
                  props.index === chartData.length - 1 ? (
                    <circle key="last" cx={props.cx} cy={props.cy} r={4} fill="var(--green)" stroke="var(--card)" strokeWidth={2} />
                  ) : (
                    <g key={props.index} />
                  )
                }
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)', fill: 'var(--green)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </section>

        <section className="surface in-card">
          <div className="in-card__head">
            <div>
              <h2>By platform</h2>
              <p>Reach, {RANGE_LABEL[range].toLowerCase()}.</p>
            </div>
          </div>
          <div className="in-hbar">
            {reachTotals.map(({ platform, total }) => {
              const Glyph = GLYPHS[platform];
              return (
                <div key={platform} className="in-hbar__row">
                  <span className="in-hbar__name"><Glyph className="w-3.5 h-3.5" /> {PLATFORM_NAMES[platform]}</span>
                  <span className="in-hbar__track" aria-hidden><i style={{ width: `${(total / reachMax) * 100}%` }} /></span>
                  <span className="mono text-right">{compact.format(total)}</span>
                </div>
              );
            })}
          </div>
          <hr className="my-4 border-(--border)" />
          <div className="in-plat">
            {byPlatform.map(({ platform, followers, reach }) => {
              const Glyph = GLYPHS[platform];
              return (
                <div key={platform} className={`in-plat__row${filter === platform ? ' is-active' : ''}`}>
                  <div className="in-plat__name"><Glyph /> {PLATFORM_NAMES[platform]}</div>
                  {[followers, reach].map((k) => (
                    <div key={k.key} className="in-plat__line">
                      <span>{k.label}</span>
                      <span>
                        {num(k.previous)}<span className="in-plat__arrow" aria-label="to">→</span><b>{num(k.current)}</b>
                      </span>
                      <Delta change={k.change} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <hr className="my-4 border-(--border)" />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-(--fg)">Best time to post</span>
            <p className="text-sm text-(--fg-muted)">
              {bestPart
                ? <>Your posts that went out in the <b className="text-(--fg)">{bestPart.part.name} ({bestPart.part.range})</b> reached the most people, about {num(bestPart.avg)} each.</>
                : 'Kawayan suggests a time once at least 3 of your posts in this period have gone out.'}
            </p>
          </div>
        </section>
      </div>

      <section className="surface in-card">
        <div className="in-card__head">
          <div>
            <h2>Post performance</h2>
            <p>
              {posts ? `${rows.length} posts, ${RANGE_LABEL[range].toLowerCase()}.` : 'Loading your posts…'} Tick up to {MAX_COMPARE} to compare them side by side.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-(--fg-muted)">{selectedPosts.length < 2 ? `Pick ${2 - selectedPosts.length} to compare` : `${selectedPosts.length} picked`}</span>
            <button type="button" className="btn btn-outline btn-sm" disabled={selectedPosts.length < 2} onClick={() => setComparing(true)}>
              <GitCompareArrows className="w-3.5 h-3.5" /> Compare
            </button>
          </div>
        </div>
        <div className="in-table-wrap">
          <table className="in-table">
            <thead>
              <tr>
                <th><span className="sr-only">Compare</span></th>
                <th className="is-left">Post</th>
                {sortTh('date', 'Posted', 'in-hide-sm')}
                {sortTh('reach', 'Reach', 'in-hide-sm')}
                {sortTh('interactions', 'Interactions', 'in-hide-sm')}
                {sortTh('clicks', 'Link clicks', 'in-hide-sm in-hide-md')}
                {sortTh('engagementRate', 'Eng. rate')}
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {posts === null
                ? [0, 1, 2].map((i) => (
                    <tr key={i} className="is-locked">
                      <td colSpan={8}><div className="in-skel" /></td>
                    </tr>
                  ))
                : sorted.map((p) => {
                    const isSelected = selectedIds.includes(p.id);
                    const locked = !isSelected && selectedIds.length >= MAX_COMPARE;
                    const Glyph = GLYPHS[p.platform];
                    return (
                      <tr
                        key={p.id}
                        className={isSelected ? 'is-selected' : locked ? 'is-locked' : ''}
                        onClick={(e) => !locked && !(e.target as HTMLElement).closest('input') && toggle(p.id)}
                      >
                        <td>
                          <input
                            type="checkbox"
                            className="in-check"
                            checked={isSelected}
                            disabled={locked}
                            onChange={() => toggle(p.id)}
                            aria-label={`Compare “${p.topic}”`}
                            title={locked ? `You can compare up to ${MAX_COMPARE} posts` : undefined}
                          />
                        </td>
                        <td className="is-left">
                          <div className="in-post">
                            <Thumb post={p} />
                            <div className="in-post__body">
                              <div className="in-post__t">
                                <span>{p.topic}</span>
                                {p.id === topId && <span className="in-chip is-top">Top</span>}
                                {p.example && <span className="in-chip">Example</span>}
                              </div>
                              <div className="in-post__m"><Glyph className="w-3 h-3" /> {PLATFORM_NAMES[p.platform]} · {shortDate(p.date)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="in-hide-sm mono">{shortDate(p.date)}</td>
                        <td className="in-hide-sm">{num(p.reach)}</td>
                        <td className="in-hide-sm">{num(p.interactions)}</td>
                        <td className="in-hide-sm in-hide-md">{num(p.clicks)}</td>
                        <td>
                          <span className="in-rate">
                            <span className="in-rate__bar in-hide-sm"><b style={{ width: `${(p.engagementRate / maxRate) * 100}%` }} /></span>
                            {pct(p.engagementRate)}
                          </span>
                        </td>
                        <td>
                          {p.viralityScore != null ? <span className={`badge mono ${p.viralityScore >= 75 ? 'badge-green' : ''}`}>{p.viralityScore}</span> : <span className="text-(--fg-muted)">—</span>}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </section>

      {selectedPosts.length > 0 && (
        <div className="in-tray" role="region" aria-label="Posts to compare">
          <div className="in-tray__thumbs" aria-hidden>
            {Array.from({ length: MAX_COMPARE }, (_, i) =>
              selectedPosts[i] ? <Thumb key={i} post={selectedPosts[i]} className="" /> : <span key={i} className="is-empty" />,
            )}
          </div>
          <span className="in-tray__msg">
            {selectedPosts.length === 1 ? 'Pick one more' : <>{selectedPosts.length} <span className="in-hide-sm">posts </span>selected</>}
          </span>
          <button type="button" className="btn btn-ghost btn-sm in-tray__clear" onClick={() => setSelected([])}>Clear</button>
          <button type="button" className="btn btn-primary btn-sm" disabled={selectedPosts.length < 2} onClick={() => setComparing(true)}>
            <GitCompareArrows className="w-3.5 h-3.5" /> Compare
          </button>
        </div>
      )}

      {comparing && selectedPosts.length >= 2 && (
        <CompareDialog
          posts={selectedPosts}
          caption={`${scopeName}, ${RANGE_LABEL[range].toLowerCase()}. Engagement rate decides the most effective post.`}
          onClose={closeCompare}
        />
      )}
    </div>
  );
};

export default InsightsDashboard;
